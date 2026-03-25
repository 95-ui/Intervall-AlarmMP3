import type { AlarmSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const SETTINGS_KEY = 'intervall-alarm-settings';
const DB_NAME = 'intervall-alarm-db';
const DB_VERSION = 1;
const STORE_NAME = 'audio-files';
const AUDIO_KEY = 'current-audio';

// ===== LocalStorage for Settings =====

export function loadSettings(): AlarmSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Einstellungen konnten nicht geladen werden:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettingsToStorage(settings: AlarmSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Einstellungen konnten nicht gespeichert werden:', e);
  }
}

// ===== IndexedDB for Audio File =====

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAudioBlob(blob: Blob, fileName: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ blob, fileName }, AUDIO_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (e) {
    console.warn('Audio konnte nicht gespeichert werden:', e);
  }
}

export async function loadAudioBlob(): Promise<{ blob: Blob; fileName: string } | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(AUDIO_KEY);
      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (e) {
    console.warn('Audio konnte nicht geladen werden:', e);
    return null;
  }
}