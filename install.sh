#!/usr/bin/env bash
# Installs Cursor Companion for the current user from this source folder.
set -euo pipefail
UUID="cursor-companion@zhumail88.github.io"
SRC="$(cd "$(dirname "$0")" && pwd)/src"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

mkdir -p "$DEST"
cp -r "$SRC"/. "$DEST"/
glib-compile-schemas "$DEST/schemas"
echo "Installed to $DEST"
echo "Log out and back in, then run:  gnome-extensions enable $UUID"
