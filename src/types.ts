export type AssistantState =
  | 'DISCONNECTED'
  | 'IDLE'
  | 'CONNECTING'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'INTERRUPTED'
  | 'ERROR';

export interface ToolCall {
  name: string;
  args: any;
  id: string;
}

export type ZoyaPersonalityMode =
  | 'Default Zoya'
  | 'Friendly'
  | 'Teacher'
  | 'Professional'
  | 'Playful';

export type NavigationTab =
  | 'home'
  | 'chat'
  | 'images'
  | 'history'
  | 'memory'
  | 'reminders'
  | 'settings';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'zoya';
  text: string;
  timestamp: number;
  audioBase64?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  type: 'voice' | 'text' | 'mixed';
  messages: ChatMessage[];
}

export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'weekdays';

export interface ReminderItem {
  id: string;
  title: string;
  datetime: string; // ISO string (e.g. YYYY-MM-DDTHH:mm)
  repeat: ReminderRepeat;
  note?: string;
  completed: boolean;
  createdAt: number;
  lastNotifiedAt?: number;
}

export interface UserSettings {
  voiceName: 'Zephyr' | 'Kore' | 'Puck';
  autoSpeakChat: boolean;
  personalityMode: ZoyaPersonalityMode;
  responseStyle: 'concise' | 'balanced' | 'detailed';
  glowIntensity: 'low' | 'normal' | 'high';
}
