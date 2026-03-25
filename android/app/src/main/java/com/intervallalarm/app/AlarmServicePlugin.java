package com.intervallalarm.app;

import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AlarmService")
public class AlarmServicePlugin extends Plugin {

    @PluginMethod()
    public void startAlarm(PluginCall call) {
        long intervalMs = call.getLong("intervalMs", 300000L);
        float volume = call.getFloat("volume", 0.8f);
        int maxPlayDuration = call.getInt("maxPlayDuration", 10);
        String audioUri = call.getString("audioUri", null);

        Intent intent = new Intent(getContext(), AlarmForegroundService.class);
        intent.putExtra("intervalMs", intervalMs);
        intent.putExtra("volume", volume);
        intent.putExtra("maxPlayDuration", maxPlayDuration);
        intent.putExtra("audioUri", audioUri); 

        getContext().startForegroundService(intent);
        call.resolve();
    }

    @PluginMethod()
    public void stopAlarm(PluginCall call) {
        Intent intent = new Intent(getContext(), AlarmForegroundService.class);
        intent.setAction("STOP");
        getContext().startService(intent);
        call.resolve();
    }
}
