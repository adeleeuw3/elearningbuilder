/**
 * Het profiel: wie bouwt, en met welke voorkeuren.
 *
 * **Dit is geen account.** Deze app kent geen inlog — de opslag is een map op deze machine en
 * iedereen die de app opent is dezelfde gebruiker. Een profielscherm dat "ingelogd als" zou zeggen
 * liegt, en een wachtwoordveld dat niemand tegenhoudt is erger dan geen wachtwoordveld. Wat hier
 * staat zijn voorkeuren en een naam die bij het werk hoort.
 *
 * Elk veld doet iets. Een profiel vol velden die nergens doorwerken is een formulier dat de
 * gebruiker invult en dat vervolgens niets verandert.
 */
import { z } from "zod";

/** De talen die een module kan hebben. BCP-47, want dat is wat het observatiedocument eist. */
export const TALEN = [
  { code: "nl-NL", naam: "Nederlands" },
  { code: "en-US", naam: "Engels (VS)" },
  { code: "en-GB", naam: "Engels (VK)" },
  { code: "de-DE", naam: "Duits" },
  { code: "fr-FR", naam: "Frans" },
] as const;

export const ProfielSchema = z
  .object({
    /** Wie de module gemaakt heeft. Verschijnt in het beheeroverzicht bij wat jij bouwde. */
    naam: z.string().max(80).default(""),
    /** De organisatie waarvoor je bouwt. Gaat mee als uitgever in de metadata van het pakket. */
    organisatie: z.string().max(120).default(""),
    /** De taal waarin nieuwe modules gemaakt worden. */
    taal: z.string().min(2).max(35).default("nl-NL"),
  })
  .strict();

export type Profiel = z.infer<typeof ProfielSchema>;

export const LEEG_PROFIEL: Profiel = { naam: "", organisatie: "", taal: "nl-NL" };

/**
 * Leest een bewaard profiel, wat er ook op schijf staat.
 *
 * Nooit werpen: een profiel dat niet te lezen is mag de app niet tegenhouden. Dan val je terug op
 * leeg, en dat is precies de staat van iemand die nog niets heeft ingevuld.
 */
export function leesProfiel(ruw: unknown): Profiel {
  const uit = ProfielSchema.safeParse(ruw);
  return uit.success ? uit.data : LEEG_PROFIEL;
}

/** Hoe de gebruiker genoemd wordt als hij nog geen naam invulde. */
export function toonNaam(profiel: Profiel): string {
  return profiel.naam.trim() || "Naamloze auteur";
}
