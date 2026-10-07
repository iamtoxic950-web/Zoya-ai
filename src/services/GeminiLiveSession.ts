import { pcmToWavBase64, base64ToPcm } from '../utils/audio';
import { AssistantState } from '../types';
import { memoryService } from './MemoryService';
import { getAudioContext, unlockAudioContext } from '../utils/sfx';
import { auth } from '../lib/firebase';

type StartupSequenceState = 'IDLE' | 'INITIALIZING' | 'DISPATCHED' | 'PLAYING' | 'COMPLETED';

interface QueuedAudioChunk {
  responseId: number;
  chunkHash: string;
  base64Pcm: string;
}

const MAX_RECONNECT_ATTEMPTS = 3;

// Module-level singletons to guarantee strictly ONE active session, ONE shared output AudioContext,
// ONE active playback node at any time, monotonic session/response IDs, and ONE startup greeting.
let sharedOutputAudioCtx: AudioContext | null = null;
let sharedOutputAnalyser: AnalyserNode | null = null;
const globalActiveSourceNodes: Set<AudioBufferSourceNode> = new Set();
let activeBrowserUtterance: SpeechSynthesisUtterance | null = null;
let globalActiveSessionId = 0;
let globalActiveSessionInstance: GeminiLiveSession | null = null;
let globalPlaybackGeneration = 0;
let globalClientTurnCounter = 0;
let globalStartupSequenceState: StartupSequenceState = 'IDLE';
let hasRegisteredUnloadCleanup = false;

function stopAllGlobalAudioOutput() {
  globalPlaybackGeneration++;
  for (const node of globalActiveSourceNodes) {
    try {
      node.onended = null;
      node.stop();
    } catch (e) {}
    try {
      node.disconnect();
    } catch (e) {}
  }
  globalActiveSourceNodes.clear();

  if (activeBrowserUtterance) {
    try {
      activeBrowserUtterance.onend = null;
      activeBrowserUtterance.onerror = null;
    } catch (e) {}
    activeBrowserUtterance = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
}

function ensureGlobalUnloadCleanupRegistered() {
  if (hasRegisteredUnloadCleanup || typeof window === 'undefined') return;
  hasRegisteredUnloadCleanup = true;

  const handleUnload = () => {
    if (globalActiveSessionInstance) {
      try {
        globalActiveSessionInstance.disconnect();
      } catch (e) {}
      globalActiveSessionInstance = null;
    }
    stopAllGlobalAudioOutput();
  };

  window.addEventListener('pagehide', handleUnload);
  window.addEventListener('beforeunload', handleUnload);
}

export class GeminiLiveSession {
  public readonly sessionId: number;
  private ws: WebSocket | null = null;
  private activeSocketId = 0;
  private connectPromise: Promise<void> | null = null;
  private micRequestPromise: Promise<boolean> | null = null;
  private reconnectAttempts = 0;
  private isReconnecting = false;

  private inputAudioCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  private onStateChange: ((state: AssistantState) => void) | null;
  private onToolCall: ((toolCall: any) => void) | null;
  private onMicStatusChange?: (hasMic: boolean, error?: string | null) => void;
  private onTranscript?: (text: string, isFinal: boolean) => void;
  private onError?: (errorMessage: string) => void;

  private volumeAnalyser: AnalyserNode | null = null;

  // Single authoritative state for this session
  private currentState: AssistantState = 'DISCONNECTED';
  public isMicActive = false;
  public micError: string | null = null;
  public sessionError: string | null = null;
  private isSpeaking = false;
  private isDestroyed = false;

  private lastSpokenAIText = '';
  private recentAITexts: string[] = [];
  private lastAISpeakStartTime = 0;
  private lastAISpeakEndTime = 0;

  // Authoritative response identity & sequential playback queue
  private activeClientTurnId = 0;
  private activePlaybackResponseId: number | null = null;
  private playedResponseIds: Set<number> = new Set();
  private cancelledResponseIds: Set<number> = new Set();
  private audioQueue: QueuedAudioChunk[] = [];
  private enqueuedChunkHashes: Set<string> = new Set();
  private isPlayingQueueChunk = false;
  private nextAudioChunkStartTime = 0;
  private activeScheduledChunkCount = 0;

  private thinkingSafetyTimer: any = null;
  private wsReconnectTimer: any = null;
  private browserSpeechSafetyTimer: any = null;
  private chunkPlaybackSafetyTimer: any = null;

  // Continuous PCM Audio VAD state (no browser SpeechRecognition start/stop beeps)
  private currentUtterancePcmChunks: Float32Array[] = [];
  private isUserCurrentlySpeaking = false;
  private lastSentTurnTime = 0;
  private lastSentText = '';

  constructor(
    onStateChange: (state: AssistantState) => void,
    onToolCall: (toolCall: any) => void,
    onMicStatusChange?: (hasMic: boolean, error?: string | null) => void,
    onTranscript?: (text: string, isFinal: boolean) => void,
    onError?: (errorMessage: string) => void
  ) {
    ensureGlobalUnloadCleanupRegistered();

    // Strictly enforce a single active Live session: clean up any prior instance first
    if (globalActiveSessionInstance && !globalActiveSessionInstance.isDestroyed) {
      try {
        globalActiveSessionInstance.disconnect();
      } catch (e) {}
    }

    stopAllGlobalAudioOutput();
    this.sessionId = ++globalActiveSessionId;
    globalActiveSessionInstance = this;

    this.onStateChange = onStateChange;
    this.onToolCall = onToolCall;
    this.onMicStatusChange = onMicStatusChange;
    this.onTranscript = onTranscript;
    this.onError = onError;
  }

  public isCurrentSession(): boolean {
    return (
      !this.isDestroyed &&
      this.sessionId === globalActiveSessionId &&
      globalActiveSessionInstance === this
    );
  }

  private isSocketOpen(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  private isAwaitingStartupGreeting(): boolean {
    return (
      globalStartupSequenceState === 'INITIALIZING' ||
      globalStartupSequenceState === 'DISPATCHED'
    );
  }

  /**
   * Returns LISTENING if the microphone track is live, or IDLE if microphone is unavailable.
   * Never fakes LISTENING when the microphone stream is dead or denied.
   */
  private getReadyListeningOrIdleState(): AssistantState {
    return this.hasLiveMicTrack() ? 'LISTENING' : 'IDLE';
  }

  /**
   * Single Source of Truth state machine transition method.
   * Prevents impossible/conflicting states and guarantees stale sessions never mutate runtime state.
   */
  private setAuthoritativeState(nextState: AssistantState) {
    if (!this.isCurrentSession()) {
      if (nextState === 'DISCONNECTED') {
        this.currentState = 'DISCONNECTED';
        this.isSpeaking = false;
      }
      return;
    }

    let resolvedState = nextState;

    // Prevent impossible states:
    // 1. Cannot be LISTENING or IDLE while socket is closed/disconnected
    if ((resolvedState === 'LISTENING' || resolvedState === 'IDLE') && !this.isSocketOpen()) {
      if (this.isReconnecting || this.connectPromise) {
        resolvedState = 'CONNECTING';
      } else if (this.currentState === 'ERROR') {
        resolvedState = 'ERROR';
      } else {
        resolvedState = 'CONNECTING';
      }
    }

    // 2. Never fake LISTENING if the microphone stream is not actually live
    if (resolvedState === 'LISTENING' && !this.hasLiveMicTrack()) {
      resolvedState = 'IDLE';
    }

    this.isSpeaking = resolvedState === 'SPEAKING';
    if (this.currentState === resolvedState) return;
    this.currentState = resolvedState;
    this.onStateChange?.(resolvedState);
  }

  public hasLiveMicTrack(): boolean {
    if (!this.stream) return false;
    const tracks = this.stream.getAudioTracks();
    return tracks.length > 0 && tracks.some(t => t.readyState === 'live' && t.enabled);
  }

  public initialize() {
    if (!this.isCurrentSession()) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!this.inputAudioCtx || this.inputAudioCtx.state === 'closed') {
      try {
        this.inputAudioCtx = new AudioContextClass({ sampleRate: 16000 });
      } catch {
        try {
          this.inputAudioCtx = new AudioContextClass();
        } catch {
          this.inputAudioCtx = null;
        }
      }
    }
    if (this.inputAudioCtx && this.inputAudioCtx.state === 'suspended') {
      this.inputAudioCtx.resume().catch(() => {});
    }

    this.ensureOutputAudioGraph();
  }

  private ensureOutputAudioGraph(): boolean {
    if (!this.isCurrentSession()) return false;
    const sharedCtx = getAudioContext();
    if (!sharedCtx) return false;

    if (sharedOutputAudioCtx !== sharedCtx || sharedOutputAudioCtx.state === 'closed') {
      sharedOutputAudioCtx = sharedCtx;
      sharedOutputAnalyser = null;
    }
    if (sharedOutputAudioCtx.state === 'suspended') {
      sharedOutputAudioCtx.resume().catch(() => {});
    }
    if (!sharedOutputAnalyser && sharedOutputAudioCtx && sharedOutputAudioCtx.state !== 'closed') {
      try {
        sharedOutputAnalyser = sharedOutputAudioCtx.createAnalyser();
        sharedOutputAnalyser.fftSize = 512;
        sharedOutputAnalyser.smoothingTimeConstant = 0.15;
        sharedOutputAnalyser.connect(sharedOutputAudioCtx.destination);
      } catch {
        sharedOutputAnalyser = null;
        return false;
      }
    }
    return Boolean(sharedOutputAudioCtx && sharedOutputAnalyser);
  }

  public getAnalyser() {
    return this.volumeAnalyser;
  }

  public getOutputAnalyser() {
    return sharedOutputAnalyser;
  }

  private startThinkingSafetyWatchdog() {
    if (this.thinkingSafetyTimer) {
      clearTimeout(this.thinkingSafetyTimer);
    }
    const expectedSessionId = this.sessionId;
    this.thinkingSafetyTimer = setTimeout(() => {
      this.thinkingSafetyTimer = null;
      if (!this.isCurrentSession() || this.sessionId !== expectedSessionId) return;
      if (!this.isSpeaking) {
        if (this.isAwaitingStartupGreeting()) {
          globalStartupSequenceState = 'COMPLETED';
        }
        if (this.isSocketOpen()) {
          this.setAuthoritativeState(this.getReadyListeningOrIdleState());
        }
      }
    }, 12000);
  }

  private clearThinkingSafetyWatchdog() {
    if (this.thinkingSafetyTimer) {
      clearTimeout(this.thinkingSafetyTimer);
      this.thinkingSafetyTimer = null;
    }
  }

  /**
   * Handles runtime microphone failure or disconnection:
   * stops invalid mic resources, resets false listening state to IDLE, and notifies UI for retry.
   */
  private handleMicrophoneFailure(reason: string) {
    if (!this.isCurrentSession()) return;
    this.micError = reason;
    this.isMicActive = false;
    this.cleanupMicrophoneNodes();
    this.onMicStatusChange?.(false, this.micError);

    if (this.currentState === 'LISTENING') {
      this.setAuthoritativeState(this.isSocketOpen() ? 'IDLE' : 'CONNECTING');
    }
  }

  public async requestMicrophoneAccess(): Promise<boolean> {
    if (!this.isCurrentSession()) return false;

    // Prevent concurrent microphone acquisition calls from creating duplicate streams
    if (this.micRequestPromise) {
      return this.micRequestPromise;
    }

    const expectedSessionId = this.sessionId;
    this.micRequestPromise = (async () => {
      try {
        if (!this.isCurrentSession() || this.sessionId !== expectedSessionId) return false;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          this.handleMicrophoneFailure('Microphone API not supported in this browser');
          return false;
        }

        this.initialize();
        if (this.inputAudioCtx && this.inputAudioCtx.state === 'suspended') {
          await this.inputAudioCtx.resume().catch(() => {});
        }

        if (!this.isCurrentSession() || this.sessionId !== expectedSessionId) return false;

        // Reuse existing live microphone stream if already active and healthy
        if (this.hasLiveMicTrack() && this.source && this.processor) {
          this.isMicActive = true;
          this.micError = null;
          this.onMicStatusChange?.(true, null);
          if (this.isSocketOpen() && !this.isSpeaking && this.currentState === 'IDLE') {
            this.setAuthoritativeState('LISTENING');
          }
          return true;
        }

        // Clean up any dead/previous microphone resources before requesting a new stream
        this.cleanupMicrophoneNodes();

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
          }
        });

        // If session ended or was replaced while awaiting getUserMedia, release tracks immediately
        if (!this.isCurrentSession() || this.sessionId !== expectedSessionId) {
          stream.getTracks().forEach(t => {
            t.onended = null;
            t.stop();
          });
          return false;
        }

        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0 || audioTracks.every(t => t.readyState !== 'live')) {
          stream.getTracks().forEach(t => {
            t.onended = null;
            t.stop();
          });
          this.handleMicrophoneFailure('Microphone track unavailable. Click ENABLE MIC to retry.');
          return false;
        }

        audioTracks.forEach(track => {
          track.enabled = true;
          track.onended = () => {
            if (!this.isCurrentSession() || this.sessionId !== expectedSessionId) return;
            if (!this.hasLiveMicTrack()) {
              this.handleMicrophoneFailure('Microphone disconnected. Click ENABLE MIC to reconnect.');
            }
          };
        });

        this.stream = stream;
        this.isMicActive = true;
        this.micError = null;

        if (this.inputAudioCtx) {
          this.source = this.inputAudioCtx.createMediaStreamSource(this.stream);
          this.volumeAnalyser = this.inputAudioCtx.createAnalyser();
          this.volumeAnalyser.fftSize = 256;
          this.volumeAnalyser.smoothingTimeConstant = 0.2;
          this.source.connect(this.volumeAnalyser);

          this.setupAudioProcessor();
        }

        this.onMicStatusChange?.(true, null);

        // If the session was waiting in IDLE due to previous mic failure, transition cleanly to LISTENING
        if (this.isSocketOpen() && !this.isSpeaking && !this.isAwaitingStartupGreeting() && this.currentState === 'IDLE') {
          this.setAuthoritativeState('LISTENING');
        }
        return true;
      } catch (err: any) {
        if (!this.isCurrentSession() || this.sessionId !== expectedSessionId) return false;
        console.warn('Microphone acquisition notice:', err);
        const isDenied =
          err.name === 'NotAllowedError' ||
          err.name === 'PermissionDeniedError' ||
          err.message?.includes('denied');
        const reason = isDenied
          ? 'Microphone permission denied. Click ENABLE MIC to retry.'
          : err.message || 'Microphone unavailable. Click ENABLE MIC to retry.';
        this.handleMicrophoneFailure(reason);
        return false;
      } finally {
        this.micRequestPromise = null;
      }
    })();

    return this.micRequestPromise;
  }

  private cleanupAudioProcessorNodes() {
    if (this.processor) {
      try {
        this.processor.onaudioprocess = null;
        this.processor.disconnect();
      } catch (e) {}
      this.processor = null;
    }
    if (this.silentGain) {
      try {
        this.silentGain.disconnect();
      } catch (e) {}
      this.silentGain = null;
    }
  }

  private cleanupMicrophoneNodes() {
    this.cleanupAudioProcessorNodes();
    if (this.volumeAnalyser) {
      try {
        this.volumeAnalyser.disconnect();
      } catch (e) {}
      this.volumeAnalyser = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {}
      this.source = null;
    }
    if (this.stream) {
      try {
        this.stream.getTracks().forEach(t => {
          t.onended = null;
          t.stop();
        });
      } catch (e) {}
      this.stream = null;
    }
    this.isMicActive = false;
  }

  private normalizeForEchoCheck(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private recordAISpokenText(text: string) {
    const clean = text.trim();
    if (!clean) return;
    this.lastSpokenAIText = clean;
    this.recentAITexts.unshift(clean);
    if (this.recentAITexts.length > 8) {
      this.recentAITexts.pop();
    }
  }

  private resetCurrentUtteranceCapture() {
    this.currentUtterancePcmChunks = [];
    this.isUserCurrentlySpeaking = false;
  }

  /**
   * Immediately stops active audio, flushes the response audio queue, marks the interrupted
   * response as cancelled/stale, and prepares to process the new user input.
   */
  public interruptSpeech() {
    if (!this.isCurrentSession()) return;
    const wasPlaying =
      this.isSpeaking ||
      globalActiveSourceNodes.size > 0 ||
      this.audioQueue.length > 0 ||
      this.isPlayingQueueChunk ||
      (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking);

    if (this.activePlaybackResponseId !== null) {
      this.cancelledResponseIds.add(this.activePlaybackResponseId);
    }
    if (this.activeClientTurnId > 0) {
      this.cancelledResponseIds.add(this.activeClientTurnId);
    }

    if (globalStartupSequenceState !== 'IDLE') {
      globalStartupSequenceState = 'COMPLETED';
    }

    this.stopCurrentAudioPlayback();
    this.lastAISpeakEndTime = Date.now() - 400;

    // Advance authoritative turn ID so any delayed audio from the interrupted response is ignored
    this.activeClientTurnId = ++globalClientTurnCounter;
    this.resetCurrentUtteranceCapture();

    if (wasPlaying) {
      this.setAuthoritativeState('INTERRUPTED');
      if (this.isSocketOpen()) {
        this.ws!.send(
          JSON.stringify({
            type: 'INTERRUPT',
            clientTurnId: this.activeClientTurnId
          })
        );
      }
    }

    if (this.isSocketOpen()) {
      this.setAuthoritativeState(this.getReadyListeningOrIdleState());
    }
  }

  /**
   * Continuous Web Audio API microphone capture pipeline.
   * Keeps the microphone stream open once for the entire session (zero OS/browser start/stop beeps)
   * and dispatches complete 16kHz WAV utterances to the Gemini Live WebSocket.
   */
  private setupAudioProcessor() {
    this.cleanupAudioProcessorNodes();
    if (!this.isCurrentSession() || !this.inputAudioCtx || !this.source) return;

    const expectedSessionId = this.sessionId;
    const processor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);
    const silentGain = this.inputAudioCtx.createGain();
    silentGain.gain.value = 0;

    this.processor = processor;
    this.silentGain = silentGain;

    this.source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(this.inputAudioCtx.destination);

    const PRE_ROLL_MAX_FRAMES = 8;
    const preRollBuffer: Float32Array[] = [];
    let silenceDurationMs = 0;
    let activeSpeechDurationMs = 0;
    let totalUtteranceDurationMs = 0;
    let consecutiveVoiceFrames = 0;
    let bargeInFrames = 0;

    const END_OF_SPEECH_SILENCE_MS = 620;
    const MAX_UTTERANCE_DURATION_MS = 12000;
    const VAD_VOICE_BINS_START = 2;
    const VAD_VOICE_BINS_END = 48;

    processor.onaudioprocess = (e) => {
      if (
        !this.isCurrentSession() ||
        this.sessionId !== expectedSessionId ||
        this.processor !== processor ||
        !this.hasLiveMicTrack()
      ) {
        return;
      }

      // Do not process mic input into a second automatic turn while startup greeting is still initializing/dispatched
      if (this.isAwaitingStartupGreeting() || !this.isSocketOpen()) {
        this.currentUtterancePcmChunks = [];
        this.isUserCurrentlySpeaking = false;
        silenceDurationMs = 0;
        activeSpeechDurationMs = 0;
        totalUtteranceDurationMs = 0;
        consecutiveVoiceFrames = 0;
        bargeInFrames = 0;
        return;
      }

      const sampleRate = this.inputAudioCtx?.sampleRate || 16000;
      const inputData = e.inputBuffer.getChannelData(0);
      const frameDurationMs = (inputData.length / sampleRate) * 1000;
      const frameCopy = new Float32Array(inputData);

      let sumSquares = 0;
      for (let i = 0; i < inputData.length; i++) {
        sumSquares += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sumSquares / inputData.length);

      let avgVoiceEnergy = 0;
      if (this.volumeAnalyser) {
        const dataArray = new Uint8Array(this.volumeAnalyser.frequencyBinCount);
        this.volumeAnalyser.getByteFrequencyData(dataArray);
        let voiceEnergy = 0;
        for (let i = VAD_VOICE_BINS_START; i <= VAD_VOICE_BINS_END; i++) {
          voiceEnergy += dataArray[i];
        }
        avgVoiceEnergy = voiceEnergy / (VAD_VOICE_BINS_END - VAD_VOICE_BINS_START + 1);
      }

      let avgOutputEnergy = 0;
      if (this.isSpeaking && sharedOutputAnalyser) {
        const outArray = new Uint8Array(sharedOutputAnalyser.frequencyBinCount);
        sharedOutputAnalyser.getByteFrequencyData(outArray);
        let outSum = 0;
        for (let i = 2; i <= 60; i++) {
          outSum += outArray[i];
        }
        avgOutputEnergy = outSum / 59;
      }

      preRollBuffer.push(frameCopy);
      if (preRollBuffer.length > PRE_ROLL_MAX_FRAMES) {
        preRollBuffer.shift();
      }

      // Voice interruption (barge-in) while Zoya is speaking
      if (this.isSpeaking) {
        const speakingElapsed = Date.now() - this.lastAISpeakStartTime;
        const isBargeInVoice =
          speakingElapsed > 480 &&
          ((avgOutputEnergy < 25 && (rms > 0.032 || avgVoiceEnergy > 45)) ||
            (rms > 0.082 && avgVoiceEnergy > Math.max(72, avgOutputEnergy * 0.95)));

        if (isBargeInVoice) {
          bargeInFrames++;
          if (bargeInFrames >= 4) {
            bargeInFrames = 0;
            this.interruptSpeech();
            this.isUserCurrentlySpeaking = true;
            this.currentUtterancePcmChunks = [...preRollBuffer];
            silenceDurationMs = 0;
            activeSpeechDurationMs = frameDurationMs * preRollBuffer.length;
            totalUtteranceDurationMs = activeSpeechDurationMs;
          }
        } else {
          bargeInFrames = Math.max(0, bargeInFrames - 1);
        }
        return;
      }

      bargeInFrames = 0;

      // Brief echo-decay window immediately after Zoya finishes speaking
      if (Date.now() - this.lastAISpeakEndTime < 350) {
        this.currentUtterancePcmChunks = [];
        this.isUserCurrentlySpeaking = false;
        silenceDurationMs = 0;
        activeSpeechDurationMs = 0;
        totalUtteranceDurationMs = 0;
        consecutiveVoiceFrames = 0;
        return;
      }

      const isVoiceFrame = rms > 0.011 || avgVoiceEnergy > 21;

      if (isVoiceFrame) {
        consecutiveVoiceFrames++;
        silenceDurationMs = 0;

        if (!this.isUserCurrentlySpeaking && consecutiveVoiceFrames >= 2) {
          this.isUserCurrentlySpeaking = true;
          activeSpeechDurationMs = frameDurationMs * 2;
          totalUtteranceDurationMs = frameDurationMs * preRollBuffer.length;
          this.currentUtterancePcmChunks = [...preRollBuffer];
          this.setAuthoritativeState('LISTENING');
        } else if (this.isUserCurrentlySpeaking) {
          this.currentUtterancePcmChunks.push(frameCopy);
          activeSpeechDurationMs += frameDurationMs;
          totalUtteranceDurationMs += frameDurationMs;
        }
      } else {
        consecutiveVoiceFrames = 0;

        if (this.isUserCurrentlySpeaking) {
          silenceDurationMs += frameDurationMs;
          totalUtteranceDurationMs += frameDurationMs;
          this.currentUtterancePcmChunks.push(frameCopy);
        }
      }

      // Commit utterance when natural end-of-speech silence or max utterance duration is reached
      if (
        this.isUserCurrentlySpeaking &&
        (silenceDurationMs >= END_OF_SPEECH_SILENCE_MS ||
          totalUtteranceDurationMs >= MAX_UTTERANCE_DURATION_MS)
      ) {
        this.isUserCurrentlySpeaking = false;
        const chunksToSend = this.currentUtterancePcmChunks;
        this.currentUtterancePcmChunks = [];
        const capturedSpeechMs = activeSpeechDurationMs;
        silenceDurationMs = 0;
        activeSpeechDurationMs = 0;
        totalUtteranceDurationMs = 0;

        if (capturedSpeechMs >= 140 && Date.now() - this.lastSentTurnTime > 450) {
          let totalLength = 0;
          for (const chunk of chunksToSend) {
            totalLength += chunk.length;
          }
          const minSamples = Math.floor(sampleRate * 0.18);
          if (totalLength >= minSamples) {
            const combinedChunk = new Float32Array(totalLength);
            let offset = 0;
            for (const chunk of chunksToSend) {
              combinedChunk.set(chunk, offset);
              offset += chunk.length;
            }
            const wavBase64 = pcmToWavBase64(combinedChunk, sampleRate);
            this.dispatchAudioWavTurn(wavBase64);
          }
        }
      }
    };
  }

  private dispatchAudioWavTurn(wavBase64: string) {
    if (!this.isCurrentSession() || !wavBase64 || wavBase64.length < 200 || this.isAwaitingStartupGreeting()) return;

    this.lastSentTurnTime = Date.now();
    this.resetCurrentUtteranceCapture();

    if (this.activeClientTurnId > 0) {
      this.cancelledResponseIds.add(this.activeClientTurnId);
    }
    const turnId = ++globalClientTurnCounter;
    this.activeClientTurnId = turnId;

    this.setAuthoritativeState('THINKING');
    this.startThinkingSafetyWatchdog();

    if (this.isSocketOpen()) {
      this.ws!.send(
        JSON.stringify({
          audioWav: wavBase64,
          clientTurnId: turnId,
          clientTime: new Date().toLocaleString()
        })
      );
    } else {
      this.handleUnexpectedDisconnectAndReconnect();
    }
  }

  private cleanupWebSocket() {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    this.isReconnecting = false;
    this.activeSocketId++;
    if (this.ws) {
      const oldWs = this.ws;
      this.ws = null;
      try {
        oldWs.onopen = null;
        oldWs.onmessage = null;
        oldWs.onclose = null;
        oldWs.onerror = null;
        if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
          oldWs.close();
        }
      } catch (e) {}
    }
  }

  private failSessionWithError(errorMessage = 'Live connection interrupted. Click RETRY to reconnect.') {
    if (!this.isCurrentSession()) return;
    this.sessionError = errorMessage;
    this.clearThinkingSafetyWatchdog();
    this.resetCurrentUtteranceCapture();
    this.stopCurrentAudioPlayback();
    this.cleanupMicrophoneNodes();
    this.cleanupWebSocket();
    this.onMicStatusChange?.(false, this.micError);
    this.onError?.(errorMessage);
    this.setAuthoritativeState('ERROR');
  }

  /**
   * Safe automatic reconnection handler with exponential backoff and loop prevention.
   * Cleans up stale turn/audio state before re-establishing connection.
   */
  private handleUnexpectedDisconnectAndReconnect() {
    if (!this.isCurrentSession() || this.isDestroyed) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.isReconnecting || this.wsReconnectTimer) {
      return;
    }

    // Cancel any in-flight response or audio from the broken connection
    if (this.activePlaybackResponseId !== null) {
      this.cancelledResponseIds.add(this.activePlaybackResponseId);
    }
    if (this.activeClientTurnId > 0) {
      this.cancelledResponseIds.add(this.activeClientTurnId);
    }
    this.stopCurrentAudioPlayback();
    this.resetCurrentUtteranceCapture();
    this.clearThinkingSafetyWatchdog();
    this.cleanupWebSocket();

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.failSessionWithError('Connection lost. Click RETRY to reconnect.');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts += 1;
    this.setAuthoritativeState('CONNECTING');

    const expectedSessionId = this.sessionId;
    const delayMs = Math.round(900 * Math.pow(1.5, this.reconnectAttempts - 1));
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      this.isReconnecting = false;
      if (!this.isCurrentSession() || this.sessionId !== expectedSessionId || this.isDestroyed) {
        return;
      }
      this.openWebSocketConnection().catch(() => {});
    }, delayMs);
  }

  private openWebSocketConnection(): Promise<void> {
    this.cleanupWebSocket();
    if (!this.isCurrentSession()) return Promise.resolve();

    const expectedSessionId = this.sessionId;
    const socketId = ++this.activeSocketId;

    return new Promise<void>((resolve) => {
      let isSettled = false;
      const settle = () => {
        if (!isSettled) {
          isSettled = true;
          resolve();
        }
      };

      try {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${location.host}/live`);
        this.ws = ws;

        ws.onopen = () => {
          if (
            !this.isCurrentSession() ||
            this.sessionId !== expectedSessionId ||
            this.activeSocketId !== socketId ||
            this.ws !== ws
          ) {
            try {
              ws.onopen = null;
              ws.onmessage = null;
              ws.onclose = null;
              ws.onerror = null;
              ws.close();
            } catch (e) {}
            settle();
            return;
          }

          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          this.sessionError = null;

          if (ws.readyState === WebSocket.OPEN) {
            // Send Firebase ID token authentication message
            const currentUser = auth.currentUser;
            if (currentUser) {
              currentUser.getIdToken().then((token) => {
                if (this.ws === ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'auth', token }));
                }
              }).catch((e) => console.warn('[GeminiLiveSession] Token fetch error:', e));
            }

            const cachedMemories = memoryService.getMemoriesList();
            if (cachedMemories.length > 0) {
              ws.send(
                JSON.stringify({
                  type: 'SYNC_MEMORIES',
                  memories: cachedMemories
                })
              );
            }

            // Explicit startup sequence state guard: executes strictly once per intentional startup
            if (
              globalStartupSequenceState === 'IDLE' ||
              globalStartupSequenceState === 'INITIALIZING'
            ) {
              globalStartupSequenceState = 'DISPATCHED';
              const startupTurnId = ++globalClientTurnCounter;
              this.activeClientTurnId = startupTurnId;
              this.startThinkingSafetyWatchdog();
              ws.send(
                JSON.stringify({
                  textPrompt: 'System initialized. Say your startup sequence.',
                  clientTurnId: startupTurnId,
                  clientTime: new Date().toLocaleString()
                })
              );
            } else if (!this.isSpeaking) {
              this.setAuthoritativeState(this.getReadyListeningOrIdleState());
            }
          }

          memoryService
            .loadAllMemories()
            .then((memories) => {
              if (
                this.isCurrentSession() &&
                this.sessionId === expectedSessionId &&
                this.activeSocketId === socketId &&
                this.ws === ws &&
                ws.readyState === WebSocket.OPEN &&
                memories.length > 0
              ) {
                ws.send(
                  JSON.stringify({
                    type: 'SYNC_MEMORIES',
                    memories: memories.map(m => m.content)
                  })
                );
              }
            })
            .catch(() => {});

          settle();
        };

        ws.onmessage = (event) => {
          if (
            !this.isCurrentSession() ||
            this.sessionId !== expectedSessionId ||
            this.activeSocketId !== socketId ||
            this.ws !== ws
          ) {
            return;
          }

          try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'AUTH_SUCCESS') {
              console.log('[WebSocket] Successfully authenticated with backend user:', msg.uid);
              return;
            }

            if (msg.type === 'AUTH_ERROR') {
              console.warn('[WebSocket] Authentication error from backend:', msg.error);
              return;
            }

            // Stale response protection: reject any message from an older or cancelled response ID
            if (typeof msg.turnId === 'number') {
              if (msg.turnId !== this.activeClientTurnId || this.cancelledResponseIds.has(msg.turnId)) {
                return;
              }
            }

            this.clearThinkingSafetyWatchdog();

            if (msg.error) {
              console.warn('Server message warning:', msg.error);
              if (this.isAwaitingStartupGreeting()) {
                globalStartupSequenceState = 'COMPLETED';
              }
              if (!this.isSpeaking && this.isSocketOpen()) {
                this.setAuthoritativeState(this.getReadyListeningOrIdleState());
              }
              return;
            }

            if (msg.userTranscript) {
              this.onTranscript?.(msg.userTranscript, true);
            }

            if (msg.silentTurn) {
              if (this.isAwaitingStartupGreeting()) {
                globalStartupSequenceState = 'COMPLETED';
              }
              if (!this.isSpeaking && this.isSocketOpen()) {
                this.setAuthoritativeState(this.getReadyListeningOrIdleState());
              }
              return;
            }

            if (msg.interrupted) {
              this.stopCurrentAudioPlayback();
              if (this.isSocketOpen()) {
                this.setAuthoritativeState(this.getReadyListeningOrIdleState());
              }
              return;
            }

            const responseId = typeof msg.turnId === 'number' ? msg.turnId : this.activeClientTurnId;
            if (this.playedResponseIds.has(responseId) || this.cancelledResponseIds.has(responseId)) {
              return;
            }

            // Authoritative single audio output path per response
            if (msg.audio) {
              this.playedResponseIds.add(responseId);
              if (this.isAwaitingStartupGreeting()) {
                globalStartupSequenceState = 'PLAYING';
              }

              if (msg.transcript) {
                this.recordAISpokenText(msg.transcript);
                this.onTranscript?.(msg.transcript, true);
              }

              this.enqueueResponseAudioChunk(responseId, msg.audio);
            } else if (msg.useBrowserSpeech && msg.text) {
              this.playedResponseIds.add(responseId);
              if (this.isAwaitingStartupGreeting()) {
                globalStartupSequenceState = 'PLAYING';
              }

              this.stopCurrentAudioPlayback();
              this.activePlaybackResponseId = responseId;
              this.recordAISpokenText(msg.text);
              this.onTranscript?.(msg.text, true);

              const currentGen = globalPlaybackGeneration;
              this.setAuthoritativeState('SPEAKING');
              this.lastAISpeakStartTime = Date.now();
              this.resetCurrentUtteranceCapture();

              this.speakBrowserText(msg.text, () => {
                if (
                  !this.isCurrentSession() ||
                  this.sessionId !== expectedSessionId ||
                  globalPlaybackGeneration !== currentGen ||
                  this.cancelledResponseIds.has(responseId)
                ) {
                  return;
                }
                if (globalStartupSequenceState === 'PLAYING') {
                  globalStartupSequenceState = 'COMPLETED';
                }
                this.activePlaybackResponseId = null;
                this.lastAISpeakEndTime = Date.now();
                if (this.isSocketOpen()) {
                  this.setAuthoritativeState(this.getReadyListeningOrIdleState());
                }
              });
            } else if (msg.transcriptOnly && msg.text) {
              this.onTranscript?.(msg.text, true);
            }

            if (msg.toolCall) {
              this.onToolCall?.(msg.toolCall);
            }
          } catch (e) {
            console.error('Error handling message from AI server:', e);
          }
        };

        ws.onclose = () => {
          settle();
          if (
            this.isCurrentSession() &&
            this.sessionId === expectedSessionId &&
            this.activeSocketId === socketId &&
            this.ws === ws &&
            !this.isDestroyed
          ) {
            this.ws = null;
            this.handleUnexpectedDisconnectAndReconnect();
          }
        };

        ws.onerror = () => {
          settle();
        };
      } catch (err: any) {
        if (this.isAwaitingStartupGreeting()) {
          globalStartupSequenceState = 'COMPLETED';
        }
        settle();
        if (this.isCurrentSession() && this.sessionId === expectedSessionId) {
          this.handleUnexpectedDisconnectAndReconnect();
        }
      }
    });
  }

  async connect(): Promise<void> {
    if (!this.isCurrentSession()) return;

    // Prevent multiple connect() calls from running simultaneously on the same session
    if (this.connectPromise) {
      return this.connectPromise;
    }

    const expectedSessionId = this.sessionId;
    this.connectPromise = (async () => {
      try {
        if (!this.isCurrentSession() || this.sessionId !== expectedSessionId) return;

        if (globalStartupSequenceState === 'IDLE') {
          globalStartupSequenceState = 'INITIALIZING';
        }
        this.sessionError = null;
        this.reconnectAttempts = 0;
        this.setAuthoritativeState('CONNECTING');
        this.initialize();

        await unlockAudioContext();
        if (!this.isCurrentSession() || this.sessionId !== expectedSessionId) return;

        await this.requestMicrophoneAccess().catch(() => {});
        if (!this.isCurrentSession() || this.sessionId !== expectedSessionId) return;

        if (sharedOutputAudioCtx && sharedOutputAudioCtx.state === 'suspended') {
          await sharedOutputAudioCtx.resume().catch(() => {});
        }
        if (this.inputAudioCtx && this.inputAudioCtx.state === 'suspended') {
          await this.inputAudioCtx.resume().catch(() => {});
        }
        if (!this.isCurrentSession() || this.sessionId !== expectedSessionId) return;

        await this.openWebSocketConnection();
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  /**
   * Stops active playback, clears the response audio queue, disconnects temporary nodes,
   * and resets playback flags while preserving the reusable output AudioContext.
   */
  private stopCurrentAudioPlayback() {
    this.audioQueue = [];
    this.enqueuedChunkHashes.clear();
    this.activePlaybackResponseId = null;
    this.isPlayingQueueChunk = false;
    this.nextAudioChunkStartTime = 0;
    this.activeScheduledChunkCount = 0;
    this.isSpeaking = false;
    if (this.browserSpeechSafetyTimer) {
      clearTimeout(this.browserSpeechSafetyTimer);
      this.browserSpeechSafetyTimer = null;
    }
    if (this.chunkPlaybackSafetyTimer) {
      clearTimeout(this.chunkPlaybackSafetyTimer);
      this.chunkPlaybackSafetyTimer = null;
    }
    stopAllGlobalAudioOutput();
  }

  /**
   * Recovers cleanly from any audio output failure:
   * stops broken playback, clears stale queues, disconnects obsolete nodes, and resets state
   * while keeping the Live session active for the next response.
   */
  private handleAudioPlaybackFailure() {
    this.stopCurrentAudioPlayback();
    if (globalStartupSequenceState === 'PLAYING' || this.isAwaitingStartupGreeting()) {
      globalStartupSequenceState = 'COMPLETED';
    }
    this.lastAISpeakEndTime = Date.now();
    if (this.isCurrentSession() && this.isSocketOpen()) {
      this.setAuthoritativeState(this.getReadyListeningOrIdleState());
    }
  }

  /**
   * Enqueues an audio chunk for the active response ID and immediately schedules playback.
   * Progressively queues and plays chunks the moment they arrive from Gemini.
   */
  private enqueueResponseAudioChunk(responseId: number, base64Pcm: string) {
    if (!this.isCurrentSession() || !base64Pcm) return;
    if (responseId !== this.activeClientTurnId || this.cancelledResponseIds.has(responseId)) {
      return;
    }

    const chunkHash = `${responseId}:${base64Pcm.length}:${base64Pcm.slice(0, 32)}:${base64Pcm.slice(-32)}`;
    if (this.enqueuedChunkHashes.has(chunkHash)) {
      return; // Never enqueue duplicate chunks
    }

    // If a new response starts, cancel and cleanly flush any previous response's audio
    if (this.activePlaybackResponseId !== null && this.activePlaybackResponseId !== responseId) {
      this.cancelledResponseIds.add(this.activePlaybackResponseId);
      this.stopCurrentAudioPlayback();
    }

    this.activePlaybackResponseId = responseId;
    this.enqueuedChunkHashes.add(chunkHash);
    this.audioQueue.push({ responseId, chunkHash, base64Pcm });

    this.scheduleQueuedChunks();
  }

  /**
   * Schedules audio chunks progressively onto AudioContext.currentTime timeline.
   * Seamless gapless playback between chunks with zero latency, zero overlapping noise,
   * and clean completion when the final chunk finishes.
   */
  private scheduleQueuedChunks() {
    if (!this.isCurrentSession()) return;

    if (!this.ensureOutputAudioGraph() || !sharedOutputAudioCtx || !sharedOutputAnalyser) {
      this.handleAudioPlaybackFailure();
      return;
    }

    if (sharedOutputAudioCtx.state === 'suspended') {
      sharedOutputAudioCtx.resume().catch(() => {});
    }

    const expectedSessionId = this.sessionId;
    const currentGen = globalPlaybackGeneration;

    while (this.audioQueue.length > 0) {
      // Discard stale or cancelled chunks
      if (
        this.audioQueue[0].responseId !== this.activeClientTurnId ||
        this.cancelledResponseIds.has(this.audioQueue[0].responseId)
      ) {
        this.audioQueue.shift();
        continue;
      }

      const item = this.audioQueue.shift()!;
      const pcmData = base64ToPcm(item.base64Pcm);
      if (pcmData.length === 0) continue;

      try {
        const audioBuffer = sharedOutputAudioCtx.createBuffer(1, pcmData.length, 24000);
        audioBuffer.getChannelData(0).set(pcmData);

        const source = sharedOutputAudioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(sharedOutputAnalyser);
        globalActiveSourceNodes.add(source);

        const ctxTime = sharedOutputAudioCtx.currentTime;
        const startTime = Math.max(ctxTime + 0.005, this.nextAudioChunkStartTime);
        this.nextAudioChunkStartTime = startTime + audioBuffer.duration;
        this.activeScheduledChunkCount++;

        if (!this.isSpeaking) {
          this.isPlayingQueueChunk = true;
          this.lastAISpeakStartTime = Date.now();
          this.setAuthoritativeState('SPEAKING');
          this.resetCurrentUtteranceCapture();
        }

        let chunkHandled = false;
        const handleChunkEnded = () => {
          if (chunkHandled) return;
          chunkHandled = true;

          source.onended = null;
          globalActiveSourceNodes.delete(source);
          try {
            source.disconnect();
          } catch (e) {}

          this.activeScheduledChunkCount = Math.max(0, this.activeScheduledChunkCount - 1);

          if (
            !this.isCurrentSession() ||
            this.sessionId !== expectedSessionId ||
            globalPlaybackGeneration !== currentGen ||
            this.cancelledResponseIds.has(item.responseId)
          ) {
            return;
          }

          // If no more chunks are currently queued or scheduled, speech turn has cleanly completed
          if (this.activeScheduledChunkCount === 0 && this.audioQueue.length === 0) {
            this.isPlayingQueueChunk = false;
            this.activePlaybackResponseId = null;
            this.nextAudioChunkStartTime = 0;
            if (globalStartupSequenceState === 'PLAYING' || this.isAwaitingStartupGreeting()) {
              globalStartupSequenceState = 'COMPLETED';
            }
            this.lastAISpeakEndTime = Date.now();
            if (this.isSocketOpen()) {
              this.setAuthoritativeState(this.getReadyListeningOrIdleState());
            }
          }
        };

        source.onended = handleChunkEnded;
        source.start(startTime);
      } catch (err) {
        console.warn('Audio scheduling notice:', err);
      }
    }
  }

  private speakBrowserText(text: string, onEnd?: () => void) {
    if (this.browserSpeechSafetyTimer) {
      clearTimeout(this.browserSpeechSafetyTimer);
      this.browserSpeechSafetyTimer = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (activeBrowserUtterance) {
          activeBrowserUtterance.onend = null;
          activeBrowserUtterance.onerror = null;
          activeBrowserUtterance = null;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        activeBrowserUtterance = utterance;
        utterance.rate = 1.08;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice =
          voices.find(
            v =>
              (v.name.includes('Google') ||
                v.name.includes('Natural') ||
                v.name.includes('Samantha') ||
                v.name.includes('Zira') ||
                v.name.includes('Female')) &&
              v.lang.startsWith('en')
          ) || voices.find(v => v.lang.startsWith('en'));
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        let finished = false;
        const finishOnce = () => {
          if (finished) return;
          finished = true;
          if (activeBrowserUtterance === utterance) {
            activeBrowserUtterance.onend = null;
            activeBrowserUtterance.onerror = null;
            activeBrowserUtterance = null;
          }
          if (this.browserSpeechSafetyTimer) {
            clearTimeout(this.browserSpeechSafetyTimer);
            this.browserSpeechSafetyTimer = null;
          }
          onEnd?.();
        };

        utterance.onend = finishOnce;
        utterance.onerror = finishOnce;

        // Safety timer in case browser speechSynthesis drops the onend event
        const maxSpeechDurationMs = Math.max(4000, text.length * 95);
        this.browserSpeechSafetyTimer = setTimeout(finishOnce, maxSpeechDurationMs);

        window.speechSynthesis.speak(utterance);
        return;
      } catch (e) {
        onEnd?.();
      }
    } else {
      onEnd?.();
    }
  }

  private async executeRestFallback(trimmed: string, expectedSessionId: number, expectedTurnId: number) {
    if (this.sessionId !== expectedSessionId || !this.isCurrentSession()) return;

    const user = auth.currentUser;
    const token = user ? await user.getIdToken().catch(() => null) : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: trimmed,
        memories: memoryService.getMemoriesList(),
        includeAudio: true
      })
    })
      .then(res => res.json())
      .then(data => {
        if (
          !this.isCurrentSession() ||
          this.sessionId !== expectedSessionId ||
          this.activeClientTurnId !== expectedTurnId ||
          this.cancelledResponseIds.has(expectedTurnId) ||
          this.playedResponseIds.has(expectedTurnId)
        ) {
          return;
        }
        this.clearThinkingSafetyWatchdog();
        this.playedResponseIds.add(expectedTurnId);

        if (data.audio) {
          if (data.text) {
            this.recordAISpokenText(data.text);
            this.onTranscript?.(data.text, true);
          }
          this.enqueueResponseAudioChunk(expectedTurnId, data.audio);
        } else if (data.text) {
          this.stopCurrentAudioPlayback();
          this.activePlaybackResponseId = expectedTurnId;
          this.recordAISpokenText(data.text);
          this.onTranscript?.(data.text, true);
          const currentGen = globalPlaybackGeneration;
          this.setAuthoritativeState('SPEAKING');
          this.lastAISpeakStartTime = Date.now();
          this.resetCurrentUtteranceCapture();

          this.speakBrowserText(data.text, () => {
            if (
              !this.isCurrentSession() ||
              this.sessionId !== expectedSessionId ||
              globalPlaybackGeneration !== currentGen ||
              this.cancelledResponseIds.has(expectedTurnId)
            ) {
              return;
            }
            this.activePlaybackResponseId = null;
            this.lastAISpeakEndTime = Date.now();
            if (this.isSocketOpen()) {
              this.setAuthoritativeState(this.getReadyListeningOrIdleState());
            }
          });
        } else if (this.isSocketOpen()) {
          this.setAuthoritativeState(this.getReadyListeningOrIdleState());
        }
      })
      .catch(() => {
        this.clearThinkingSafetyWatchdog();
        if (this.isCurrentSession() && this.sessionId === expectedSessionId && this.activeClientTurnId === expectedTurnId) {
          if (this.isSocketOpen()) {
            this.setAuthoritativeState(this.getReadyListeningOrIdleState());
          }
        }
      });
  }

  public sendText(text: string) {
    if (!this.isCurrentSession()) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const normTrimmed = this.normalizeForEchoCheck(trimmed);
    const normLastSent = this.normalizeForEchoCheck(this.lastSentText);
    if (!normTrimmed) return;
    if (normTrimmed === normLastSent && Date.now() - this.lastSentTurnTime < 1500) {
      return;
    }
    this.lastSentText = trimmed;
    this.lastSentTurnTime = Date.now();

    if (globalStartupSequenceState !== 'IDLE') {
      globalStartupSequenceState = 'COMPLETED';
    }

    this.resetCurrentUtteranceCapture();

    // Mark any previous active response as cancelled
    if (this.activePlaybackResponseId !== null) {
      this.cancelledResponseIds.add(this.activePlaybackResponseId);
    }
    if (this.activeClientTurnId > 0) {
      this.cancelledResponseIds.add(this.activeClientTurnId);
    }

    const turnId = ++globalClientTurnCounter;
    this.activeClientTurnId = turnId;

    // Clean interruption: stop any currently playing Zoya audio and flush the queue
    if (
      this.isSpeaking ||
      globalActiveSourceNodes.size > 0 ||
      this.audioQueue.length > 0 ||
      this.isPlayingQueueChunk
    ) {
      this.stopCurrentAudioPlayback();
      if (this.isSocketOpen()) {
        this.ws!.send(JSON.stringify({ type: 'INTERRUPT', clientTurnId: turnId }));
      }
    }

    this.setAuthoritativeState('THINKING');
    this.startThinkingSafetyWatchdog();

    if (this.isSocketOpen()) {
      this.ws!.send(
        JSON.stringify({
          textPrompt: trimmed,
          clientTurnId: turnId,
          clientTime: new Date().toLocaleString()
        })
      );
    } else {
      this.handleUnexpectedDisconnectAndReconnect();
      this.executeRestFallback(trimmed, this.sessionId, turnId);
    }
  }

  public sendToolResponse(functionResponses: any[]) {
    if (this.isCurrentSession() && this.isSocketOpen()) {
      this.ws!.send(
        JSON.stringify({
          toolResponse: { functionResponses }
        })
      );
    }
  }

  public disconnect() {
    if (this.isDestroyed) return;
    const wasCurrentSession = this.isCurrentSession();

    this.isDestroyed = true;
    this.isMicActive = false;
    this.connectPromise = null;
    this.micRequestPromise = null;

    if (globalActiveSessionInstance === this) {
      globalActiveSessionInstance = null;
    }

    if (this.activePlaybackResponseId !== null) {
      this.cancelledResponseIds.add(this.activePlaybackResponseId);
    }
    if (this.activeClientTurnId > 0) {
      this.cancelledResponseIds.add(this.activeClientTurnId);
    }

    this.clearThinkingSafetyWatchdog();
    this.resetCurrentUtteranceCapture();

    this.stopCurrentAudioPlayback();
    this.cleanupMicrophoneNodes();

    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch (e) {}
      this.inputAudioCtx = null;
    }

    this.cleanupWebSocket();

    this.currentState = 'DISCONNECTED';
    if (wasCurrentSession) {
      this.onMicStatusChange?.(false, null);
      this.onStateChange?.('DISCONNECTED');
    }

    // Detach all external callbacks so a disconnected session can never affect state or UI
    this.onStateChange = null;
    this.onToolCall = null;
    this.onMicStatusChange = undefined;
    this.onTranscript = undefined;
    this.onError = undefined;
  }
}
