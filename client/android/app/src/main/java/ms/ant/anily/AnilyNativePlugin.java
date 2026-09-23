package ms.ant.anily;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.Iterator;

@CapacitorPlugin(name = "AnilyNative")
public class AnilyNativePlugin extends Plugin {

    @PluginMethod
    public void openExternalPlayer(PluginCall call) {
        String url = call.getString("url");
        String mimeType = call.getString("mimeType", "video/*");
        Boolean isLocalFile = call.getBoolean("isLocalFile", false);
        String filename = call.getString("filename");

        String subtitleUrl = call.getString("subtitleUrl");
        String subtitleTitle = call.getString("subtitleTitle", "English");

        if (url == null && filename == null) {
            call.reject("Either url or filename must be provided");
            return;
        }

        try {
            Context context = getContext();
            Intent intent = new Intent(Intent.ACTION_VIEW);

            if (Boolean.TRUE.equals(isLocalFile) || (filename != null && !filename.isEmpty())) {
                String targetFilename = filename != null ? filename : url;
                File moviesDir = context.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
                File file = new File(moviesDir, targetFilename);

                if (!file.exists() || file.length() == 0) {
                    call.reject("File does not exist or is empty: " + targetFilename);
                    return;
                }

                String authority = context.getPackageName() + ".fileprovider";
                Uri contentUri = FileProvider.getUriForFile(context, authority, file);

                intent.setDataAndType(contentUri, mimeType);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                Uri uri = Uri.parse(url);
                intent.setDataAndType(uri, mimeType);
            }

            if (subtitleUrl != null && !subtitleUrl.isEmpty()) {
                Uri subUri = Uri.parse(subtitleUrl);
                // VLC for Android
                intent.putExtra("subtitles_location", subtitleUrl);
                // MX Player
                intent.putExtra("subs", new android.os.Parcelable[] { subUri });
                intent.putExtra("subs.name", new String[] { subtitleTitle });
                intent.putExtra("subs.filename", new String[] { subtitleTitle });
                intent.putExtra("subs.enable", new boolean[] { true });
                // MPV Android / Just Player
                intent.putExtra("subtitles", subtitleUrl);
                intent.putExtra("sub", subUri);
            }

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            Intent chooser = Intent.createChooser(intent, "Play with");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            context.startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open external player: " + e.getMessage(), e);
        }
    }

    private static class DownloadTask {
        String id;
        String filename;
        volatile String status = "PENDING"; // "PENDING", "RUNNING", "SUCCESSFUL", "FAILED"
        volatile long bytesDownloaded = 0;
        volatile long totalBytes = 0;
        volatile String errorMessage = null;
        java.util.concurrent.Future<?> future;
        java.net.HttpURLConnection connection;
    }

    private final java.util.Map<String, DownloadTask> activeDownloads = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.concurrent.ExecutorService downloadExecutor = java.util.concurrent.Executors.newFixedThreadPool(2);

    private void startDownloadService(String title, String text) {
        try {
            Context context = getContext();
            Intent intent = new Intent(context, DownloadService.class);
            intent.setAction(DownloadService.ACTION_START);
            intent.putExtra("title", title);
            intent.putExtra("text", text);
            intent.putExtra("indeterminate", true);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception ignored) {}
    }

    private void updateDownloadServiceProgress(String title, String text, int progress) {
        try {
            Context context = getContext();
            Intent intent = new Intent(context, DownloadService.class);
            intent.setAction(DownloadService.ACTION_UPDATE);
            intent.putExtra("title", title);
            intent.putExtra("text", text);
            intent.putExtra("progress", progress);
            intent.putExtra("indeterminate", progress < 0);
            context.startService(intent);
        } catch (Exception ignored) {}
    }

    private void checkStopDownloadService() {
        boolean hasActive = false;
        for (DownloadTask t : activeDownloads.values()) {
            if ("RUNNING".equals(t.status) || "PENDING".equals(t.status)) {
                hasActive = true;
                break;
            }
        }
        if (!hasActive) {
            try {
                Context context = getContext();
                Intent intent = new Intent(context, DownloadService.class);
                intent.setAction(DownloadService.ACTION_STOP);
                context.startService(intent);
            } catch (Exception ignored) {}
        }
    }

    @PluginMethod
    public void downloadEpisode(PluginCall call) {
        String url = call.getString("url");
        String filename = call.getString("filename");
        String title = call.getString("title", "Episode");
        String animeTitle = call.getString("animeTitle", "Anily");
        JSObject headers = call.getObject("headers");

        if (url == null || filename == null) {
            call.reject("URL and filename are required");
            return;
        }

        try {
            Context context = getContext();
            String downloadId = java.util.UUID.randomUUID().toString();
            DownloadTask task = new DownloadTask();
            task.id = downloadId;
            task.filename = filename;
            task.status = "RUNNING";
            activeDownloads.put(downloadId, task);

            startDownloadService(animeTitle, "Downloading " + title);

            task.future = downloadExecutor.submit(() -> {
                File moviesDir = context.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
                File tmpFile = new File(moviesDir, filename + ".download");
                File finalFile = new File(moviesDir, filename);

                java.net.HttpURLConnection conn = null;
                try {
                    String currentUrl = url;
                    int redirects = 0;
                    while (redirects < 5) {
                        java.net.URL requestUrl = new java.net.URL(currentUrl);
                        conn = (java.net.HttpURLConnection) requestUrl.openConnection();
                        conn.setInstanceFollowRedirects(false);
                        conn.setConnectTimeout(30000);
                        conn.setReadTimeout(60000);
                        conn.setRequestProperty("User-Agent", "Anily-Android/1.0");

                        if (headers != null) {
                            Iterator<String> keys = headers.keys();
                            while (keys.hasNext()) {
                                String key = keys.next();
                                String val = headers.getString(key);
                                if (val != null) {
                                    conn.setRequestProperty(key, val);
                                }
                            }
                        }

                        try {
                            String webCookies = android.webkit.CookieManager.getInstance().getCookie(currentUrl);
                            if (webCookies != null && !webCookies.isEmpty()) {
                                String existingCookie = conn.getRequestProperty("Cookie");
                                conn.setRequestProperty("Cookie", existingCookie != null ? existingCookie + "; " + webCookies : webCookies);
                            }
                        } catch (Exception ignored) {}

                        task.connection = conn;
                        conn.connect();

                        int code = conn.getResponseCode();
                        if (code == java.net.HttpURLConnection.HTTP_MOVED_PERM || code == java.net.HttpURLConnection.HTTP_MOVED_TEMP || code == 307 || code == 308) {
                            String loc = conn.getHeaderField("Location");
                            if (loc != null) {
                                currentUrl = new java.net.URL(requestUrl, loc).toString();
                                conn.disconnect();
                                redirects++;
                                continue;
                            }
                        }
                        break;
                    }

                    int responseCode = conn.getResponseCode();
                    if (responseCode != java.net.HttpURLConnection.HTTP_OK && responseCode != java.net.HttpURLConnection.HTTP_PARTIAL) {
                        task.status = "FAILED";
                        task.errorMessage = "Server returned HTTP " + responseCode;
                        if (tmpFile.exists()) tmpFile.delete();
                        return;
                    }

                    String contentType = conn.getContentType();
                    if (contentType != null) {
                        String lowerType = contentType.toLowerCase();
                        if (lowerType.contains("text/html") || lowerType.contains("application/json")) {
                            task.status = "FAILED";
                            task.errorMessage = "Server returned HTML/JSON instead of video. Authentication may be invalid or stream unavailable.";
                            if (tmpFile.exists()) tmpFile.delete();
                            return;
                        }
                    }

                    long contentLength = conn.getContentLengthLong();
                    task.totalBytes = contentLength > 0 ? contentLength : 0;

                    try (java.io.InputStream in = conn.getInputStream();
                         FileOutputStream out = new FileOutputStream(tmpFile)) {
                        byte[] buffer = new byte[16384];
                        int bytesRead;
                        long lastNotifiedBytes = 0;
                        while ((bytesRead = in.read(buffer)) != -1) {
                            if (Thread.currentThread().isInterrupted()) {
                                task.status = "FAILED";
                                task.errorMessage = "Download cancelled";
                                tmpFile.delete();
                                return;
                            }
                            out.write(buffer, 0, bytesRead);
                            task.bytesDownloaded += bytesRead;

                            if (task.bytesDownloaded - lastNotifiedBytes > 512 * 1024) {
                                lastNotifiedBytes = task.bytesDownloaded;
                                int prog = -1;
                                String progressText = (task.bytesDownloaded / (1024 * 1024)) + " MB";
                                if (task.totalBytes > 0) {
                                    prog = (int) ((task.bytesDownloaded * 100) / task.totalBytes);
                                    progressText += " / " + (task.totalBytes / (1024 * 1024)) + " MB (" + prog + "%)";
                                }
                                updateDownloadServiceProgress(animeTitle, title + " • " + progressText, prog);
                            }
                        }
                        out.flush();
                    }

                    if (task.bytesDownloaded == 0) {
                        task.status = "FAILED";
                        task.errorMessage = "Server returned empty stream (0 bytes)";
                        if (tmpFile.exists()) tmpFile.delete();
                        return;
                    }

                    if (task.totalBytes > 0 && task.bytesDownloaded < task.totalBytes) {
                        task.status = "FAILED";
                        task.errorMessage = "Download incomplete: received " + task.bytesDownloaded + " of " + task.totalBytes + " bytes";
                        if (tmpFile.exists()) tmpFile.delete();
                        return;
                    }

                    if (finalFile.exists()) {
                        finalFile.delete();
                    }
                    if (tmpFile.renameTo(finalFile)) {
                        task.status = "SUCCESSFUL";
                    } else {
                        task.status = "FAILED";
                        task.errorMessage = "Failed to finalize downloaded file";
                        tmpFile.delete();
                    }
                } catch (Exception e) {
                    task.status = "FAILED";
                    task.errorMessage = e.getMessage();
                    if (tmpFile.exists()) tmpFile.delete();
                } finally {
                    if (conn != null) {
                        try { conn.disconnect(); } catch (Exception ignored) {}
                    }
                    checkStopDownloadService();
                }
            });

            JSObject ret = new JSObject();
            ret.put("downloadId", downloadId);
            ret.put("filename", filename);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start download: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getDownloadStatus(PluginCall call) {
        String downloadIdStr = call.getString("downloadId");
        String filename = call.getString("filename");
        if (downloadIdStr == null && filename == null) {
            call.reject("downloadId or filename is required");
            return;
        }

        DownloadTask task = downloadIdStr != null ? activeDownloads.get(downloadIdStr) : null;
        if (task != null) {
            JSObject ret = new JSObject();
            ret.put("status", task.status);
            ret.put("bytesDownloaded", task.bytesDownloaded);
            ret.put("totalBytes", task.totalBytes);
            if (task.errorMessage != null) {
                ret.put("reason", task.errorMessage);
            }
            call.resolve(ret);
            return;
        }

        Context context = getContext();
        File moviesDir = context.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
        if (filename != null) {
            File file = new File(moviesDir, filename);
            if (file.exists() && file.length() > 0) {
                JSObject ret = new JSObject();
                ret.put("status", "SUCCESSFUL");
                ret.put("bytesDownloaded", file.length());
                ret.put("totalBytes", file.length());
                call.resolve(ret);
                return;
            }
        }

        JSObject notFound = new JSObject();
        notFound.put("status", "NOT_FOUND");
        notFound.put("bytesDownloaded", 0);
        notFound.put("totalBytes", 0);
        call.resolve(notFound);
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String downloadIdStr = call.getString("downloadId");
        String filename = call.getString("filename");
        if (downloadIdStr == null && filename == null) {
            call.reject("downloadId or filename is required");
            return;
        }

        DownloadTask task = downloadIdStr != null ? activeDownloads.remove(downloadIdStr) : null;
        if (task == null && filename != null) {
            for (java.util.Map.Entry<String, DownloadTask> entry : activeDownloads.entrySet()) {
                if (filename.equals(entry.getValue().filename)) {
                    task = activeDownloads.remove(entry.getKey());
                    break;
                }
            }
        }

        if (task != null) {
            if (task.future != null) {
                task.future.cancel(true);
            }
            if (task.connection != null) {
                try { task.connection.disconnect(); } catch (Exception ignored) {}
            }
            Context context = getContext();
            File moviesDir = context.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
            File tmpFile = new File(moviesDir, task.filename + ".download");
            if (tmpFile.exists()) {
                tmpFile.delete();
            }
        }

        checkStopDownloadService();

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkDownloadedEpisode(PluginCall call) {
        String filename = call.getString("filename");
        if (filename == null) {
            call.reject("filename is required");
            return;
        }

        try {
            Context context = getContext();
            File moviesDir = context.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
            File file = new File(moviesDir, filename);

            boolean exists = file.exists() && file.length() > 0;
            if (file.exists() && file.length() == 0) {
                file.delete();
            }

            JSObject ret = new JSObject();
            ret.put("exists", exists);
            ret.put("size", exists ? file.length() : 0);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to check file: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void deleteDownloadedEpisode(PluginCall call) {
        String filename = call.getString("filename");
        if (filename == null) {
            call.reject("filename is required");
            return;
        }

        try {
            Context context = getContext();
            File moviesDir = context.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
            File file = new File(moviesDir, filename);

            boolean deleted = file.exists() && file.delete();
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("deleted", deleted);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to delete file: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getStorageInfo(PluginCall call) {
        try {
            Context context = getContext();
            File moviesDir = context.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
            if (moviesDir == null) {
                JSObject ret = new JSObject();
                ret.put("freeSpace", 0);
                ret.put("totalSpace", 0);
                ret.put("usedByApp", 0);
                ret.put("files", new com.getcapacitor.JSArray());
                call.resolve(ret);
                return;
            }

            long freeSpace = moviesDir.getFreeSpace();
            long totalSpace = moviesDir.getTotalSpace();
            long usedByApp = 0;

            File[] files = moviesDir.listFiles((dir, name) -> name.startsWith("anily_ep_") && name.endsWith(".mp4"));
            com.getcapacitor.JSArray filesArr = new com.getcapacitor.JSArray();

            if (files != null) {
                for (File f : files) {
                    if (f.length() > 0) {
                        usedByApp += f.length();
                        JSObject fileObj = new JSObject();
                        fileObj.put("filename", f.getName());
                        fileObj.put("size", f.length());
                        filesArr.put(fileObj);
                    } else {
                        f.delete();
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("freeSpace", freeSpace);
            ret.put("totalSpace", totalSpace);
            ret.put("usedByApp", usedByApp);
            ret.put("files", filesArr);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get storage info: " + e.getMessage(), e);
        }
    }

    private static volatile boolean autoPipEnabled = false;

    public static boolean isAutoPipEnabled() {
        return autoPipEnabled;
    }

    @PluginMethod
    public void setAutoPip(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", false);
        autoPipEnabled = Boolean.TRUE.equals(enabled);
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void enterPip(PluginCall call) {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.O) {
            call.reject("Picture-in-Picture requires Android 8.0 or higher");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                android.app.PictureInPictureParams.Builder builder = new android.app.PictureInPictureParams.Builder()
                    .setAspectRatio(new android.util.Rational(16, 9));
                boolean success = getActivity().enterPictureInPictureMode(builder.build());
                JSObject ret = new JSObject();
                ret.put("success", success);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to enter Picture-in-Picture: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void setBrightness(PluginCall call) {
        Double brightness = call.getDouble("brightness");
        if (brightness == null) {
            call.reject("brightness value is required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                android.view.Window window = getActivity().getWindow();
                android.view.WindowManager.LayoutParams lp = window.getAttributes();
                if (brightness < 0) {
                    lp.screenBrightness = android.view.WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
                } else {
                    lp.screenBrightness = (float) Math.max(0.01, Math.min(1.0, brightness));
                }
                window.setAttributes(lp);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to set brightness: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void getBrightness(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                android.view.Window window = getActivity().getWindow();
                android.view.WindowManager.LayoutParams lp = window.getAttributes();
                float current = lp.screenBrightness;
                JSObject ret = new JSObject();
                ret.put("brightness", current);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to get brightness: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void getLocalEpisodePath(PluginCall call) {
        String filename = call.getString("filename");
        if (filename == null || filename.isEmpty()) {
            call.reject("filename is required");
            return;
        }

        Context context = getContext();
        File moviesDir = context.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
        File file = new File(moviesDir, filename);

        JSObject ret = new JSObject();
        ret.put("exists", file.exists() && file.length() > 0);
        ret.put("path", file.getAbsolutePath());
        call.resolve(ret);
    }
}
