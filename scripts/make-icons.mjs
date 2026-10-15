// Generates PWA icons from an inline SVG. Run: node scripts/make-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const glyph = `<g fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/>
  <path d="m2.5 21.5 1.4-1.4"/><path d="m20.1 3.9 1.4-1.4"/>
  <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/>
  <path d="m9.6 14.4 4.8-4.8"/></g>`;

const svg = (size, pad, radius) => {
  const inner = size - pad * 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#0b5d35"/>
  <svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="0 0 24 24">${glyph}</svg></svg>`);
};

mkdirSync('public/icons', { recursive: true });
await sharp(svg(512, 120, 112)).png().toFile('public/icons/icon-512.png');
await sharp(svg(512, 120, 112)).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(svg(512, 150, 0)).png().toFile('public/icons/maskable-512.png');
await sharp(svg(512, 110, 0)).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
await sharp(svg(512, 120, 112)).resize(32, 32).png().toFile('public/favicon.png');
console.log('icons written');
