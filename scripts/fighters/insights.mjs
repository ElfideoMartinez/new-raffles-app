#!/usr/bin/env node
/**
 * insights.mjs — Build matchup insights from fighters profiles.
 *
 * Reads every profile, groups fighters by their _event.name into cards,
 * pairs opponents, computes head-to-head stats, and writes fighters/_insights.json.
 *
 * Usage:
 *   node scripts/fighters/insights.mjs                          # all cards
 *   node scripts/fighters/insights.mjs --event="UFC 334: Gane vs. Hokit"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const FIGHTERS_DIR = path.join(ROOT, "fighters");

// ---- 0. Parse args ----------------------------------------------------------
const argv = process.argv.slice(2);
const eventArg = (() => {
  const a = argv.find((x) => x.startsWith("--event="));
  return a ? a.slice("--event=".length) : null;
})();

// ---- 1. Load all profiles ---------------------------------------------------
const profiles = [];
for (const entry of fs.readdirSync(FIGHTERS_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const profilePath = path.join(FIGHTERS_DIR, entry.name, "profile.json");
  if (!fs.existsSync(profilePath)) continue;
  try {
    const p = JSON.parse(fs.readFileSync(profilePath, "utf8"));
    profiles.push(p);
  } catch (err) {
    console.warn(`Skipping ${entry.name}: ${err.message}`);
  }
}

// ---- 2. Group fighters by event (card) --------------------------------------
/** @type {Map<string, typeof profiles>} */
const cardMap = new Map();
for (const p of profiles) {
  const eventName = p._event?.name;
  if (!eventName) continue;
  if (eventArg && eventName !== eventArg) continue;
  if (!cardMap.has(eventName)) cardMap.set(eventName, []);
  cardMap.get(eventName).push(p);
}

const cards = [...cardMap.keys()].sort();

// ---- 3. Build a name→profile index for opponent lookup ----------------------
/** @type {Map<string, typeof profiles[0]>} */
const byName = new Map();
for (const p of profiles) {
  if (p.name) byName.set(p.name, p);
}

// ---- 4. Build matchups per card --------------------------------------------
function formatRecord(rec) {
  if (!rec) return "?";
  const { wins = 0, losses = 0, draws = 0 } = rec;
  return draws ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
}

const matchups = [];

for (const [eventName, fighters] of cardMap) {
  // Index fighters on this card by name for pairing
  /** @type {Map<string, typeof profiles[0]>} */
  const onCard = new Map();
  for (const f of fighters) {
    if (f.name) onCard.set(f.name, f);
  }

  // Track already-paired names to avoid duplicates
  const paired = new Set();

  for (const f of fighters) {
    if (!f._event?.bouts?.length) continue;
    for (const bout of f._event.bouts) {
      if (!bout.opponent) continue;
      // Only pair if opponent is also in our fighter set for this card
      const opp = onCard.get(bout.opponent);
      if (!opp) continue;

      // Dedupe: sort names so we only get one matchup per pair
      const pair = [f.name, bout.opponent].sort();
      const pairKey = pair.join(" vs. ");
      if (paired.has(pairKey)) continue;
      paired.add(pairKey);

      const [nameA, nameB] = pair;
      const pA = onCard.get(nameA);
      const pB = onCard.get(nameB);

      // Head-to-head: count times they appear in each other's previousFights
      const priorFights = [];
      for (const pf of pA.previousFights || []) {
        if (pf.opponent === nameB) priorFights.push(pf);
      }
      for (const pf of pB.previousFights || []) {
        if (pf.opponent === nameA) {
          // Only add if not already captured (avoid double-counting the same fight)
          const isDupe = priorFights.some(
            (x) => x.date === pf.date && x.opponent === nameA
          );
          if (!isDupe) priorFights.push(pf);
        }
      }
      const headToHead = priorFights.length;

      // Shared cards: how many cards[] entries they share
      const cardsA = new Set((pA.cards || []).map((c) => c.name));
      const cardsB = new Set((pB.cards || []).map((c) => c.name));
      const sharedEvents = [...cardsA].filter((c) => cardsB.has(c));
      const sharedCards = sharedEvents.length;

      const recA = formatRecord(pA.record);
      const recB = formatRecord(pB.record);

      // Division from the bout or from the fighters' profiles
      const division =
        bout.division ||
        pA.division ||
        pB.division ||
        null;

      // Notes in Spanish
      const notes = [];
      if (headToHead === 0) {
        notes.push("Primera vez peleando entre sí");
      } else {
        notes.push(`Se han enfrentado ${headToHead} vez${headToHead > 1 ? "es" : ""} anteriormente`);
      }
      if (division && pA.division === pB.division) {
        notes.push(`Ambos compiten en la misma división: ${division}`);
      }
      notes.push(`Récord combinado: ${recA} · ${recB}`);

      matchups.push({
        event: eventName,
        matchup: pair,
        division: division || null,
        headToHead,
        priorFights,
        isFirstFight: headToHead === 0,
        sharedCards,
        sharedEvents,
        records: [recA, recB],
        notes,
      });
    }
  }
}

// ---- 5. Write output --------------------------------------------------------
const output = {
  generated_at: new Date().toISOString(),
  event: eventArg || null,
  cards,
  fighterCount: eventArg
    ? (cardMap.get(eventArg)?.length ?? 0)
    : profiles.length,
  matchups,
};

const outPath = path.join(FIGHTERS_DIR, "_insights.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");

// ---- 6. Summary -------------------------------------------------------------
console.log(`Insights generated: ${outPath}`);
console.log(`  Cards: ${cards.length} (${cards.join(", ")})`);
console.log(`  Fighters: ${output.fighterCount}`);
console.log(`  Matchups: ${matchups.length}`);
if (eventArg) console.log(`  Filtered to event: ${eventArg}`);
process.exit(0);
