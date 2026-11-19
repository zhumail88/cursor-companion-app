// Platform-independent motion model for the companion.
//
// No GNOME / Clutter imports here on purpose: this file only turns
// "where is the cursor" + "how much time passed" into "where should the
// image be, how tilted, how high in its bounce". It can be reused as-is
// by a future Windows port.

const TWO_PI = Math.PI * 2;

// Tuning constants (multiplied by the user-facing intensity settings).
const MAX_TILT_DEG = 12;          // tilt at full speed, intensity 1.0
const TILT_SPEED_FOR_MAX = 1400;  // px/s of horizontal speed giving max tilt
const TILT_RESPONSE = 10;         // how fast rotation eases to its target (1/s)
const MAX_BOUNCE_PX = 7;          // bounce height at full speed, intensity 1.0
const BOUNCE_SPEED_FOR_MAX = 1200;
const BOUNCE_RESPONSE = 8;        // how fast bounce height eases (1/s)
const BOUNCE_HZ = 3.2;            // hops per second at full speed
const VELOCITY_SMOOTHING = 12;    // low-pass on measured velocity (1/s)

// Below these thresholds the companion counts as "settled".
const SETTLE_DIST = 0.3;
const SETTLE_ANGLE = 0.05;
const SETTLE_BOUNCE = 0.05;

function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
}

// Exponential approach that behaves the same at any frame rate.
function approach(rate, dt) {
    return 1 - Math.exp(-rate * dt);
}

export class CompanionMotion {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.angle = 0;   // degrees, positive = clockwise (tilt right)
        this.lift = 0;    // px, how far the image is raised by the bounce
        this._vx = 0;
        this._vy = 0;
        this._bounceAmp = 0;
        this._phase = 0;

        // User-tunable values.
        this.followSpeed = 0.18;     // fraction of the gap closed per 60 FPS frame
        this.bounceIntensity = 1.0;
        this.tiltIntensity = 1.0;
    }

    // Jump straight to a position with no animation (used on show).
    reset(x, y) {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.lift = 0;
        this._vx = this._vy = 0;
        this._bounceAmp = 0;
        this._phase = 0;
    }

    // Advance the simulation by dt seconds toward (targetX, targetY).
    // Returns true while still animating, false once fully settled.
    step(targetX, targetY, dt) {
        if (dt <= 0)
            return true;

        // Position: the classic "close X% of the gap each frame", converted
        // to be frame-rate independent so 120 Hz screens feel the same.
        const s = clamp(this.followSpeed, 0.01, 1);
        const k = 1 - Math.pow(1 - s, dt * 60);
        const prevX = this.x, prevY = this.y;
        this.x += (targetX - this.x) * k;
        this.y += (targetY - this.y) * k;

        // Smoothed velocity of the image itself.
        const a = approach(VELOCITY_SMOOTHING, dt);
        this._vx += ((this.x - prevX) / dt - this._vx) * a;
        this._vy += ((this.y - prevY) / dt - this._vy) * a;
        const speed = Math.hypot(this._vx, this._vy);

        // Tilt toward horizontal movement direction, ease back upright.
        const tiltTarget = clamp(this._vx / TILT_SPEED_FOR_MAX, -1, 1) *
            MAX_TILT_DEG * this.tiltIntensity;
        this.angle += (tiltTarget - this.angle) * approach(TILT_RESPONSE, dt);

        // Bounce: height grows with speed, fades out when stopping.
        const speedNorm = clamp(speed / BOUNCE_SPEED_FOR_MAX, 0, 1);
        const ampTarget = speedNorm > 0.02
            ? (0.35 + 0.65 * speedNorm) * MAX_BOUNCE_PX * this.bounceIntensity
            : 0;
        this._bounceAmp += (ampTarget - this._bounceAmp) * approach(BOUNCE_RESPONSE, dt);
        this._phase = (this._phase + TWO_PI * BOUNCE_HZ * (0.6 + 0.4 * speedNorm) * dt) % TWO_PI;
        this.lift = Math.abs(Math.sin(this._phase)) * this._bounceAmp;

        const settled =
            Math.hypot(targetX - this.x, targetY - this.y) < SETTLE_DIST &&
            Math.abs(this.angle) < SETTLE_ANGLE &&
            this._bounceAmp < SETTLE_BOUNCE;

        if (settled) {
            this.reset(targetX, targetY);
            return false;
        }
        return true;
    }
}
