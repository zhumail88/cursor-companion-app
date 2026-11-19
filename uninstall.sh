#!/usr/bin/env bash
# Removes Cursor Companion and its settings for the current user.
set -euo pipefail
UUID="cursor-companion@zhumail88.github.io"
gnome-extensions disable "$UUID" 2>/dev/null || true
rm -rf "$HOME/.local/share/gnome-shell/extensions/$UUID"
dconf reset -f /org/gnome/shell/extensions/cursor-companion/ 2>/dev/null || true
echo "Removed. Log out and back in to clear it from GNOME's extension list."
