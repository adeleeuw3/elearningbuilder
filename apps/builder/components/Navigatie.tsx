/**
 * De knoppen in de kop: waar je vanaf hier naartoe kunt.
 *
 * Bestond niet, en dat was precies het gat: vanuit het bouwscherm kwam je nergens meer. Terug naar
 * het beginscherm kon alleen door de pagina te herladen, en wat je gebouwd had was dan weg als je
 * niet bewaard had. Vandaar dat "Beginscherm" hier vraagt of je het zeker weet zodra er werk in
 * staat dat nog niet op schijf staat.
 */
"use client";

import * as React from "react";
import { Bevestiging, Button } from "@ob/ui";

export interface NavigatieProps {
  /** Welk scherm je nu ziet; die knop is dan uit. */
  hier: "bouwen" | "beheer" | "profiel";
  /**
   * Is er werk dat nog niet bewaard is? Dan waarschuwt "Beginscherm" eerst.
   *
   * Als vraag en niet als blokkade: het is jouw module, en soms wíl je hem weggooien. Maar niet
   * per ongeluk, en niet zonder dat iemand het zei.
   */
  onbewaardWerk?: boolean;
  onBeginscherm: () => void;
  onBeheer: () => void;
  onProfiel: () => void;
}

export function Navigatie({
  hier,
  onbewaardWerk,
  onBeginscherm,
  onBeheer,
  onProfiel,
}: NavigatieProps) {
  const [vraagt, setVraagt] = React.useState(false);

  function naarBegin() {
    if (onbewaardWerk) {
      setVraagt(true);
      return;
    }
    onBeginscherm();
  }

  return (
    <nav className="flex items-center gap-1.5" aria-label="Schermen">
      {vraagt && (
        <Bevestiging
          titel="Terug naar het beginscherm?"
          uitleg="Wat je nog niet bewaard hebt gaat verloren."
          bevestig="Terug naar begin"
          ingrijpend
          onAnnuleer={() => setVraagt(false)}
          onBevestig={() => {
            setVraagt(false);
            onBeginscherm();
          }}
        />
      )}
      <Button size="sm" role_="subtle" onClick={naarBegin}>
        Beginscherm
      </Button>
      <Button size="sm" role_="subtle" disabled={hier === "beheer"} onClick={onBeheer}>
        Beheer
      </Button>
      <Button size="sm" role_="subtle" disabled={hier === "profiel"} onClick={onProfiel}>
        Profiel
      </Button>
    </nav>
  );
}
