#!/usr/bin/env node
/**
 * Generate PWA icons from assets/logo.jpg.
 * Outputs to public/assets/: icon-192.png, icon-512.png, icon-maskable-512.png
 * - Crop centered (face + crown). PNG. Transparent padding for maskable.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const inputPath = path.join(root, 'assets', 'logo.jpg');
const outDir = path.join(root, 'public', 'assets');

async function main() {
  await mkdir(outDir, { recursive: true });

  const image = sharp(inputPath);
  const meta = await image.metadata();
  const w = meta.width || 1;
  const h = meta.height || 1;

  // Center crop: use cover so face/crown stays centered
  const crop = (size) =>
    image
      .clone()
      .resize(size, size, { fit: 'cover', position: 'center' })
      .png();

  // 192x192 and 512x512 regular icons (centered crop)
  await crop(192).then((buf) => writeFile(path.join(outDir, 'icon-192.png'), buf));
  await crop(512).then((buf) => writeFile(path.join(outDir, 'icon-512.png'), buf));

  // Maskable 512: content at ~80% (410px) centered on 512x512 so it won't clip
  const maskableSize = 512;
  const contentSize = Math.round(maskableSize * 0.8);
  const resized = await image
    .clone()
    .resize(contentSize, contentSize, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer();

  const left = Math.round((maskableSize - contentSize) / 2);
  const maskable = await sharp({
    create: {
      width: maskableSize,
      height: maskableSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top: left }])
    .png()
    .toBuffer();

  await writeFile(path.join(outDir, 'icon-maskable-512.png'), maskable);

  console.log('Generated: public/assets/icon-192.png, icon-512.png, icon-maskable-512.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
