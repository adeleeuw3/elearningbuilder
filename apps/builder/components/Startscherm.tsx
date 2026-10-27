/**
 * Het startscherm: één vraag, midden op een aurora.
 *
 * Dit scherm ís de eerste interviewbeurt. Het onderwerp is altijd het eerste veld (zie de
 * veldorde in `lib/spec.ts`), dus daar hoeft het model niet om gevraagd te worden — we schrijven
 * het antwoord lokaal in de spec en laten het model pas vanaf beurt twee meedenken. Dat scheelt
 * de gemeten ~9-21s die de eerste aanroep kostte; de pagina staat er nu direct.
 *
 * Prism-verantwoording:
 * - De aurora gebruikt alleen **Flow** en **Bloom**: hier ga je iets doen (Flow) en een AI
 *   genereert het (Bloom). Glow betekent "voltooid" en heeft op een startpagina niets te melden,
 *   dus die blijft eruit. Kleur = betekenis, ook in een achtergrond.
 * - De kleuren komen uit de tokens via `color-mix()`, niet uit overgetypte hexwaarden.
 * - Er is precies één glow op dit scherm: de accentknop, en alleen zodra je iets getypt hebt.
 *   Een leeg startscherm heeft dus geen enkele glow — glow verdient zijn plek.
 * - Focus is een outline (zoals overal in deze app), geen tweede glow.
 */
"use client";

import * as React from "react";
import { Button, cn } from "@ob/ui";
import { Merkteken, Woordmerk } from "./Merkteken";
import {
  laadProject,
  leesBronmateriaal,
  lijstProjecten,
  type Bronmateriaal,
  type ProjectRegel,
} from "../lib/api-client";

export interface StartschermProps {
  /** Het onderwerp waarmee het interview begint, met eventueel bronmateriaal erbij. */
  onStart: (onderwerp: string, bron?: Bronmateriaal) => void;
  /** Het interview overslaan en meteen zelf blokken gaan neerzetten. */
  onZelfBouwen: (onderwerp?: string) => void;
  /** Een bewaarde module openen. */
  onOpen: (id: string, doc: unknown) => void;
  /**
   * De knoppen rechtsboven: beheer en profiel.
   *
   * Als prop, net als bij `Shell`. Zonder deze stonden ze alléén op de schermen ná het starten, en
   * was er vanaf hier geen weg naar het beheeroverzicht of je profiel — je moest eerst een module
   * openen of beginnen om erbij te kunnen.
   */
  navigatie?: React.ReactNode;
}

export function Startscherm({ onStart, onZelfBouwen, onOpen, navigatie }: StartschermProps) {
  const [tekst, setTekst] = React.useState("");
  const leeg = tekst.trim().length === 0;

  /** Wat er al bewaard is. Leeg bij een verse installatie, en dan staat er ook niets. */
  const [bewaard, setBewaard] = React.useState<ProjectRegel[]>([]);
  const [opent, setOpent] = React.useState<string | null>(null);
  React.useEffect(() => {
    void lijstProjecten().then(setBewaard);
  }, []);

  async function open(id: string) {
    setOpent(id);
    const p = await laadProject(id);
    setOpent(null);
    if (p) onOpen(id, p.doc);
  }

  /**
   * Het aangeleverde document, als er een is.
   *
   * Blijft in dit tabblad: de server bewaart hem niet. Hij reist mee naar het genereren en
   * verdwijnt daarna — er is geen reden om het handboek van een klant op die machine te laten
   * staan nadat de module gemaakt is.
   */
  const [bron, setBron] = React.useState<Bronmateriaal | null>(null);
  const [leest, setLeest] = React.useState(false);
  const [bronfout, setBronfout] = React.useState<string | null>(null);
  const bestandRef = React.useRef<HTMLInputElement | null>(null);

  async function kiesBestand(bestand: File | undefined) {
    if (!bestand) return;
    setLeest(true);
    setBronfout(null);
    const uit = await leesBronmateriaal(bestand);
    setLeest(false);
    // Het veld leegmaken, anders levert hetzelfde bestand opnieuw kiezen geen `change` meer op.
    if (bestandRef.current) bestandRef.current.value = "";
    if (!uit.ok) {
      setBronfout(uit.bericht);
      return;
    }
    setBron(uit.data);
  }

  const verstuur = () => {
    if (leeg) return;
    onStart(tekst.trim(), bron ?? undefined);
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <Aurora />

      <header className="relative z-10 flex items-center gap-3 px-4 pt-5 sm:px-6">
        <Merkteken />
        <span className="mr-auto">
          <Woordmerk />
        </span>
        {navigatie}
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-20 text-center">
        {/* Display XL (46/700/-0.03em) op ruime schermen, Titel (30/700/-0.02em) op smalle.
            Beide zijn gedocumenteerde typerollen; 46px past niet op 375px. */}
        <h1 className="text-[30px] font-bold leading-[1.08] -tracking-[0.02em] sm:text-[46px] sm:-tracking-[0.03em]">
          Wat wil je maken?
        </h1>
        <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-ink-soft sm:text-[18px]">
          Beschrijf het onderwerp van je leermodule. Daarna stel ik een paar korte vragen en bouw
          ik de module.
        </p>

        <div className="mt-7 w-full max-w-[560px]">
          {/* De pil blijft in rust op platte elevation. Focus is een outline in Flow-ink, precies
              zoals elk ander bedieningselement hier — niet een tweede glow naast de knop. */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-full border border-stroke bg-card py-2 pl-5 pr-2",
              "shadow-elevation",
              // `outline-2` zet alléén de breedte. Bij focus-visible vult de browser de stijl zelf
              // in (outline-style: auto), maar focus-within krijgt die hulp niet — zonder de
              // `outline`-klasse blijft outline-style `none` en is er dus geen zichtbare focus.
              "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2",
              "focus-within:outline-flow-ink",
            )}
          >
            <input
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              onKeyDown={(e) => {
                // Enter begint. Geen HTML <form> — kwaliteitsvloer.
                if (e.key === "Enter") {
                  e.preventDefault();
                  verstuur();
                }
              }}
              autoFocus
              aria-label="Onderwerp van je leermodule"
              placeholder="Bijv. veilig werken op hoogte"
              className={cn(
                "min-w-0 flex-1 bg-transparent text-[15px] leading-relaxed text-ink",
                "placeholder:text-ink-faint focus:outline-none",
              )}
            />
            <Button
              role_="accent"
              disabled={leeg}
              onClick={verstuur}
              aria-label="Beginnen"
              className="shrink-0 rounded-full"
            >
              {/* Op 375px vraagt het label 114px op en houdt het tekstveld er 191 over — te smal
                  voor de placeholder. Vanaf `sm` is er ruimte, daar staat het label er wel. */}
              <span className="hidden sm:inline">Beginnen</span>
              <span aria-hidden="true">→</span>
            </Button>
          </div>

          {/* Het alternatief, bewust rustig: wie hier komt wil meestal het interview. Wat er al
              getypt is gaat mee als titel — dat scheelt het opnieuw intikken. */}
          {/* Eigen materiaal. Onder de pil en rustig vormgegeven: het is een aanvulling, geen
              voorwaarde — de meeste modules beginnen zonder. Geen HTML <form>: een verborgen
              bestandsveld dat een knop aanstuurt (kwaliteitsvloer). */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <input
              ref={bestandRef}
              type="file"
              accept=".docx,.txt,.md,.markdown"
              className="sr-only"
              onChange={(e) => void kiesBestand(e.target.files?.[0])}
            />

            {!bron && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-[12.5px] text-ink-faint">Heb je eigen materiaal?</span>
                <Button
                  size="sm"
                  role_="subtle"
                  disabled={leest}
                  onClick={() => bestandRef.current?.click()}
                >
                  {leest ? "Lezen…" : "Handboek of procedure toevoegen"}
                </Button>
              </div>
            )}

            {bron && (
              <div
                className={cn(
                  "flex flex-wrap items-center justify-center gap-2 rounded-card",
                  "border border-stroke bg-card px-3 py-2 text-[12.5px] shadow-elevation",
                )}
              >
                <span className="font-semibold text-ink">{bron.naam}</span>
                <span className="text-ink-faint">
                  {bron.alineas} alinea{bron.alineas === 1 ? "" : "'s"} gelezen
                  {/* Afkappen stilzwijgend laten gebeuren levert een module op die een hoofdstuk
                      mist, en dat merkt niemand. */}
                  {bron.afgekapt && " · alleen het begin, de rest valt buiten de limiet"}
                </span>
                <Button size="sm" role_="subtle" onClick={() => setBron(null)}>
                  Weghalen
                </Button>
              </div>
            )}

            {bronfout && (
              <p className="max-w-[46ch] rounded-control bg-bloom-wash px-3 py-2 text-[12.5px] leading-relaxed text-bloom-ink">
                {bronfout}
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[12.5px] text-ink-faint">Liever zelf bouwen?</span>
            <Button
              size="sm"
              role_="subtle"
              onClick={() => onZelfBouwen(tekst.trim() || undefined)}
            >
              Begin met een leeg whiteboard →
            </Button>
          </div>

          {/* Wat er al bewaard is. Staat er alleen als er iets is — een lege lijst is ruis. */}
          {bewaard.length > 0 && (
            <div className="mt-8 text-left">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                Verder met
              </span>
              <ul className="mt-2 flex flex-col gap-1">
                {bewaard.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={opent !== null}
                      onClick={() => void open(p.id)}
                      className="flex w-full items-center gap-2 rounded-control border border-stroke bg-card px-3 py-2 text-left text-[13.5px] text-ink shadow-elevation [transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-0.5 hover:-translate-y-px hover:bg-flow-wash hover:text-flow-ink hover:border-flow-from hover:shadow-glow-flow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink disabled:opacity-55"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{p.titel}</span>
                      <span className="shrink-0 text-[11.5px] tabular-nums text-ink-faint">
                        {p.gewijzigd.slice(0, 16).replace("T", " ")}
                      </span>
                      <span aria-hidden="true" className="shrink-0 text-flow-ink">
                        {opent === p.id ? "…" : "→"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * De aurora. Twee zachte velden achter de inhoud, met een langzame drift.
 *
 * Alleen `transform` beweegt (motion.md), en de animatieklassen staan achter `motion-safe`, dus
 * bij `prefers-reduced-motion` staat de gloed stil in plaats van dat hij zachter beweegt. De
 * drift is een doorlopende ademhaling en geen state-overgang, dus daar past een sinusachtige
 * `ease-in-out` bij en niet een van de drie springs — die zijn entree-curves.
 */
function Aurora() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Flow: de kern, precies achter de invoer. Hier ga je iets doen. */}
      <div className="absolute left-1/2 top-[52%] h-[760px] w-[1180px] -translate-x-1/2 -translate-y-1/2">
        <div
          className="h-full w-full motion-safe:animate-[prism-aurora-a_26s_ease-in-out_infinite]"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in srgb, var(--flow-from) 38%, transparent), color-mix(in srgb, var(--flow-to) 20%, transparent) 55%, transparent 80%)",
          }}
        />
      </div>

      {/* Bloom: kleiner en verschoven. Hier genereert een AI iets. */}
      <div className="absolute left-1/2 top-[64%] h-[520px] w-[760px] -translate-x-[62%] -translate-y-1/2">
        <div
          className="h-full w-full motion-safe:animate-[prism-aurora-b_34s_ease-in-out_infinite]"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in srgb, var(--bloom-from) 20%, transparent), transparent 72%)",
          }}
        />
      </div>
    </div>
  );
}
