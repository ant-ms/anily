#!/bin/sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

APK_SRC="${1:-$ROOT_DIR/client/android/app/build/outputs/apk/debug/app-debug.apk}"
OUTPUT_DIR="${2:-$SCRIPT_DIR}"
TEMPLATE_FILE="$SCRIPT_DIR/index.template.html"

if [ ! -f "$APK_SRC" ]; then
  echo "Error: APK source file not found at '$APK_SRC'" >&2
  exit 1
fi

if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "Error: Template file not found at '$TEMPLATE_FILE'" >&2
  exit 1
fi

COMMIT_SHA="${CI_COMMIT_SHORT_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo "latest")}"
COMMIT_REF="${CI_COMMIT_REF_NAME:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")}"
COMMIT_TITLE="${CI_COMMIT_TITLE:-$(git log -1 --pretty=%s 2>/dev/null || echo "Automated build")}"
COMMIT_DATE="${CI_COMMIT_TIMESTAMP:-$(date -u +"%Y-%m-%d %H:%M UTC")}"
PROJECT_URL="${CI_PROJECT_URL:-https://gitlab.com/ant.ms/anily}"
PAGES_URL="${CI_PAGES_URL:-https://ant.ms.gitlab.io/anily}"
case "$PAGES_URL" in
  */) ;;
  *) PAGES_URL="${PAGES_URL}/" ;;
esac
APP_ID="ms.ant.anily"
APP_NAME="Anily"
APP_VERSION="$(grep 'versionName' "$ROOT_DIR/client/android/app/build.gradle" 2>/dev/null | sed 's/.*versionName "\([^"]*\)".*/\1/' || echo "1.0")"

html_escape() {
  printf '%s' "$1" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g'
}

urlencode() {
  printf '%s' "$1" | awk 'BEGIN {
    for (i = 0; i <= 255; i++) {
      c = sprintf("%c", i);
      if (c ~ /[a-zA-Z0-9_.~-]/) {
        map[c] = c;
      } else {
        map[c] = sprintf("%%%02X", i);
      }
    }
  }
  {
    len = length($0);
    for (i = 1; i <= len; i++) {
      char = substr($0, i, 1);
      printf "%s", (char in map ? map[char] : char);
    }
  }'
}

ESC_APP_NAME="$(html_escape "$APP_NAME")"
ESC_APP_VERSION="$(html_escape "$APP_VERSION")"
ESC_COMMIT_SHA="$(html_escape "$COMMIT_SHA")"
ESC_COMMIT_REF="$(html_escape "$COMMIT_REF")"
ESC_COMMIT_TITLE="$(html_escape "$COMMIT_TITLE")"
ESC_COMMIT_DATE="$(html_escape "$COMMIT_DATE")"
ESC_PROJECT_URL="$(html_escape "$PROJECT_URL")"
ESC_PAGES_URL="$(html_escape "$PAGES_URL")"

APK_FILENAME="anily-${APP_VERSION}-${COMMIT_SHA}.apk"

mkdir -p "$OUTPUT_DIR"

echo "Copying APKs to $OUTPUT_DIR..."
cp "$APK_SRC" "$OUTPUT_DIR/$APK_FILENAME"
cp "$APK_SRC" "$OUTPUT_DIR/anily-${COMMIT_SHA}.apk"
cp "$APK_SRC" "$OUTPUT_DIR/anily.apk"
cp "$APK_SRC" "$OUTPUT_DIR/app-debug.apk"

APK_SHA256="$(sha256sum "$APK_SRC" | awk '{print $1}')"
echo "$APK_SHA256  $APK_FILENAME" > "$OUTPUT_DIR/$APK_FILENAME.sha256"
echo "$APK_SHA256  anily.apk" > "$OUTPUT_DIR/anily.apk.sha256"
APK_SIZE="$(ls -lh "$APK_SRC" | awk '{print $5}')"

if [ -f "$ROOT_DIR/client/public/icon-192.png" ]; then
  cp "$ROOT_DIR/client/public/icon-192.png" "$OUTPUT_DIR/icon.png"
fi
if [ -f "$ROOT_DIR/client/public/favicon.ico" ]; then
  cp "$ROOT_DIR/client/public/favicon.ico" "$OUTPUT_DIR/favicon.ico"
fi

cat <<EOF > "$OUTPUT_DIR/obtainium.json"
{
  "id": "$APP_ID",
  "url": "$PAGES_URL",
  "author": "ant.ms",
  "name": "$APP_NAME",
  "additionalSettings": "{\"versionExtractionRegEx\":\"anily-(.+)\\\\\\\\.apk\",\"matchGroupToUse\":\"1\"}"
}
EOF

# Static pre-encoded Obtainium deep link for fallback
STATIC_CONFIG="{\"id\":\"$APP_ID\",\"url\":\"$PAGES_URL\",\"author\":\"ant.ms\",\"name\":\"$APP_NAME\",\"additionalSettings\":\"{\\\"versionExtractionRegEx\\\":\\\"anily-(.+)\\\\\\\\.apk\\\",\\\"matchGroupToUse\\\":\\\"1\\\"}\"}"
STATIC_CONFIG_ENCODED="$(urlencode "$STATIC_CONFIG")"
STATIC_OBTAINIUM_DIRECT="obtainium://app/$STATIC_CONFIG_ENCODED"
STATIC_OBTAINIUM_REDIRECT="https://apps.obtainium.imranr.dev/redirect?r=$STATIC_OBTAINIUM_DIRECT"

# Substitute placeholders from template into index.html
sed \
  -e "s|{{APP_NAME}}|$ESC_APP_NAME|g" \
  -e "s|{{APP_VERSION}}|$ESC_APP_VERSION|g" \
  -e "s|{{COMMIT_SHA}}|$ESC_COMMIT_SHA|g" \
  -e "s|{{COMMIT_REF}}|$ESC_COMMIT_REF|g" \
  -e "s|{{COMMIT_TITLE}}|$ESC_COMMIT_TITLE|g" \
  -e "s|{{COMMIT_DATE}}|$ESC_COMMIT_DATE|g" \
  -e "s|{{PROJECT_URL}}|$ESC_PROJECT_URL|g" \
  -e "s|{{PAGES_URL}}|$ESC_PAGES_URL|g" \
  -e "s|{{APK_FILENAME}}|$APK_FILENAME|g" \
  -e "s|{{APK_SIZE}}|$APK_SIZE|g" \
  -e "s|{{APK_SHA256}}|$APK_SHA256|g" \
  -e "s|{{STATIC_OBTAINIUM_DIRECT}}|$STATIC_OBTAINIUM_DIRECT|g" \
  -e "s|{{STATIC_OBTAINIUM_REDIRECT}}|$STATIC_OBTAINIUM_REDIRECT|g" \
  "$TEMPLATE_FILE" > "$OUTPUT_DIR/index.html"

echo "Successfully generated GitLab Pages deployment in $OUTPUT_DIR"
