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
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';

export interface SavedMemory {
  id: string;
  uid?: string;
  content: string;
  category?: string;
  createdAt?: number;
  updatedAt?: number;
  timestamp: number;
}

const LOCAL_STORAGE_KEY = 'zoya_neural_memories_v2';
type MemoryListener = (memories: SavedMemory[]) => void;

class MemoryService {
  private localCache: SavedMemory[] = [];
  private listeners: Set<MemoryListener> = new Set();
  private isSyncing = false;

  constructor() {
    this.loadFromLocalStorage();
  }

  public subscribe(listener: MemoryListener): () => void {
    this.listeners.add(listener);
    listener([...this.localCache]);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener([...this.localCache]);
      } catch (e) {
        console.warn('[MemoryService] Listener error:', e);
      }
    }
  }

  private loadFromLocalStorage(): SavedMemory[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        this.localCache = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[MemoryService] Local storage load error:', e);
    }
    return this.localCache;
  }

  private saveToLocalStorage(memories: SavedMemory[]) {
    try {
      this.localCache = memories;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(memories));
      this.notify();
    } catch (e) {
      console.warn('[MemoryService] Local storage save error:', e);
    }
  }

  /**
   * Syncs memories from Cloud Firestore for the authenticated user.
   */
  public async loadAllMemories(): Promise<SavedMemory[]> {
    const user = auth.currentUser;
    if (!user) {
      return this.loadFromLocalStorage();
    }

    if (this.isSyncing) return this.localCache;
    this.isSyncing = true;

    const path = `users/${user.uid}/memories`;
    try {
      const colRef = collection(db, 'users', user.uid, 'memories');
      const q = query(colRef, orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);

      const firestoreMemories: SavedMemory[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          uid: user.uid,
          content: data.content || '',
          category: data.category || 'general',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
          timestamp: data.updatedAt || data.createdAt || Date.now()
        };
      });

      if (firestoreMemories.length > 0) {
        this.saveToLocalStorage(firestoreMemories);
        this.isSyncing = false;
        return firestoreMemories;
      }
    } catch (e) {
      console.warn('[MemoryService] Firestore sync error, using local cache:', e);
    }

    this.isSyncing = false;
    return this.localCache;
  }

  /**
   * Commits a new memory to Cloud Firestore and local cache.
   */
  public async saveMemory(content: string, category = 'user_preference'): Promise<{ success: boolean; memory: SavedMemory }> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error('Memory content cannot be empty');
    }

    const user = auth.currentUser;
    const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const memoryItem: SavedMemory = {
      id: memoryId,
      uid: user?.uid,
      content: trimmed,
      category,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      timestamp: Date.now()
    };

    // Update local state immediately for instant UI feedback
    const current = this.loadFromLocalStorage();
    const filtered = current.filter((m) => m.content.toLowerCase().trim() !== trimmed.toLowerCase());
    const updated = [memoryItem, ...filtered].slice(0, 100);
    this.saveToLocalStorage(updated);

    // Persist to Cloud Firestore
    if (user) {
      const path = `users/${user.uid}/memories/${memoryId}`;
      try {
        const docRef = doc(db, 'users', user.uid, 'memories', memoryId);
        await setDoc(docRef, {
          id: memoryId,
          uid: user.uid,
          content: trimmed,
          category,
          createdAt: memoryItem.createdAt,
          updatedAt: memoryItem.updatedAt
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, path);
      }
    }

    return { success: true, memory: memoryItem };
  }

  /**
   * Updates an existing memory in Cloud Firestore.
   */
  public async updateMemory(id: string, newContent: string, newCategory?: string): Promise<SavedMemory> {
    const trimmed = newContent.trim();
    if (!trimmed) throw new Error('Content cannot be empty');

    const current = this.loadFromLocalStorage();
    const idx = current.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error('Memory not found');

    const updatedItem: SavedMemory = {
      ...current[idx],
      content: trimmed,
      category: newCategory || current[idx].category || 'general',
      updatedAt: Date.now(),
      timestamp: Date.now()
    };

    current[idx] = updatedItem;
    this.saveToLocalStorage([...current]);

    const user = auth.currentUser;
    if (user) {
      const path = `users/${user.uid}/memories/${id}`;
      try {
        const docRef = doc(db, 'users', user.uid, 'memories', id);
        await setDoc(
          docRef,
          {
            content: trimmed,
            category: updatedItem.category,
            updatedAt: updatedItem.updatedAt
          },
          { merge: true }
        );
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, path);
      }
    }

    return updatedItem;
  }

  /**
   * Deletes a memory from Cloud Firestore.
   */
  public async deleteMemory(id: string): Promise<void> {
    const current = this.loadFromLocalStorage();
    const filtered = current.filter((m) => m.id !== id);
    this.saveToLocalStorage(filtered);

    const user = auth.currentUser;
    if (user) {
      const path = `users/${user.uid}/memories/${id}`;
      try {
        const docRef = doc(db, 'users', user.uid, 'memories', id);
        await deleteDoc(docRef);
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, path);
      }
    }
  }

  /**
   * Clears all memories for the authenticated user.
   */
  public async clearAllMemories(): Promise<void> {
    const current = [...this.localCache];
    this.saveToLocalStorage([]);

    const user = auth.currentUser;
    if (user && current.length > 0) {
      const path = `users/${user.uid}/memories`;
      try {
        const batch = writeBatch(db);
        current.forEach((m) => {
          const docRef = doc(db, 'users', user.uid, 'memories', m.id);
          batch.delete(docRef);
        });
        await batch.commit();
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, path);
      }
    }
  }

  /**
   * Context injection for Gemini prompts and live sessions.
   */
  public getPromptContext(): string {
    const memories = this.loadFromLocalStorage();
    if (memories.length === 0) return '';
    const lines = memories.slice(0, 25).map((m) => `- ${m.content}`);
    return `\n# ACTIVE USER NEURAL MEMORIES (from Cloud Firestore):\n${lines.join('\n')}\n`;
  }

  public getMemoriesList(): string[] {
    return this.loadFromLocalStorage().map((m) => m.content);
  }

  public getMemories(): SavedMemory[] {
    return this.loadFromLocalStorage();
  }
}

export const memoryService = new MemoryService();
