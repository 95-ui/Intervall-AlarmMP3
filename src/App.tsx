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

// ===================================================================
// CountdownRing
// ===================================================================
function CountdownRing({
  remaining,
  total,
  isRunning,
  isAlarming,
}: {
  remaining: number;
  total: number;
  isRunning: boolean;
  isAlarming: boolean;
}) {
  const radius = 110;
  const strokeWidth = 10;
  const size = (radius + strokeWidth) * 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? remaining / total : 0;
  const dashOffset = circumference * (1 - progress);

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const timeDisplay =
    hours > 0
      ? `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      : `${minutes.toString().padStart(2, '0')}:${seconds
          .toString()
          .padStart(2, '0')}`;

  return (
    <div
      className={`relative flex items-center justify-center ${
        isAlarming ? 'animate-pulse-glow' : ''
      }`}
    >
      <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
        />

        {isRunning && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={isAlarming ? '#ef4444' : '#f59e0b'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        )}
      </svg>

      <div className="absolute text-center">
        <span className="text-xs text-slate-400">
          {isRunning ? 'Nächster Alarm in' : 'Bereit'}
        </span>
        <div className="text-3xl font-mono">
          {isRunning ? timeDisplay : '--:--'}
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// Popup
// ===================================================================
function PopupModal({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-slate-800 p-6 rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl mb-2">Alarm!</h2>
        <p className="mb-4">{text}</p>
        <button onClick={onClose} className="bg-amber-500 px-4 py-2 rounded">
          OK
        </button>
      </div>
    </div>
  );
}

// ===================================================================
// Main App
// ===================================================================
export default function App() {
  const [settings, setSettings] = useState<AlarmSettings>(() => loadSettings());
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [nativeAudioPath, setNativeAudioPath] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const targetTimeRef = useRef<number>(0);

  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  useEffect(() => {
    audioRef.current = new Audio();
  }, []);

  const getIntervalSeconds = () => {
    if (settings.intervalUnit === 'seconds') return settings.intervalValue;
    if (settings.intervalUnit === 'minutes') return settings.intervalValue * 60;
    return settings.intervalValue * 3600;
  };

  const triggerAlarm = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(() => {});
    }
    setShowPopup(true);
  };

  useEffect(() => {
    if (!isRunning) return;

    timerRef.current = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((targetTimeRef.current - Date.now()) / 1000)
      );

      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        triggerAlarm();
        const next = getIntervalSeconds();
        targetTimeRef.current = Date.now() + next * 1000;
      }
    }, 500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const startAlarm = () => {
    const total = getIntervalSeconds();
    setTotalSeconds(total);
    setRemainingSeconds(total);
    targetTimeRef.current = Date.now() + total * 1000;
    setIsRunning(true);
  };

  const stopAlarm = () => {
    setIsRunning(false);
    setRemainingSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const path = await saveAudioToFile(file);
    setNativeAudioPath(path);
    setAudioUrl(Capacitor.convertFileSrc(path));
  };

  const intervalDescription = `Alle ${settings.intervalValue} ${
    UNIT_LABELS[settings.intervalUnit]
  }`;

  return (
    <div className="p-6 text-white">
      <input type="file" accept="audio/*" onChange={handleFileSelect} />

      <CountdownRing
        remaining={remainingSeconds}
        total={totalSeconds}
        isRunning={isRunning}
        isAlarming={false}
      />

      <div className="mt-4">
        {!isRunning ? (
          <button onClick={startAlarm}>Start</button>
        ) : (
          <button onClick={stopAlarm}>Stop</button>
        )}
      </div>

      <p>{intervalDescription}</p>

      {showPopup && (
        <PopupModal text={settings.popupText} onClose={() => setShowPopup(false)} />
      )}
    </div>
  );
}
