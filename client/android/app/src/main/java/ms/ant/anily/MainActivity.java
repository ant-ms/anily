package ms.ant.anily;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AnilyNativePlugin.class);
        super.onCreate(savedInstanceState);

        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                String ua = settings.getUserAgentString();
                if (ua != null) {
                    settings.setUserAgentString(ua.replace("; wv", "").replaceAll("Version/[0-9.]+", ""));
                }

                ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
                    Insets insets = windowInsets.getInsets(
                        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                    );
                    float density = getResources().getDisplayMetrics().density;
                    int topDp = Math.round(insets.top / density);
                    int bottomDp = Math.round(insets.bottom / density);
                    int leftDp = Math.round(insets.left / density);
                    int rightDp = Math.round(insets.right / density);

                    webView.post(() -> {
                        String js = String.format(
                            "document.documentElement.style.setProperty('--safe-area-inset-top', '%dpx');" +
                            "document.documentElement.style.setProperty('--safe-area-inset-bottom', '%dpx');" +
                            "document.documentElement.style.setProperty('--safe-area-inset-left', '%dpx');" +
                            "document.documentElement.style.setProperty('--safe-area-inset-right', '%dpx');",
                            topDp, bottomDp, leftDp, rightDp
                        );
                        webView.evaluateJavascript(js, null);
                    });
                    return windowInsets;
                });
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, android.content.res.Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                String js = String.format("window.dispatchEvent(new CustomEvent('anily:pip-changed', { detail: { inPip: %b } }));", isInPictureInPictureMode);
                getBridge().getWebView().evaluateJavascript(js, null);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        try {
            if (AnilyNativePlugin.isAutoPipEnabled() && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                android.app.PictureInPictureParams.Builder builder = new android.app.PictureInPictureParams.Builder()
                    .setAspectRatio(new android.util.Rational(16, 9));
                enterPictureInPictureMode(builder.build());
            }
        } catch (Exception ignored) {}
    }
}
