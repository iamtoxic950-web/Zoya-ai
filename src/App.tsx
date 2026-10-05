import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MinimalLandingScreen } from './components/startup/MinimalLandingScreen';
import { ZoyaStartingNote } from './components/hud/ZoyaStartingNote';
import { AICore3D } from './components/AICore3D';
import { useVoiceAssistant } from './hooks/useVoiceAssistant';
import { NavigationTab, ZoyaPersonalityMode, ReminderItem } from './types';
import { ZoyaSideDrawer } from './components/menu/ZoyaSideDrawer';
import { ChatView } from './components/views/ChatView';
import { ImageGenerationView } from './components/views/ImageGenerationView';
import { ChatHistoryView } from './components/views/ChatHistoryView';
import { MemoryView } from './components/views/MemoryView';
import { RemindersView } from './components/views/RemindersView';
import { SettingsView } from './components/views/SettingsView';
import { settingsService } from './services/SettingsService';
import { reminderService } from './services/ReminderService';
import { chatHistoryService } from './services/ChatHistoryService';
import { memoryService } from './services/MemoryService';
import { AuthProvider, useAuth } from './context/AuthContext';

type AppPhase = 'LANDING' | 'STARTING_NOTE' | 'ACTIVE';

function ZoyaApp() {
  const { user, uid } = useAuth();
  const [phase, setPhase] = useState<AppPhase>('LANDING');
  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [personalityMode, setPersonalityMode] = useState<ZoyaPersonalityMode>(
    settingsService.getSettings().personalityMode
  );
  const [dueReminder, setDueReminder] = useState<ReminderItem | null>(null);

  const hasInitiatedStartupRef = useRef(false);
  const {
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
    outputAnalyser,
    hudMessages,
    systemLogs,
    pipelineStage
  } = useVoiceAssistant();

  const isConnected = state !== 'DISCONNECTED' && state !== 'ERROR';

  // Synchronize Firestore user records when auth identity changes
  useEffect(() => {
    if (uid) {
      memoryService.loadAllMemories().catch(() => {});
      chatHistoryService.syncWithServer().catch(() => {});
      reminderService.syncWithServer().catch(() => {});
      settingsService.syncWithServer().catch(() => {});
    }
  }, [uid]);

  // Subscribe to personality updates & due reminders
  useEffect(() => {
    const unsubSettings = settingsService.subscribe((s) => {
      setPersonalityMode(s.personalityMode);
    });

    const unsubReminders = reminderService.onDueReminder((reminder) => {
      setDueReminder(reminder);
    });

    return () => {
      unsubSettings();
      unsubReminders();
    };
  }, []);

  const handleLandingActivated = useCallback(() => {
    if (hasInitiatedStartupRef.current) return;
    hasInitiatedStartupRef.current = true;
    setPhase('STARTING_NOTE');
    toggleConnection();
  }, [toggleConnection]);

  const handleStartingNoteComplete = useCallback(() => {
    setPhase('ACTIVE');
  }, []);

  const handleSelectTab = useCallback((tab: NavigationTab) => {
    setActiveTab(tab);
    setIsMenuOpen(false);
  }, []);

  const handleNewChatFromHistory = useCallback(() => {
    chatHistoryService.createConversation('New Conversation', 'text');
    setActiveTab('chat');
  }, []);

  return (
    <div className="fixed inset-0 bg-[#000103] text-slate-100 overflow-hidden select-none font-mono">
      {/* 3D Infinite Space & Living Core (Kept mounted in background so voice/audio never breaks) */}
      {phase !== 'LANDING' && (
        <motion.div
          className={`fixed inset-0 w-full h-full transition-opacity duration-500 ${
            activeTab !== 'home' ? 'opacity-25 pointer-events-none' : 'opacity-100'
          }`}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: activeTab !== 'home' ? 0.25 : 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <AICore3D
            state={state}
            analyser={analyser}
            outputAnalyser={outputAnalyser}
            toggleConnection={toggleConnection}
            hudMessages={hudMessages}
            systemLogs={systemLogs}
            pipelineStage={pipelineStage}
            isConnected={isConnected}
            isMicActive={isMicActive}
            micWarning={micWarning}
            liveTranscript={liveTranscript}
            isTranscriptFinal={isTranscriptFinal}
            requestMicAccess={requestMicAccess}
            sendTextPrompt={sendTextPrompt}
            showHud={phase === 'ACTIVE' && activeTab === 'home'}
            onOpenMenu={() => setIsMenuOpen(true)}
            dueReminder={dueReminder}
            onDismissDueReminder={() => setDueReminder(null)}
            onOpenReminders={() => {
              setDueReminder(null);
              setActiveTab('reminders');
            }}
          />
        </motion.div>
      )}

      {/* Stage 1 & 2: Minimal Core Landing Screen */}
      <AnimatePresence>
        {phase === 'LANDING' && (
          <MinimalLandingScreen onActivated={handleLandingActivated} />
        )}
      </AnimatePresence>

      {/* Stage 3: Zoya Holographic Starting Note */}
      <AnimatePresence>
        {phase === 'STARTING_NOTE' && (
          <ZoyaStartingNote onComplete={handleStartingNoteComplete} />
        )}
      </AnimatePresence>

      {/* Feature Views Overlays */}
      <AnimatePresence mode="wait">
        {phase === 'ACTIVE' && activeTab === 'chat' && (
          <motion.div
            key="chat-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40"
          >
            <ChatView
              onBackToVoice={() => setActiveTab('home')}
              onOpenMenu={() => setIsMenuOpen(true)}
              personalityMode={personalityMode}
            />
          </motion.div>
        )}

        {phase === 'ACTIVE' && activeTab === 'images' && (
          <motion.div
            key="images-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40"
          >
            <ImageGenerationView
              onBackToVoice={() => setActiveTab('home')}
              onOpenMenu={() => setIsMenuOpen(true)}
            />
          </motion.div>
        )}

        {phase === 'ACTIVE' && activeTab === 'history' && (
          <motion.div
            key="history-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40"
          >
            <ChatHistoryView
              onBackToVoice={() => setActiveTab('home')}
              onOpenMenu={() => setIsMenuOpen(true)}
              onSelectConversation={() => setActiveTab('chat')}
              onNewChat={handleNewChatFromHistory}
            />
          </motion.div>
        )}

        {phase === 'ACTIVE' && activeTab === 'memory' && (
          <motion.div
            key="memory-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40"
          >
            <MemoryView
              onBackToVoice={() => setActiveTab('home')}
              onOpenMenu={() => setIsMenuOpen(true)}
            />
          </motion.div>
        )}

        {phase === 'ACTIVE' && activeTab === 'reminders' && (
          <motion.div
            key="reminders-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40"
          >
            <RemindersView
              onBackToVoice={() => setActiveTab('home')}
              onOpenMenu={() => setIsMenuOpen(true)}
            />
          </motion.div>
        )}

        {phase === 'ACTIVE' && activeTab === 'settings' && (
          <motion.div
            key="settings-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40"
          >
            <SettingsView
              onBackToVoice={() => setActiveTab('home')}
              onOpenMenu={() => setIsMenuOpen(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-out Menu / Navigation Drawer */}
      <ZoyaSideDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        personalityMode={personalityMode}
      />

      {/* Diagnostic Alert Banner */}
      {state === 'ERROR' && phase === 'ACTIVE' && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded border border-red-500/80 bg-red-950/90 backdrop-blur-md text-red-200 text-[10px] tracking-wider uppercase shadow-[0_0_20px_rgba(255,0,0,0.4)] flex items-center gap-3 pointer-events-auto"
        >
          <span>ALERT: {errorMsg || 'CONNECTION RECONNECTING...'}</span>
          <button
            onClick={toggleConnection}
            className="px-2 py-0.5 rounded border border-red-400 bg-red-900/50 hover:bg-red-800 text-white font-bold cursor-pointer transition-colors"
          >
            RETRY
          </button>
        </motion.div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ZoyaApp />
    </AuthProvider>
  );
}
