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
import { Conversation, ChatMessage } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';

const CHAT_STORAGE_KEY = 'zoya_chat_history_v2';
const ACTIVE_CONV_KEY = 'zoya_active_conv_id';

type HistoryListener = (conversations: Conversation[]) => void;

class ChatHistoryService {
  private conversations: Conversation[] = [];
  private activeConversationId: string | null = null;
  private listeners: Set<HistoryListener> = new Set();
  private isSyncing = false;

  constructor() {
    this.loadFromStorage();
  }

  public subscribe(listener: HistoryListener): () => void {
    this.listeners.add(listener);
    listener([...this.conversations]);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener([...this.conversations]);
      } catch (e) {
        console.warn('[ChatHistoryService] Listener error:', e);
      }
    }
  }

  private loadFromStorage(): Conversation[] {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (raw) {
        this.conversations = JSON.parse(raw);
      }
      this.activeConversationId = localStorage.getItem(ACTIVE_CONV_KEY);
      if (!this.activeConversationId && this.conversations.length > 0) {
        this.activeConversationId = this.conversations[0].id;
      }
    } catch (e) {
      console.warn('[ChatHistoryService] Storage load error:', e);
    }
    return this.conversations;
  }

  private saveToStorage(convs: Conversation[]) {
    try {
      this.conversations = convs;
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(convs));
      this.notify();
    } catch (e) {
      console.warn('[ChatHistoryService] Storage save error:', e);
    }
  }

  /**
   * Syncs conversations and recent messages from Cloud Firestore.
   */
  public async syncWithServer(): Promise<Conversation[]> {
    const user = auth.currentUser;
    if (!user) {
      return this.loadFromStorage();
    }

    if (this.isSyncing) return this.conversations;
    this.isSyncing = true;

    const path = `users/${user.uid}/conversations`;
    try {
      const colRef = collection(db, 'users', user.uid, 'conversations');
      const q = query(colRef, orderBy('updatedAt', 'desc'), limit(30));
      const snap = await getDocs(q);

      const firestoreConvs: Conversation[] = [];

      for (const d of snap.docs) {
        const data = d.data();
        const convId = d.id;

        // Fetch messages for each conversation
        let messages: ChatMessage[] = [];
        try {
          const msgColRef = collection(db, 'users', user.uid, 'conversations', convId, 'messages');
          const msgQuery = query(msgColRef, orderBy('timestamp', 'asc'), limit(100));
          const msgSnap = await getDocs(msgQuery);
          messages = msgSnap.docs.map((md) => {
            const mData = md.data();
            return {
              id: md.id,
              sender: mData.role === 'model' || mData.role === 'zoya' ? 'zoya' : 'user',
              text: mData.content || '',
              timestamp: mData.timestamp || Date.now()
            };
          });
        } catch {
          // If subcollection messages not fetched, fallback to empty
        }

        firestoreConvs.push({
          id: convId,
          title: data.title || 'Conversation',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
          type: data.type || 'text',
          messages
        });
      }

      if (firestoreConvs.length > 0) {
        this.saveToStorage(firestoreConvs);
        this.isSyncing = false;
        return firestoreConvs;
      }
    } catch (e) {
      console.warn('[ChatHistoryService] Firestore sync error, using local storage:', e);
    }

    this.isSyncing = false;
    return this.conversations;
  }

  public getActiveConversationId(): string | null {
    return this.activeConversationId;
  }

  public setActiveConversationId(id: string | null) {
    this.activeConversationId = id;
    if (id) {
      localStorage.setItem(ACTIVE_CONV_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_CONV_KEY);
    }
    this.notify();
  }

  public async getOrCreateActiveConversation(defaultType: 'voice' | 'text' = 'text'): Promise<Conversation> {
    if (this.activeConversationId) {
      const found = this.conversations.find((c) => c.id === this.activeConversationId);
      if (found) return found;
    }

    if (this.conversations.length > 0) {
      this.activeConversationId = this.conversations[0].id;
      return this.conversations[0];
    }

    return this.createConversation('Active Session', defaultType);
  }

  public async createConversation(title = 'New Conversation', type: 'voice' | 'text' = 'text'): Promise<Conversation> {
    const user = auth.currentUser;
    const convId = `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const newConv: Conversation = {
      id: convId,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      type,
      messages: []
    };

    const current = this.loadFromStorage();
    const updated = [newConv, ...current];
    this.saveToStorage(updated);
    this.setActiveConversationId(newConv.id);

    if (user) {
      const path = `users/${user.uid}/conversations/${convId}`;
      try {
        const docRef = doc(db, 'users', user.uid, 'conversations', convId);
        await setDoc(docRef, {
          id: convId,
          uid: user.uid,
          title,
          type,
          createdAt: newConv.createdAt,
          updatedAt: newConv.updatedAt
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, path);
      }
    }

    return newConv;
  }

  public async addMessage(
    conversationId: string,
    message: { sender: 'user' | 'zoya'; text: string; audioBase64?: string }
  ): Promise<Conversation> {
    const current = this.loadFromStorage();
    let convIndex = current.findIndex((c) => c.id === conversationId);

    if (convIndex === -1) {
      const created = await this.createConversation(message.text.slice(0, 30));
      return this.addMessage(created.id, message);
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newMessage: ChatMessage = {
      id: messageId,
      sender: message.sender,
      text: message.text,
      timestamp: Date.now(),
      audioBase64: message.audioBase64
    };

    const target = current[convIndex];
    const updatedMessages = [...target.messages, newMessage];

    let newTitle = target.title;
    if (
      (target.title === 'New Conversation' || target.title === 'Active Session') &&
      message.sender === 'user' &&
      message.text
    ) {
      newTitle = message.text.slice(0, 35).trim();
    }

    const updatedConv: Conversation = {
      ...target,
      title: newTitle,
      updatedAt: Date.now(),
      messages: updatedMessages
    };

    current[convIndex] = updatedConv;
    current.sort((a, b) => b.updatedAt - a.updatedAt);
    this.saveToStorage([...current]);

    // Persist to Cloud Firestore: update conversation and insert message document
    const user = auth.currentUser;
    if (user) {
      try {
        const convRef = doc(db, 'users', user.uid, 'conversations', conversationId);
        await setDoc(
          convRef,
          {
            title: newTitle,
            updatedAt: updatedConv.updatedAt
          },
          { merge: true }
        );

        const msgRef = doc(db, 'users', user.uid, 'conversations', conversationId, 'messages', messageId);
        await setDoc(msgRef, {
          id: messageId,
          uid: user.uid,
          conversationId,
          role: message.sender === 'user' ? 'user' : 'model',
          content: message.text,
          timestamp: newMessage.timestamp
        });
      } catch (e) {
        console.warn('[ChatHistoryService] Firestore message write warning:', e);
      }
    }

    return updatedConv;
  }

  public async renameConversation(id: string, newTitle: string): Promise<void> {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    const current = this.loadFromStorage();
    const idx = current.findIndex((c) => c.id === id);
    if (idx === -1) return;

    current[idx].title = trimmed;
    current[idx].updatedAt = Date.now();
    this.saveToStorage([...current]);

    const user = auth.currentUser;
    if (user) {
      try {
        const convRef = doc(db, 'users', user.uid, 'conversations', id);
        await setDoc(convRef, { title: trimmed, updatedAt: Date.now() }, { merge: true });
      } catch (e) {
        console.warn('[ChatHistoryService] Rename conversation error:', e);
      }
    }
  }

  public async deleteConversation(id: string): Promise<void> {
    const current = this.loadFromStorage();
    const filtered = current.filter((c) => c.id !== id);
    this.saveToStorage(filtered);

    if (this.activeConversationId === id) {
      this.setActiveConversationId(filtered.length > 0 ? filtered[0].id : null);
    }

    const user = auth.currentUser;
    if (user) {
      const path = `users/${user.uid}/conversations/${id}`;
      try {
        const convRef = doc(db, 'users', user.uid, 'conversations', id);
        await deleteDoc(convRef);
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, path);
      }
    }
  }

  public async clearAllConversations(): Promise<void> {
    const current = [...this.conversations];
    this.saveToStorage([]);
    this.setActiveConversationId(null);

    const user = auth.currentUser;
    if (user && current.length > 0) {
      try {
        const batch = writeBatch(db);
        current.forEach((c) => {
          const ref = doc(db, 'users', user.uid, 'conversations', c.id);
          batch.delete(ref);
        });
        await batch.commit();
      } catch (e) {
        console.warn('[ChatHistoryService] Clear conversations Firestore warning:', e);
      }
    }
  }

  public getAllConversations(): Conversation[] {
    return [...this.conversations];
  }

  public getRecentContext(maxMessages = 8): Array<{ role: 'user' | 'model'; text: string }> {
    if (!this.activeConversationId) return [];
    const conv = this.conversations.find((c) => c.id === this.activeConversationId);
    if (!conv || conv.messages.length === 0) return [];

    return conv.messages.slice(-maxMessages).map((m) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      text: m.text
    }));
  }
}

export const chatHistoryService = new ChatHistoryService();
