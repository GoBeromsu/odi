#!/bin/sh
set -e
root="$(cd "$(dirname "$0")/.." && pwd)"
source="$root/native/notify-auth/main.swift"
bundle="$root/build/bin/ody-notifier.app"
target="$bundle/Contents/MacOS/ody-notifier"

if ! command -v swiftc >/dev/null 2>&1; then
  echo "build-notify-helper: swiftc not found, keeping $bundle as is"
  exit 0
fi

if [ -f "$target" ] && [ "$target" -nt "$source" ] && [ "$target" -nt "$0" ]; then
  echo "build-notify-helper: $bundle is up to date"
  exit 0
fi

rm -rf "$bundle" "$root/build/bin/ody-notify-auth"
mkdir -p "$bundle/Contents/MacOS" "$bundle/Contents/Resources"
swiftc -O -o "$target" "$source"
iconset="$(mktemp -d)/icon.iconset"
mkdir -p "$iconset"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$root/build/icon.png" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  sips -z "$((size * 2))" "$((size * 2))" "$root/build/icon.png" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$iconset" -o "$bundle/Contents/Resources/icon.icns"
rm -rf "$(dirname "$iconset")"
cat > "$bundle/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>com.gobeomsu.ody.notifier</string>
  <key>CFBundleName</key><string>ody</string>
  <key>CFBundleDisplayName</key><string>ody</string>
  <key>CFBundleExecutable</key><string>ody-notifier</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST
codesign -s - --force "$bundle"
echo "build-notify-helper: built $bundle"
