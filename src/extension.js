// Cursor Companion: a little picture that chases the mouse pointer.
//
// The "active" setting is the on/off switch. Toggle it with:
//   * left-click on the icon in the top bar (right-click opens settings)
//   * the keyboard shortcut (default Super+Alt+C)
//   * the switch in the preferences window
// When off, nothing is drawn or polled. The image stays decoded in
// memory (a few hundred KB) so turning it back on is instant.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {Companion} from './companion.js';
import {loadImage} from './imageLoader.js';

const MOTION_KEYS = ['follow-speed', 'bounce-intensity', 'tilt-intensity', 'offset-x', 'offset-y'];

const ToggleButton = GObject.registerClass(
class ToggleButton extends PanelMenu.Button {
    _init(ext) {
        super._init(0.0, 'Cursor Companion', true);
        this._ext = ext;

        this._icon = new St.Icon({style_class: 'system-status-icon'});
        this.add_child(this._icon);

        const left = new Clutter.ClickGesture({required_button: Clutter.BUTTON_PRIMARY});
        left.connect('recognize', () => ext.toggle());
        this.add_action(left);

        const right = new Clutter.ClickGesture({required_button: Clutter.BUTTON_SECONDARY});
        right.connect('recognize', () => ext.openPreferences());
        this.add_action(right);
    }

    sync(active) {
        const name = active ? 'blob-filled-symbolic.svg' : 'blob-outline-symbolic.svg';
        this._icon.gicon = Gio.FileIcon.new(this._ext.dir.get_child('icons').get_child(name));
        this.opacity = active ? 255 : 150;
    }
});

export default class CursorCompanionExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._companion = new Companion(this._settings);
        this._cancellable = new Gio.Cancellable();
        this._loadGeneration = 0;

        this._settingsIds = [
            this._settings.connect('changed::active', () => this._syncActive()),
            this._settings.connect('changed::show-panel-icon', () => this._syncPanelIcon()),
            this._settings.connect('changed::image-path', () => this._reloadImage()),
            this._settings.connect('changed::size', () => this._reloadImage()),
            ...MOTION_KEYS.map(key => this._settings.connect(`changed::${key}`,
                () => this._companion.onMotionSettingsChanged())),
        ];

        Main.wm.addKeybinding('toggle-shortcut', this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this.toggle());

        this._syncPanelIcon();
        this._reloadImage();
    }

    disable() {
        Main.wm.removeKeybinding('toggle-shortcut');
        this._settingsIds.forEach(id => this._settings.disconnect(id));
        this._settingsIds = null;

        this._cancellable.cancel();
        this._cancellable = null;

        this._button?.destroy();
        this._button = null;

        this._companion.destroy();
        this._companion = null;
        this._settings = null;
    }

    toggle() {
        this._settings.set_boolean('active', !this._settings.get_boolean('active'));
    }

    _syncActive() {
        const active = this._settings.get_boolean('active');
        if (active)
            this._companion.show();
        else
            this._companion.hide();
        this._button?.sync(active);
    }

    _syncPanelIcon() {
        const wanted = this._settings.get_boolean('show-panel-icon');
        if (wanted && !this._button) {
            this._button = new ToggleButton(this);
            Main.panel.addToStatusArea(this.uuid, this._button);
            this._button.sync(this._settings.get_boolean('active'));
        } else if (!wanted && this._button) {
            this._button.destroy();
            this._button = null;
        }
    }

    async _reloadImage() {
        const generation = ++this._loadGeneration;
        const custom = this._settings.get_string('image-path');
        const path = custom || this.dir.get_child('mascot.svg').get_path();
        const size = this._settings.get_int('size');
        const cancellable = this._cancellable;
        const textureScale = Math.max(2, this._companion.scaleFactor);

        let image;
        try {
            image = await loadImage(path, size, textureScale, cancellable);
        } catch (e) {
            if (cancellable.is_cancelled())
                return;
            console.warn(`[cursor-companion] could not load "${path}": ${e.message}`);
            Main.notify('Cursor Companion',
                `Couldn't load the image "${path}". Pick another one in the settings.`);
            return;
        }

        // Ignore stale results (disabled meanwhile, or a newer load started).
        if (cancellable.is_cancelled() || generation !== this._loadGeneration)
            return;

        this._companion.setImage(image);
        this._syncActive();
    }
}
