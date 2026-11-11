import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const MAX_BYTES = 3 * 1024 * 1024;

export function assertImageBytes(buf) {
  if (!buf.length || buf.length > MAX_BYTES) throw new Error("empty or oversized image");
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    if (buf.at(-2) !== 0xff || buf.at(-1) !== 0xd9) throw new Error("truncated JPEG: missing end marker");
    return "jpeg";
  }
  if (buf.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    if (!buf.subarray(-12).equals(Buffer.from("0000000049454e44ae426082", "hex"))) throw new Error("truncated PNG: missing IEND");
    return "png";
  }
  throw new Error("not a JPEG or PNG image");
}

// Remove only metadata, never JPEG coding tables. In particular DHT (0xC4)
// is essential Huffman data; the old allowlist incorrectly discarded it.
export function stripJpegMetadata(buf) {
  if (assertImageBytes(buf) !== "jpeg") throw new Error("not JPEG");
  const out = [buf.subarray(0, 2)];
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error(`bad JPEG marker at ${i}`);
    const start = i;
    while (buf[i] === 0xff) i++;
    const marker = buf[i++];
    // Preserve all scans verbatim (including progressive scan tables).
    if (marker === 0xda || marker === 0xd9) {
      out.push(buf.subarray(start));
      return Buffer.concat(out);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(buf.subarray(start, i));
      continue;
    }
    if (i + 2 > buf.length) throw new Error("truncated JPEG segment");
    const len = buf.readUInt16BE(i);
    if (len < 2 || i + len > buf.length) throw new Error("invalid JPEG segment length");
    const metadata = marker === 0xfe || (marker >= 0xe1 && marker <= 0xef && marker !== 0xee);
    // Keep APP0/JFIF and APP14/Adobe (color interpretation).
    if (!metadata) out.push(buf.subarray(start, i + len));
    i += len;
  }
  throw new Error("JPEG has no scan");
}

export function validateNativeDecode(file, scratch) {
  assertImageBytes(fs.readFileSync(file));
  // -g pixelWidth only reads headers and does NOT prove that pixels decode.
  execFileSync("sips", ["-s", "format", "png", file, "--out", scratch], { stdio: "pipe" });
  const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", scratch], { encoding: "utf8" });
  const width = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1]);
  if (!(width > 0 && height > 0)) throw new Error("image did not decode to pixels");
  return { width, height };
}

// Download, decode, normalize and validate in a same-filesystem staging folder.
// A failed request/conversion must never replace a previously working photo.
export async function savePhoto(url, dest, { fetchImpl = fetch, headers = {} } = {}) {
  const stage = fs.mkdtempSync(path.join(path.dirname(dest), ".photo-"));
  try {
    const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(60000) });
    if (!res.ok) {
      const error = new Error(`HTTP ${res.status} downloading ${url}`);
      error.status = res.status;
      throw error;
    }
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!["image/jpeg", "image/png"].includes(type)) throw new Error(`unexpected image content-type: ${type || "missing"}`);
    const size = Number(res.headers.get("content-length"));
    if (size > MAX_BYTES) throw new Error("oversized image response");
    const buf = Buffer.from(await res.arrayBuffer());
    const format = assertImageBytes(buf);
    if (`image/${format}` !== type) throw new Error("image signature does not match content-type");
    const input = path.join(stage, `input.${format}`);
    const output = path.join(stage, "photo.jpg");
    const decoded = path.join(stage, "decoded.png");
    fs.writeFileSync(input, buf);
    const original = validateNativeDecode(input, decoded);
    const resize = Math.max(original.width, original.height) > 1200
      ? ["--resampleHeightWidthMax", "1200"] : [];
    execFileSync("sips", [...resize, "-s", "format", "jpeg", input, "--out", output], { stdio: "pipe" });
    fs.writeFileSync(output, stripJpegMetadata(fs.readFileSync(output)));
    const dimensions = validateNativeDecode(output, decoded);
    const bytes = fs.statSync(output).size;
    if (bytes > 2 * 1024 * 1024) throw new Error("normalized photo exceeds 2 MB");
    fs.renameSync(output, dest);
    return { bytes, ...dimensions };
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}
