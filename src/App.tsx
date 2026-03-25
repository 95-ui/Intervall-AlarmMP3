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
// CountdownRing - Circular SVG countdown display
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

  let timeDisplay: string;
  if (hours > 0) {
    timeDisplay = `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  return (
    <div
      className={`relative flex items-center justify-center ${
        isAlarming ? 'animate-pulse-glow' : ''
      }`}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="ring-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#ring-bg)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        {isRunning && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={isAlarming ? '#ef4444' : 'url(#ring-gradient)'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700 ease-linear"
          />
        )}
        {/* Dot markers */}
        {[0, 90, 180, 270].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x = center + (radius + strokeWidth + 6) * Math.cos(rad);
          const y = center + (radius + strokeWidth + 6) * Math.sin(rad);
          return (
            <circle
              key={angle}
              cx={x}
              cy={y}
              r={2}
              fill="#475569"
            />
          );
        })}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-slate-500 text-xs uppercase tracking-widest mb-2 font-medium">
          {isAlarming
            ? '🔔 Alarm!'
            : isRunning
            ? 'Nächster Alarm in'
            : 'Bereit'}
        </span>
        <span
          className={`font-mono font-bold tracking-wider ${
            isAlarming
              ? 'text-red-400 text-4xl animate-alarm-flash'
              : isRunning
              ? 'text-white text-4xl'
              : 'text-slate-600 text-3xl'
          }`}
        >
          {isRunning ? timeDisplay : '--:--'}
        </span>
        {isRunning && !isAlarming && (
          <span className="text-emerald-400 text-xs mt-2 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Aktiv
          </span>
        )}
      </div>
    </div>
  );
}

// ===================================================================
// PopupModal - Fullscreen alarm popup
// ===================================================================
function PopupModal({
  text,
  onClose,
}: {
  text: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-slate-800 to-slate-900 border border-amber-500/30 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl shadow-amber-500/20 animate-bounce-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-6xl mb-5 animate-pulse">🔔</div>
        <h2 className="text-2xl font-bold text-white mb-2">Alarm!</h2>
        <div className="w-12 h-0.5 bg-amber-500/50 mx-auto mb-4" />
        <p className="text-slate-300 text-lg mb-8 leading-relaxed">{text}</p>
        <button
          onClick={onClose}
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-bold rounded-2xl transition-all active:scale-95 text-lg shadow-lg shadow-amber-500/25"
        >
          OK
        </button>
      </div>
    </div>
  );
}

// ===================================================================
// Toggle - Custom toggle switch
// ===================================================================
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer select-none group">
      <span className="text-slate-300 text-sm group-hover:text-slate-200 transition-colors">
        {label}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 ${
          checked ? 'bg-amber-500' : 'bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}

// ===================================================================
// SettingsSection - Reusable card wrapper
// ===================================================================
function SettingsSection({
  icon,
  title,
  children,
  className = '',
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-slate-800/40 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-4 animate-slide-up ${className}`}
    >
      <h2 className="text-amber-400 font-semibold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
        <span>{icon}</span> {title}
      </h2>
      {children}
    </section>
  );
}

// ===================================================================
// Main App Component
// ===================================================================
export default function App() {
  // ---- State ----
  const [settings, setSettings] = useState<AlarmSettings>(() => loadSettings());
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [nativeAudioPath, setNativeAudioPath] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [isAlarming, setIsAlarming] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);

  // ---- Refs ----
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const playbackTimeoutRef = useRef<number | null>(null);
  const targetTimeRef = useRef<number>(0);
  const settingsRef = useRef<AlarmSettings>(settings);
  const audioUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Keep refs in sync
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  // ---- Settings persistence ----
  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  const updateSettings = useCallback((partial: Partial<AlarmSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  // ---- Audio element lifecycle ----
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = 'auto';

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  // Update audio source
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
  }, [audioUrl]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = settings.volume / 100;
    }
  }, [settings.volume]);

  // ---- Load saved audio on mount ----
  useEffect(() => {
    const loadInitialAudio = async () => {
        const savedSettings = loadSettings();
        if (savedSettings.audioFileName) {
            try {
                // Check if the file exists in the new location
                const uriResult = await Filesystem.getUri({
                    directory: Directory.Data,
                    path: 'alarm.mp3',
                });

                setNativeAudioPath(uriResult.uri);

                // Create a playable URL for the webview for the test button
                const webUrl = Capacitor.convertFileSrc(uriResult.uri);
                setAudioUrl(webUrl);

            } catch (e) {
                // File doesn't exist at the new path.
                // This could be the first run after the update.
                // Let's try to load from the old IndexedDB location as a fallback.
                const result = await loadAudioBlob();
                if (result) {
                    const url = URL.createObjectURL(result.blob);
                    setAudioUrl(url);
                    // We don't have a native path yet, user will have to re-select the file once.
                }
            }
            setSettings(prev => ({ ...prev, audioFileName: savedSettings.audioFileName }));
        }
        setAudioLoaded(true);
    };

    loadInitialAudio();
}, []);


  // ---- Helper: Get interval in seconds ----
  const getIntervalSeconds = useCallback((): number => {
    const s = settingsRef.current;
    switch (s.intervalUnit) {
      case 'seconds':
        return s.intervalValue;
      case 'minutes':
        return s.intervalValue * 60;
      case 'hours':
        return s.intervalValue * 3600;
    }
  }, []);

  // ---- Helper: Check active hours ----
  const isWithinActiveHours = useCallback((): boolean => {
    const s = settingsRef.current;
    if (!s.activeHoursEnabled) return true;

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = s.activeHoursStart.split(':').map(Number);
    const [endH, endM] = s.activeHoursEnd.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (startMins <= endMins) {
      return currentMins >= startMins && currentMins <= endMins;
    }
    // Crosses midnight
    return currentMins >= startMins || currentMins <= endMins;
  }, []);

  // ---- Trigger alarm ----
  const triggerAlarm = useCallback(() => {
    const s = settingsRef.current;

    // Check active hours
    if (!isWithinActiveHours()) return;

    // Play audio
    if (audioRef.current && audioUrlRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.volume = s.volume / 100;
      audioRef.current.play().catch(() => {});
      setIsAlarming(true);

      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
      }
      
      const handleEnded = () => {
        setIsAlarming(false);
        audioRef.current?.removeEventListener('ended', handleEnded);
      };

      if (s.playbackDurationEnabled && s.playbackDuration > 0) {
        playbackTimeoutRef.current = window.setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          setIsAlarming(false);
        }, s.playbackDuration * 1000);
      } else {
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.addEventListener('ended', handleEnded);
      }
    }

    if (s.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }

    if (
      s.notificationEnabled &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
          reg?.getNotifications({ tag: 'interval-alarm-trigger' })
            .then(notifs => notifs.forEach(n => n.close()));
        });
      }
      try {
        new Notification('🔔 Intervall-Alarm', {
          body: s.popupEnabled ? s.popupText : 'Alarm ausgelöst!',
          tag: 'interval-alarm-trigger',
          requireInteraction: false,
        });
      } catch (e) {
        console.warn('Notification failed:', e);
      }
    }

    if (s.popupEnabled) {
      setShowPopup(true);
    }
  }, [isWithinActiveHours]);

  // ---- Timer effect ----
  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(
        0,
        Math.ceil((targetTimeRef.current - now) / 1000)
      );
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        triggerAlarm();
        const nextInterval = getIntervalSeconds() * 1000;
        targetTimeRef.current = Date.now() + nextInterval;
        setRemainingSeconds(getIntervalSeconds());
      }
    };

    timerRef.current = window.setInterval(tick, 500);
    tick();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, triggerAlarm, getIntervalSeconds]);

  // ---- Start alarm ----
  const startAlarm = useCallback(() => {
    if (!nativeAudioPath) {
      alert('⚠️ Bitte zuerst eine Audiodatei wählen!');
      return;
    }

    if (
      settings.notificationEnabled &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission();
    }

    const audio = audioRef.current;
    const originalVolume = audio.volume;
    audio.volume = 0.01;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = originalVolume;
      })
      .catch(() => {
        audio.volume = originalVolume;
      });

    const totalSec = getIntervalSeconds();
    setTotalSeconds(totalSec);
    setRemainingSeconds(totalSec);
    targetTimeRef.current = Date.now() + totalSec * 1000;

    const intervalMs = settings.intervalValue * 
      (settings.intervalUnit === 'hours' ? 3600000 : 
      settings.intervalUnit === 'minutes' ? 60000 : 1000);
    const maxDur = settings.playbackDurationEnabled ? settings.playbackDuration : 0;
    startNativeAlarm(intervalMs, settings.volume, maxDur, nativeAudioPath);

    setIsRunning(true);

    if (
      settings.notificationEnabled &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification('⏱️ Intervall-Alarm aktiv', {
          body: `Alarm alle ${settings.intervalValue} ${
            UNIT_LABELS[settings.intervalUnit]
          }`,
          tag: 'interval-alarm-status',
          requireInteraction: false,
        });
      } catch {}
    }
  }, [nativeAudioPath, settings, getIntervalSeconds]);

  // ---- Stop alarm ----
  const stopAlarm = useCallback(() => {
    setIsRunning(false);
    setRemainingSeconds(0);
    setTotalSeconds(0);
    setIsAlarming(false);
    stopNativeAlarm();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
  }, []);

  // ---- File selection ----
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }

      try {
        const nativePath = await saveAudioToFile(file);
        setNativeAudioPath(nativePath);
        updateSettings({ audioFileName: file.name });
        const webUrl = Capacitor.convertFileSrc(nativePath);
        setAudioUrl(webUrl);
      } catch (error) {
        console.error("Error processing file:", error);
        alert("Fehler beim Verarbeiten der Audiodatei.");
      }
    },
    [audioUrl, updateSettings]
  );

  // ---- Test play ----
  const testPlay = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;

    if (isTesting) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsTesting(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = settings.volume / 100;
      audioRef.current.play().catch(() => {});
      setIsTesting(true);

      const handleEnded = () => {
        setIsTesting(false);
        audioRef.current?.removeEventListener('ended', handleEnded);
      };
      audioRef.current.addEventListener('ended', handleEnded);

      if (settings.playbackDurationEnabled && settings.playbackDuration > 0) {
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          setIsTesting(false);
        }, settings.playbackDuration * 1000);
      }
    }
  }, [audioUrl, isTesting, settings.volume, settings.playbackDurationEnabled, settings.playbackDuration]);

  // ---- Close popup ----
  const closePopup = useCallback(() => {
    setShowPopup(false);
  }, []);

  // ---- Computed values ----
  const intervalDescription = `Alle ${settings.intervalValue} ${
    UNIT_LABELS[settings.intervalUnit]
  }`;

  // ---- Loading state ----
  if (!audioLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🔔</div>
          <p className="text-slate-400">Laden...</p>
        </div>
      </div>
    );
  }

  // ===================================================================
  // RENDER
  // ===================================================================
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-x-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <header className="pt-6 pb-2 text-center relative">
        <div className="inline-flex items-center gap-2">
          <span className="text-2xl">🔔</span>
          <h1 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            Intervall-Alarm
          </h1>
        </div>
        <p className="text-slate-500 text-xs mt-0.5 tracking-wide">
          Wiederholender Alarm-Timer
        </p>
      </header>

      <div className="flex justify-center py-4">
        <CountdownRing
          remaining={remainingSeconds}
          total={totalSeconds}
          isRunning={isRunning}
          isAlarming={isAlarming}
        />
      </div>

      {isRunning && (
        <div className="text-center mb-2">
          <span className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700/40 rounded-full px-4 py-1.5 text-xs text-slate-400">
            ⏱️ {intervalDescription}
            {settings.activeHoursEnabled && (
              <span className="text-amber-400/70">
                | {settings.activeHoursStart}–{settings.activeHoursEnd}
              </span>
            )}
          </span>
        </div>
      )}

      <div className="flex justify-center gap-3 px-6 pb-4 pt-2">
        {!isRunning ? (
          <button
            onClick={startAlarm}
            className="flex-1 max-w-xs py-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold rounded-2xl text-lg shadow-lg shadow-emerald-500/20 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            Starten
          </button>
        ) : (
          <button
            onClick={stopAlarm}
            className="flex-1 max-w-xs py-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-bold rounded-2xl text-lg shadow-lg shadow-red-500/20 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Stoppen
          </button>
        )}
      </div>

      <div className="px-4 pb-8 space-y-3 max-w-lg mx-auto">
        <SettingsSection icon="🎵" title="Audiodatei">
          {settings.audioFileName ? (
            <div className="flex items-center gap-2 bg-slate-900/60 rounded-xl px-3 py-2.5 mb-3 border border-slate-700/30">
              <span className="text-amber-400 text-lg">♪</span>
              <span className="text-sm text-slate-300 truncate flex-1">
                {settings.audioFileName}
              </span>
              <span className="text-emerald-400 text-xs">✓</span>
            </div>
          ) : (
            <div className="text-slate-500 text-sm italic mb-3 bg-slate-900/30 rounded-xl px-3 py-2.5 border border-dashed border-slate-700/40">
              Keine Datei ausgewählt
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isRunning}
              className="flex-1 py-2.5 bg-slate-700/80 hover:bg-slate-600/80 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 border border-slate-600/40"
            >
              📁 Datei wählen
            </button>
            <button
              onClick={testPlay}
              disabled={!audioUrl}
              className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 border ${
                isTesting
                  ? 'bg-red-500/15 text-red-400 border-red-500/40 hover:bg-red-500/25'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/40 hover:bg-amber-500/25'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {isTesting ? '⏹ Stop' : '▶ Test'}
            </button>
          </div>
        </SettingsSection>

        <SettingsSection icon="⏱️" title="Intervall">
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                min="1"
                max="999"
                value={settings.intervalValue}
                onChange={(e) =>
                  updateSettings({
                    intervalValue: Math.max(
                      1,
                      parseInt(e.target.value) || 1
                    ),
                  })
                }
                disabled={isRunning}
                className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-center text-xl font-mono text-white disabled:opacity-40 disabled:cursor-not-allowed focus:border-amber-500/50 transition-colors"
              />
            </div>
            <select
              value={settings.intervalUnit}
              onChange={(e) =>
                updateSettings({
                  intervalUnit: e.target.value as AlarmSettings['intervalUnit'],
                })
              }
              disabled={isRunning}
              className="flex-1 bg-slate-900/60 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed appearance-none text-center focus:border-amber-500/50 transition-colors cursor-pointer"
            >
              <option value="seconds">Sekunden</option>
              <option value="minutes">Minuten</option>
              <option value="hours">Stunden</option>
            </select>
          </div>
          <p className="text-slate-500 text-xs mt-2 text-center">
            {intervalDescription} wird der Alarm ausgelöst
          </p>
        </SettingsSection>

        <SettingsSection icon="🔊" title="Lautstärke">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-lg">🔈</span>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.volume}
              onChange={(e) =>
                updateSettings({ volume: parseInt(e.target.value) })
              }
              className="flex-1"
            />
            <span className="text-slate-500 text-lg">🔊</span>
            <span className="text-amber-400 font-mono text-sm w-11 text-right font-medium">
              {settings.volume}%
            </span>
          </div>
        </SettingsSection>

        <SettingsSection icon="⏳" title="Abspieldauer">
          <Toggle
            checked={settings.playbackDurationEnabled}
            onChange={(v) =>
              updateSettings({ playbackDurationEnabled: v })
            }
            label="Abspieldauer begrenzen"
          />
          {settings.playbackDurationEnabled && (
            <div className="mt-3 flex items-center gap-3 animate-slide-up">
              <span className="text-slate-400 text-sm">Max.</span>
              <input
                type="number"
                min="1"
                max="3600"
                value={settings.playbackDuration}
                onChange={(e) =>
                  updateSettings({
                    playbackDuration: Math.max(
                      1,
                      parseInt(e.target.value) || 1
                    ),
                  })
                }
                className="w-24 bg-slate-900/60 border border-slate-600/50 rounded-xl px-3 py-2 text-center font-mono text-white focus:border-amber-500/50 transition-colors"
              />
              <span className="text-slate-400 text-sm">Sekunden</span>
            </div>
          )}
        </SettingsSection>

        <SettingsSection icon="🕐" title="Aktive Zeiten">
          <Toggle
            checked={settings.activeHoursEnabled}
            onChange={(v) =>
              updateSettings({ activeHoursEnabled: v })
            }
            label="Nur zu bestimmten Zeiten aktiv"
          />
          {settings.activeHoursEnabled && (
            <div className="mt-3 flex items-center gap-2 animate-slide-up">
              <input
                type="time"
                value={settings.activeHoursStart}
                onChange={(e) =>
                  updateSettings({ activeHoursStart: e.target.value })
                }
                className="flex-1 bg-slate-900/60 border border-slate-600/50 rounded-xl px-3 py-2.5 text-center text-white text-sm focus:border-amber-500/50 transition-colors"
              />
              <span className="text-slate-500 text-sm font-medium">bis</span>
              <input
                type="time"
                value={settings.activeHoursEnd}
                onChange={(e) =>
                  updateSettings({ activeHoursEnd: e.target.value })
                }
                className="flex-1 bg-slate-900/60 border border-slate-600/50 rounded-xl px-3 py-2.5 text-center text-white text-sm focus:border-amber-500/50 transition-colors"
              />
            </div>
          )}
        </SettingsSection>

        <SettingsSection icon="📱" title="Benachrichtigung">
          <Toggle
            checked={settings.notificationEnabled}
            onChange={(v) =>
              updateSettings({ notificationEnabled: v })
            }
            label="Benachrichtigung bei Alarm anzeigen"
          />
          <p className="text-slate-600 text-xs mt-2">
            Zeigt eine Benachrichtigung in der Statusleiste
          </p>
        </SettingsSection>

        <SettingsSection icon="📳" title="Vibration">
          <Toggle
            checked={settings.vibrationEnabled}
            onChange={(v) =>
              updateSettings({ vibrationEnabled: v })
            }
            label="Vibration bei Alarm"
          />
          <p className="text-slate-600 text-xs mt-2">
            Handy vibriert bei jedem Alarm (optional)
          </p>
        </SettingsSection>

        <SettingsSection icon="💬" title="Popup-Nachricht">
          <Toggle
            checked={settings.popupEnabled}
            onChange={(v) => updateSettings({ popupEnabled: v })}
            label="Popup bei Alarm anzeigen"
          />
          {settings.popupEnabled && (
            <div className="mt-3 animate-slide-up">
              <input
                type="text"
                value={settings.popupText}
                onChange={(e) =>
                  updateSettings({ popupText: e.target.value })
                }
                placeholder="Nachricht eingeben..."
                maxLength={200}
                className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500/50 transition-colors"
              />
              <p className="text-slate-600 text-xs mt-1.5 text-right">
                {settings.popupText.length}/200
              </p>
            </div>
          )}
        </SettingsSection>

        <div className="text-center pt-4 pb-10 space-y-3">
          <div className="inline-flex items-center gap-2 bg-slate-800/30 border border-slate-700/30 rounded-xl px-4 py-2.5">
            <span className="text-amber-400">💡</span>
            <p className="text-slate-500 text-xs text-left">
              <strong className="text-slate-400">Tipp:</strong> Halte die App im Vordergrund
              für beste Ergebnisse. Für echte Hintergrund-Funktionalität
              empfehlen wir die APK-Version mit der Anleitung oben.
            </p>
          </div>
          <p className="text-slate-700 text-xs">
            Intervall-Alarm v1.1 • Alle Einstellungen werden automatisch gespeichert
          </p>
        </div>
      </div>

      {showPopup && (
        <PopupModal text={settings.popupText} onClose={closePopup} />
      )}
    </div>
  );
}
