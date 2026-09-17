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
import java.util.Iterator;

@CapacitorPlugin(name = "AnilyNative")
public class AnilyNativePlugin extends Plugin {

    @PluginMethod
    public void openExternalPlayer(PluginCall call) {
        String url = call.getString("url");
        String mimeType = call.getString("mimeType", "video/*");
        Boolean isLocalFile = call.getBoolean("isLocalFile", false);
        String filename = call.getString("filename");

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

                if (!file.exists()) {
                    call.reject("File does not exist: " + targetFilename);
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
            DownloadManager downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);

            if (downloadManager == null) {
                call.reject("DownloadManager not available on this device");
                return;
            }

            Uri downloadUri = Uri.parse(url);
            DownloadManager.Request request = new DownloadManager.Request(downloadUri);

            request.setTitle(animeTitle);
            request.setDescription(title);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalFilesDir(context, Environment.DIRECTORY_MOVIES, filename);

            if (headers != null) {
                Iterator<String> keys = headers.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    String val = headers.getString(key);
                    if (val != null) {
                        request.addRequestHeader(key, val);
                    }
                }
            }

            long downloadId = downloadManager.enqueue(request);

            JSObject ret = new JSObject();
            ret.put("downloadId", String.valueOf(downloadId));
            ret.put("filename", filename);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to enqueue download: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getDownloadStatus(PluginCall call) {
        String downloadIdStr = call.getString("downloadId");
        if (downloadIdStr == null) {
            call.reject("downloadId is required");
            return;
        }

        try {
            long downloadId = Long.parseLong(downloadIdStr);
            Context context = getContext();
            DownloadManager downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);

            if (downloadManager == null) {
                call.reject("DownloadManager not available");
                return;
            }

            DownloadManager.Query query = new DownloadManager.Query();
            query.setFilterById(downloadId);

            try (Cursor cursor = downloadManager.query(query)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                    int bytesDownloadedIdx = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
                    int totalBytesIdx = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
                    int reasonIdx = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);

                    int status = cursor.getInt(statusIdx);
                    long bytesDownloaded = cursor.getLong(bytesDownloadedIdx);
                    long totalBytes = cursor.getLong(totalBytesIdx);
                    int reason = cursor.getInt(reasonIdx);

                    String statusStr;
                    switch (status) {
                        case DownloadManager.STATUS_PENDING:
                            statusStr = "PENDING";
                            break;
                        case DownloadManager.STATUS_RUNNING:
                            statusStr = "RUNNING";
                            break;
                        case DownloadManager.STATUS_PAUSED:
                            statusStr = "PAUSED";
                            break;
                        case DownloadManager.STATUS_SUCCESSFUL:
                            statusStr = "SUCCESSFUL";
                            break;
                        case DownloadManager.STATUS_FAILED:
                            statusStr = "FAILED";
                            break;
                        default:
                            statusStr = "UNKNOWN";
                            break;
                    }

                    JSObject ret = new JSObject();
                    ret.put("status", statusStr);
                    ret.put("bytesDownloaded", bytesDownloaded);
                    ret.put("totalBytes", totalBytes);
                    ret.put("reason", reason);
                    call.resolve(ret);
                    return;
                }
            }

            JSObject notFound = new JSObject();
            notFound.put("status", "NOT_FOUND");
            notFound.put("bytesDownloaded", 0);
            notFound.put("totalBytes", 0);
            call.resolve(notFound);
        } catch (Exception e) {
            call.reject("Failed to query download status: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String downloadIdStr = call.getString("downloadId");
        if (downloadIdStr == null) {
            call.reject("downloadId is required");
            return;
        }

        try {
            long downloadId = Long.parseLong(downloadIdStr);
            Context context = getContext();
            DownloadManager downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);

            if (downloadManager != null) {
                downloadManager.remove(downloadId);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to cancel download: " + e.getMessage(), e);
        }
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

            JSObject ret = new JSObject();
            ret.put("exists", file.exists());
            ret.put("size", file.exists() ? file.length() : 0);
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
}
