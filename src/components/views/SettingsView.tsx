import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings,
  Radio,
  Menu,
  Volume2,
  Mic,
  Sparkles,
  Download,
  Trash2,
  RotateCcw,
  Check,
  CheckCircle2,
  Sliders,
  Database,
  User as UserIcon,
  LogIn,
  LogOut,
  ShieldCheck,
  Smartphone,
  Layers,
  Activity,
  Globe,
  ExternalLink
} from 'lucide-react';
import { UserSettings, ZoyaPersonalityMode } from '../../types';
import { settingsService } from '../../services/SettingsService';
import { memoryService } from '../../services/MemoryService';
import { chatHistoryService } from '../../services/ChatHistoryService';
import { reminderService } from '../../services/ReminderService';
import { useAuth } from '../../context/AuthContext';
import { ZoyaNativeBridge, isNativeAndroid } from '../../services/ZoyaNativeBridge';
import { getApiBaseUrl, setApiBaseUrl } from '../../config/api';

interface SettingsViewProps {
  onBackToVoice: () => void;
  onOpenMenu: () => void;
}

export function SettingsView({ onBackToVoice, onOpenMenu }: SettingsViewProps) {
  const { user, uid, signInWithGoogle, signOut } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(settingsService.getSettings());
  const [saveToast, setSaveToast] = useState(false);
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  // Native Android & Bridge status state
  const isAndroid = isNativeAndroid();
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
  const [overlayGranted, setOverlayGranted] = useState(false);
  const [foregroundRunning, setForegroundRunning] = useState(false);
  const [hudActive, setHudActive] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState(getApiBaseUrl());
  const [isApiUrlEditing, setIsApiUrlEditing] = useState(false);

  useEffect(() => {
    if (isAndroid) {
      ZoyaNativeBridge.isAccessibilityServiceEnabled().then((res) => {
        setAccessibilityEnabled(res.enabled);
      }).catch(() => {});

      ZoyaNativeBridge.checkOverlayPermission().then((res) => {
        setOverlayGranted(res.granted);
      }).catch(() => {});

      ZoyaNativeBridge.isForegroundServiceRunning().then((res) => {
        setForegroundRunning(res.running);
      }).catch(() => {});
    }
  }, [isAndroid]);

  useEffect(() => {
    const unsub = settingsService.subscribe((s) => {
      setSettings(s);
    });
    return () => unsub();
  }, []);

  const handleUpdate = (partial: Partial<UserSettings>) => {
    settingsService.updateSettings(partial);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 1800);
  };

  const handleTestMic = async () => {
    if (isMicTesting) return;
    try {
      setIsMicTesting(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let count = 0;
      const interval = setInterval(() => {
        analyser.getByteFrequencyData(buffer);
        const avg = buffer.reduce((a, b) => a + b, 0) / buffer.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        count++;
        if (count > 35) {
          clearInterval(interval);
          stream.getTracks().forEach((t) => t.stop());
          audioCtx.close();
          setIsMicTesting(false);
          setMicLevel(0);
        }
      }, 100);
    } catch {
      setIsMicTesting(false);
      setMicLevel(0);
    }
  };

  const handleExportData = () => {
    const payload = {
      exportDate: new Date().toISOString(),
      settings: settingsService.getSettings(),
      memories: memoryService.getMemories(),
      conversations: chatHistoryService.getAllConversations(),
      reminders: reminderService.getAllReminders()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zoya-data-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleResetDefaults = () => {
    settingsService.resetToDefaults();
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 1800);
  };

  const personalityModes: Array<{
    mode: ZoyaPersonalityMode;
    label: string;
    description: string;
  }> = [
    {
      mode: 'Default Zoya',
      label: 'Default Zoya',
      description: 'Confident, intelligent, emotionally aware AI companion with subtle wit.'
    },
    {
      mode: 'Friendly',
      label: 'Warm & Friendly',
      description: 'Supportive, conversational, empathetic, and encouraging.'
    },
    {
      mode: 'Teacher',
      label: 'Insightful Teacher',
      description: 'Patient, intuitive, step-by-step guidance with lucid analogies.'
    },
    {
      mode: 'Professional',
      label: 'Executive Professional',
      description: 'Concise, structured, outcome-focused, and execution-oriented.'
    },
    {
      mode: 'Playful',
      label: 'Playful & Witty',
      description: 'Energetic, charming banter, quick humor, and light teasing.'
    }
  ];

  return (
    <div className="fixed inset-0 z-40 bg-[#00040b] text-cyan-100 flex flex-col font-mono select-none overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(0,180,216,0.1)_0%,_transparent_70%)]" />

      {/* Header */}
      <header className="relative z-10 px-4 py-3 sm:px-6 sm:py-3.5 border-b border-cyan-500/20 bg-[#010814]/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToVoice}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:text-cyan-100 hover:border-cyan-400 transition-colors cursor-pointer text-[10px] tracking-widest uppercase"
            title="Return to Voice Interface"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Voice Core</span>
          </button>

          <span className="text-[11px] font-bold tracking-wider text-cyan-200">
            System Preferences
          </span>
        </div>

        <div className="flex items-center gap-2">
          {saveToast && (
            <span className="text-[9px] text-emerald-400 tracking-wider flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30">
              <Check className="w-3 h-3" /> Preferences Saved
            </span>
          )}

          <button
            onClick={onOpenMenu}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:text-cyan-100 hover:border-cyan-400 text-[10px] tracking-widest uppercase transition-colors cursor-pointer"
            title="Open Menu"
          >
            <Menu className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Menu</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-4xl w-full mx-auto space-y-6">
        {/* Section 1: Personality Matrix */}
        <section className="p-4 sm:p-5 rounded-2xl border border-cyan-500/25 bg-[#00101f]/70 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 text-cyan-300">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold tracking-widest uppercase">
              Personality Mode & Demeanor
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {personalityModes.map((item) => {
              const isActive = settings.personalityMode === item.mode;

              return (
                <button
                  key={item.mode}
                  onClick={() => handleUpdate({ personalityMode: item.mode })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'border-cyan-400 bg-cyan-950/50 text-cyan-100 shadow-[0_0_15px_rgba(0,229,255,0.18)]'
                      : 'border-cyan-500/20 bg-[#000a14]/60 text-cyan-300 hover:border-cyan-400/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold tracking-wider">{item.label}</span>
                    {isActive && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />}
                  </div>
                  <p className="text-[10px] text-cyan-400/70 font-sans leading-relaxed">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 2: Voice & Audio Settings */}
        <section className="p-4 sm:p-5 rounded-2xl border border-cyan-500/25 bg-[#00101f]/70 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 text-cyan-300">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold tracking-widest uppercase">
              Vocal Synthesis & Microphone
            </h3>
          </div>

          <div className="space-y-4">
            {/* Preferred Voice Selection */}
            <div>
              <label className="block text-[9px] uppercase tracking-widest text-cyan-500 mb-2">
                Zoya Voice Profile:
              </label>
              <div className="flex flex-wrap gap-2">
                {(['Zephyr', 'Kore', 'Puck'] as const).map((voice) => (
                  <button
                    key={voice}
                    onClick={() => handleUpdate({ voiceName: voice })}
                    className={`px-4 py-2 rounded-xl text-xs font-mono tracking-wider transition-all cursor-pointer border ${
                      settings.voiceName === voice
                        ? 'border-cyan-400 bg-cyan-900/60 text-cyan-100 shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                        : 'border-cyan-500/20 bg-[#000d1a]/60 text-cyan-400/80 hover:border-cyan-400/40 hover:text-cyan-200'
                    }`}
                  >
                    {voice} {voice === 'Zephyr' && '(Primary Female)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Speak Text Toggle */}
            <div className="flex items-center justify-between pt-3 border-t border-cyan-500/15">
              <div>
                <span className="text-xs font-sans text-cyan-200 block">
                  Read aloud responses in Text Chat
                </span>
                <span className="text-[10px] text-cyan-500/70 font-sans">
                  Automatically plays synthesized voice when Zoya replies in text mode
                </span>
              </div>
              <button
                onClick={() => handleUpdate({ autoSpeakChat: !settings.autoSpeakChat })}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border ${
                  settings.autoSpeakChat
                    ? 'bg-cyan-500/30 border-cyan-400'
                    : 'bg-black/50 border-cyan-500/30'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                    settings.autoSpeakChat
                      ? 'right-1 bg-cyan-300 shadow-[0_0_8px_#00e5ff]'
                      : 'left-1 bg-cyan-700'
                  }`}
                />
              </button>
            </div>

            {/* Mic Diagnostic Test */}
            <div className="flex items-center justify-between pt-3 border-t border-cyan-500/15">
              <div>
                <span className="text-xs font-sans text-cyan-200 block">Microphone Sensor Test</span>
                <span className="text-[10px] text-cyan-500/70 font-sans">
                  Verify audio input sensitivity and noise threshold
                </span>
              </div>

              <div className="flex items-center gap-3">
                {isMicTesting && (
                  <div className="w-20 h-2 bg-black/60 rounded-full overflow-hidden border border-cyan-500/30">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-100"
                      style={{ width: `${micLevel}%` }}
                    />
                  </div>
                )}

                <button
                  onClick={handleTestMic}
                  disabled={isMicTesting}
                  className="px-3 py-1 rounded-lg border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 text-[10px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{isMicTesting ? 'Listening...' : 'Test Mic'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Response Tone & Glow Appearance */}
        <section className="p-4 sm:p-5 rounded-2xl border border-cyan-500/25 bg-[#00101f]/70 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 text-cyan-300">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold tracking-widest uppercase">
              Response Style & Core Glow
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] uppercase tracking-widest text-cyan-500 mb-2">
                Response Verbosity:
              </label>
              <div className="flex gap-2">
                {(['concise', 'balanced', 'detailed'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => handleUpdate({ responseStyle: style })}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] uppercase font-mono tracking-wider transition-all cursor-pointer border capitalize ${
                      settings.responseStyle === style
                        ? 'border-cyan-400 bg-cyan-900/60 text-cyan-100 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                        : 'border-cyan-500/20 bg-[#000d1a]/60 text-cyan-400/80 hover:border-cyan-400/40 hover:text-cyan-200'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-widest text-cyan-500 mb-2">
                Core Hologram Bloom:
              </label>
              <div className="flex gap-2">
                {(['low', 'normal', 'high'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => handleUpdate({ glowIntensity: level })}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] uppercase font-mono tracking-wider transition-all cursor-pointer border capitalize ${
                      settings.glowIntensity === level
                        ? 'border-cyan-400 bg-cyan-900/60 text-cyan-100 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                        : 'border-cyan-500/20 bg-[#000d1a]/60 text-cyan-400/80 hover:border-cyan-400/40 hover:text-cyan-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Account & Cloud Persistence */}
        <section className="p-4 sm:p-5 rounded-2xl border border-cyan-500/25 bg-[#00101f]/70 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-300">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold tracking-widest uppercase">
                Account & Cloud Persistence
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Cloud Firestore Active</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-[#000a14]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full border border-cyan-400/50 object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
                  <UserIcon className="w-5 h-5" />
                </div>
              )}

              <div>
                <div className="text-xs font-bold text-cyan-100">
                  {user && !user.isAnonymous
                    ? user.displayName || user.email || 'Authenticated User'
                    : 'Guest Mode Session'}
                </div>
                {user?.email && (
                  <div className="text-[10px] text-cyan-400/70 font-sans">{user.email}</div>
                )}
                <div className="text-[9px] text-cyan-500/70 font-mono mt-0.5">
                  UID: <span className="text-cyan-300">{uid || 'Connecting...'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto font-mono">
              {user && !user.isAnonymous ? (
                <button
                  onClick={() => signOut()}
                  className="px-3 py-1.5 rounded-xl border border-red-500/30 hover:border-red-400 text-red-400 hover:text-red-200 text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={() => signInWithGoogle()}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-950/80 border border-cyan-400/50 hover:bg-cyan-900 text-cyan-200 text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(0,229,255,0.15)] transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In with Google</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Section 5: Android Native Bridge & System Integrations */}
        <section className="p-4 sm:p-5 rounded-2xl border border-cyan-500/25 bg-[#00101f]/70 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-300">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold tracking-widest uppercase">
                Android Native System & Permissions
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-950/30 text-cyan-300">
              {isAndroid ? 'Android Runtime' : 'Web Browser Preview'}
            </span>
          </div>

          <p className="text-[11px] text-cyan-300/70 font-sans leading-relaxed">
            Configure system accessibility, persistent floating HUD notch, background audio services, and Render backend endpoints.
          </p>

          <div className="space-y-3 pt-1">
            {/* Accessibility Service Item */}
            <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-[#000a14]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-cyan-200 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Zoya Accessibility Service</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${accessibilityEnabled ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30' : 'bg-amber-950/40 text-amber-300 border border-amber-500/30'}`}>
                    {accessibilityEnabled ? 'ENABLED' : 'MANUAL APPROVAL REQUIRED'}
                  </span>
                </div>
                <div className="text-[10px] text-cyan-400/60 font-sans mt-1">
                  Enables legitimate assistant actions (reading permitted screen content on request, navigation, tapping actions).
                </div>
              </div>

              <button
                onClick={() => {
                  if (isAndroid) {
                    ZoyaNativeBridge.openAccessibilitySettings();
                  } else {
                    alert('Accessibility Service settings are only available on an Android device.');
                  }
                }}
                className="px-3 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900 text-cyan-300 hover:text-cyan-100 text-xs uppercase tracking-wider flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Accessibility Settings</span>
              </button>
            </div>

            {/* Floating HUD Notch Item */}
            <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-[#000a14]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-cyan-200 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Floating Dynamic HUD Notch</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${overlayGranted ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30' : 'bg-cyan-950/40 text-cyan-300 border border-cyan-500/30'}`}>
                    {overlayGranted ? 'OVERLAY GRANTED' : 'PERMISSION REQUIRED'}
                  </span>
                </div>
                <div className="text-[10px] text-cyan-400/60 font-sans mt-1">
                  Displays futuristic top notch pill showing live assistant state, transcript, and audio activity above other apps.
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                {!overlayGranted ? (
                  <button
                    onClick={() => {
                      if (isAndroid) {
                        ZoyaNativeBridge.requestOverlayPermission().then((res) => {
                          setOverlayGranted(res.granted);
                        });
                      } else {
                        alert('Floating HUD overlay is only available on an Android device.');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-950/30 text-amber-300 hover:text-amber-100 text-xs uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    Grant Overlay
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (isAndroid) {
                        if (hudActive) {
                          ZoyaNativeBridge.hideHUD();
                          setHudActive(false);
                        } else {
                          ZoyaNativeBridge.showHUD({ text: 'ZOYA AI ACTIVE' });
                          setHudActive(true);
                        }
                      } else {
                        alert('Floating HUD toggle is only active on an Android device.');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-950/50 text-cyan-200 hover:text-white text-xs uppercase tracking-wider cursor-pointer transition-colors"
                  >
                    {hudActive ? 'Hide Notch' : 'Show Notch'}
                  </button>
                )}
              </div>
            </div>

            {/* Android Foreground Service Item */}
            <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-[#000a14]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-cyan-200 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Foreground Assistant Service</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${foregroundRunning ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30' : 'bg-cyan-950/40 text-cyan-400 border border-cyan-500/30'}`}>
                    {foregroundRunning ? 'ACTIVE' : 'STANDBY'}
                  </span>
                </div>
                <div className="text-[10px] text-cyan-400/60 font-sans mt-1">
                  Maintains continuous audio and live WebSocket assistant connection with Android persistent notification.
                </div>
              </div>

              <button
                onClick={() => {
                  if (isAndroid) {
                    if (foregroundRunning) {
                      ZoyaNativeBridge.stopForegroundService().then(() => setForegroundRunning(false));
                    } else {
                      ZoyaNativeBridge.startForegroundService().then(() => setForegroundRunning(true));
                    }
                  } else {
                    alert('Foreground service runs natively on Android devices.');
                  }
                }}
                className="px-3 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-950/40 text-cyan-300 hover:text-cyan-100 text-xs uppercase tracking-wider self-start sm:self-auto cursor-pointer transition-colors shrink-0"
              >
                {foregroundRunning ? 'Stop Service' : 'Start Service'}
              </button>
            </div>

            {/* Render Backend Endpoint Override */}
            <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-[#000a14]/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-cyan-200 flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Render Backend Endpoint URL</span>
                </div>
                <button
                  onClick={() => setIsApiUrlEditing(!isApiUrlEditing)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-200 underline cursor-pointer"
                >
                  {isApiUrlEditing ? 'Done' : 'Configure URL'}
                </button>
              </div>

              <div className="text-[10px] text-cyan-400/60 font-sans">
                Active: <span className="font-mono text-cyan-300">{customApiUrl || '(Same-Origin Web Server)'}</span>
              </div>

              {isApiUrlEditing && (
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <input
                    type="url"
                    value={customApiUrl}
                    onChange={(e) => setCustomApiUrl(e.target.value)}
                    placeholder="https://zoya-ai.onrender.com"
                    className="w-full bg-[#00040B] border border-cyan-500/40 rounded-lg px-3 py-1.5 text-xs text-cyan-200 focus:outline-none focus:border-cyan-400"
                  />
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={() => {
                        setApiBaseUrl(customApiUrl);
                        setIsApiUrlEditing(false);
                        setSaveToast(true);
                        setTimeout(() => setSaveToast(false), 1800);
                      }}
                      className="px-3 py-1.5 bg-cyan-950 border border-cyan-400 text-cyan-200 text-xs rounded-lg uppercase tracking-wider cursor-pointer hover:bg-cyan-900"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setCustomApiUrl('');
                        setApiBaseUrl(null);
                        setIsApiUrlEditing(false);
                        setSaveToast(true);
                        setTimeout(() => setSaveToast(false), 1800);
                      }}
                      className="px-3 py-1.5 border border-red-500/40 text-red-400 text-xs rounded-lg uppercase tracking-wider cursor-pointer hover:bg-red-950/30"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 6: Data & Reset */}
        <section className="p-4 sm:p-5 rounded-2xl border border-cyan-500/25 bg-[#00101f]/70 backdrop-blur-md space-y-3">
          <div className="flex items-center gap-2 text-cyan-300">
            <Database className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold tracking-widest uppercase">
              Assistant Data & Continuity
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleExportData}
              className="px-3.5 py-2 rounded-xl border border-cyan-500/30 hover:border-cyan-400 bg-cyan-950/30 text-cyan-300 hover:text-cyan-100 text-xs tracking-wider uppercase flex items-center gap-2 cursor-pointer transition-all"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export All Data (JSON)</span>
            </button>

            <button
              onClick={handleResetDefaults}
              className="px-3.5 py-2 rounded-xl border border-cyan-500/30 hover:border-cyan-400 bg-cyan-950/30 text-cyan-300 hover:text-cyan-100 text-xs tracking-wider uppercase flex items-center gap-2 cursor-pointer transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Settings</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
