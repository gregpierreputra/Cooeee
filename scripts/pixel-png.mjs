// A small PNG writer and reader for the hand drawn game art, with no
// dependency: node:zlib does the compression, and the rest is the PNG format.
// Reads only what this project writes or Chrome writes: 8 bit RGBA, not
// interlaced, any of the five row filters.

import { deflateSync, inflateSync } from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** An RGBA picture as a PNG file. `rgba` holds width * height * 4 bytes. */
export function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits per channel
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // no filter
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A PNG file back to { width, height, rgba }. 8 bit RGBA only. */
export function decodePng(file) {
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  const data = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 6 || body[12] !== 0) throw new Error('only 8 bit RGBA, not interlaced');
    } else if (type === 'IDAT') data.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * 4;
  const rgba = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? rgba[y * stride + x - 4] : 0;
      const b = y > 0 ? rgba[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? rgba[(y - 1) * stride + x - 4] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      rgba[y * stride + x] = value & 0xff;
    }
  }
  return { width, height, rgba };
}

/** A blank RGBA picture with a pixel writer and a blitter, for drawing. */
export function picture(width, height) {
  const rgba = new Uint8Array(width * height * 4);
  const set = (x, y, [r, g, b, a = 255]) => {
    if (x < 0 || y < 0 || x >= width || y >= height || a === 0) return;
    const i = (y * width + x) * 4;
    // Over an empty pixel, or fully opaque, the colour is copied exactly.
    if (a === 255 || rgba[i + 3] === 0) {
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
      return;
    }
    // Blend over what is there.
    const k = a / 255;
    rgba[i] = Math.round(r * k + rgba[i] * (1 - k));
    rgba[i + 1] = Math.round(g * k + rgba[i + 1] * (1 - k));
    rgba[i + 2] = Math.round(b * k + rgba[i + 2] * (1 - k));
    rgba[i + 3] = Math.max(rgba[i + 3], a);
  };
  const get = (x, y) => {
    const i = (y * width + x) * 4;
    return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
  };
  /** Copy a region of another picture in, skipping clear pixels. */
  const blit = (source, sx, sy, w, h, dx, dy) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = ((sy + y) * source.width + sx + x) * 4;
        const a = source.rgba[i + 3];
        if (a) set(dx + x, dy + y, [source.rgba[i], source.rgba[i + 1], source.rgba[i + 2], a]);
      }
    }
  };
  return { width, height, rgba, set, get, blit };
}

/** Draw rows of palette letters ('.' is clear) into a picture at (x, y). */
export function drawRows(target, rows, palette, x = 0, y = 0) {
  rows.forEach((row, j) => {
    [...row].forEach((letter, i) => {
      if (letter === '.' || letter === ' ') return;
      const colour = palette[letter];
      if (!colour) throw new Error(`no colour for '${letter}'`);
      target.set(x + i, y + j, colour);
    });
  });
}
