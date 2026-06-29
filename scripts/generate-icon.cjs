/**
 * 從 SVG 生成 PNG 圖標（256x256）
 * 用於 electron-builder 的 Windows 打包
 */
const { writeFileSync } = require('fs');
const { join } = require('path');

// 簡易 PNG 生成器（不依賴外部套件）
// 生成 256x256 的深色背景 + 藍色邊框 + "賽" 文字 PNG

const WIDTH = 256;
const HEIGHT = 256;

// 建立 RGBA buffer
const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const idx = (y * WIDTH + x) * 4;
  // Alpha blending
  const srcA = a / 255;
  const dstA = pixels[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA > 0) {
    pixels[idx] = Math.round((r * srcA + pixels[idx] * dstA * (1 - srcA)) / outA);
    pixels[idx + 1] = Math.round((g * srcA + pixels[idx + 1] * dstA * (1 - srcA)) / outA);
    pixels[idx + 2] = Math.round((b * srcA + pixels[idx + 2] * dstA * (1 - srcA)) / outA);
    pixels[idx + 3] = Math.round(outA * 255);
  }
}

function fillRect(x1, y1, w, h, r, g, b, a = 255) {
  for (let y = y1; y < y1 + h; y++) {
    for (let x = x1; x < x1 + w; x++) {
      setPixel(x, y, r, g, b, a);
    }
  }
}

function fillCircle(cx, cy, radius, r, g, b, a = 255) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) {
        setPixel(x, y, r, g, b, a);
      }
    }
  }
}

// 背景：深色 #0f1118
fillRect(0, 0, WIDTH, HEIGHT, 15, 17, 24);

// 圓角矩形邊框（簡化為矩形）：藍色 #6c8cff, 半透明
fillRect(4, 4, WIDTH - 8, 3, 108, 140, 255, 100);
fillRect(4, HEIGHT - 7, WIDTH - 8, 3, 108, 140, 255, 100);
fillRect(4, 4, 3, HEIGHT - 8, 108, 140, 255, 100);
fillRect(WIDTH - 7, 4, 3, HEIGHT - 8, 108, 140, 255, 100);

// 中央圓形裝飾：藍色
fillCircle(WIDTH / 2, HEIGHT / 2 - 20, 60, 108, 140, 255, 40);
fillCircle(WIDTH / 2, HEIGHT / 2 - 20, 40, 108, 140, 255, 60);

// 簡易 "賽" 字（用方塊模擬）
const cx = WIDTH / 2;
const cy = HEIGHT / 2 - 25;
const s = 6; // pixel size
// 橫畫
fillRect(cx - 4 * s, cy - 3 * s, 8 * s, s, 108, 140, 255);
fillRect(cx - 3 * s, cy - 1 * s, 6 * s, s, 108, 140, 255);
fillRect(cx - 4 * s, cy + 1 * s, 8 * s, s, 108, 140, 255);
// 豎畫
fillRect(cx - s / 2, cy - 4 * s, s, 7 * s, 108, 140, 255);
// 兩撇
fillRect(cx - 3 * s, cy + 3 * s, 2 * s, s, 108, 140, 255);
fillRect(cx + 1 * s, cy + 3 * s, 2 * s, s, 108, 140, 255);

// 底部文字 "精靈圖鑑"（簡化為橫線）
fillRect(cx - 30, cy + 60, 60, 3, 136, 136, 160);

// ─── PNG 編碼 ───
function createPNG(width, height, rgba) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let c = 0xffffffff;
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let v = n;
      for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
      table[n] = v;
    }
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeData));
    return Buffer.concat([len, typeData, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT (raw deflate)
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  // Simple uncompressed deflate
  const blocks = [];
  const blockSize = 32768;
  for (let i = 0; i < raw.length; i += blockSize) {
    const end = Math.min(i + blockSize, raw.length);
    const isLast = end === raw.length;
    const blockData = raw.slice(i, end);
    const header = Buffer.alloc(5);
    header[0] = isLast ? 0x01 : 0x00;
    header.writeUInt16LE(blockData.length, 1);
    header.writeUInt16LE(~blockData.length & 0xffff, 3);
    blocks.push(header, blockData);
  }
  // Add adler32 checksum
  let a = 1, b = 0;
  for (let i = 0; i < raw.length; i++) {
    a = (a + raw[i]) % 65521;
    b = (b + a) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE((b << 16) | a);
  const deflated = Buffer.concat([...blocks, adler]);

  // zlib wrapper: 0x78 0x01 (no compression)
  const zlibHeader = Buffer.from([0x78, 0x01]);
  const idat = Buffer.concat([zlibHeader, deflated]);

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', iend),
  ]);
}

const png = createPNG(WIDTH, HEIGHT, pixels);
const outPath = join(__dirname, '..', 'public', 'icons', 'icon-256.png');
writeFileSync(outPath, png);
console.log(`PNG icon created: ${outPath} (${png.length} bytes)`);
