/**
 * Zwevende werkbalk onderaan het canvas: pilvorm, witte achtergrond, zachte schaduw.
 *
 * Elk gereedschap hier doet echt iets. Een balk met knoppen die niets doen is erger dan een
 * kleinere balk: de gebruiker klikt, er gebeurt niets, en dan vertrouwt hij de rest ook niet meer.
 */
"use client";

import { Button, cn } from "@ob/ui";

export type Gereedschap = "selecteer" | "hand" | "stift" | "verbind" | "gum";

export interface WerkbalkProps {
  gereedschap: Gereedschap;
  onGereedschap: (g: Gereedschap) => void;
  raster: boolean;
  onRaster: (aan: boolean) => void;
  zoom: number;
  /** Schaalt het canvas zichzelf mee? Dan staat dat bij het percentage. */
  autoSchaal?: boolean;
  onZoom: (z: number) => void;
  /** Alles in beeld brengen. */
  onPassend: () => void;
  /**
    * "Opruimen": leg de hele module in één keer in het raster.
    *
    * De enige plek waar posities dwingend herschreven worden. Het canvas is verder vrij; dit is de
    * knop voor als het rommelig geworden is.
    */
  onOpruimen: () => void;
  /** Actieve hint, bijvoorbeeld welke knoop als eerste is aangeklikt bij verbinden. */
  hint?: string | null;
}

const GEREEDSCHAP: { id: Gereedschap; icoon: string; label: string; sneltoets: string }[] = [
  { id: "selecteer", icoon: "▲", label: "Selecteren en slepen", sneltoets: "V" },
  { id: "hand", icoon: "✋", label: "Canvas verschuiven", sneltoets: "H" },
  { id: "stift", icoon: "✎", label: "Vrij tekenen", sneltoets: "M" },
  { id: "verbind", icoon: "⤳", label: "Knopen verbinden", sneltoets: "C" },
  { id: "gum", icoon: "⌫", label: "Tekening of verbinding wissen", sneltoets: "E" },
];

export const ZOOM_STAPPEN = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function Werkbalk({
  gereedschap,
  onGereedschap,
  raster,
  onRaster,
  zoom,
  autoSchaal,
  onZoom,
  onPassend,
  onOpruimen,
  hint,
}: WerkbalkProps) {
  const index = ZOOM_STAPPEN.reduce(
    (best, z, i) => (Math.abs(z - zoom) < Math.abs(ZOOM_STAPPEN[best]! - zoom) ? i : best),
    0,
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex flex-col items-center gap-2">
      {hint && (
        <span className="pointer-events-auto rounded-full bg-flow-wash px-3 py-1.5 text-[12px] font-semibold text-flow-ink shadow-elevation">
          {hint}
        </span>
      )}

      <div
        role="toolbar"
        aria-label="Canvasgereedschap"
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-stroke bg-card p-1.5 shadow-elevation"
      >
        {GEREEDSCHAP.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={gereedschap === g.id}
            aria-label={`${g.label} (${g.sneltoets})`}
            title={`${g.label} · ${g.sneltoets}`}
            onClick={() => onGereedschap(g.id)}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full text-[15px]",
              "[transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-px hover:shadow-glow-flow",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
              gereedschap === g.id
                ? "bg-flow-wash text-flow-ink"
                : "text-ink-soft hover:bg-flow-wash hover:text-flow-ink",
            )}
          >
            <span aria-hidden="true">{g.icoon}</span>
          </button>
        ))}

        <span aria-hidden="true" className="mx-1 h-6 w-px bg-stroke" />

        <button
          type="button"
          aria-pressed={raster}
          aria-label="Raster tonen"
          title="Raster tonen"
          onClick={() => onRaster(!raster)}
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full text-[15px]",
            "[transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-px hover:shadow-glow-flow",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink",
            raster ? "bg-flow-wash text-flow-ink" : "text-ink-soft hover:bg-flow-wash hover:text-flow-ink",
          )}
        >
          <span aria-hidden="true">▦</span>
        </button>

        <button
          type="button"
          aria-label="Opruimen"
          title="Opruimen — leg de hele module in het raster (cmd+Z maakt het ongedaan)"
          onClick={onOpruimen}
          className="grid h-9 w-9 place-items-center rounded-full text-[15px] text-ink-soft [transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-px hover:shadow-glow-flow hover:bg-flow-wash hover:text-flow-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink"
        >
          <span aria-hidden="true">⌗</span>
        </button>

        <span aria-hidden="true" className="mx-1 h-6 w-px bg-stroke" />

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Uitzoomen"
            title="Uitzoomen"
            disabled={index === 0}
            onClick={() => onZoom(ZOOM_STAPPEN[Math.max(0, index - 1)]!)}
            className="grid h-9 w-9 place-items-center rounded-full text-[17px] text-ink-soft [transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-px hover:shadow-glow-flow hover:bg-flow-wash hover:text-flow-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink disabled:opacity-40"
          >
            <span aria-hidden="true">−</span>
          </button>
          <button
            type="button"
            onClick={() => onZoom(1)}
            title="Terug naar 100%"
            aria-label={
              autoSchaal
                ? `Zoomniveau ${Math.round(zoom * 100)} procent, schaalt automatisch mee · klik voor 100 procent`
                : `Zoomniveau ${Math.round(zoom * 100)} procent, klik voor 100 procent`
            }
            className="min-w-[52px] rounded-full px-2 py-1.5 text-center text-[12.5px] font-semibold tabular-nums text-ink [transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-px hover:shadow-glow-flow hover:bg-flow-wash hover:text-flow-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Alles in beeld"
            title="Alles in beeld"
            onClick={onPassend}
            className="grid h-9 w-9 place-items-center rounded-full text-[14px] text-ink-soft [transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-px hover:shadow-glow-flow hover:bg-flow-wash hover:text-flow-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink"
          >
            <span aria-hidden="true">⛶</span>
          </button>
          <button
            type="button"
            aria-label="Inzoomen"
            title="Inzoomen"
            disabled={index === ZOOM_STAPPEN.length - 1}
            onClick={() => onZoom(ZOOM_STAPPEN[Math.min(ZOOM_STAPPEN.length - 1, index + 1)]!)}
            className="grid h-9 w-9 place-items-center rounded-full text-[17px] text-ink-soft [transition:transform_var(--spring-snappy),background-color_var(--spring-flow),border-color_var(--spring-flow),color_var(--spring-flow),box-shadow_var(--spring-flow)] active:translate-y-px hover:shadow-glow-flow hover:bg-flow-wash hover:text-flow-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flow-ink disabled:opacity-40"
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Kleine hulpknop naast de balk, voor acties die geen gereedschap zijn. */
export function CanvasActie({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button size="sm" role_="subtle" onClick={onClick}>
      {label}
    </Button>
  );
}
