package ms.ant.anily;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

public class DownloadService extends Service {
    public static final String ACTION_START = "ms.ant.anily.action.START_DOWNLOAD";
    public static final String ACTION_UPDATE = "ms.ant.anily.action.UPDATE_DOWNLOAD";
    public static final String ACTION_STOP = "ms.ant.anily.action.STOP_DOWNLOAD";

    private static final String CHANNEL_ID = "anily_episode_downloads";
    private static final int NOTIFICATION_ID = 40401;

    private NotificationManager notificationManager;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "anily:download_service");
            wakeLock.setReferenceCounted(false);
            try {
                wakeLock.acquire(4 * 60 * 60 * 1000L); // 4 hours maximum timeout safety
            } catch (Exception ignored) {}
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Episode Downloads",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows active episode download progress");
            channel.setShowBadge(false);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String title, String text, int progress, boolean indeterminate) {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = null;
        if (launchIntent != null) {
            pendingIntent = PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(title != null ? title : "Downloading Anime")
            .setContentText(text != null ? text : "Downloading episode...")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent);

        if (indeterminate) {
            builder.setProgress(0, 0, true);
        } else if (progress >= 0 && progress <= 100) {
            builder.setProgress(100, progress, false);
        }

        return builder.build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopForegroundService();
            return START_NOT_STICKY;
        }

        String title = intent.getStringExtra("title");
        String text = intent.getStringExtra("text");
        int progress = intent.getIntExtra("progress", -1);
        boolean indeterminate = intent.getBooleanExtra("indeterminate", false);

        Notification notification = buildNotification(title, text, progress, indeterminate);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Exception ignored) {}
        }

        if (notificationManager != null) {
            notificationManager.notify(NOTIFICATION_ID, notification);
        }

        return START_STICKY;
    }

    private void stopForegroundService() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
        }
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
