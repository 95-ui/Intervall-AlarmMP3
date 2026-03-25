import { Capacitor, registerPlugin } from '@capacitor/core';

interface AlarmServicePlugin {
  startAlarm(options: {
    intervalMs: number;
    volume: number;
    maxPlayDuration: number;
    audioUri: string | null;
  }): Promise<void>;
  stopAlarm(): Promise<void>;
}

const AlarmService = registerPlugin<AlarmServicePlugin>('AlarmService');

export async function startNativeAlarm(
  intervalMs: number,
  volume: number,
  maxPlayDuration: number,
  audioUri: string
): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await AlarmService.startAlarm({
        intervalMs,
        volume: volume / 100,
        maxPlayDuration,
        audioUri,
      });
      return true;
    } catch (e) {
      console.error('Native alarm failed:', e);
      return false;
    }
  }
  return false;
}

export async function stopNativeAlarm(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      await AlarmService.stopAlarm();
      return true;
    } catch (e) {
      console.error('Native alarm stop failed:', e);
      return false;
    }
  }
  return false;
}
