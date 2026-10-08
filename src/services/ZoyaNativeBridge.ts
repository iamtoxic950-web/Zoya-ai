import { registerPlugin, Capacitor } from '@capacitor/core';

export interface NativeHUDState {
  listening: boolean;
  speaking: boolean;
  processing: boolean;
  statusText?: string;
  transcript?: string;
}

export interface ZoyaNativeBridgePlugin {
  // Platform & Environment
  isAndroidPlatform(): Promise<{ isAndroid: boolean; platform: string }>;

  // System Settings & Deep Links
  openAppSettings(): Promise<{ success: boolean }>;
  openAccessibilitySettings(): Promise<{ success: boolean }>;
  isAccessibilityServiceEnabled(): Promise<{ enabled: boolean }>;

  // Overlay / Floating HUD Window Permission & Controls
  checkOverlayPermission(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<{ granted: boolean }>;
  showHUD(options?: { state?: string; text?: string }): Promise<{ success: boolean }>;
  hideHUD(): Promise<{ success: boolean }>;
  updateHUDState(state: NativeHUDState): Promise<{ success: boolean }>;

  // Android Foreground Service for Audio Continuity
  startForegroundService(): Promise<{ success: boolean }>;
  stopForegroundService(): Promise<{ success: boolean }>;
  isForegroundServiceRunning(): Promise<{ running: boolean }>;

  // Generic Function Dispatcher (Accessibility actions, apps, device status)
  dispatchFunction(options: { name: string; args?: any }): Promise<{ result: any }>;
}

const ZoyaNativeBridge = registerPlugin<ZoyaNativeBridgePlugin>('ZoyaAndroidBridge', {
  web: {
    async isAndroidPlatform() {
      return { isAndroid: false, platform: 'web' };
    },
    async openAppSettings() {
      return { success: false };
    },
    async openAccessibilitySettings() {
      return { success: false };
    },
    async isAccessibilityServiceEnabled() {
      return { enabled: false };
    },
    async checkOverlayPermission() {
      return { granted: false };
    },
    async requestOverlayPermission() {
      return { granted: false };
    },
    async showHUD() {
      return { success: false };
    },
    async hideHUD() {
      return { success: false };
    },
    async updateHUDState() {
      return { success: true };
    },
    async startForegroundService() {
      return { success: false };
    },
    async stopForegroundService() {
      return { success: false };
    },
    async isForegroundServiceRunning() {
      return { running: false };
    },
    async dispatchFunction(options: { name: string; args?: any }) {
      return { result: { message: `Web mock: ${options.name}` } };
    }
  }
});

export { ZoyaNativeBridge };
export const isNativeAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
