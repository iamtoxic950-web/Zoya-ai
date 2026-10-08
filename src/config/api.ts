// Centralized API configuration for Zoya AI
// Seamlessly supports:
// 1. Web Preview / Dev / Production (same-origin relative URLs or configured VITE_API_URL)
// 2. Android Capacitor Native (Render backend URL via VITE_API_URL or runtime override)

import { Capacitor } from '@capacitor/core';

// Default Render backend URL for mobile app deployment if VITE_API_URL is not set at build time
const DEFAULT_RENDER_BACKEND_URL = 'https://zoya-ai.onrender.com';

const STORAGE_KEY_API_BASE = 'zoya_custom_api_base_url';

export function getApiBaseUrl(): string {
  // 1. Check user-configured override in localStorage (useful in Settings)
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_API_BASE);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  }

  // 2. Check Vite build-time environment variable
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 3. If running inside native Android / iOS Capacitor app without same-origin backend
  if (Capacitor.isNativePlatform()) {
    return DEFAULT_RENDER_BACKEND_URL;
  }

  // 4. Default for Web browser: use relative paths (empty string) for same-origin dev & prod
  return '';
}

export function setApiBaseUrl(url: string | null): void {
  if (typeof window === 'undefined') return;
  if (!url || !url.trim()) {
    localStorage.removeItem(STORAGE_KEY_API_BASE);
  } else {
    localStorage.setItem(STORAGE_KEY_API_BASE, url.trim().replace(/\/+$/, ''));
  }
}

export function getApiEndpoint(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function getLiveWebSocketUrl(): string {
  const base = getApiBaseUrl();
  if (base) {
    try {
      const parsed = new URL(base);
      const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${parsed.host}/live`;
    } catch {
      // Fallback
    }
  }

  // Web fallback using current window.location
  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/live`;
  }

  return 'wss://zoya-ai.onrender.com/live';
}
