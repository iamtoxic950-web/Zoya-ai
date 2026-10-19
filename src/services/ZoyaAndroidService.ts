import { ZoyaNativeBridge, isNativeAndroid, MacroDroidPayload, MacroDroidResult } from './ZoyaNativeBridge';

export type SafeAndroidAction =
  | 'OPEN_APP'
  | 'OPEN_URL'
  | 'OPEN_SETTINGS'
  | 'SET_VOLUME'
  | 'SET_BRIGHTNESS'
  | 'PLAY_MEDIA'
  | 'PAUSE_MEDIA'
  | 'TOGGLE_FLASHLIGHT'
  | 'CREATE_REMINDER'
  | 'READ_NOTIFICATION_STATUS'
  | 'GET_BATTERY_STATUS';

export interface ActionRequest {
  action: SafeAndroidAction | string;
  target?: string;
  value?: string | number;
  text?: string;
  requiresConfirmation?: boolean;
}

export interface ActionResult {
  success: boolean;
  action: string;
  message: string;
  target?: string;
}

/**
 * Predefined list of safe actions that require explicit user verbal or UI confirmation
 * before execution (e.g. actions with consequential side-effects like sending messages, changing system toggles).
 */
const CONFIRMATION_REQUIRED_ACTIONS = new Set<string>([
  'RESET_SETTINGS',
  'CLEAR_DATA',
  'DELETE_REMINDER'
]);

class ZoyaAndroidService {
  /**
   * Check if running on native Android
   */
  public isAndroid(): boolean {
    return isNativeAndroid();
  }

  /**
   * Check if MacroDroid is installed and available
   */
  public async isMacroDroidAvailable(): Promise<boolean> {
    if (!this.isAndroid()) return false;
    try {
      const res = await ZoyaNativeBridge.isMacroDroidAvailable();
      return Boolean(res?.available);
    } catch {
      return false;
    }
  }

  /**
   * Main typed execution method:
   * zoyaAndroid.executeAction({ action: "...", target: "...", value: "..." })
   *
   * Detects whether running on Android, gracefully falls back when running on Web,
   * never crashes if the native bridge is unavailable, and returns structured status.
   */
  public async executeAction(request: ActionRequest): Promise<ActionResult> {
    const normAction = (request.action || '').trim().toUpperCase();

    // Check if confirmation is required
    if (CONFIRMATION_REQUIRED_ACTIONS.has(normAction) && !request.requiresConfirmation) {
      return {
        success: false,
        action: normAction,
        message: `Action '${normAction}' requires explicit confirmation before execution.`
      };
    }

    // Graceful fallback when running in Web browser
    if (!this.isAndroid()) {
      return this.handleWebFallback(normAction, request);
    }

    try {
      // 1. Dispatch structured Intent to MacroDroid via native bridge
      const payload: MacroDroidPayload = {
        action: normAction,
        command: normAction,
        target: request.target,
        value: request.value !== undefined ? String(request.value) : undefined,
        text: request.text
      };

      const macroResult: MacroDroidResult = await ZoyaNativeBridge.executeMacroDroidCommand(payload);

      // 2. Also execute companion fallback for OPEN_APP or GET_BATTERY_STATUS if native dispatcher has internal handler
      if (normAction === 'OPEN_APP' && request.target) {
        await ZoyaNativeBridge.dispatchFunction({
          name: 'openApp',
          args: { appName: request.target }
        }).catch(() => {});
      }

      return {
        success: macroResult.success,
        action: normAction,
        message: macroResult.message || `Executed ${normAction}`,
        target: request.target
      };
    } catch (e: any) {
      console.warn('[ZoyaAndroid] Native action error:', e);
      return {
        success: false,
        action: normAction,
        message: e?.message || 'Failed to dispatch native Android action.'
      };
    }
  }

  /**
   * Safe web fallback handler for web preview/desktop testing
   */
  private handleWebFallback(action: string, request: ActionRequest): ActionResult {
    if (action === 'OPEN_APP') {
      const raw = (request.target || '').toLowerCase().trim();
      const webMap: Record<string, string> = {
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
      const found = Object.keys(webMap).find(k => raw.includes(k));
      const url = found ? webMap[found] : `https://www.google.com/search?q=${encodeURIComponent(request.target || '')}`;
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
      return {
        success: true,
        action,
        message: `Web fallback: Opened ${request.target || 'search'}`,
        target: request.target
      };
    }

    if (action === 'OPEN_URL' && request.target) {
      if (typeof window !== 'undefined') {
        window.open(request.target, '_blank');
      }
      return {
        success: true,
        action,
        message: `Web fallback: Opened URL`,
        target: request.target
      };
    }

    if (action === 'GET_BATTERY_STATUS') {
      return {
        success: true,
        action,
        message: 'Battery 100% (AC power connected on Web)'
      };
    }

    return {
      success: false,
      action,
      message: `${action} is an Android automation action. MacroDroid automation is active on Android devices.`
    };
  }
}

export const zoyaAndroid = new ZoyaAndroidService();
