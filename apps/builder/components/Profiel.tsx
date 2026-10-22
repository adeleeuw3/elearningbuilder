/**
 * Profiel: wie je bent in deze app, en wat er is ingesteld.
 *
 * **Geen account.** Deze app kent geen inlog — de opslag is een map op deze machine. Dat staat
 * hier ook met zoveel woorden, want een profielscherm wekt de indruk van een afgeschermde
 * omgeving, en die indruk is hier onjuist. Liever één zin die dat rechtzet dan een gebruiker die
 * denkt dat zijn werk achter een slot zit.
 *
 * **Wat hier nog niet werkt staat erbij.** De drie velden worden bewaard maar werken nog nergens
 * door; dat staat onder elk veld in plaats van dat de gebruiker het zelf moet ontdekken. Een veld
 * dat doet alsof het iets verandert is erger dan een veld dat zegt dat het dat nog niet doet.
 *
 * Het tweede deel is een statusoverzicht: welke sleutels ingesteld zijn. Dat staat hier omdat
 * "exporteren weigert" en "zoeken vindt niets" dezelfde oorzaak kunnen hebben — een ontbrekende
 * regel in `.env.local` — en die oorzaak anders pas blijkt op het moment dat je ertegenaan loopt.
 * Alleen ja of nee: een waarde die hier getoond wordt is een waarde die in de browser staat.
 */
"use client";

import * as React from "react";
import { Button, Card, Chip, cn } from "@ob/ui";
import { LEEG_PROFIEL, TALEN, type Profiel as ProfielVorm } from "../lib/profiel";

interface Instellingenstand {
  iriBasis: { ingesteld: boolean; bezwaar: string | null };
  anthropic: boolean;
  media: { pexels: boolean; pixabay: boolean; youtube: boolean };
}

export function Profiel() {
  const [profiel, setProfiel] = React.useState<ProfielVorm>(LEEG_PROFIEL);
  const [geladen, setGeladen] = React.useState(false);
  const [stand, setStand] = React.useState<Instellingenstand | null>(null);
  const [bewaarStand, setBewaarStand] = React.useState<"rust" | "bezig" | "klaar" | "mis">("rust");
  const [fout, setFout] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/profiel");
        if (res.ok) setProfiel((await res.json()) as ProfielVorm);
      } catch {
        /* dan blijft het leeg staan */
      }
      setGeladen(true);
      try {
        const res = await fetch("/api/instellingen");
        if (res.ok) setStand((await res.json()) as Instellingenstand);
      } catch {
        /* het statusblok blijft dan weg */
      }
    })();
  }, []);

  async function bewaar() {
    setBewaarStand("bezig");
    setFout(null);
    try {
      const res = await fetch("/api/profiel", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profiel),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { bericht?: string } | null;
        setFout(body?.bericht ?? "Bewaren lukte niet.");
        setBewaarStand("mis");
        return;
      }
      setBewaarStand("klaar");
    } catch {
      setFout("De server is niet bereikbaar.");
      setBewaarStand("mis");
    }
  }

  const zet = (patch: Partial<ProfielVorm>) => {
    setProfiel((p) => ({ ...p, ...patch }));
    setBewaarStand("rust");
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[30px] font-bold leading-[1.15] -tracking-[0.02em]">Profiel</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
          Deze app heeft geen inlog: alles staat in een map op deze machine en iedereen die de app
          opent is dezelfde gebruiker. Wat hier staat zijn jouw voorkeuren, geen account.
        </p>
      </div>

      <Card panel className="flex flex-col gap-3">
        <Veld
          label="Naam"
          waarde={profiel.naam}
          placeholder="Hoe je genoemd wilt worden"
          onChange={(naam) => zet({ naam })}
          hint="Wordt bewaard. Komt bij de modules te staan zodra het beheeroverzicht de auteur toont — dat is nog niet aangesloten."
        />
        <Veld
          label="Organisatie"
          waarde={profiel.organisatie}
          placeholder="Voor wie je bouwt"
          onChange={(organisatie) => zet({ organisatie })}
          hint="Wordt bewaard. Gaat nog niet mee als uitgever in het exportpakket; daar is een veld in het schema voor nodig."
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Taal van nieuwe modules
          </span>
          <span className="text-[11.5px] leading-relaxed text-ink-faint">
            Wordt bewaard. De export zet nog altijd nl-NL; die taal hoort per module vast te liggen
            op het moment dat je hem maakt, niet op het moment dat je exporteert.
          </span>
          <select
            value={profiel.taal}
            onChange={(e) => zet({ taal: e.target.value })}
            className="rounded-control border border-stroke bg-card px-2.5 py-2 text-[13.5px] text-ink focus:border-flow-from focus:outline-none"
          >
            {TALEN.map((t) => (
              <option key={t.code} value={t.code}>
                {t.naam} ({t.code})
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-3">
          <Button onClick={() => void bewaar()} disabled={!geladen || bewaarStand === "bezig"}>
            {bewaarStand === "bezig" ? "Bewaren…" : "Bewaren"}
          </Button>
          {bewaarStand === "klaar" && (
            <span className="text-[12px] text-glow-ink">Bewaard.</span>
          )}
          {fout && <span className="text-[12px] text-bloom-ink">{fout}</span>}
        </div>
      </Card>

      {stand && (
        <Card panel className="flex flex-col gap-3">
          <div>
            <h2 className="text-[20px] font-semibold -tracking-[0.01em]">Wat er is ingesteld</h2>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-faint">
              Komt uit <code>.env.local</code> op de server. Alleen of het er staat — de waarden
              zelf blijven daar, want wat hier zou staan staat in de browser van iedereen die dit
              scherm opent.
            </p>
          </div>

          <ul className="flex flex-col gap-1.5">
            <Regel
              naam="IRI-namespace (OB_IRI_BASE)"
              ok={stand.iriBasis.ingesteld && !stand.iriBasis.bezwaar}
              uitleg={
                stand.iriBasis.bezwaar ??
                (stand.iriBasis.ingesteld
                  ? "Exporteren kan."
                  : "Zonder dit weigert elke export — er is dan geen namespace voor de xAPI-IRI's.")
              }
            />
            <Regel
              naam="Anthropic (ANTHROPIC_API_KEY)"
              ok={stand.anthropic}
              uitleg={
                stand.anthropic
                  ? "Schrijven en genereren kan."
                  : "Zonder dit kan er niets geschreven of gegenereerd worden."
              }
            />
            <Regel
              naam="Pexels (PEXELS_API_KEY)"
              ok={stand.media.pexels}
              uitleg="Foto's en stockvideo in de mediazoeker."
            />
            <Regel
              naam="Pixabay (PIXABAY_API_KEY)"
              ok={stand.media.pixabay}
              uitleg="Foto's en stockvideo in de mediazoeker."
            />
            <Regel
              naam="YouTube (YOUTUBE_API_KEY)"
              ok={stand.media.youtube}
              uitleg="Zoeken naar video's om in te sluiten."
            />
          </ul>
        </Card>
      )}
    </div>
  );
}

function Regel({ naam, ok, uitleg }: { naam: string; ok: boolean; uitleg: string }) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <Chip tone={ok ? "glow" : "rest"} className="shrink-0">
        {ok ? "ingesteld" : "ontbreekt"}
      </Chip>
      <span className="text-[13.5px] font-medium text-ink">{naam}</span>
      <span className={cn("text-[12px]", ok ? "text-ink-faint" : "text-ink-soft")}>{uitleg}</span>
    </li>
  );
}

function Veld({
  label,
  waarde,
  placeholder,
  hint,
  onChange,
}: {
  label: string;
  waarde: string;
  placeholder?: string;
  hint?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </span>
      <input
        value={waarde}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-control border border-stroke bg-card px-3 py-2 text-[14px] text-ink placeholder:text-ink-faint focus:border-flow-from focus:shadow-glow-flow focus:outline-none"
      />
      {hint && <span className="text-[11.5px] leading-relaxed text-ink-faint">{hint}</span>}
    </label>
  );
}
