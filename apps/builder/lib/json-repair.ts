/**
 * Vangnet voor modelantwoorden die geen schone JSON zijn.
 *
 * Staat los van lib/claude.ts omdat dat bestand `server-only` is (het leest de API-key): pure
 * logica hoort niet achter die grens te zitten, anders is het niet te testen.
 *
 * Met structured outputs hoort dit nooit te vuren — de API dwingt het schema af. Het bestaat
 * voor het geval een antwoord alsnog in ```json fences of begeleidende tekst aankomt.
 */

/** Haalt fences en omringende tekst weg en houdt het buitenste JSON-object over. */
export function repareerJson(ruw: string): string {
  let s = ruw.trim();

  // ```json ... ```  of  ``` ... ```
  const fence = s.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fence?.[1] !== undefined) s = fence[1].trim();

  // Nog steeds tekst eromheen? Pak het buitenste {...}.
  if (!s.startsWith("{")) {
    const eerste = s.indexOf("{");
    const laatste = s.lastIndexOf("}");
    if (eerste !== -1 && laatste > eerste) s = s.slice(eerste, laatste + 1);
  }

  return s.trim();
}
