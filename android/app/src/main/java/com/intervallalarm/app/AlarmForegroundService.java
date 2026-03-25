package com.intervallalarm.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import android.util.Log;

public class AlarmForegroundService extends Service {
    private static final String TAG = "AlarmForegroundService";
    private static final String CHANNEL_ID = "alarm_channel";
    private static final int NOTIFICATION_ID = 1;
    private Handler handler;
    private Runnable alarmRunnable;
    private MediaPlayer mediaPlayer;
    private PowerManager.WakeLock wakeLock;
    private long intervalMs = 300000;
    private float volume = 0.8f;
    private String audioUri;
    private int maxPlayDuration = 10;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        handler = new Handler(Looper.getMainLooper());

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "IntervalAlarm::WakeLock");
        try {
            wakeLock.acquire();
            Log.d(TAG, "Wakelock acquired");
        } catch (Exception e) {
            Log.e(TAG, "Error acquiring wakelock", e);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("STOP".equals(action)) {
                stopSelf();
                return START_NOT_STICKY;
            }
            intervalMs = intent.getLongExtra("intervalMs", 300000);
            volume = intent.getFloatExtra("volume", 0.8f);
            maxPlayDuration = intent.getIntExtra("maxPlayDuration", 10);
            audioUri = intent.getStringExtra("audioUri");
            Log.d(TAG, "Starting service with interval: " + intervalMs + "ms, audioUri: " + audioUri);
        }

        startForeground(NOTIFICATION_ID, buildNotification("Alarm aktiv - Nächster Alarm wird vorbereitet..."));
        startAlarmLoop();
        return START_STICKY;
    }

    private void startAlarmLoop() {
        if (alarmRunnable != null) handler.removeCallbacks(alarmRunnable);
        alarmRunnable = new Runnable() {
            @Override
            public void run() {
                Log.d(TAG, "Runnable triggered. Playing alarm.");
                playAlarm();
                updateNotification("Alarm ausgelöst! Nächster in " + (intervalMs / 60000) + "min");
                handler.postDelayed(this, intervalMs);
            }
        };
        handler.postDelayed(alarmRunnable, intervalMs);
    }

    private void playAlarm() {
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            }
            
            mediaPlayer = new MediaPlayer();

            if (audioUri != null && !audioUri.isEmpty()) {
                Log.d(TAG, "Attempting to play custom audio: " + audioUri);
                // **THE FIX**: Use the setDataSource(String) overload for file paths
                Uri parsedUri = Uri.parse(audioUri);
                if ("file".equals(parsedUri.getScheme())) {
                    // It's a file URI, so we can use its path.
                    mediaPlayer.setDataSource(parsedUri.getPath());
                } else {
                    // It might be a content URI or something else, let the system handle it.
                    mediaPlayer.setDataSource(getApplicationContext(), parsedUri);
                }
            } else {
                Log.w(TAG, "Audio URI is null or empty, playing default alarm sound.");
                mediaPlayer.setDataSource(getApplicationContext(), android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI);
            }

            mediaPlayer.prepare();
            mediaPlayer.setVolume(volume, volume);
            mediaPlayer.start();
            Log.d(TAG, "MediaPlayer started.");

            mediaPlayer.setOnCompletionListener(mp -> {
                Log.d(TAG, "MediaPlayer finished playing.");
                mp.release();
                mediaPlayer = null;
            });

            if (maxPlayDuration > 0) {
                handler.postDelayed(() -> {
                    if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                        Log.d(TAG, "Max play duration reached. Stopping MediaPlayer.");
                        mediaPlayer.stop();
                    }
                }, maxPlayDuration * 1000L);
            }

        } catch (Exception e) {
            // Log the exception but DO NOT play a fallback sound.
            Log.e(TAG, "Error setting up or playing media player", e);
        }
    }


    private Notification buildNotification(String text) {
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Intervall-Alarm")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(pi)
            .setOngoing(true)
            .build();
    }

    private void updateNotification(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        nm.notify(NOTIFICATION_ID, buildNotification(text));
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Alarm Service", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Zeigt an, dass der Intervall-Alarm aktiv ist");
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.createNotificationChannel(channel);
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "Service being destroyed.");
        if (handler != null && alarmRunnable != null) handler.removeCallbacks(alarmRunnable);
        if (mediaPlayer != null) { 
             if (mediaPlayer.isPlaying()) {
                mediaPlayer.stop();
             }
            mediaPlayer.release(); 
            mediaPlayer = null; 
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            Log.d(TAG, "Wakelock released");
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
