export interface AlarmSettings {
  intervalValue: number;
  intervalUnit: 'seconds' | 'minutes' | 'hours';
  volume: number;
  playbackDurationEnabled: boolean;
  playbackDuration: number;
  activeHoursEnabled: boolean;
  activeHoursStart: string;
  activeHoursEnd: string;
  notificationEnabled: boolean;
  vibrationEnabled: boolean;
  popupEnabled: boolean;
  popupText: string;
  audioFileName: string;
}

export const UNIT_LABELS = {
  seconds: 'Sekunden',
  minutes: 'Minuten',
  hours: 'Stunden',
};

export const DEFAULT_SETTINGS: AlarmSettings = {
  intervalValue: 5,
  intervalUnit: 'minutes',
  volume: 80,
  playbackDurationEnabled: false,
  playbackDuration: 10,
  activeHoursEnabled: false,
  activeHoursStart: '08:00',
  activeHoursEnd: '22:00',
  notificationEnabled: true,
  vibrationEnabled: false,
  popupEnabled: false,
  popupText: 'Alarm! Zeit ist um!',
  audioFileName: '',
};