#!/usr/bin/env bash
# Builds the zip uploaded to extensions.gnome.org (dist/<uuid>.shell-extension.zip).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
gnome-extensions pack src --force --out-dir=dist \
    --extra-source=companion.js \
    --extra-source=imageLoader.js \
    --extra-source=motion.js \
    --extra-source=mascot.svg \
    --extra-source=icons
ls -l dist
