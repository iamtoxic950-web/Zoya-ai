import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import { ReminderItem, ReminderRepeat } from '../types';
import { getAudioContext } from '../utils/sfx';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';

const REMINDERS_STORAGE_KEY = 'zoya_reminders_v2';

type ReminderListener = (reminders: ReminderItem[]) => void;
type DueReminderListener = (reminder: ReminderItem) => void;

class ReminderService {
  private reminders: ReminderItem[] = [];
  private listeners: Set<ReminderListener> = new Set();
  private dueListeners: Set<DueReminderListener> = new Set();
  private checkInterval: any = null;
  private isSyncing = false;

  constructor() {
    this.loadFromStorage();
    this.startChecker();
  }

  public subscribe(listener: ReminderListener): () => void {
    this.listeners.add(listener);
    listener([...this.reminders]);
    return () => this.listeners.delete(listener);
  }

  public onDueReminder(listener: DueReminderListener): () => void {
    this.dueListeners.add(listener);
    return () => this.dueListeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener([...this.reminders]);
      } catch (e) {
        console.warn('[ReminderService] Listener error:', e);
      }
    }
  }

  private loadFromStorage(): ReminderItem[] {
    try {
      const raw = localStorage.getItem(REMINDERS_STORAGE_KEY);
      if (raw) {
        this.reminders = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[ReminderService] Storage load error:', e);
    }
    return this.reminders;
  }

  private saveToStorage(items: ReminderItem[]) {
    try {
      this.reminders = items;
      localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(items));
      this.notify();
    } catch (e) {
      console.warn('[ReminderService] Storage save error:', e);
    }
  }

  /**
   * Syncs reminders from Cloud Firestore for authenticated user.
   */
  public async syncWithServer(): Promise<ReminderItem[]> {
    const user = auth.currentUser;
    if (!user) {
      return this.loadFromStorage();
    }

    if (this.isSyncing) return this.reminders;
    this.isSyncing = true;

    const path = `users/${user.uid}/reminders`;
    try {
      const colRef = collection(db, 'users', user.uid, 'reminders');
      const q = query(colRef, orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);

      const firestoreReminders: ReminderItem[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || '',
          datetime: data.scheduledAt || data.datetime || new Date().toISOString(),
          repeat: data.repeatRule || data.repeat || 'none',
          note: data.note || undefined,
          completed: Boolean(data.completed),
          createdAt: data.createdAt || Date.now()
        };
      }).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

      if (firestoreReminders.length > 0) {
        this.saveToStorage(firestoreReminders);
        this.isSyncing = false;
        return firestoreReminders;
      }
    } catch (e) {
      console.warn('[ReminderService] Firestore sync error, using local storage:', e);
    }

    this.isSyncing = false;
    return this.reminders;
  }

  public async createReminder(data: {
    title: string;
    datetime: string;
    repeat?: ReminderRepeat;
    note?: string;
  }): Promise<ReminderItem> {
    const title = data.title.trim();
    if (!title) throw new Error('Reminder title is required');

    const user = auth.currentUser;
    const reminderId = `rem_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const newReminder: ReminderItem = {
      id: reminderId,
      title,
      datetime: data.datetime,
      repeat: data.repeat || 'none',
      note: data.note?.trim(),
      completed: false,
      createdAt: Date.now()
    };

    const current = this.loadFromStorage();
    const updated = [newReminder, ...current].sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );
    this.saveToStorage(updated);

    if (user) {
      const path = `users/${user.uid}/reminders/${reminderId}`;
      try {
        const docRef = doc(db, 'users', user.uid, 'reminders', reminderId);
        await setDoc(docRef, {
          id: reminderId,
          uid: user.uid,
          title,
          scheduledAt: data.datetime,
          repeatRule: newReminder.repeat,
          note: newReminder.note || '',
          completed: false,
          createdAt: newReminder.createdAt,
          updatedAt: Date.now()
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, path);
      }
    }

    return newReminder;
  }

  public async updateReminder(id: string, updates: Partial<ReminderItem>): Promise<ReminderItem> {
    const current = this.loadFromStorage();
    const idx = current.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Reminder not found');

    const updatedItem = {
      ...current[idx],
      ...updates,
      id
    };

    current[idx] = updatedItem;
    current.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    this.saveToStorage([...current]);

    const user = auth.currentUser;
    if (user) {
      const path = `users/${user.uid}/reminders/${id}`;
      try {
        const docRef = doc(db, 'users', user.uid, 'reminders', id);
        await setDoc(
          docRef,
          {
            title: updatedItem.title,
            scheduledAt: updatedItem.datetime,
            repeatRule: updatedItem.repeat,
            note: updatedItem.note || '',
            completed: updatedItem.completed,
            updatedAt: Date.now()
          },
          { merge: true }
        );
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, path);
      }
    }

    return updatedItem;
  }

  public async toggleComplete(id: string): Promise<ReminderItem> {
    const current = this.loadFromStorage();
    const item = current.find((r) => r.id === id);
    if (!item) throw new Error('Reminder not found');

    return this.updateReminder(id, { completed: !item.completed });
  }

  public async deleteReminder(id: string): Promise<void> {
    const current = this.loadFromStorage();
    const filtered = current.filter((r) => r.id !== id);
    this.saveToStorage(filtered);

    const user = auth.currentUser;
    if (user) {
      const path = `users/${user.uid}/reminders/${id}`;
      try {
        const docRef = doc(db, 'users', user.uid, 'reminders', id);
        await deleteDoc(docRef);
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, path);
      }
    }
  }

  public getAllReminders(): ReminderItem[] {
    return [...this.reminders];
  }

  private startChecker() {
    if (typeof window === 'undefined') return;
    if (this.checkInterval) clearInterval(this.checkInterval);

    this.checkInterval = setInterval(() => {
      this.checkDueReminders();
    }, 6000);
  }

  public checkDueReminders(): ReminderItem[] {
    const now = Date.now();
    const dueItems: ReminderItem[] = [];
    let stateChanged = false;

    for (let i = 0; i < this.reminders.length; i++) {
      const item = this.reminders[i];
      if (item.completed) continue;

      const dueTime = new Date(item.datetime).getTime();
      // If due within the last 15 minutes and hasn't been notified in the last 10 minutes
      if (now >= dueTime && now - dueTime < 15 * 60 * 1000) {
        if (!item.lastNotifiedAt || now - item.lastNotifiedAt > 10 * 60 * 1000) {
          item.lastNotifiedAt = now;
          dueItems.push(item);
          stateChanged = true;

          // Play subtle notification tone
          this.playReminderChime();

          // Trigger in-app listeners
          for (const listener of this.dueListeners) {
            try {
              listener(item);
            } catch (e) {}
          }
        }
      }
    }

    if (stateChanged) {
      this.saveToStorage([...this.reminders]);
    }

    return dueItems;
  }

  private playReminderChime() {
    const ctx = getAudioContext();
    if (!ctx || ctx.state === 'suspended') return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    } catch (e) {}
  }
}

export const reminderService = new ReminderService();
