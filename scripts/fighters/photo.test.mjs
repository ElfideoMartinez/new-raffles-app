import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {deflateSync} from 'node:zlib';
import {assertImageBytes, savePhoto, stripJpegMetadata, validateNativeDecode} from './photo.mjs';

// Deterministic RGB PNG, with valid chunk CRCs (not a permissively decoded fixture).
function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type),data]);
  let crc = 0xffffffff;
  for (const byte of body) {crc ^= byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  const length = Buffer.alloc(4);length.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4);tail.writeUInt32BE((crc^0xffffffff)>>>0);
  return Buffer.concat([length,body,tail]);
}
const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=2;
const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),pngChunk('IHDR',header),pngChunk('IDAT',deflateSync(Buffer.from([0,210,80,20]))),pngChunk('IEND',Buffer.alloc(0))]);
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fighter-photo-test-'));

test('normalizes a PNG and preserves coding tables and decoded pixels after metadata removal', async () => {
  const dir = temp();
  try {
    const dest = path.join(dir, 'photo.jpg');
    const result = await savePhoto('https://example.test/photo', dest, {fetchImpl: async () => new Response(png, {headers: {'content-type':'image/png'}})});
    assert.deepEqual({width:result.width,height:result.height},{width:1,height:1});
    const jpeg = fs.readFileSync(dest);
    assert.equal(assertImageBytes(jpeg), 'jpeg');
    assert.ok(jpeg.includes(Buffer.from([0xff, 0xc4])), 'DHT must survive');
    const metadata = Buffer.from([0xff,0xe1,0,6,1,2,3,4]);
    const withMetadata = Buffer.concat([jpeg.subarray(0,2),metadata,jpeg.subarray(2)]);
    assert.deepEqual(stripJpegMetadata(withMetadata),jpeg);
    validateNativeDecode(dest,path.join(dir,'decoded.png'));
    // Reproduce the original bug, rather than trusting header dimensions or a
    // browser decoder which may substitute default Huffman tables.
    const pieces=[jpeg.subarray(0,2)];
    for(let i=2;i<jpeg.length;) {
      const marker=jpeg[i+1];
      if(marker===0xda){pieces.push(jpeg.subarray(i));break;}
      const end=i+2+jpeg.readUInt16BE(i+2);
      if(marker!==0xc4)pieces.push(jpeg.subarray(i,end));
      i=end;
    }
    const corrupt=path.join(dir,'missing-huffman.jpg');
    fs.writeFileSync(corrupt,Buffer.concat(pieces));
    assert.throws(()=>validateNativeDecode(corrupt,path.join(dir,'corrupt.png')));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('HTTP, HTML, wrong MIME, truncated and undecodable inputs cannot replace a saved photo', async () => {
  const dir = temp();
  try {
    const dest = path.join(dir,'photo.jpg');
    const original = Buffer.from('previous valid photo sentinel');
    const brokenPng = Buffer.concat([png.subarray(0,33),Buffer.from('invalid pixels'),png.subarray(-12)]);
    const cases = [
      () => new Response('unavailable',{status:503}),
      () => new Response('<html>error</html>',{headers:{'content-type':'text/html'}}),
      () => new Response(png,{headers:{'content-type':'image/jpeg'}}),
      () => new Response(png.subarray(0,-12),{headers:{'content-type':'image/png'}}),
      () => new Response(Buffer.from([0xff,0xd8,0xff,0xda,0,4,1,2]),{headers:{'content-type':'image/jpeg'}}),
      () => new Response(brokenPng,{headers:{'content-type':'image/png'}}),
    ];
    for (const response of cases) {
      fs.writeFileSync(dest,original);
      await assert.rejects(savePhoto('https://example.test/photo',dest,{fetchImpl:async()=>response()}));
      assert.deepEqual(fs.readFileSync(dest),original);
      assert.deepEqual(fs.readdirSync(dir),['photo.jpg']);
    }
    // Transport failure is also non-destructive.
    await assert.rejects(savePhoto('https://example.test/photo',dest,{fetchImpl:async()=>{throw Error('network failure')}}));
    assert.deepEqual(fs.readFileSync(dest),original);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
