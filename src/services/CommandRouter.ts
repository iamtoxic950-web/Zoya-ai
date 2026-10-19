import { zoyaAndroid, ActionRequest, ActionResult } from './ZoyaAndroidService';

export interface CommandIntent {
  isPhoneAction: boolean;
  actionRequest?: ActionRequest;
  confidence: number;
  confirmationRequired?: boolean;
}

/**
 * Command Router: converts natural-language intents into a predefined set of safe actions.
 * Initially supports:
 *   OPEN_APP
 *   OPEN_URL
 *   OPEN_SETTINGS
 *   SET_VOLUME
 *   SET_BRIGHTNESS
 *   PLAY_MEDIA
 *   PAUSE_MEDIA
 *   TOGGLE_FLASHLIGHT
 *   CREATE_REMINDER
 *   READ_NOTIFICATION_STATUS
 *   GET_BATTERY_STATUS
 */
export function routeCommandIntent(text: string): CommandIntent {
  const norm = text.toLowerCase().trim();

  // 1. OPEN_APP: "open youtube", "launch spotify", "open whatsapp", "start camera"
  const openAppMatch = norm.match(/^(?:zoya\s*,?\s*)?(?:please\s+)?(?:open|launch|start|run)\s+(?:the\s+)?([a-z0-9\s]+?)(?:\s+app)?$/i);
  if (openAppMatch && openAppMatch[1]) {
    const rawTarget = openAppMatch[1].trim();
    // Exclude settings / url / flashlight triggers
    if (!rawTarget.includes('setting') && !rawTarget.includes('flashlight') && !rawTarget.includes('torch')) {
      const formattedTarget = rawTarget.charAt(0).toUpperCase() + rawTarget.slice(1);
      return {
        isPhoneAction: true,
        actionRequest: {
          action: 'OPEN_APP',
          target: formattedTarget
        },
        confidence: 0.95
      };
    }
  }

  // 2. OPEN_SETTINGS: "open wifi settings", "open bluetooth settings", "open settings"
  if (norm.includes('open setting') || norm.includes('go to setting') || norm.includes('open wifi') || norm.includes('open bluetooth')) {
    let target = 'SYSTEM';
    if (norm.includes('wifi') || norm.includes('wi-fi')) target = 'WIFI';
    else if (norm.includes('bluetooth')) target = 'BLUETOOTH';
    else if (norm.includes('display')) target = 'DISPLAY';
    else if (norm.includes('sound') || norm.includes('volume')) target = 'SOUND';
    else if (norm.includes('battery')) target = 'BATTERY';

    return {
      isPhoneAction: true,
      actionRequest: {
        action: 'OPEN_SETTINGS',
        target
      },
      confidence: 0.9
    };
  }

  // 3. SET_VOLUME: "set volume to 50", "turn volume up", "volume 80"
  const volumeMatch = norm.match(/volume(?:\s+(?:to|level))?\s+(\d+)/i) || norm.match(/set\s+(?:the\s+)?volume\s+(?:to\s+)?(\d+)/i);
  if (volumeMatch && volumeMatch[1]) {
    return {
      isPhoneAction: true,
      actionRequest: {
        action: 'SET_VOLUME',
        value: volumeMatch[1]
      },
      confidence: 0.9
    };
  }

  // 4. SET_BRIGHTNESS: "set brightness to 70", "brightness 50 percent"
  const brightMatch = norm.match(/brightness(?:\s+(?:to|level))?\s+(\d+)/i) || norm.match(/set\s+(?:the\s+)?brightness\s+(?:to\s+)?(\d+)/i);
  if (brightMatch && brightMatch[1]) {
    return {
      isPhoneAction: true,
      actionRequest: {
        action: 'SET_BRIGHTNESS',
        value: brightMatch[1]
      },
      confidence: 0.9
    };
  }

  // 5. TOGGLE_FLASHLIGHT: "turn on flashlight", "toggle torch", "turn off flashlight"
  if (norm.includes('flashlight') || norm.includes('torch')) {
    const val = norm.includes('off') ? 'OFF' : norm.includes('on') ? 'ON' : 'TOGGLE';
    return {
      isPhoneAction: true,
      actionRequest: {
        action: 'TOGGLE_FLASHLIGHT',
        value: val
      },
      confidence: 0.95
    };
  }

  // 6. PLAY_MEDIA / PAUSE_MEDIA: "play music", "resume playback", "pause music", "stop music"
  if (norm.includes('pause music') || norm.includes('pause playback') || norm.includes('stop music')) {
    return {
      isPhoneAction: true,
      actionRequest: {
        action: 'PAUSE_MEDIA'
      },
      confidence: 0.9
    };
  }
  if (norm.includes('play music') || norm.includes('resume music') || norm.includes('resume playback')) {
    return {
      isPhoneAction: true,
      actionRequest: {
        action: 'PLAY_MEDIA'
      },
      confidence: 0.9
    };
  }

  // 7. GET_BATTERY_STATUS: "battery level", "what is my battery", "how much battery"
  if (norm.includes('battery level') || norm.includes('battery status') || (norm.includes('battery') && (norm.includes('what') || norm.includes('how much') || norm.includes('check')))) {
    return {
      isPhoneAction: true,
      actionRequest: {
        action: 'GET_BATTERY_STATUS'
      },
      confidence: 0.95
    };
  }

  // 8. READ_NOTIFICATION_STATUS: "read notifications", "check notifications"
  if (norm.includes('check notification') || norm.includes('read notification') || norm.includes('any new notification')) {
    return {
      isPhoneAction: true,
      actionRequest: {
        action: 'READ_NOTIFICATION_STATUS'
      },
      confidence: 0.9
    };
  }

  return {
    isPhoneAction: false,
    confidence: 0
  };
}
