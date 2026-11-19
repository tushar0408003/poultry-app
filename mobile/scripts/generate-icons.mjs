// Renders the brand SVGs in assets/brand/ into the PNGs Expo needs.
// Expo (prebuild / EAS) then produces Android mipmaps, adaptive-icon XML and iOS AppIcon from these.
// Run: npm run icons
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const BRAND = new URL('../assets/brand/', import.meta.url);
const OUT = new URL('../assets/', import.meta.url);
const GREEN = '#14532D';
const OFF_WHITE = '#F0FDF4';

const svg = (name) => readFile(new URL(name, BRAND));
const png = (input, size) => sharp(input, { density: 300 }).resize(size, size).png();

async function main() {
  const [icon, fg, mono, fav] = await Promise.all(
    ['icon.svg', 'icon-foreground.svg', 'icon-monochrome.svg', 'favicon.svg'].map(svg),
  );

  // iOS/legacy icon must be opaque: flatten onto the brand green (the rounded corners are masked by the OS).
  await png(icon, 1024).flatten({ background: GREEN }).toFile(path('icon.png'));
  await png(fg, 1024).toFile(path('android-icon-foreground.png'));
  await png(mono, 1024).toFile(path('android-icon-monochrome.png'));
  await png(fav, 48).toFile(path('favicon.png'));

  // Play Console wants a 512x512 opaque PNG; it applies its own corner mask.
  await mkdir(new URL('store/', OUT), { recursive: true });
  await png(icon, 512).flatten({ background: GREEN }).toFile(path('store/play-icon-512.png'));

  // Splash: Expo's splash is one image on a background colour, so the name is baked into the image.
  const weight = fg.toString('base64');
  const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <image href="data:image/svg+xml;base64,${weight}" x="162" y="40" width="700" height="700"/>
    <text x="512" y="860" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700"
      font-size="150" fill="${OFF_WHITE}">KiloKhata</text>
  </svg>`;
  await png(Buffer.from(splash), 1024).toFile(path('splash-icon.png'));

  console.log('Icons written to assets/');
}

const path = (name) => fileURLToPath(new URL(name, OUT));

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
