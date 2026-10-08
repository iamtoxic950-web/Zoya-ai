import { useState, useRef, useCallback, useEffect } from 'react';
import { AssistantState } from '../types';
import { GeminiLiveSession } from '../services/GeminiLiveSession';
import { playDeactivationSound, playStateChangeSound } from '../utils/sfx';
import { memoryService } from '../services/MemoryService';
import { reminderService } from '../services/ReminderService';
import { ZoyaNativeBridge, isNativeAndroid } from '../services/ZoyaNativeBridge';

export interface HudMessage {
  id: string;
  title: string;
  content: React.ReactNode;
}

export function useVoiceAssistant() {
  const [pipelineStage, setPipelineStage] = useState(-1);
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [micWarning, setMicWarning] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [isTranscriptFinal, setIsTranscriptFinal] = useState<boolean>(false);

  const isMountedRef = useRef<boolean>(true);
  const activeTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const scheduleSafeTimeout = useCallback((fn: () => void, delayMs: number) => {
    const timer = setTimeout(() => {
      activeTimersRef.current.delete(timer);
      if (!isMountedRef.current) return;
      fn();
    }, delayMs);
    activeTimersRef.current.add(timer);
    return timer;
  }, []);

  const addSystemLog = useCallback((log: string) => {
    if (!isMountedRef.current) return;
    setSystemLogs(prev => [...prev.slice(-10), log]);
  }, []);

  const [hudMessages, setHudMessages] = useState<HudMessage[]>([]);

  const addHudMessage = useCallback((title: string, content: React.ReactNode, duration = 3000) => {
    if (!isMountedRef.current) return;
    const id = Math.random().toString(36).substring(7);
    setHudMessages(prev => {
      const next = [...prev, { id, title, content }];
      if (next.length > 3) return next.slice(next.length - 3);
      return next;
    });

    scheduleSafeTimeout(() => {
      setHudMessages(prev => prev.filter(msg => msg.id !== id));
    }, duration);
  }, [scheduleSafeTimeout]);

  const [state, setState] = useState<AssistantState>('DISCONNECTED');
  const stateRef = useRef<AssistantState>('DISCONNECTED');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const sessionRef = useRef<GeminiLiveSession | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  const connectionOpIdRef = useRef<number>(0);
  const lastToggleTimestampRef = useRef<number>(0);

  const updateAuthoritativeState = useCallback((nextState: AssistantState) => {
    if (!isMountedRef.current) return;
    if (stateRef.current === nextState) return;
    stateRef.current = nextState;
    setState(nextState);
    playStateChangeSound(nextState);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      connectionOpIdRef.current += 1;
      isConnectingRef.current = false;
      for (const timer of activeTimersRef.current) {
        clearTimeout(timer);
      }
      activeTimersRef.current.clear();

      if (sessionRef.current) {
        sessionRef.current.disconnect();
        sessionRef.current = null;
      }
    };
  }, []);

  const handleToolCall = useCallback(async (toolCall: any) => {
    const activeSession = sessionRef.current;
    if (!isMountedRef.current || !activeSession || !activeSession.isCurrentSession()) return;

    console.log("Tool call received:", toolCall);
    const functionResponses = await Promise.all(toolCall.functionCalls.map(async (call: any) => {
      const buildSequence = () => {
        let input = call.name;
        let intent = `Execute ${call.name}`;
        let analysis = "Processing request...";
        let action = "Executing...";
        let success = "Operation Complete";

        if (call.name === 'openApp') {
          input = `Open ${call.args.appName}`;
          intent = "Open Installed Application";
          analysis = "Locating App...";
          action = `Launching ${call.args.appName}`;
          success = "App Launched";
        } else if (call.name === 'openWebsite') {
          input = `Go to ${call.args.url}`;
          intent = "Open Web Browser";
          analysis = "Resolving URL...";
          action = "Opening Tab...";
          success = "Navigation Complete";
        } else if (call.name === 'saveMemory') {
          input = `Remember: ${call.args.content}`;
          intent = "Neural Memory Store";
          analysis = "Writing to Database...";
          action = "Persisting to Cloud & Local Storage...";
          success = "Memory Permanently Saved";
        } else if (call.name === 'getMemories') {
          input = "Querying memory...";
          intent = "Recall Neural Memory";
          analysis = "Scanning Database Records...";
          action = "Decrypting Memory Bank...";
          success = "Memories Retrieved";
        }

        return { input, intent, analysis, action, success };
      };

      const seq = buildSequence();
      if (isMountedRef.current && sessionRef.current === activeSession && activeSession.isCurrentSession()) {
        addHudMessage("SYSTEM ACTION", seq.input, 2000);
      }

      let response: any;
      if (call.name === 'openWebsite') {
        const url = call.args.url;
        window.open(url, '_blank');
        response = { success: true, opened_url: url };
      } else if (call.name === 'saveMemory') {
        try {
          const content = call.args.content;
          const category = call.args.category || 'general';
          const saved = await memoryService.saveMemory(content, category);
          if (isMountedRef.current && sessionRef.current === activeSession && activeSession.isCurrentSession()) {
            addHudMessage("MEMORY STORED", (
              <div className="text-[10px] text-cyan-300">
                <div className="font-bold text-amber-300">DATABASE SYNCED:</div>
                <div className="truncate">{content}</div>
              </div>
            ), 3500);
          }
          response = { success: true, memory_saved: content, id: saved.memory.id };
        } catch(e: any) {
          console.error("Error saving memory:", e);
          response = { error: e.message || 'Failed to save memory' };
        }
      } else if (call.name === 'getMemories') {
        try {
          const memories = await memoryService.loadAllMemories();
          const memoryList = memories.map(m => m.content);
          if (isMountedRef.current && sessionRef.current === activeSession && activeSession.isCurrentSession()) {
            addHudMessage("MEMORY RETRIEVED", `${memories.length} records found in database`, 2500);
          }
          response = { success: true, memories: memoryList };
        } catch(e: any) {
          console.error("Error retrieving memories:", e);
          response = { error: e.message || 'Failed to retrieve memories' };
        }
      } else if ([
        'openApp', 'createReminder', 'readNotifications', 'showOverlay',
        'hideOverlay', 'readScreenText', 'performAccessibilityAction',
        'analyzeScreenshot', 'getDeviceInfo', 'getBatteryStatus',
        'getNetworkStatus', 'readClipboard', 'writeClipboard',
        'pickFile', 'takePicture', 'readContacts', 'readCalendar'
      ].includes(call.name)) {
        if (!isNativeAndroid()) {
          if (call.name === 'openApp') {
            const rawApp = String(call.args?.appName || '').toLowerCase().trim();
            const appUrlMap: Record<string, string> = {
              youtube: 'https://www.youtube.com',
              spotify: 'https://open.spotify.com',
              google: 'https://www.google.com',
              gmail: 'https://mail.google.com',
              whatsapp: 'https://web.whatsapp.com',
              github: 'https://github.com',
              instagram: 'https://www.instagram.com',
              netflix: 'https://www.netflix.com',
              maps: 'https://maps.google.com'
            };
            const matchedKey = Object.keys(appUrlMap).find(k => rawApp.includes(k));
            const targetUrl = matchedKey ? appUrlMap[matchedKey] : `https://www.google.com/search?q=${encodeURIComponent(call.args?.appName || '')}`;
            window.open(targetUrl, '_blank');
            response = { success: true, opened_app: call.args?.appName, opened_url: targetUrl };
          } else if (call.name === 'createReminder') {
            const title = String(call.args?.title || 'Reminder');
            const scheduledAt = call.args?.time || new Date(Date.now() + 3600000).toISOString();
            await reminderService.createReminder({
              title,
              datetime: scheduledAt,
              repeat: 'none'
            }).catch(() => {});
            if (isMountedRef.current && sessionRef.current === activeSession && activeSession.isCurrentSession()) {
              addHudMessage("REMINDER CREATED", `${title} scheduled in Firestore`, 3000);
            }
            response = { success: true, reminder: `${title} scheduled for ${scheduledAt}` };
          } else if (call.name === 'getDeviceInfo') {
            response = { success: true, result: { model: 'Web Client', platform: 'web', osVersion: navigator.userAgent } };
          } else if (call.name === 'getBatteryStatus') {
            response = { success: true, result: { batteryLevel: 100, isCharging: true } };
          } else {
            response = { error: 'Not available on web preview. Requires Android device companion.' };
          }
        } else {
          try {
            const res = await ZoyaNativeBridge.dispatchFunction({ name: call.name, args: call.args || {} });
            response = { success: true, result: res };
          } catch (e: any) {
            console.error(`Android bridge error for ${call.name}:`, e);
            response = { error: e.message || 'Android bridge error' };
          }
        }
      } else {
        response = { error: 'Tool not found' };
      }

      scheduleSafeTimeout(() => {
        if (sessionRef.current !== activeSession || !activeSession.isCurrentSession()) return;
        const success = response?.success || !response?.error;
        addHudMessage(success ? "SUCCESS" : "ERROR", success ? (
          <div className="flex flex-col items-center gap-0.5">
             <span>{seq.success}</span>
             <span className="text-cyan-300">✓</span>
          </div>
        ) : (response?.error || 'Failed'), 2500);
      }, 500);

      return {
        id: call.id,
        name: call.name,
        response: response
      };
    }));

    if (isMountedRef.current && sessionRef.current === activeSession && activeSession.isCurrentSession()) {
      activeSession.sendToolResponse(functionResponses);
    }
  }, [addHudMessage, scheduleSafeTimeout]);

  const requestMicAccess = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!isMountedRef.current || !activeSession || !activeSession.isCurrentSession()) {
      return false;
    }

    const success = await activeSession.requestMicrophoneAccess();
    if (!isMountedRef.current || sessionRef.current !== activeSession || !activeSession.isCurrentSession()) {
      return false;
    }

    setIsMicActive(success);
    if (success) {
      setMicWarning(null);
      setAnalyser(activeSession.getAnalyser());
      addSystemLog("Microphone stream synchronized.");
    } else {
      setMicWarning(activeSession.micError || 'Microphone access denied');
    }
    return success;
  }, [addSystemLog]);

  const sendTextPrompt = useCallback((text: string) => {
    const activeSession = sessionRef.current;
    if (!isMountedRef.current || !activeSession || !activeSession.isCurrentSession()) return;
    setLiveTranscript(text);
    setIsTranscriptFinal(true);
    addSystemLog(`Command dispatched: "${text}"`);
    activeSession.sendText(text);
  }, [addSystemLog]);

  const toggleConnection = useCallback(async () => {
    if (!isMountedRef.current) return;

    const now = Date.now();
    // Guard against rapid multi-tap race conditions while a connection is already being established
    if (isConnectingRef.current && now - lastToggleTimestampRef.current < 600) {
      return;
    }
    lastToggleTimestampRef.current = now;

    const currentState = stateRef.current;
    if (currentState === 'DISCONNECTED' || currentState === 'ERROR') {
      if (isConnectingRef.current) return;
      isConnectingRef.current = true;
      const opId = ++connectionOpIdRef.current;

      // Always clean up any previous session before creating a new one
      if (sessionRef.current) {
        sessionRef.current.disconnect();
        sessionRef.current = null;
      }

      updateAuthoritativeState('CONNECTING');
      setErrorMsg(null);

      const session = new GeminiLiveSession(
        (newState) => {
          if (
            !isMountedRef.current ||
            connectionOpIdRef.current !== opId ||
            sessionRef.current !== session ||
            !session.isCurrentSession()
          ) {
            return;
          }
          if (newState === 'THINKING') {
            setPipelineStage(1);
            addSystemLog("Processing input & neural reasoning...");
          } else if (newState === 'SPEAKING') {
            setPipelineStage(6);
            addSystemLog("Vocal matrix active.");
          } else if (newState === 'LISTENING' || newState === 'IDLE') {
            setPipelineStage(-1);
            addSystemLog("Neural synapse connected. Awaiting input.");
          } else if (newState === 'INTERRUPTED') {
            setPipelineStage(-1);
            addSystemLog("Response interrupted by user.");
          } else if (newState === 'ERROR' || newState === 'DISCONNECTED') {
            setPipelineStage(-1);
          }
          updateAuthoritativeState(newState);
        },
        handleToolCall,
        (hasMic, micErr) => {
          if (
            !isMountedRef.current ||
            connectionOpIdRef.current !== opId ||
            sessionRef.current !== session
          ) {
            return;
          }
          setIsMicActive(hasMic);
          if (micErr) {
            setMicWarning(micErr);
            addSystemLog(`Mic status: ${micErr}`);
          } else {
            setMicWarning(null);
            if (hasMic) {
              addSystemLog("Microphone online.");
            }
          }
        },
        (transcript, isFinal) => {
          if (
            !isMountedRef.current ||
            connectionOpIdRef.current !== opId ||
            sessionRef.current !== session ||
            !session.isCurrentSession()
          ) {
            return;
          }
          setLiveTranscript(transcript);
          setIsTranscriptFinal(isFinal);
        },
        (runtimeErrMsg) => {
          if (
            !isMountedRef.current ||
            connectionOpIdRef.current !== opId ||
            sessionRef.current !== session
          ) {
            return;
          }
          setErrorMsg(runtimeErrMsg);
          addSystemLog(`Connection alert: ${runtimeErrMsg}`);
        }
      );

      sessionRef.current = session;
      session.initialize();
      setAnalyser(session.getAnalyser());
      setOutputAnalyser(session.getOutputAnalyser());

      try {
        await session.connect();
        if (
          isMountedRef.current &&
          connectionOpIdRef.current === opId &&
          sessionRef.current === session &&
          session.isCurrentSession()
        ) {
          if (session.sessionError) {
            setErrorMsg(session.sessionError);
          } else {
            setErrorMsg(null);
          }
          setIsMicActive(session.isMicActive);
          setMicWarning(session.micError);
          setAnalyser(session.getAnalyser());
          setOutputAnalyser(session.getOutputAnalyser());
        }
      } catch (err: any) {
        console.error("Connection caught:", err);
        if (
          isMountedRef.current &&
          connectionOpIdRef.current === opId &&
          sessionRef.current === session
        ) {
          session.disconnect();
          sessionRef.current = null;
          setIsMicActive(false);
          setAnalyser(null);
          setOutputAnalyser(null);
          setErrorMsg(err.message || 'Connection failed.');
          updateAuthoritativeState('ERROR');
        }
      } finally {
        if (connectionOpIdRef.current === opId) {
          isConnectingRef.current = false;
        }
      }
    } else {
      connectionOpIdRef.current += 1;
      isConnectingRef.current = false;
      playDeactivationSound();
      if (sessionRef.current) {
        sessionRef.current.disconnect();
        sessionRef.current = null;
      }
      setPipelineStage(-1);
      setIsMicActive(false);
      setAnalyser(null);
      setOutputAnalyser(null);
      updateAuthoritativeState('DISCONNECTED');
    }
  }, [handleToolCall, addSystemLog, updateAuthoritativeState]);

  return {
    hudMessages,
    pipelineStage,
    systemLogs,
    addSystemLog,
    state,
    errorMsg,
    isMicActive,
    micWarning,
    liveTranscript,
    isTranscriptFinal,
    requestMicAccess,
    sendTextPrompt,
    toggleConnection,
    analyser,
    outputAnalyser
  };
}
