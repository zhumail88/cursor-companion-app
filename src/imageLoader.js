// Loads the companion image without blocking the desktop, trims transparent
// margins and scales it once to the exact size we draw, so nothing is
// decoded or resampled per frame.

import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

const ALPHA_THRESHOLD = 8; // pixels fainter than this count as empty

function expandPath(path) {
    if (path === '~' || path.startsWith('~/'))
        return GLib.build_filenamev([GLib.get_home_dir(), path.slice(1)]);
    return path;
}

function openAsync(file, cancellable) {
    return new Promise((resolve, reject) => {
        file.read_async(GLib.PRIORITY_DEFAULT, cancellable, (_f, res) => {
            try {
                resolve(file.read_finish(res));
            } catch (e) {
                reject(e);
            }
        });
    });
}

async function loadScaledAsync(file, box, cancellable) {
    const stream = await openAsync(file, cancellable);
    try {
        return await new Promise((resolve, reject) => {
            GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(stream, box, box, true,
                cancellable, (_src, res) => {
                    try {
                        resolve(GdkPixbuf.Pixbuf.new_from_stream_finish(res));
                    } catch (e) {
                        reject(e);
                    }
                });
        });
    } finally {
        stream.close_async(GLib.PRIORITY_DEFAULT, null, null);
    }
}

// Crop away fully transparent borders so the image sits right at the cursor.
function trimTransparent(pixbuf) {
    if (!pixbuf.get_has_alpha())
        return pixbuf;

    const w = pixbuf.get_width();
    const h = pixbuf.get_height();
    const stride = pixbuf.get_rowstride();
    const n = pixbuf.get_n_channels();
    const px = pixbuf.get_pixels();

    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
        const row = y * stride;
        for (let x = 0; x < w; x++) {
            if (px[row + x * n + 3] > ALPHA_THRESHOLD) {
                if (x < minX)
                    minX = x;
                if (x > maxX)
                    maxX = x;
                if (y < minY)
                    minY = y;
                maxY = y;
            }
        }
    }

    if (maxX < 0)
        return pixbuf; // fully transparent image; leave it alone
    return pixbuf.new_subpixbuf(minX, minY, maxX - minX + 1, maxY - minY + 1);
}

// Returns {content, width, height} where width/height are the logical size
// (fitting inside size x size) and content holds a sharper texture.
export async function loadImage(path, size, textureScale, cancellable) {
    const file = Gio.File.new_for_path(expandPath(path));
    const texBox = Math.ceil(size * textureScale);

    // Decode at a bounded resolution first: cheap even for huge photos.
    let pixbuf = await loadScaledAsync(file, Math.max(512, texBox * 2), cancellable);
    pixbuf = pixbuf.apply_embedded_orientation() ?? pixbuf;
    pixbuf = trimTransparent(pixbuf);

    const srcW = pixbuf.get_width();
    const srcH = pixbuf.get_height();
    const fit = Math.min(size / srcW, size / srcH);
    const width = Math.max(1, Math.round(srcW * fit));
    const height = Math.max(1, Math.round(srcH * fit));
    const texW = Math.max(1, Math.round(width * textureScale));
    const texH = Math.max(1, Math.round(height * textureScale));

    if (texW !== srcW || texH !== srcH)
        pixbuf = pixbuf.scale_simple(texW, texH, GdkPixbuf.InterpType.HYPER);

    const coglContext = global.stage.context.get_backend().get_cogl_context();
    const content = St.ImageContent.new_with_preferred_size(width, height);
    content.set_bytes(
        coglContext,
        pixbuf.read_pixel_bytes(),
        pixbuf.get_has_alpha() ? Cogl.PixelFormat.RGBA_8888 : Cogl.PixelFormat.RGB_888,
        texW,
        texH,
        pixbuf.get_rowstride());

    return {content, width, height};
}
