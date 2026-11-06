#!/bin/sh
if [ -n "$ODY_OSASCRIPT_LOG" ]; then
  printf "%s %s\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$ODY_OSASCRIPT_LOG"
fi
printf "https://example.com/\n"
