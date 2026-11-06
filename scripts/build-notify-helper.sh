#!/bin/sh
set -e
root="$(cd "$(dirname "$0")/.." && pwd)"
source="$root/native/notify-auth/main.swift"
target="$root/build/bin/ody-notify-auth"

if ! command -v swiftc >/dev/null 2>&1; then
  echo "build-notify-helper: swiftc not found, keeping $target as is"
  exit 0
fi

if [ -f "$target" ] && [ "$target" -nt "$source" ]; then
  echo "build-notify-helper: $target is up to date"
  exit 0
fi

mkdir -p "$root/build/bin"
swiftc -O -o "$target" "$source"
echo "build-notify-helper: built $target"
