import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function spinRow(settings, key, title, subtitle, {min, max, step, digits = 0}) {
    const row = new Adw.SpinRow({
        title,
        subtitle,
        digits,
        adjustment: new Gtk.Adjustment({lower: min, upper: max, step_increment: step, page_increment: step * 10}),
    });
    settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

function switchRow(settings, key, title, subtitle) {
    const row = new Adw.SwitchRow({title, subtitle});
    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

function prettyPath(path) {
    const home = GLib.get_home_dir();
    return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

export default class CursorCompanionPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

        // General
        const general = new Adw.PreferencesGroup({title: 'General'});
        page.add(general);
        general.add(switchRow(settings, 'active', 'Show companion',
            'Also: click the icon in the top bar, or press Super+Alt+C'));
        general.add(switchRow(settings, 'show-panel-icon', 'Top bar icon',
            'Left-click toggles, right-click opens these settings'));

        // Image
        const look = new Adw.PreferencesGroup({title: 'Image'});
        page.add(look);

        const imageRow = new Adw.ActionRow({title: 'Picture'});
        const resetButton = new Gtk.Button({
            icon_name: 'edit-undo-symbolic',
            tooltip_text: 'Use the built-in blob',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });
        resetButton.connect('clicked', () => settings.reset('image-path'));
        const syncImageRow = () => {
            const path = settings.get_string('image-path');
            imageRow.subtitle = path || 'Built-in blob';
            resetButton.visible = path !== '';
        };
        settings.connect('changed::image-path', syncImageRow);
        syncImageRow();
        const chooseButton = new Gtk.Button({label: 'Choose...', valign: Gtk.Align.CENTER});
        chooseButton.connect('clicked', () => {
            const filter = new Gtk.FileFilter({name: 'Images'});
            for (const type of ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'])
                filter.add_mime_type(type);
            const filters = new Gio.ListStore({item_type: Gtk.FileFilter});
            filters.append(filter);
            const dialog = new Gtk.FileDialog({title: 'Choose a picture (transparent PNG works best)', filters});
            dialog.open(window, null, (_d, res) => {
                try {
                    const file = dialog.open_finish(res);
                    if (file?.get_path())
                        settings.set_string('image-path', prettyPath(file.get_path()));
                } catch {
                    // dialog dismissed
                }
            });
        });
        imageRow.add_suffix(resetButton);
        imageRow.add_suffix(chooseButton);
        look.add(imageRow);
        look.add(spinRow(settings, 'size', 'Size', 'Longest side in pixels', {min: 24, max: 512, step: 4}));

        // Movement
        const move = new Adw.PreferencesGroup({title: 'Movement'});
        page.add(move);
        move.add(spinRow(settings, 'follow-speed', 'Follow speed',
            'Higher is snappier, lower trails further behind', {min: 0.02, max: 1, step: 0.02, digits: 2}));
        move.add(spinRow(settings, 'offset-x', 'Distance right of cursor', 'Negative puts it on the left',
            {min: -300, max: 300, step: 2}));
        move.add(spinRow(settings, 'offset-y', 'Distance below cursor', 'Negative puts it above',
            {min: -300, max: 300, step: 2}));
        move.add(spinRow(settings, 'bounce-intensity', 'Bounce', '0 turns bouncing off',
            {min: 0, max: 3, step: 0.1, digits: 1}));
        move.add(spinRow(settings, 'tilt-intensity', 'Tilt', '0 turns tilting off',
            {min: 0, max: 3, step: 0.1, digits: 1}));
    }
}
