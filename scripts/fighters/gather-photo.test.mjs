import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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
const image = 'https://ufc.com/images/styles/athlete_bio_full_body/s3/2026-04/PROCHAZKA_JIRI_L_04-11.png?itok=kzDQfMFd';
const photo = {file:'photo.png', source_url:'https://www.ufc.com/athlete/synthetic-alpha', download_url:image, license:'UFC official press image (© UFC) — reference copy only, not CC/Commons', width:1, height:1};

function runGather({savedPhoto = photo, savedBytes = png, blocked = true, commons = false} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gather-photo-'));
  const dir = path.join(root, 'synthetic-alpha'); fs.mkdirSync(dir);
  if (savedPhoto) fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify({photo:savedPhoto, sources:[{url:savedPhoto.source_url,note:'original photo attribution',checked:'2026-01-01'}]}));
  if (savedBytes) fs.writeFileSync(path.join(dir, 'photo.png'), savedBytes);
  const script = `
    process.argv = [process.execPath, 'gather.mjs', '--date=2026-10-24', '--max=1', ${JSON.stringify('--dir=' + root)}, ...${JSON.stringify(commons ? ['--commons-fallback'] : [])}];
    globalThis.setTimeout = (fn) => {fn(); return 0;};
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.startsWith('https://site.api.espn.com/')) return Response.json({events:[{name:'SYNTHETIC EVENT',competitions:[{competitors:[{athlete:{displayName:'Synthetic Alpha'}},{athlete:{displayName:'Synthetic Beta'}}]}]}]});
      if (url.startsWith('https://en.wikipedia.org/')) return new Response('', {status:404});
      if (/^https:\\/\\/www\\.ufc(espanol)?\\.com\\/athlete\\//.test(url)) return new Response(${JSON.stringify(blocked ? '' : `<img src="${image}">`)}, {status:${blocked ? 403 : 200}});
      if (url === ${JSON.stringify(image)}) return new Response(Buffer.from(${JSON.stringify(png.toString('base64'))}, 'base64'));
      throw new Error('NETWORK DISABLED ' + url);
    };
    await import(${JSON.stringify(new URL('./gather.mjs', import.meta.url).href)});
  `;
  try {
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {encoding:'utf8', timeout:10000});
    assert.ifError(child.error);
    return {...child, profile:JSON.parse(fs.readFileSync(path.join(dir,'profile.json'))), sources:fs.readFileSync(path.join(dir,'sources.md'),'utf8'), bytes:fs.existsSync(path.join(dir,'photo.png')) ? fs.readFileSync(path.join(dir,'photo.png')) : null, report:JSON.parse(fs.readFileSync(path.join(root,'_gather-report.json')))};
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
}

test('report counts usable PNG/profile coverage and records timestamp rather than orphan bytes', () => {
  const valid = runGather();
  assert.deepEqual(valid.report.photoCoverage, {profiles:1, withPhoto:1, png:1, ufc:1, retained:1, initials:0});
  assert.ok(Number.isFinite(Date.parse(valid.report.generatedAt)));
  const corrupt = runGather({savedBytes:Buffer.from('not decoded pixels')});
  assert.equal(corrupt.profile.photo, null);
  assert.deepEqual(corrupt.report.photoCoverage, {profiles:1, withPhoto:0, png:0, ufc:0, retained:0, initials:1});
  assert.match(corrupt.sources, /fallback not requested/);
});

test('fresh UFC PNG sources include the exact download URL and local filename', () => {
  const run = runGather({savedPhoto:null, savedBytes:null, blocked:false});
  assert.equal(run.status, 0, run.stdout);
  assert.ok(run.sources.includes(image));
  assert.ok(run.sources.includes('photo.png'));
});

test('manual PNG metadata survives even opt-in Commons without making photo requests', () => {
  const manual = {...photo, source_url:'manual supplied cutout', download_url:null, license:'manual reference'};
  const run = runGather({savedPhoto:manual, commons:true});
  assert.equal(run.status, 0, run.stdout);
  assert.deepEqual(run.profile.photo, manual);
  assert.deepEqual(run.bytes, png);
  assert.match(run.sources, /retained local image/);
  assert.doesNotMatch(run.stdout, /NO photo|NETWORK DISABLED/);
});

test('blocked refresh retains validated UFC PNG metadata and truthful exact image attribution', () => {
  const run = runGather({commons:true});
  assert.deepEqual(run.profile.photo, photo);
  assert.deepEqual(run.bytes, png);
  assert.equal(run.status, 1, 'blocked upstream remains visible as failure');
  assert.match(run.sources, /retained/i);
  assert.ok(run.sources.includes(image));
  assert.ok(run.sources.includes('photo.png'));
  assert.doesNotMatch(run.sources, /No photo|no Commons|Initials fallback/);
  assert.ok(run.profile.sources.some(s => s.url === photo.source_url && s.checked === '2026-01-01'));
  assert.doesNotMatch(run.stdout, /NETWORK DISABLED|NO photo/);
});
