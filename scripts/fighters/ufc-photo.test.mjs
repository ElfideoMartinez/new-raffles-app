import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractFullBodyUrl, isUfcSourced, ufcCutout } from './ufc-photo.mjs';
import { deflateSync } from 'node:zlib';

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of body) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, body, tail]);
}
const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0, 210, 80, 20, 0]))), chunk('IEND', Buffer.alloc(0))]);

const reference = 'https://ufc.com/images/styles/athlete_bio_full_body/s3/2026-04/PROCHAZKA_JIRI_L_04-11.png?itok=kzDQfMFd';

test('extracts exact full-body URLs on trusted UFC hosts with HTML entities', () => {
  assert.equal(extractFullBodyUrl(`<img src="${reference}">`), reference);
  for (const host of ['ufc.com', 'www.ufc.com', 'ufcespanol.com', 'www.ufcespanol.com']) {
    const url = reference.replace('ufc.com', host) + '&width=800';
    assert.equal(extractFullBodyUrl(`<img src="${url.replace('&', '&amp;')}">`), url);
    assert.equal(extractFullBodyUrl(`<img src="${url.replace('&', '&#38;')}">`), url);
  }
  assert.equal(extractFullBodyUrl(`<img src="${reference.replace('ufc.com', 'ufc.com.evil.test')}">`), null);
  assert.equal(isUfcSourced({source_url:'https://ufc.com.evil.test/athlete/test'}), false);
  assert.equal(isUfcSourced({source_url:'https://evilufc.com/athlete/test'}), false);
});

for (const bad of ['http', 'html', 'truncated', 'undecodable']) {
  test(`invalid UFC download (${bad}) never replaces saved PNG`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ufc-photo-'));
    const originalFetch = globalThis.fetch;
    try {
      fs.writeFileSync(path.join(dir, 'photo.png'), png);
      globalThis.fetch = async (input) => {
        if (String(input).includes('/athlete/')) return new Response(`<img src="${reference}">`);
        if (String(input) !== reference) throw new Error('NETWORK DISABLED');
        if (bad === 'http') return new Response('', {status:403});
        if (bad === 'html') return new Response('<html>blocked</html>');
        if (bad === 'truncated') return new Response(png.subarray(0, -12));
        return new Response(Buffer.concat([png.subarray(0,33), Buffer.from('invalid pixels'), png.subarray(-12)]));
      };
      await assert.rejects(ufcCutout('synthetic-alpha', dir));
      assert.deepEqual(fs.readFileSync(path.join(dir, 'photo.png')), png);
      assert.deepEqual(fs.readdirSync(dir), ['photo.png']);
    } finally { globalThis.fetch = originalFetch; fs.rmSync(dir, {recursive:true, force:true}); }
  });
}

for (const spanish of ['blocked', 'absent']) {
  test(`official English athlete page supplies exact PNG when Spanish is ${spanish}`, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ufc-photo-'));
    const originalFetch = globalThis.fetch;
    const requests = [];
    try {
      globalThis.fetch = async (input) => {
        const url = String(input); requests.push(url);
        if (url === 'https://www.ufcespanol.com/athlete/synthetic-alpha') return new Response('<html></html>', {status:spanish === 'blocked' ? 403 : 200});
        if (url === 'https://www.ufc.com/athlete/synthetic-alpha') return new Response(`<img src="${reference}">`);
        if (url === reference) return new Response(png, {headers:{'content-type':'image/png'}});
        throw new Error('NETWORK DISABLED ' + url);
      };
      const result = await ufcCutout('synthetic-alpha', dir);
      assert.equal(result?.filePage, 'https://www.ufc.com/athlete/synthetic-alpha');
      assert.equal(result.url, reference);
      assert.equal(result.width, 1);
      assert.equal(result.height, 1);
      assert.deepEqual(fs.readFileSync(path.join(dir, 'photo.png')), png);
      assert.deepEqual(requests, ['https://www.ufcespanol.com/athlete/synthetic-alpha', 'https://www.ufc.com/athlete/synthetic-alpha', reference]);
    } finally { globalThis.fetch = originalFetch; fs.rmSync(dir, {recursive:true, force:true}); }
  });
}
