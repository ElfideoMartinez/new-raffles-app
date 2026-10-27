import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, join } from "node:path";
import FightersRoster, { type FighterCardData } from "./FightersRoster";

/**
 * Read-only fighter roster (admin).
 *
 * Source of truth is the repo's `fighters/<slug>/profile.json` + `photo.jpg`,
 * the same files the Instagram generator uses. The page is statically rendered
 * at build time (`force-static`), so the deployed page never needs filesystem
 * access at runtime and the thumbnails are embedded as data URIs.
 *
 * Purpose: see at a glance who still has no picture.
 */
export const dynamic = "force-static";

function initialsFor(name: string, slug: string): string {
  const fromName = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return fromName || slug.slice(0, 2).toUpperCase();
}

// sips is present on the machine that renders this static page (macOS). If it
// is unavailable (e.g. a Linux build), assume the file is usable; the client
// thumbnail still falls back to initials if the browser cannot decode it.
function isDecodableImage(file: string): boolean {
  try {
    const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], {
      encoding: "utf8",
    });
    return /pixelWidth:\s*\d+/.test(out) && /pixelHeight:\s*\d+/.test(out);
  } catch (err: any) {
    if (err?.code === "ENOENT") return true;
    return false;
  }
}

function loadFighters(): FighterCardData[] {
  const root = join(process.cwd(), "fighters");
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "profile.json")))
    .map((entry) => {
      const dir = join(root, entry.name);
      let profile: Record<string, any>;
      try {
        profile = JSON.parse(readFileSync(join(dir, "profile.json"), "utf8"));
      } catch (err) {
        console.warn(`[admin/fighters] skipping ${entry.name}: invalid profile.json`, err);
        return null;
      }

      const slug: string = String(profile.slug || entry.name);
      const name: string = String(profile.name || slug);
      const photo = profile.photo;
      const photoFile =
        profile.photo && typeof profile.photo.file === "string"
          ? basename(profile.photo.file)
          : "photo.jpg";
      const photoPath = join(dir, photoFile);
      const hasPhoto = Boolean(profile.photo) && existsSync(photoPath);

      let photoDataUri: string | null = null;
      if (hasPhoto) {
        const ext = photoPath.toLowerCase().endsWith(".png") ? "png" : "jpeg";
        try {
          photoDataUri = `data:image/${ext};base64,${readFileSync(photoPath).toString("base64")}`;
        } catch (err) {
          console.warn(`[admin/fighters] could not read photo for ${slug}`, err);
        }
      }

      // Gather records RELAXED in sources.md and (future) profile.photo.relaxed.
      let sourcesText = "";
      const sourcesPath = join(dir, "sources.md");
      if (existsSync(sourcesPath)) {
        try {
          sourcesText = readFileSync(sourcesPath, "utf8");
        } catch {
          /* non-fatal */
        }
      }
      const relaxed =
        photo?.relaxed === true ||
        photo?.any_license === true ||
        /(^|\W)RELAXED(\W|$)/.test(sourcesText);

      const checkedDates = (Array.isArray(profile.sources) ? profile.sources : [])
        .map((source: any) => (typeof source?.checked === "string" ? source.checked : null))
        .filter((value: string | null): value is string => Boolean(value))
        .sort();
      const checked = checkedDates.length ? checkedDates[checkedDates.length - 1] : null;

      const rec = profile.record || {};
      const record =
        typeof rec.wins === "number"
          ? `${rec.wins}-${rec.losses ?? 0}${rec.draws ? `-${rec.draws}` : ""}`
          : null;

      return {
        slug,
        name,
        initials: String(profile.initials || initialsFor(name, slug)),
        division: typeof profile.division === "string" ? profile.division : null,
        country: typeof profile.country === "string" ? profile.country : null,
        license: typeof photo?.license === "string" ? photo.license : null,
        relaxed,
        checked,
        hasPhoto: Boolean(photoDataUri),
        photoDataUri,
        record,
      } satisfies FighterCardData;
    })
    .filter((fighter): fighter is FighterCardData => fighter !== null)
    // Fighters without a picture first: that is the thing to act on.
    .sort((a, b) => Number(a.hasPhoto) - Number(b.hasPhoto) || a.name.localeCompare(b.name));
}


export default function FightersAdminPage() {
  return <FightersRoster fighters={loadFighters()} />;
}
