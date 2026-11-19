# Cursor Companion

A tiny picture that follows your mouse pointer: smoothly chasing, bouncing
and tilting as it goes. It comes with a cute blob, or you can use any image
you like.

<!-- Demo GIF goes here: ![Cursor Companion demo](docs/demo.gif) -->

- **Smooth chasing** with a slight trailing delay, frame-synced to your monitor
- **Tilts** toward the direction it's moving and **bounces** gently while it travels
- **Any picture**: PNG, SVG, WebP or JPEG. Transparent PNGs look best,
  and empty transparent margins are trimmed automatically
- **Never gets in the way**: your real cursor is untouched and clicks pass straight through
- **Lightweight**: stops animating when the mouse is still, and does nothing at all when turned off
- **One-click toggle** from the top bar, or <kbd>Super</kbd>+<kbd>Alt</kbd>+<kbd>C</kbd>

## Requirements

GNOME Shell 50 (Wayland). Windows support is planned.

## Install

### From extensions.gnome.org

*Coming soon.*

### From source

```bash
git clone https://github.com/zhumail88/cursor-companion-app.git
cd cursor-companion-app
./install.sh
```

Log out and back in (GNOME on Wayland only loads new extensions at login), then:

```bash
gnome-extensions enable cursor-companion@zhumail88.github.io
```

## Usage

| Action | How |
|---|---|
| Turn on / off | Left-click the blob in the top bar, or <kbd>Super</kbd>+<kbd>Alt</kbd>+<kbd>C</kbd> |
| Settings | Right-click the blob in the top bar, or `gnome-extensions prefs cursor-companion@zhumail88.github.io` |

In the settings you can change the picture, its size, follow speed, distance
from the cursor, and bounce and tilt strength. Changes apply instantly.

To change the shortcut:

```bash
gsettings --schemadir ~/.local/share/gnome-shell/extensions/cursor-companion@zhumail88.github.io/schemas \
  set org.gnome.shell.extensions.cursor-companion toggle-shortcut "['<Super><Alt>h']"
```

## Uninstall

```bash
./uninstall.sh
```

## How it works

On Wayland, regular apps can't see the global pointer position, place
windows at arbitrary coordinates, or reliably draw click-through overlays.
GNOME Shell is the compositor, so an extension can do all three:

- **Pointer position**: `global.get_pointer()`
- **Overlay**: a non-reactive `Clutter.Actor` at the top of the Shell's UI
  group. It isn't a window, so it has no background and never receives input.
- **Animation**: a `Clutter.Timeline` synced to the display's frame clock.
  Once the companion settles, the loop stops and GNOME's idle-aware pointer
  watcher wakes it on the next movement.
- **Image**: decoded asynchronously once, trimmed, and pre-scaled to a 2x
  texture. Nothing is decoded or resampled per frame.

```
src/
  extension.js    enable/disable, top bar toggle, shortcut, settings wiring
  companion.js    the overlay actor, frame loop and idle sleep
  motion.js       platform-independent math: chase, tilt, bounce, settle
  imageLoader.js  async image loading, trimming and scaling
  prefs.js        settings window (libadwaita)
  mascot.svg      the default blob
  icons/          top bar icons
  schemas/        GSettings schema
```

`motion.js` has no GNOME dependencies, so it can be shared by the upcoming
Windows version.

## Debugging

```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep -i companion   # live logs
gnome-extensions info cursor-companion@zhumail88.github.io       # state and errors
```

For a safer development loop, run a separate GNOME Shell in a window
(requires `sudo apt install mutter-dev-bin` on Ubuntu):

```bash
dbus-run-session gnome-shell --devkit --wayland
```

To build the zip for extensions.gnome.org: `./pack.sh`

## Known limitations

- Fullscreen games and videos that bypass compositing may hide the companion.
- It appears in screenshots and screen recordings.
- It is hidden on the lock screen.

## Roadmap

- [ ] Publish on extensions.gnome.org
- [ ] Windows 10/11 version
- [ ] Animated GIF support

## License

[GPL-2.0-or-later](LICENSE)
