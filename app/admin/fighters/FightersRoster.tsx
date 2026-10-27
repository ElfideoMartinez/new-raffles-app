"use client";
import { useState } from "react";
import withAuth from "@/app/components/WithAuth";

export type FighterCardData = {
  slug: string;
  name: string;
  initials: string;
  division: string | null;
  country: string | null;
  license: string | null;
  relaxed: boolean;
  checked: string | null;
  hasPhoto: boolean;
  photoDataUri: string | null;
  record: string | null;
};

function FighterThumb({
  fighter,
  broken,
  onBroken,
}: {
  fighter: FighterCardData;
  broken: boolean;
  onBroken: () => void;
}) {
  if (fighter.photoDataUri && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fighter.photoDataUri}
        alt={`Foto de ${fighter.name}`}
        onError={onBroken}
        className="h-20 w-20 rounded-sm object-cover bg-ink-100 shrink-0"
      />
    );
  }
  return (
    <div
      aria-label={`Sin foto: ${fighter.name}`}
      className="h-20 w-20 rounded-sm shrink-0 flex items-center justify-center bg-ink-100 border border-dashed border-ink-300 text-ink-500 font-bold text-xl"
    >
      {fighter.initials}
    </div>
  );
}

function FightersRoster({ fighters }: { fighters: FighterCardData[] }) {
  // A file can exist but still fail to decode (one profile does). The browser
  // reports it here, and the card/summary then treat it as "no photo".
  const [brokenPhotos, setBrokenPhotos] = useState<Record<string, boolean>>({});
  const photoOk = (fighter: FighterCardData) =>
    fighter.hasPhoto && !brokenPhotos[fighter.slug];
  const withPhoto = fighters.filter(photoOk).length;
  const missing = fighters.length - withPhoto;

  return (
    <div className="flex flex-col w-full items-center px-4 mt-6">
      <h1 className="my-1 text-xl font-bold">Peleadores</h1>
      <p className="text-sm text-gray-600 text-center mb-4 max-w-xl">
        Fichas guardadas en <code>fighters/</code>. Solo lectura. Sirve para ver
        quién todavía no tiene foto: esas fichas usan iniciales al generar las
        tarjetas de Instagram.
      </p>

      <div className="mb-5 flex flex-wrap justify-center gap-2 text-sm">
        <span className="rounded-sm bg-ink-100 px-3 py-1.5 text-ink-700">
          {fighters.length} peleadores
        </span>
        <span className="rounded-sm bg-success-50 px-3 py-1.5 text-success-700">
          {withPhoto} con foto
        </span>
        <span
          className={`rounded-sm px-3 py-1.5 ${
            missing > 0 ? "bg-warning-50 text-warning-700" : "bg-ink-100 text-ink-500"
          }`}
        >
          {missing} sin foto
        </span>
      </div>

      {fighters.length === 0 ? (
        <p className="text-sm text-gray-600">
          No se encontraron perfiles en <code>fighters/</code>.
        </p>
      ) : (
        <ul className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {fighters.map((fighter) => (
            <li
              key={fighter.slug}
              className="flex gap-3 rounded-card border border-ink-300 bg-white p-3 shadow-card"
            >
              <FighterThumb
                fighter={fighter}
                broken={Boolean(brokenPhotos[fighter.slug])}
                onBroken={() =>
                  setBrokenPhotos((current) => ({ ...current, [fighter.slug]: true }))
                }
              />
              <div className="min-w-0 flex flex-col gap-1">
                <div className="flex items-start gap-2">
                  <h2 className="font-semibold text-ink-900 leading-tight">
                    {fighter.name}
                  </h2>
                  {fighter.relaxed && photoOk(fighter) ? (
                    <span
                      title="Foto aceptada bajo --any-license; revisar antes de uso amplio"
                      className="shrink-0 rounded-sm bg-warning-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-700"
                    >
                      Relaxed
                    </span>
                  ) : null}
                  {!photoOk(fighter) ? (
                    <span className="shrink-0 rounded-sm bg-warning-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-700">
                      Sin foto
                    </span>
                  ) : null}
                </div>
                <p className="font-mono text-xs text-ink-500 break-all">{fighter.slug}</p>
                <p className="text-xs text-ink-700">
                  {[fighter.division, fighter.country].filter(Boolean).join(" · ") ||
                    "División/país sin dato"}
                  {fighter.record ? ` · ${fighter.record}` : ""}
                </p>
                <p className="text-xs text-ink-500">
                  Licencia: {photoOk(fighter) ? fighter.license || "—" : "—"}
                </p>
                <p className="text-xs text-ink-500">
                  Revisado: {fighter.checked || "sin fecha"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default withAuth(FightersRoster);
