#!/usr/bin/env node
// build-fightweek.mjs — render the "FIGHT WEEK" matchup poster for one bout.
// Records, names and photos come from fighters/<slug>/profile.json (never typed by hand).
//
// Usage:
//   node scripts/instagram/build-fightweek.mjs --left=ciryl-gane --right=josh-hokit \
//     --headline="Gane vs. Hokit" --event="UFC 334: Gane vs. Hokit" \
//     --line="Sábado 14 de noviembre · Nueva York" [--kicker="UFC 334 · FIGHT WEEK"] \
//     [--broadcast="En vivo por Paramount+"] [--hashtags="#UFC334 #RifasMtz"] [--out=<slug>]
// Output: instagram-pack/out/<out or fightweek-<left>-<right>>/{feed.jpg,story.jpg,...}

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const FIGHTERS = path.join(ROOT, "fighters");
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [, k, v] = a.match(/^--([^=]+)(?:=(.*))?$/);
    return [k, v ?? true];
  })
);
for (const k of ["left", "right", "headline", "event", "line"]) {
  if (typeof args[k] !== "string") throw new Error(`Missing --${k}`);
}

function loadFighter(slug) {
  const dir = path.join(FIGHTERS, slug);
  const profile = JSON.parse(fs.readFileSync(path.join(dir, "profile.json"), "utf8"));
  const rec = profile.record;
  const record = rec ? `${rec.wins}-${rec.losses}-${rec.draws ?? 0}` : "";
  const file = profile.photo?.file;
  if (!file || !fs.existsSync(path.join(dir, file))) {
    throw new Error(`${slug}: no photo file (${file || "none"}); add the UFC cutout first (scripts/fighters/ufc-photo.mjs ${slug})`);
  }
  const ext = file.toLowerCase().endsWith(".png") ? "png" : "jpeg";
  return {
    name: profile.name,
    record,
    photoDataUri: `data:image/${ext};base64,${fs.readFileSync(path.join(dir, file)).toString("base64")}`,
  };
}

const left = loadFighter(args.left);
const right = loadFighter(args.right);
const outSlug = typeof args.out === "string" ? args.out : `fightweek-${args.left}-${args.right}`;
const input = {
  slug: outSlug,
  locale: "es-MX",
  templates: { feed: "scripts/instagram/templates/feed-fightweek.html" },
  brand: { name: "Rifas Mtz", handle: "@bet.mx.ufc" },
  event: {
    title: args.event,
    kicker: typeof args.kicker === "string" ? args.kicker : "FIGHT WEEK",
    line: args.line,
    broadcast: typeof args.broadcast === "string" ? args.broadcast : "",
    hashtag: typeof args.hashtags === "string" ? args.hashtags.split(" ")[0] : "",
  },
  headline: args.headline,
  left,
  right,
  caption: {
    text: `${args.event} · ${left.name} (${left.record}) vs. ${right.name} (${right.record}).`,
    hashtags: typeof args.hashtags === "string" ? args.hashtags : "",
  },
  only: "feed",
};

const tmp = path.join(ROOT, "instagram-pack/.automation", `${outSlug}.input.json`);
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, JSON.stringify(input));
const res = spawnSync(process.execPath, [path.join(HERE, "generate.mjs"), tmp], {
  cwd: ROOT, stdio: "inherit", env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` },
});
fs.rmSync(tmp, { force: true });
process.exit(res.status ?? 1);
