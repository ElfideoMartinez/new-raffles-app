import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const gather = fileURLToPath(new URL("./gather.mjs", import.meta.url));

// SYNTHETIC fixtures only: no real fighters, event claims, or network access.
function runGather(args = [], competitions = [], { commonsFailure = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "synthetic-gather-results-"));
  const output = path.join(root, "output");
  const fixture = { events: [{ name: "SYNTHETIC TEST EVENT", competitions }] };
  const script = `
    process.argv = [process.execPath, ${JSON.stringify(gather)}, ...${JSON.stringify(args)}, ${JSON.stringify(`--dir=${output}`)}];
    globalThis.setTimeout = (callback) => { callback(); return 0; };
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.startsWith('https://site.api.espn.com/')) {
        console.log('SYNTHETIC_SCOREBOARD_FETCH');
        return { ok: true, json: async () => (${JSON.stringify(fixture)}) };
      }
      if (url.startsWith('https://en.wikipedia.org/api/rest_v1/page/summary/')) return { ok: false, status: 404 };
      if (url.startsWith('https://www.ufcespanol.com/athlete/') || url.startsWith('https://www.ufc.com/athlete/')) return { ok: true, text: async () => '<html></html>' };
      if (url.startsWith('https://commons.wikimedia.org/w/api.php')) {
        if (${commonsFailure}) throw new Error('SYNTHETIC commons failure');
        return { ok: true, json: async () => ({ query: { pages: [] } }) };
      }
      throw new Error('NETWORK DISABLED: unexpected fetch ' + url);
    };
    await import(${JSON.stringify(new URL("./gather.mjs", import.meta.url).href)});
  `;
  try {
    const child = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
      encoding: "utf8", timeout: 10000,
    });
    assert.ifError(child.error);
    const profiles = fs.existsSync(output)
      ? fs.readdirSync(output).filter((entry) => fs.statSync(path.join(output, entry)).isDirectory())
        .map((entry) => JSON.parse(fs.readFileSync(path.join(output, entry, "profile.json"), "utf8")))
      : [];
    const reportPath = path.join(output, "_gather-report.json");
    return { ...child, profiles, report: fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, "utf8")) : null };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// SYNTHETIC ESPN-shaped bout; deliberately not a claim about any real event.
function syntheticBout(status = { type: { state: "post", completed: true, name: "STATUS_FINAL" } }) {
  return {
    status,
    type: { abbreviation: "SyntheticDivision" },
    competitors: [
      { athlete: { displayName: "Synthetic Alpha", flag: { alt: "Synthetic Country A", href: "https://invalid.example/a" } }, winner: true, records: [{ summary: "1-0-0" }] },
      { athlete: { displayName: "Synthetic Beta", flag: { alt: "Synthetic Country B" } }, winner: false },
    ],
  };
}

test("pending bouts never become previous wins or losses, even with stale winner flags", () => {
  const run = runGather(["--date=2026-10-24"], [syntheticBout({ type: { state: "pre", completed: false, name: "STATUS_SCHEDULED" } })]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.profiles.length, 2);
  for (const profile of run.profiles) {
    assert.deepEqual(profile.previousFights, []);
    assert.deepEqual(profile.stats, []);
    assert.equal(profile._event.bouts[0].result, null);
    assert.equal(profile._event.bouts[0].winner, null);
  }
});

test("W/L requires exactly two competitors with explicit complementary boolean winner flags", () => {
  const cases = [[false, false], [true, true], [true, undefined], [undefined, undefined], ["true", false], [true, "false"], [true], [true, false, false]];
  for (const flags of cases) {
    const bout = syntheticBout();
    bout.competitors = flags.map((winner, index) => ({ athlete: { displayName: `Synthetic Fighter ${index}` }, winner }));
    const run = runGather(["--date=2026-10-24"], [bout]);
    assert.equal(run.status, 0, run.stderr);
    for (const profile of run.profiles) {
      assert.equal(profile._event.bouts[0].result, null, JSON.stringify(flags));
      assert.deepEqual(profile.previousFights, []);
      assert.deepEqual(profile.stats, []);
    }
  }
});

test("cancelled or postponed status overrides stale completed winner flags", () => {
  for (const name of ["STATUS_CANCELED", "STATUS_CANCELLED", "STATUS_POSTPONED", "STATUS_SUSPENDED"]) {
    const bout = syntheticBout({ type: { state: "post", completed: true, name } });
    const run = runGather(["--date=2026-10-24"], [bout]);
    assert.equal(run.status, 0, run.stderr);
    for (const profile of run.profiles) {
      assert.equal(profile._event.bouts[0].result, null, name);
      assert.deepEqual(profile.previousFights, []);
      assert.deepEqual(profile.stats, []);
    }
  }
});

test("explicit completed draw/no-contest evidence is preserved without W/L or win claims", () => {
  for (const [evidence, result] of [["Majority Draw", "D"], ["No Contest", "NC"], ["NC", "NC"], ["D", "D"]]) {
    for (const location of ["status", "details", "competitors"]) {
      const bout = syntheticBout();
      if (location === "status") bout.status.type.detail = evidence;
      if (location === "details") bout.details = { type: { text: evidence } };
      if (location === "competitors") bout.competitors.forEach((competitor) => { competitor.result = evidence; });
      const run = runGather(["--date=2026-10-24"], [bout]);
      assert.equal(run.status, 0, run.stderr);
      for (const profile of run.profiles) {
        assert.equal(profile._event.bouts[0].result, result, `${location}: ${evidence}`);
        assert.equal(profile._event.bouts[0].winner, null);
        assert.equal(profile.previousFights[0].result, result);
        assert.deepEqual(profile.stats, []);
      }
    }
  }
});

test("completed verified W/L preserves country through profile and event mapping", () => {
  const run = runGather(["--date=2024-02-29"], [syntheticBout()]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.report.date, "2024-02-29");
  assert.deepEqual(run.profiles.map((profile) => profile.previousFights[0].result), ["W", "L"]);
  assert.equal(run.profiles[0].stats[0].value, "Ganó en SYNTHETIC TEST EVENT");
  assert.deepEqual(run.profiles[1].stats, []);
  for (const [index, profile] of run.profiles.entries()) {
    const country = index === 0 ? "Synthetic Country A" : "Synthetic Country B";
    assert.equal(profile.country, country);
    assert.equal(profile._event.bouts[0].country, country);
  }
});

test("recorded failures produce a nonzero exit after writing the run report", () => {
  const run = runGather(["--date=2026-10-24", "--commons-fallback"], [syntheticBout()], { commonsFailure: true });
  assert.equal(run.report.failures.length, 2);
  assert.match(run.report.failures[0], /SYNTHETIC commons failure/);
  assert.equal(run.profiles.length, 2);
  assert.equal(run.status, 1);
});

test("contradictory explicit result evidence cannot produce W/L", () => {
  const bout = syntheticBout();
  bout.competitors[0].result = "L";
  bout.competitors[1].result = "W";
  const run = runGather(["--date=2026-10-24"], [bout]);
  assert.equal(run.status, 0, run.stderr);
  for (const profile of run.profiles) {
    assert.equal(profile._event.bouts[0].result, null);
    assert.deepEqual(profile.previousFights, []);
    assert.deepEqual(profile.stats, []);
  }
});

test("unverified completion or conflicting draw/no-contest stays unknown", () => {
  const bouts = [undefined, { type: { state: "in", completed: false } }, { type: { state: "post", completed: "true" } }, { type: { state: "post" } }]
    .map((status) => ({ ...syntheticBout(), status }));
  const conflict = syntheticBout();
  conflict.status.type.detail = "Draw";
  conflict.details = { type: { abbreviation: "NC" } };
  bouts.push(conflict);
  for (const bout of bouts) {
    const run = runGather(["--date=2026-10-24"], [bout]);
    assert.equal(run.status, 0, run.stderr);
    for (const profile of run.profiles) {
      assert.equal(profile._event.bouts[0].result, null);
      assert.deepEqual(profile.previousFights, []);
      assert.deepEqual(profile.stats, []);
    }
  }
});

test("requires an explicit real calendar --date before fetching or writing", () => {
  for (const args of [[], ["--date"], ["--date="], ["--date=2026-2-01"], ["--date=2026-02-29"], ["--date=2026-04-31"], ["--date=2026-13-01"], ["--date=not-a-date"]]) {
    const run = runGather(args);
    assert.notEqual(run.status, 0, JSON.stringify(args));
    assert.match(run.stderr, /--date.*YYYY-MM-DD/);
    assert.doesNotMatch(run.stdout, /SYNTHETIC_SCOREBOARD_FETCH/);
    assert.equal(run.report, null);
  }
});
