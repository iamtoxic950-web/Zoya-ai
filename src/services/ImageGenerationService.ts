import { doc, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';

export type ImageGenerationErrorType = 'QUOTA_EXHAUSTED' | 'PAID_REQUIRED' | 'NETWORK_ERROR' | 'UNKNOWN';

export interface ImageGenerationError {
  type: ImageGenerationErrorType;
  message: string;
  canRetry: boolean;
  retryAfterSeconds?: number;
}

export interface GeneratedImageMetadata {
  id: string;
  uid: string;
  prompt: string;
  aspectRatio: string;
  createdAt: number;
  provider: string;
  localImageDataUrl?: string; // Kept in-memory or localStorage, NOT saved in Firestore document
}

export interface ImageGenOptions {
  aspectRatio?: string;
  signal?: AbortSignal;
}

export interface GeneratedImageResult {
  imageUrl: string;
  caption?: string;
  metadata: GeneratedImageMetadata;
}

class ImageGenerationService {
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL_MS = 3000; // Prevent rapid spam/retries

  /**
   * Clean abstracted image generation call.
   */
  public async generateImage(
    prompt: string,
    aspectRatio = '1:1',
    options?: ImageGenOptions
  ): Promise<GeneratedImageResult> {
    const trimmed = prompt.trim();
    if (!trimmed) {
      throw {
        type: 'UNKNOWN',
        message: 'Prompt cannot be empty.',
        canRetry: false
      } as ImageGenerationError;
    }

    // Rate limiting debounce to prevent rapid automatic retry loops
    const now = Date.now();
    if (now - this.lastRequestTime < this.MIN_REQUEST_INTERVAL_MS) {
      const waitSeconds = Math.ceil((this.MIN_REQUEST_INTERVAL_MS - (now - this.lastRequestTime)) / 1000);
      throw {
        type: 'QUOTA_EXHAUSTED',
        message: `Please wait ${waitSeconds}s before generating another visual artifact.`,
        canRetry: true,
        retryAfterSeconds: waitSeconds
      } as ImageGenerationError;
    }
    this.lastRequestTime = now;

    const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL || '';
    const endpoint = `${baseUrl}/api/generate-image`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          aspectRatio
        }),
        signal: options?.signal
      });
    } catch (networkErr: any) {
      throw {
        type: 'NETWORK_ERROR',
        message: 'Network connection glitch. Please check your connectivity and try again.',
        canRetry: true
      } as ImageGenerationError;
    }

    const data = await response.json().catch(() => ({}));
    const hasError = !response.ok || data.success === false || Boolean(data.error && !data.imageUrl);

    if (hasError) {
      const errText = (data.error || '').toLowerCase();
      const isPaidRequired = data.requiresPaidKey || errText.includes('limit: 0') || errText.includes('freetier') || errText.includes('billing') || errText.includes('paid');
      const isQuota = data.isQuota || response.status === 429 || errText.includes('quota') || errText.includes('resource_exhausted');

      if (isPaidRequired) {
        throw {
          type: 'PAID_REQUIRED',
          message: 'Image synthesis models are unavailable on this free Google Cloud project because they require billing enabled. All voice, chat, memory, and reminder features remain fully functional.',
          canRetry: false
        } as ImageGenerationError;
      }

      if (isQuota) {
        throw {
          type: 'QUOTA_EXHAUSTED',
          message: 'Image generation rate limit reached. Please wait a moment before trying again.',
          canRetry: true,
          retryAfterSeconds: 30
        } as ImageGenerationError;
      }

      throw {
        type: 'UNKNOWN',
        message: data.error || `Server returned an error (${response.status}). Please refine your prompt and try again.`,
        canRetry: true
      } as ImageGenerationError;
    }

    if (!data.imageUrl) {
      throw {
        type: 'UNKNOWN',
        message: 'Model did not produce an image. Please refine your prompt and try again.',
        canRetry: true
      } as ImageGenerationError;
    }

    const currentUid = auth.currentUser?.uid || 'guest';
    const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const metadata: GeneratedImageMetadata = {
      id: imageId,
      uid: currentUid,
      prompt: trimmed,
      aspectRatio,
      createdAt: Date.now(),
      provider: 'gemini-3.1-flash-image',
      localImageDataUrl: data.imageUrl
    };

    // Save metadata ONLY to Cloud Firestore (never huge base64 strings in Firestore!)
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      this.saveImageMetadataToFirestore(metadata).catch((e) => {
        console.warn('[ImageGen] Could not save metadata to Firestore:', e);
      });
    }

    return {
      imageUrl: data.imageUrl,
      caption: data.caption,
      metadata
    };
  }

  /**
   * Saves lightweight metadata to Firestore under users/{uid}/generatedImages/{imageId}.
   */
  public async saveImageMetadataToFirestore(metadata: GeneratedImageMetadata): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;

    const path = `users/${user.uid}/generatedImages/${metadata.id}`;
    try {
      const docRef = doc(db, 'users', user.uid, 'generatedImages', metadata.id);
      await setDoc(docRef, {
        id: metadata.id,
        uid: user.uid,
        prompt: metadata.prompt,
        aspectRatio: metadata.aspectRatio,
        createdAt: metadata.createdAt,
        provider: metadata.provider
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  }

  /**
   * Loads user's previous generated images metadata from Cloud Firestore.
   */
  public async getUserImageHistory(): Promise<GeneratedImageMetadata[]> {
    const user = auth.currentUser;
    if (!user) return [];

    const path = `users/${user.uid}/generatedImages`;
    try {
      const colRef = collection(db, 'users', user.uid, 'generatedImages');
      const q = query(colRef, orderBy('createdAt', 'desc'), limit(25));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as GeneratedImageMetadata);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
      return [];
    }
  }
}

export const imageGenerationService = new ImageGenerationService();
