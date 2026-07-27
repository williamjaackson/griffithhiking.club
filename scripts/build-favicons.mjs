/**
 * Regenerates the favicon set from the club badge.
 *
 * Run with `pnpm build:favicons` after changing src/assets/club-logo.png. The
 * output is committed rather than generated during the build: it changes about
 * never, and putting sharp in the critical path of every deploy to redo
 * identical work is a poor trade.
 *
 * The mark is cropped to a circle and nothing else - the same treatment the
 * hero gives it, which is `rounded-full` over a square source. Deliberately no
 * trimming or re-centring: that would enlarge the badge relative to the logo as
 * the site actually wears it, and the two would stop being the same mark.
 */
import sharp from "sharp";
import { writeFileSync, statSync } from "node:fs";

const SOURCE = "src/assets/club-logo.png";
const OUT = "public";

/** iOS fills any transparency with black and masks the result to its own shape,
 *  so the touch icon needs an opaque backing. It has to differ from the badge's
 *  own background or the disc disappears into it and the icon reads as a square.
 *  This is --color-cream. */
const TOUCH_BACKING = { r: 242, g: 237, b: 223 };

const PNGS = {
  "favicon-32.png": 32,
  "favicon-192.png": 192,
  "favicon-512.png": 512,
  "apple-touch-icon.png": 180,
};

/** The sizes inside favicon.ico. 16 is a muddy green at this level of detail,
 *  but it is what a non-retina tab asks for, so it ships anyway. */
const ICO_SIZES = [16, 32];

const kb = (path) => `${(statSync(path).size / 1024).toFixed(1)}KB`;

const { width, height } = await sharp(SOURCE).metadata();
const side = Math.min(width, height);

/** Everything outside the inscribed circle becomes transparent, so the badge
 *  reads as a disc on whatever the browser puts behind a tab. */
const mask = Buffer.from(
  `<svg width="${side}" height="${side}"><circle cx="${side / 2}" cy="${side / 2}" r="${side / 2}" fill="#fff"/></svg>`,
);

const disc = await sharp(SOURCE)
  // Matches the hero's object-cover: the largest centred square, then the mask.
  // A no-op while the logo is square, correct if it ever is not.
  .resize(side, side, { fit: "cover", position: "centre" })
  .ensureAlpha()
  .composite([{ input: mask, blend: "dest-in" }])
  .png()
  .toBuffer();

for (const [file, size] of Object.entries(PNGS)) {
  const path = `${OUT}/${file}`;
  const resized = sharp(disc).resize(size, size, { kernel: "lanczos3" });
  const image =
    file === "apple-touch-icon.png"
      ? sharp({
          create: {
            width: size,
            height: size,
            channels: 3,
            background: TOUCH_BACKING,
          },
        }).composite([{ input: await resized.png().toBuffer() }])
      : resized;
  await image.png({ compressionLevel: 9 }).toFile(path);
  console.log(`  ${file.padEnd(22)} ${size}x${size}  ${kb(path)}`);
}

/** An ICO holding PNGs rather than bitmaps - allowed since Vista, and far
 *  smaller. Header, then one 16-byte directory entry per size, then the data. */
const images = await Promise.all(
  ICO_SIZES.map((size) =>
    sharp(disc)
      .resize(size, size, { kernel: "lanczos3" })
      .png({ compressionLevel: 9 })
      .toBuffer(),
  ),
);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // 1 = icon
header.writeUInt16LE(images.length, 4);

let offset = header.length + 16 * images.length;
const directory = images.map((png, i) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(ICO_SIZES[i], 0); // width, 0 meaning 256
  entry.writeUInt8(ICO_SIZES[i], 1); // height
  entry.writeUInt8(0, 2); // palette size
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  return entry;
});

const icoPath = `${OUT}/favicon.ico`;
writeFileSync(icoPath, Buffer.concat([header, ...directory, ...images]));
console.log(
  `  favicon.ico            ${ICO_SIZES.join("+")}     ${kb(icoPath)}`,
);
