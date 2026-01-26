#!/usr/bin/env node

/**
 * Simple icon generator for Tauri app
 * Generates PNG icons at various sizes for macOS, Windows, and Linux
 *
 * For production, replace these with proper designed icons
 */

const fs = require('fs');
const path = require('path');

const ICON_DIR = path.join(__dirname, '..', 'src-tauri', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(ICON_DIR)) {
  fs.mkdirSync(ICON_DIR, { recursive: true });
}

// Generate a simple PNG with a colored circle
function generatePNG(size, r, g, b) {
  // PNG header
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const width = size;
  const height = size;
  const bitDepth = 8;
  const colorType = 6; // RGBA
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(bitDepth, 8);
  ihdrData.writeUInt8(colorType, 9);
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk - image data
  const rawData = Buffer.alloc(height * (1 + width * 4));
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = (Math.min(width, height) / 2) - 2;

  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    rawData[rowStart] = 0; // filter byte

    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      const dx = x - centerX + 0.5;
      const dy = y - centerY + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Inside circle - solid color
        rawData[px] = r;
        rawData[px + 1] = g;
        rawData[px + 2] = b;
        rawData[px + 3] = 255;
      } else if (dist <= radius + 1) {
        // Anti-aliased edge
        const alpha = Math.round((radius + 1 - dist) * 255);
        rawData[px] = r;
        rawData[px + 1] = g;
        rawData[px + 2] = b;
        rawData[px + 3] = alpha;
      } else {
        // Outside - transparent
        rawData[px] = 0;
        rawData[px + 1] = 0;
        rawData[px + 2] = 0;
        rawData[px + 3] = 0;
      }
    }
  }

  // Compress with zlib
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type);

  // Calculate CRC
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return crc ^ 0xFFFFFFFF;
}

// App icon color (Expertly purple/indigo)
const ICON_R = 99;
const ICON_G = 102;
const ICON_B = 241;

// Generate icons at different sizes
const sizes = [32, 128, 256, 512, 1024];

console.log('Generating app icons...');

for (const size of sizes) {
  const png = generatePNG(size, ICON_R, ICON_G, ICON_B);

  if (size === 32) {
    fs.writeFileSync(path.join(ICON_DIR, '32x32.png'), png);
    console.log(`  Created 32x32.png`);
  }
  if (size === 128) {
    fs.writeFileSync(path.join(ICON_DIR, '128x128.png'), png);
    console.log(`  Created 128x128.png`);
  }
  if (size === 256) {
    fs.writeFileSync(path.join(ICON_DIR, '128x128@2x.png'), png);
    fs.writeFileSync(path.join(ICON_DIR, 'icon.png'), png);
    console.log(`  Created 128x128@2x.png`);
    console.log(`  Created icon.png`);
  }
}

// For .icns and .ico, we'll just copy the 256x256 PNG
// In production, use proper icon generation tools
console.log(`  Note: .icns and .ico require additional tooling for production`);

console.log('Done! Icons generated in src-tauri/icons/');
