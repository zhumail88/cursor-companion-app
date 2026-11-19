// The on-screen companion: one non-reactive actor on top of GNOME Shell's
// UI layer, driven by CompanionMotion.
//
// Power use:
//  * While the cursor moves (or the image is still settling) we animate
//    in sync with the display's frame clock.
//  * Once settled, the frame loop stops completely and we fall back to the
//    Shell's own idle-aware pointer watcher, which wakes us on movement.
//  * When the companion is turned off, the actor, timeline and watcher are
//    all destroyed: zero work is done.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Graphene from 'gi://Graphene';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {getPointerWatcher} from 'resource:///org/gnome/shell/ui/pointerWatcher.js';

import {CompanionMotion} from './motion.js';

const WAKE_POLL_MS = 30;
const MAX_DT = 0.05; // clamp long frame gaps so nothing jumps

export class Companion {
    constructor(settings) {
        this._settings = settings;
        this._motion = new CompanionMotion();
        this._actor = null;
        this._timeline = null;
        this._watch = null;
        this._lastTime = 0;
        this._image = null; // {content, width, height}
        this._applyMotionSettings();
    }

    get scaleFactor() {
        return St.ThemeContext.get_for_stage(global.stage).scale_factor;
    }

    _applyMotionSettings() {
        this._motion.followSpeed = this._settings.get_double('follow-speed');
        this._motion.bounceIntensity = this._settings.get_double('bounce-intensity');
        this._motion.tiltIntensity = this._settings.get_double('tilt-intensity');
        this._offsetX = this._settings.get_int('offset-x');
        this._offsetY = this._settings.get_int('offset-y');
    }

    onMotionSettingsChanged() {
        this._applyMotionSettings();
        this._wake();
    }

    // Called with a freshly loaded image (or when it changes).
    setImage(image) {
        this._image = image;
        if (this._actor)
            this._applyImage();
    }

    _applyImage() {
        const sf = this.scaleFactor;
        this._actor.set_content(this._image.content);
        this._actor.set_size(this._image.width * sf, this._image.height * sf);
    }

    show() {
        if (this._actor || !this._image)
            return;

        this._actor = new Clutter.Actor({
            reactive: false,          // never receives clicks / scrolls
            pivot_point: new Graphene.Point({x: 0.5, y: 0.5}),
        });
        this._actor.set_content_scaling_filters(
            Clutter.ScalingFilter.TRILINEAR, Clutter.ScalingFilter.LINEAR);
        this._applyImage();

        // Topmost child of the Shell UI group: above windows and panels.
        Main.layoutManager.uiGroup.add_child(this._actor);

        this._timeline = new Clutter.Timeline({
            actor: this._actor,
            duration: 1000,
            repeat_count: -1,
        });
        this._timeline.connect('new-frame', () => this._onFrame());

        const [tx, ty] = this._target();
        this._motion.reset(tx, ty);
        this._render();
        this._wake();
    }

    hide() {
        this._stopWatch();
        if (this._timeline) {
            this._timeline.stop();
            this._timeline = null;
        }
        if (this._actor) {
            this._actor.destroy();
            this._actor = null;
        }
    }

    destroy() {
        this.hide();
        this._image = null;
    }

    _target() {
        const [px, py] = global.get_pointer();
        const sf = this.scaleFactor;
        return [px + this._offsetX * sf, py + this._offsetY * sf];
    }

    // Start (or keep) the frame-synced animation loop.
    _wake() {
        if (!this._timeline || this._timeline.is_playing())
            return;
        this._stopWatch();
        this._lastTime = GLib.get_monotonic_time();
        this._timeline.start();
    }

    _sleep() {
        this._timeline.stop();
        if (!this._watch)
            this._watch = getPointerWatcher().addWatch(WAKE_POLL_MS, () => this._wake());
    }

    _stopWatch() {
        if (this._watch) {
            this._watch.remove();
            this._watch = null;
        }
    }

    _onFrame() {
        const now = GLib.get_monotonic_time();
        const dt = Math.min((now - this._lastTime) / 1e6, MAX_DT);
        this._lastTime = now;

        const [tx, ty] = this._target();
        const moving = this._motion.step(tx, ty, dt);
        this._render();

        if (!moving)
            this._sleep();
    }

    _render() {
        const m = this._motion;
        const sf = this.scaleFactor;
        this._actor.set_position(m.x, m.y);
        this._actor.translation_y = -m.lift * sf;
        this._actor.rotation_angle_z = m.angle;

        // Stay on top if the Shell added something above us (e.g. a menu).
        const parent = this._actor.get_parent();
        if (parent.get_last_child() !== this._actor)
            parent.set_child_above_sibling(this._actor, null);
    }
}
