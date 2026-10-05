import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserSettings, ZoyaPersonalityMode } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';

const SETTINGS_STORAGE_KEY = 'zoya_settings_v3';

const DEFAULT_SETTINGS: UserSettings = {
  voiceName: 'Zephyr',
  autoSpeakChat: false,
  personalityMode: 'Default Zoya',
  responseStyle: 'balanced',
  glowIntensity: 'normal'
};

type SettingsListener = (settings: UserSettings) => void;

class SettingsService {
  private currentSettings: UserSettings = DEFAULT_SETTINGS;
  private listeners: Set<SettingsListener> = new Set();
  private isLoaded = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): UserSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        this.currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('[SettingsService] Storage load error:', e);
    }
    return this.currentSettings;
  }

  private saveToStorage(settings: UserSettings) {
    try {
      this.currentSettings = settings;
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      this.notify();
    } catch (e) {
      console.warn('[SettingsService] Storage save error:', e);
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener({ ...this.currentSettings });
      } catch (e) {
        console.warn('[SettingsService] Listener notification error:', e);
      }
    }
  }

  public subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.currentSettings });
    return () => this.listeners.delete(listener);
  }

  /**
   * Syncs user settings from Cloud Firestore.
   */
  public async syncWithServer(): Promise<UserSettings> {
    const user = auth.currentUser;
    if (!user) return this.currentSettings;

    const path = `users/${user.uid}/settings/preferences`;
    try {
      const docRef = doc(db, 'users', user.uid, 'settings', 'preferences');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const merged: UserSettings = {
          voiceName: data.voiceName || this.currentSettings.voiceName,
          autoSpeakChat: typeof data.autoSpeakChat === 'boolean' ? data.autoSpeakChat : this.currentSettings.autoSpeakChat,
          personalityMode: data.personalityMode || this.currentSettings.personalityMode,
          responseStyle: data.responseStyle || this.currentSettings.responseStyle,
          glowIntensity: data.glowIntensity || this.currentSettings.glowIntensity
        };
        this.saveToStorage(merged);
        this.isLoaded = true;
        return merged;
      }
    } catch (e) {
      console.warn('[SettingsService] Firestore load error:', e);
    }

    this.isLoaded = true;
    return this.currentSettings;
  }

  public getSettings(): UserSettings {
    return { ...this.currentSettings };
  }

  public updateSettings(partial: Partial<UserSettings>): UserSettings {
    const updated: UserSettings = {
      ...this.currentSettings,
      ...partial
    };
    this.saveToStorage(updated);

    const user = auth.currentUser;
    if (user) {
      const path = `users/${user.uid}/settings/preferences`;
      try {
        const docRef = doc(db, 'users', user.uid, 'settings', 'preferences');
        setDoc(
          docRef,
          {
            uid: user.uid,
            ...updated,
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        ).catch((e) => {
          handleFirestoreError(e, OperationType.UPDATE, path);
        });
      } catch (e) {
        console.warn('[SettingsService] Firestore save error:', e);
      }
    }

    return updated;
  }

  public setPersonalityMode(mode: ZoyaPersonalityMode): UserSettings {
    return this.updateSettings({ personalityMode: mode });
  }

  public resetToDefaults(): UserSettings {
    this.saveToStorage(DEFAULT_SETTINGS);
    const user = auth.currentUser;
    if (user) {
      try {
        const docRef = doc(db, 'users', user.uid, 'settings', 'preferences');
        setDoc(docRef, { uid: user.uid, ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() });
      } catch {}
    }
    return DEFAULT_SETTINGS;
  }
}

export const settingsService = new SettingsService();
