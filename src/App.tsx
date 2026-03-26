import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import type { AlarmSettings } from "./types";
import { UNIT_LABELS } from "./types";
import { startNativeAlarm, stopNativeAlarm } from './nativeAlarm';
import { saveAudioToFile } from './utils/audio';
import {
  loadSettings,
  saveSettingsToStorage,
  loadAudioBlob,
} from './utils/storage';

// ================= Countdown =================
function CountdownRing({ remaining, total }: { remaining: number; total: number }) {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? remaining / total : 0;

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="220">
        <circle
          cx="110"
          cy="110"
          r={radius}
          stroke="#1e293b"
          strokeWidth="10"
          fill="none"
        />
        <circle
          cx="110"
          cy="110"
          r={radius}
          stroke="#f59e0b"
          strokeWidth="10"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-3xl font-mono mt-2">
        {remaining}s
      </div>
    </div>
  );
}

// ================= Popup =================
function PopupModal({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div className="bg-slate-800 p-6 rounded-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl mb-2">Alarm!</h2>
        <p className="mb-4">{text}</p>
        <button onClick={onClose} className="bg-amber-500 px-4 py-2 rounded">
          OK
        </button>
      </div>
    </div>
  );
}

// ================= APP =================
export default function App() {
  const [settings, setSettings] = useState<AlarmSettings>(() => loadSettings());
  const [isRunning, setIsRunning] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [nativePath, setNativePath] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const targetRef = useRef<number>(0);

  // ===== Init Audio =====
  useEffect(() => {
    audioRef.current = new Audio();
  }, []);

  // ===== Load Settings =====
  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  // ===== Load saved audio =====
  useEffect(() => {
    const load = async () => {
      if (settings.audioFileName) {
        try {
          const uri = await Filesystem.getUri({
            directory: Directory.Data,
            path: 'alarm.mp3',
          });
          setNativePath(uri.uri);
          setAudioUrl(Capacitor.convertFileSrc(uri.uri));
        } catch {
          const old = await loadAudioBlob();
          if (old) {
            setAudioUrl(URL.createObjectURL(old.blob));
          }
        }
      }
    };
    load();
  }, []);

  // ===== Interval helper =====
  const getSeconds = useCallback(() => {
    if (settings.intervalUnit === 'seconds') return settings.intervalValue;
    if (settings.intervalUnit === 'minutes') return settings.intervalValue * 60;
    return settings.intervalValue * 3600;
  }, [settings]);

  // ===== Alarm trigger =====
  const trigger = useCallback(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl;
      audioRef.current.volume = settings.volume / 100;
      audioRef.current.play().catch(() => {});
    }

    if (settings.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    if (settings.popupEnabled) {
      setShowPopup(true);
    }
  }, [audioUrl, settings]);

  // ===== Timer =====
  useEffect(() => {
    if (!isRunning) return;

    timerRef.current = window.setInterval(() => {
      const r = Math.max(0, Math.ceil((targetRef.current - Date.now()) / 1000));
      setRemaining(r);

      if (r <= 0) {
        trigger();
        const next = getSeconds();
        targetRef.current = Date.now() + next * 1000;
      }
    }, 500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, trigger, getSeconds]);

  // ===== Start =====
  const start = () => {
    if (!nativePath) {
      alert("Bitte Audio wählen");
      return;
    }

    const sec = getSeconds();
    setTotal(sec);
    setRemaining(sec);
    targetRef.current = Date.now() + sec * 1000;

    startNativeAlarm(sec * 1000, settings.volume, 0, nativePath);

    setIsRunning(true);
  };

  // ===== Stop =====
  const stop = () => {
    setIsRunning(false);
    stopNativeAlarm();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // ===== File =====
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const path = await saveAudioToFile(f);
    setNativePath(path);
    setAudioUrl(Capacitor.convertFileSrc(path));

    setSettings(prev => ({ ...prev, audioFileName: f.name }));
  };

  return (
    <div className="p-6 text-white">
      <input type="file" accept="audio/*" onChange={handleFile} />

      <CountdownRing remaining={remaining} total={total} />

      <div className="mt-4 flex gap-2">
        {!isRunning ? (
          <button onClick={start}>Start</button>
        ) : (
          <button onClick={stop}>Stop</button>
        )}
      </div>

      <p className="mt-2">
        Alle {settings.intervalValue} {UNIT_LABELS[settings.intervalUnit]}
      </p>

      {showPopup && (
        <PopupModal
          text={settings.popupText}
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  );
}
