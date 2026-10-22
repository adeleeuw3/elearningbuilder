/**
 * Het canvas: de blokken van de pagina als storyboard.
 *
 * De keten op dit canvas *is* de pagina. Het nummer op elke kaart is zijn plek in díe pagina, dus
 * wie de lijnen verlegt verlegt de pagina — dat is de hele belofte van deze weergave. Een blok dat
 * aan niets hangt is geen zwerver maar een pagina met één onderdeel, en hoeft dus niets te melden.
 *
 * Verbindingen komen uit de knooppositie plus de gemeten knoophoogte, niet uit getBoundingClientRect
 * per frame — zo lopen de lijnen mee als een knoop groeit of versleept wordt.
 *
 * Prism: de soort zit in de RAND en de pil, de state in de glow (selectie = Flow, niet-af = Bloom).
 * Zo blijft "max één glow per element" overeind.
 *
 * Alle pointerposities gaan via `naarCanvas()`, die door de zoomfactor deelt. Zonder dat staat alles
 * wat je op 150% doet op twee derde van de plek waar je klikte.
 */
"use client";

import * as React from "react";
import { springClasses, TONE_HEX, cn } from "@ob/ui";
import { Werkbalk, type Gereedschap } from "./Werkbalk";
import { KnoopKaart } from "./KnoopKaart";
import { Blokpalet } from "./Blokpalet";
import {
  isBruikbaar,
  naarCanvas,
  raaktStreek,
  startStreek,
  streekPad,
  verwijderStreek,
  volgendAnnotatieId,
  vulAan,
  type Punt,
  type Streek,
} from "../../lib/annotaties";
import { verbindingsBezwaar } from "../../lib/leerpad";
import {
  geldigeDoelen,
  passendOpScherm,
  scrollNaarKnoop,
  snapPositie,
  verplaatsGroep,
  vrijePositie,
  wisselSelectie,
  zoekKnopen,
} from "../../lib/canvas";
import { paginasVan } from "../../lib/paginas";
import { Zoekvak } from "./Zoekvak";
import {
  CATEGORIE_ICOON,
  CATEGORIE_LABEL,
  CATEGORIE_RAND,
  CATEGORIE_TAG,
  KNOOP_BREEDTE,
  KOLOM_AFSTAND,
  RIJ_HOOGTE,
  verplaatsKnoop,
  type Knoop,
  type KnoopSoort,
  type Verbinding,
} from "../../lib/graph";

export interface WhiteboardProps {
  knopen: Knoop[];
  verbindingen: Verbinding[];
  breedte: number;
  hoogte: number;
  /**
    * Het nummer op elke kaart: de plek van dat blok binnen zíjn pagina.
    *
    * Bewust per pagina en niet doorlopend over de hele cursus: de kaart zegt "onderdeel 2 van deze
    * pagina", en een doorlopende telling maakt van die zin een leugen zodra er een tweede pagina is.
    */
  blokNummers: Record<string, number>;
  geselecteerd: string | null;
  geselecteerdeSchakel: string | null;
  onSelecteer: (id: string | null) => void;
  onSelecteerSchakel: (id: string | null) => void;
  onVerplaats: (knopen: Knoop[]) => void;
  onVerbind: (van: string, naar: string) => void;
  onVerbreek: (id: string) => void;
  /** De hele selectie; het laatste id is het primaire (dat vult het paneel). */
  selectie: string[];
  onSelectie: (ids: string[]) => void;
  /** De knopen opnieuw neerleggen volgens de structuur, met de hier gemeten hoogtes. */
  /** "Opruimen": leg de hele module in het raster. Krijgt de gemeten hoogtes mee. */
  onOpruimen: (hoogtes: Record<string, number>) => void;
  /** Welke knoop de cursor aanwijst, zodat de zijbalk de bijbehorende groep kan oplichten. */
  onHoverKnoop?: (id: string | null) => void;
  /** Knopen die vanuit de zijbalk zijn aangewezen en dus oplichten. */
  gemarkeerd?: string[];
  /** De hele selectie verwijderen. */
  onVerwijderSelectie: () => void;
  /** Het volledige leerpad, om te bepalen waar een sleeplijn heen mág. */
  leerpad: import("../../lib/leerpad").Leerpad;
  onPlaatsBlok: (soort: KnoopSoort, x: number, y: number) => void;
  onWijzigKnoop: (id: string, patch: Partial<Knoop>) => void;
  /** De tekst van een knoop, uit de bron waar hij hoort. */
  tekstVan: (knoop: Knoop) => string | null;
  onTekst: (knoop: Knoop, tekst: string) => void;
  /** Laat de tekst van deze knoop schrijven. */
  onGenereer: (id: string) => void;
  /** Voor welke knoop draait de generatie nu. */
  bezigMet: string | null;
  /** "Bekijken →" op een kaart opent het blok in de blokkenweergave. */
  onOpen: (knoop: Knoop) => void;
  streken: Streek[];
  onStreken: (streken: Streek[]) => void;
  /** Meldt de plek van een kaart, zodat de doellijnen naar de inhoudsopgave getekend kunnen worden. */
  onKaartAnker?: (id: string, el: HTMLDivElement | null) => void;
  /** De gemeten kaarthoogtes, zodat de layout een rij kan laten meegroeien met zijn hoogste kaart. */
  onHoogtes?: (hoogtes: Record<string, number>) => void;
  /** Breng deze knoop in beeld. De teller loopt op zodat twee keer hetzelfde blok ook werkt. */
  centreer?: { id: string; teller: number } | null;
  /** Aanleiding om de doellijnen opnieuw te meten (scroll, zoom, versleep). */
  onVerandering?: () => void;
}

/** Hoogte waarmee gerekend wordt voordat de echte hoogte gemeten is. */
const AANGENOMEN_HOOGTE = 150;
/** De verticale plek van de poorten op een kaart — gelijk aan `POORT_TOP` in `KnoopKaart`. */
const POORT_HOOGTE = 21;

type Bezig =
  | {
      soort: "sleep";
      id: string;
      dx: number;
      dy: number;
      bewogen: boolean;
      /** De blokken die meebewegen: alleen dit blok, de hele selectie, of de hele keten. */
      mee: string[];
    }
  | { soort: "pan"; startX: number; startY: number; scrollX: number; scrollY: number }
  | { soort: "tekenen" };

export function Whiteboard({
  knopen,
  verbindingen,
  breedte,
  hoogte,
  blokNummers,
  geselecteerd,
  geselecteerdeSchakel,
  onSelecteer,
  onSelecteerSchakel,
  onVerplaats,
  onVerbind,
  onVerbreek,
  selectie,
  onSelectie,
  onOpruimen,
  onHoverKnoop,
  gemarkeerd,
  onVerwijderSelectie,
  leerpad,
  onPlaatsBlok,
  onWijzigKnoop,
  tekstVan,
  onTekst,
  onGenereer,
  bezigMet,
  onOpen,
  streken,
  onStreken,
  onKaartAnker,
  onVerandering,
  onHoogtes,
  centreer,
}: WhiteboardProps) {
  const [gereedschap, setGereedschap] = React.useState<Gereedschap>("selecteer");
  const [raster, setRaster] = React.useState(true);
  const [zoom, setZoom] = React.useState(1);
  /**
   * Schaalt het canvas zichzelf mee met de omvang van de module?
   *
   * Staat aan tot de auteur zelf aan de zoom komt. Dat onderscheid is het hele punt: automatisch
   * herschalen bij elke wijziging is vijandig zodra iemand ingezoomd aan een blok werkt — je voegt
   * een knoop toe en het beeld springt onder je handen weg. Zodra je zelf zoomt neemt de app haar
   * handen eraf; "Alles in beeld" geeft de regie weer terug.
   */
  const [autoSchaal, setAutoSchaal] = React.useState(true);
  /**
   * De hoogte van het canvasvak, gemeten in plaats van gegokt.
   *
   * Hier stond `calc(100vh - 268px)`. Dat getal was een schatting van wat er bóven het canvas
   * staat, en die schatting klopte niet: in de praktijk is het 335px, dus liep het vak 67 pixels
   * onder de vensterrand door en moest je de pagina scrollen om bij de onderkant van je eigen
   * tekening te komen. Een kop die langer of korter wordt — een module met een lange titel — zou
   * dat getal opnieuw scheef trekken.
   *
   * Nu wordt de afstand tot de bovenkant gemeten en vult het vak precies de rest. `null` tot de
   * eerste meting: dan staat de oude bodem er nog, en dat is beter dan een vak van nul hoog.
   */
  const [vakHoogte, setVakHoogte] = React.useState<number | null>(null);
  /**
   * De streek-in-de-maak staat in een ref én in state. De ref is de waarheid voor de handlers
   * (pointer-events lopen voor op een render), de state dient alleen om hem te tekenen.
   *
   * Waarom niet alleen state: dan moet `opEinde` de streek uit de state-updater halen en daar
   * `onStreken` aanroepen. Dat is een neveneffect binnen een updater, en React roept updaters in
   * StrictMode twee keer aan om precies zulke onzuiverheid te tonen — de streek werd dan dubbel
   * opgeslagen.
   */
  const huidigeStreekRef = React.useRef<Streek | null>(null);
  const [huidigeStreek, setHuidigeStreek] = React.useState<Streek | null>(null);
  const [verbindVan, setVerbindVan] = React.useState<string | null>(null);
  /** Waarom de laatste poging tot verbinden niet mocht. Verdwijnt bij de volgende klik. */
  const [bezwaar, setBezwaar] = React.useState<string | null>(null);
  /**
   * Welke kaarten op dit moment aan de cursor hangen.
   *
   * Alleen om de layout-transitie uit te zetten zolang je sleept: een kaart die de muis met 280ms
   * vertraging volgt voelt kapot. Zodra je loslaat staat de transitie er weer op, en dan zie je de
   * volgende automatische verplaatsing wél lopen.
   */
  const [sleepend, setSleepend] = React.useState<string[]>([]);
  /**
   * De hulplijnen die tonen dát er gesnapt is.
   *
   * Zonder zichtbare lijn weet de auteur niet of hij is vastgeklikt, en dan ziet een uitlijning die
   * er net naast zit er precies zo uit als een die klopt.
   */
  const [hulplijnen, setHulplijnen] = React.useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });

  /** Wat er nu uit het palet gesleept wordt, en waar de cursor staat. */
  const [sleepSoort, setSleepSoort] = React.useState<KnoopSoort | null>(null);
  const [sleepPunt, setSleepPunt] = React.useState<{ x: number; y: number } | null>(null);
  /**
   * De lijn die nu vanaf een uitgaande poort getrokken wordt.
   *
   * Slepen van poort naar poort is de manier waarop een node-canvas werkt. Het verbind-gereedschap
   * blijft bestaan als klik-alternatief: WCAG 2.2 vraagt bij 2.5.7 om een enkelvoudige-pointer
   * alternatief voor elke handeling die alleen met slepen kan.
   */
  const [wireVan, setWireVan] = React.useState<string | null>(null);
  const [wirePunt, setWirePunt] = React.useState<Punt | null>(null);
  /**
   * Waar de lijn die nu getrokken wordt heen mág. Berekend zodra het slepen begint en niet per
   * frame: de graaf verandert er onderweg niet van, en zo hoeft er niet bij elke muisbeweging over
   * alle knopen gelopen te worden.
   */
  const doelen = React.useMemo(
    () => (wireVan ? geldigeDoelen(leerpad, wireVan) : null),
    [wireVan, leerpad],
  );

  const buitenRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const elementen = React.useRef(new Map<string, HTMLDivElement>());
  const [hoogtes, setHoogtes] = React.useState<Record<string, number>>({});
  const bezig = React.useRef<Bezig | null>(null);
  const negeerKlik = React.useRef(false);
  const nieuwId = () => volgendAnnotatieId(streken, []);

  /**
   * Hoe groot het zichtbare canvasvak is. Nodig omdat het canvas anders alleen zo breed is als de
   * blokken toevallig staan: op een breed scherm zie je dan een smalle rasterstrook met wit ernaast.
   */
  const [vak, setVak] = React.useState({ breedte: 0, hoogte: 0 });
  React.useEffect(() => {
    const el = buitenRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setVak((v) =>
        v.breedte === el.clientWidth && v.hoogte === el.clientHeight
          ? v
          : { breedte: el.clientWidth, hoogte: el.clientHeight },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * Het canvas is minstens zo groot als het vak waarin het staat.
   *
   * Deze maat gaat óók naar `verplaatsKnoop`, en dat is het punt: die klemt een blok binnen de
   * canvasgrens. Zou alleen de achtergrond meegroeien, dan zie je raster waar je geen blok kunt
   * neerzetten — het canvas zou groter lijken dan het is.
   */
  /**
   * Ruimte om te werken: het canvas loopt altijd een rij en een kolom door voorbij het laagste en
   * rechtste blok.
   *
   * `canvasHoogte` rekent met één vaste blokhoogte, terwijl een tekstkaart met prompt- én
   * uitvoerveld ruim drie keer zo hoog is. Zonder deze marge klemt `verplaatsKnoop` een blok tegen
   * een grens die vlak onder de onderste kaart ligt: je pakt hem op, sleept naar beneden, en er
   * gebeurt niets — zonder dat iets vertelt waarom.
   */
  const onderkant = knopen.reduce(
    (max, k) => Math.max(max, k.y + (hoogtes[k.id] ?? AANGENOMEN_HOOGTE)),
    0,
  );
  const rechterkant = knopen.reduce((max, k) => Math.max(max, k.x + KNOOP_BREEDTE), 0);
  const effBreedte = Math.max(breedte, vak.breedte / zoom, rechterkant + KOLOM_AFSTAND);
  const effHoogte = Math.max(hoogte, vak.hoogte / zoom, onderkant + RIJ_HOOGTE);

  const positie = React.useMemo(
    () => new Map<string, number>(Object.entries(blokNummers)),
    [blokNummers],
  );

  // De gemeten hoogtes gaan omhoog: de layout laat een rij meegroeien met zijn hoogste kaart.
  React.useEffect(() => {
    onHoogtes?.(hoogtes);
  }, [hoogtes, onHoogtes]);

  React.useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      setHoogtes((vorig) => {
        let gewijzigd = false;
        const next = { ...vorig };
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.knoopId;
          if (!id) continue;
          const h = e.contentRect.height;
          if (next[id] !== h) {
            next[id] = h;
            gewijzigd = true;
          }
        }
        return gewijzigd ? next : vorig;
      });
    });
    for (const el of elementen.current.values()) ro.observe(el);
    return () => ro.disconnect();
  }, [knopen.length]);

  const registreer = React.useCallback(
    (id: string, el: HTMLDivElement | null) => {
      if (el) elementen.current.set(id, el);
      else elementen.current.delete(id);
      onKaartAnker?.(id, el);
    },
    [onKaartAnker],
  );

  /** Sneltoetsen, zoals elk canvas ze heeft. Niet terwijl je in een veld typt. */
  React.useEffect(() => {
    const bij = (e: KeyboardEvent) => {
      const doel = e.target as HTMLElement | null;
      if (doel && /^(INPUT|TEXTAREA|SELECT)$/.test(doel.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, Gereedschap> = {
        v: "selecteer",
        h: "hand",
        m: "stift",
        c: "verbind",
        e: "gum",
      };
      const g = map[e.key.toLowerCase()];
      if (g) {
        setGereedschap(g);
        setVerbindVan(null);
      }
      if (e.key === "Escape") {
        setVerbindVan(null);
        onSelectie([]);
        onSelecteerSchakel(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectie.length > 0) {
        e.preventDefault();
        onVerwijderSelectie();
      }
    };
    window.addEventListener("keydown", bij);
    return () => window.removeEventListener("keydown", bij);
  }, [onSelecteer, onSelecteerSchakel, onSelectie, onVerwijderSelectie, selectie.length]);

  /**
   * Meet hoeveel ruimte er onder de kop overblijft, en herhaal dat bij elke maatverandering.
   *
   * Een `ResizeObserver` op de body en niet alleen `window.resize`: de kop verandert ook van hoogte
   * zonder dat het venster verandert — een langere moduletitel, een melding erbij, het palet dat
   * over twee regels valt.
   */
  React.useEffect(() => {
    const meet = () => {
      const el = buitenRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      // 24px lucht onder, zodat het vak niet tegen de vensterrand plakt.
      setVakHoogte(Math.max(440, Math.round(window.innerHeight - top - 24)));
    };
    meet();
    window.addEventListener("resize", meet);
    const waarnemer = new ResizeObserver(meet);
    if (document.body) waarnemer.observe(document.body);
    return () => {
      window.removeEventListener("resize", meet);
      waarnemer.disconnect();
    };
  }, []);

  /* ------------------------- alles in beeld / ergens heen ------------------------- */

  const naarPositie = (zoomNaar: number, scrollX: number, scrollY: number) => {
    setZoom(zoomNaar);
    // Na de zoom, want de scrollhoogte hangt ervan af.
    requestAnimationFrame(() => {
      const buiten = buitenRef.current;
      if (!buiten) return;
      buiten.scrollLeft = scrollX;
      buiten.scrollTop = scrollY;
      onVerandering?.();
    });
  };

  /**
   * Meet de kaarthoogtes op dit moment.
   *
   * Niet de `hoogtes`-state gebruiken: die wordt door een ResizeObserver gevuld, en die heeft bij
   * de eerste render nog niet gevuurd — dan zou "ordenen" met een geschatte hoogte rekenen en
   * lopen hoge kaarten over de volgende heen. `getBoundingClientRect` geeft de waarheid op het
   * moment dat de auteur klikt.
   */
  const meetHoogtes = (): Record<string, number> => {
    const uit: Record<string, number> = {};
    for (const [id, el] of elementen.current) {
      const h = el.getBoundingClientRect().height / zoom;
      if (h > 0) uit[id] = h;
    }
    return uit;
  };

  const allesInBeeld = () => {
    const buiten = buitenRef.current;
    if (!buiten) return;
    const p = passendOpScherm(knopen, {
      breedte: buiten.clientWidth,
      hoogte: buiten.clientHeight,
    });
    // Expliciet om het automatisch schalen weer aan te zetten: deze knop ís de vraag "regel het
    // voor me", dus is het vreemd als hij dat één keer doet en daarna weer loslaat.
    setAutoSchaal(true);
    if (p) naarPositie(p.zoom, p.scrollX, p.scrollY);
  };

  /**
   * Houdt het canvas passend zolang de auteur de zoom met rust laat.
   *
   * Alleen **uit**zoomen, nooit in: `passendOpScherm` begrenst op 1, dus een module met twee
   * blokken wordt nooit opgeblazen tot 200% — dan vult één kaart het scherm en ben je de context
   * kwijt. En alleen aanpassen als het verschil merkbaar is: anders herschrijft elke meting de
   * zoom met een duizendste en flikkert het beeld permanent.
   *
   * De gemeten kaarthoogtes doen mee in de afhankelijkheden: een kaart die uitklapt verandert de
   * omvang van de module net zo goed als een knoop erbij.
   */
  React.useEffect(() => {
    if (!autoSchaal) return;
    const buiten = buitenRef.current;
    if (!buiten || knopen.length === 0) return;
    const p = passendOpScherm(knopen, {
      breedte: buiten.clientWidth,
      hoogte: buiten.clientHeight,
    });
    if (!p || Math.abs(p.zoom - zoom) < 0.02) return;
    naarPositie(p.zoom, p.scrollX, p.scrollY);
    // `zoom` staat er met opzet niet bij: die wordt hierbinnen gezet, en meenemen zou de lus
    // zichzelf laten aanroepen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSchaal, knopen, hoogtes, vakHoogte]);

  const springNaar = (knoop: Knoop) => {
    const buiten = buitenRef.current;
    if (!buiten) return;
    const s = scrollNaarKnoop(
      knoop,
      { breedte: buiten.clientWidth, hoogte: buiten.clientHeight },
      zoom,
    );
    buiten.scrollLeft = s.scrollX;
    buiten.scrollTop = s.scrollY;
    onSelecteerSchakel(null);
    onSelectie([knoop.id]);
    onVerandering?.();
  };

  /* --------------------------- pointer op het canvas --------------------------- */

  const punt = (ev: { clientX: number; clientY: number }): Punt => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return naarCanvas({ x: ev.clientX, y: ev.clientY }, rect, zoom);
  };

  const opCanvasNeer = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (gereedschap === "hand") {
      const buiten = buitenRef.current;
      if (!buiten) return;
      bezig.current = {
        soort: "pan",
        startX: ev.clientX,
        startY: ev.clientY,
        scrollX: buiten.scrollLeft,
        scrollY: buiten.scrollTop,
      };
      ev.currentTarget.setPointerCapture(ev.pointerId);
      ev.preventDefault();
      return;
    }
    if (gereedschap === "stift") {
      bezig.current = { soort: "tekenen" };
      const nieuw = startStreek(nieuwId(), punt(ev));
      huidigeStreekRef.current = nieuw;
      setHuidigeStreek(nieuw);
      ev.currentTarget.setPointerCapture(ev.pointerId);
      ev.preventDefault();
      return;
    }
    if (gereedschap === "gum") {
      const p = punt(ev);
      const geraakt = streken.find((s) => raaktStreek(s, p));
      if (geraakt) onStreken(verwijderStreek(streken, geraakt.id));
      return;
    }
  };

  const opBeweging = (ev: React.PointerEvent<HTMLDivElement>) => {
    const b = bezig.current;
    if (!b) return;

    if (b.soort === "pan") {
      const buiten = buitenRef.current;
      if (buiten) {
        buiten.scrollLeft = b.scrollX - (ev.clientX - b.startX);
        buiten.scrollTop = b.scrollY - (ev.clientY - b.startY);
      }
      onVerandering?.();
      return;
    }
    if (b.soort === "tekenen") {
      const lopend = huidigeStreekRef.current;
      if (!lopend) return;
      const bij = vulAan(lopend, punt(ev));
      huidigeStreekRef.current = bij;
      setHuidigeStreek(bij);
      return;
    }
    b.bewogen = true;
    const p = punt(ev);
    const huidige = knopen.find((k) => k.id === b.id);
    if (!huidige) return;
    const grens = { breedte: effBreedte, hoogte: effHoogte };

    // Snappen op de banen van de andere blokken. Alt zet het uit — voor de keren dat je iets
    // bewust net níet wilt uitlijnen.
    const ruw = { x: p.x - b.dx, y: p.y - b.dy };
    const gesnapt = ev.altKey ? { ...ruw, hulplijnX: null, hulplijnY: null } : snapPositie(knopen, b.id, ruw.x, ruw.y);
    setHulplijnen({ x: gesnapt.hulplijnX, y: gesnapt.hulplijnY });

    if (b.mee.length > 1) {
      onVerplaats(
        verplaatsGroep(knopen, b.mee, gesnapt.x - huidige.x, gesnapt.y - huidige.y, grens),
      );
    } else {
      onVerplaats(
        verplaatsKnoop(knopen, b.id, gesnapt.x, gesnapt.y, grens, hoogtes[b.id] ?? AANGENOMEN_HOOGTE),
      );
    }
    onVerandering?.();
  };

  const opEinde = () => {
    const b = bezig.current;
    bezig.current = null;
    setSleepend([]);
    setHulplijnen({ x: null, y: null });
    if (b?.soort === "sleep" && b.bewogen) {
      negeerKlik.current = true;
      // Twee kaarten op elkaar zien er niet kapot uit maar slordig, en de onderste is onvindbaar.
      // Bij het loslaten schuift elk versleept blok daarom naar de eerstvolgende vrije plek.
      let na = knopen;
      for (const id of b.mee) {
        const k = na.find((x) => x.id === id);
        if (!k) continue;
        const vrij = vrijePositie(na, id, k.x, k.y, hoogtes, AANGENOMEN_HOOGTE);
        if (vrij.x !== k.x || vrij.y !== k.y) {
          na = na.map((x) => (x.id === id ? { ...x, ...vrij } : x));
        }
      }
      if (na !== knopen) onVerplaats(na);
    }
    if (b?.soort === "tekenen") {
      const klaar = huidigeStreekRef.current;
      huidigeStreekRef.current = null;
      setHuidigeStreek(null);
      if (klaar && isBruikbaar(klaar)) onStreken([...streken, klaar]);
    }
  };

  /** Of de laatste pointerdown met shift was — de klik zelf komt daarna en weet dat niet meer. */
  const metShift = React.useRef(false);

  const opKnoopNeer = (knoop: Knoop) => (ev: React.PointerEvent<HTMLDivElement>) => {
    metShift.current = ev.shiftKey;
    if (gereedschap !== "selecteer") return;
    // Slepen aan een knoop buiten de selectie maakt hem eerst de selectie — anders sleep je iets
    // anders dan wat je vasthebt.
    if (!ev.shiftKey && !selectie.includes(knoop.id)) onSelectie([knoop.id]);
    if ((ev.target as HTMLElement).closest("button")) return;
    const p = punt(ev);
    // Shift sleept de hele pagina mee. Shift-klik zónder beweging blijft gewoon de selectie
    // aan- en uitzetten; het onderscheid valt bij het loslaten.
    const pagina = ev.shiftKey
      ? paginasVan(leerpad).find((pa) => pa.onderdelen.some((k) => k.id === knoop.id))
      : undefined;
    const mee = pagina
      ? pagina.onderdelen.map((k) => k.id)
      : selectie.length > 1 && selectie.includes(knoop.id)
        ? selectie
        : [knoop.id];
    bezig.current = {
      soort: "sleep",
      id: knoop.id,
      dx: p.x - knoop.x,
      dy: p.y - knoop.y,
      bewogen: false,
      mee,
    };
    setSleepend(mee);
    ev.currentTarget.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  };

  const opKnoopKlik = (knoop: Knoop) => () => {
    if (negeerKlik.current) {
      negeerKlik.current = false;
      return;
    }
    if (gereedschap === "verbind") {
      if (!verbindVan) {
        setBezwaar(null);
        setVerbindVan(knoop.id);
        return;
      }
      const bron = knopen.find((k) => k.id === verbindVan);
      // Een geweigerde schakel in stilte laten gebeuren is het ergste van beide werelden: de
      // auteur ziet niets veranderen en weet niet of hij misklikte of dat het niet mag.
      const reden = bron ? verbindingsBezwaar(bron, knoop, leerpad) : null;
      setBezwaar(reden);
      if (!reden) onVerbind(verbindVan, knoop.id);
      setVerbindVan(null);
      return;
    }
    if (gereedschap === "gum") return;
    onSelecteerSchakel(null);
    onSelectie(wisselSelectie(selectie, knoop.id, metShift.current));
  };

  /* ------------------------------ palet slepen ------------------------------ */

  const paletSleepStart = (soort: KnoopSoort, ev: React.PointerEvent<HTMLButtonElement>) => {
    setSleepSoort(soort);
    setSleepPunt({ x: ev.clientX, y: ev.clientY });
    ev.currentTarget.setPointerCapture(ev.pointerId);
  };

  React.useEffect(() => {
    if (!sleepSoort) return;
    const beweeg = (e: PointerEvent) => setSleepPunt({ x: e.clientX, y: e.clientY });
    const laatLos = (e: PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      const binnen =
        rect &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (rect && binnen) {
        const p = naarCanvas({ x: e.clientX, y: e.clientY }, rect, zoom);
        // De cursor houdt het blok bij de kop vast, niet in de linkerbovenhoek.
        onPlaatsBlok(sleepSoort, p.x - KNOOP_BREEDTE / 2, p.y - 20);
      }
      setSleepSoort(null);
      setSleepPunt(null);
    };
    window.addEventListener("pointermove", beweeg);
    window.addEventListener("pointerup", laatLos);
    window.addEventListener("pointercancel", laatLos);
    return () => {
      window.removeEventListener("pointermove", beweeg);
      window.removeEventListener("pointerup", laatLos);
      window.removeEventListener("pointercancel", laatLos);
    };
  }, [sleepSoort, zoom, onPlaatsBlok]);

  /* ------------------------------ poorten slepen ------------------------------ */

  const startWire = (id: string) => (ev: React.PointerEvent<HTMLSpanElement>) => {
    ev.stopPropagation();
    ev.preventDefault();
    setBezwaar(null);
    setWireVan(id);
    setWirePunt(punt(ev));
  };

  React.useEffect(() => {
    if (!wireVan) return;
    const rect = () => canvasRef.current?.getBoundingClientRect();
    const beweeg = (e: PointerEvent) => {
      const r = rect();
      if (r) setWirePunt(naarCanvas({ x: e.clientX, y: e.clientY }, r, zoom));
    };
    const laatLos = (e: PointerEvent) => {
      const doel = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest(
        "[data-knoop-id]",
      );
      const naar = doel instanceof HTMLElement ? doel.dataset.knoopId : undefined;
      if (naar && naar !== wireVan) {
        const bron = knopen.find((k) => k.id === wireVan);
        const doelKnoop = knopen.find((k) => k.id === naar);
        // Stilte bij een geweigerde lijn is het ergste van beide werelden: er verandert niets en
        // de auteur weet niet of hij misklikte of dat het niet mag.
        const reden = bron && doelKnoop ? verbindingsBezwaar(bron, doelKnoop, leerpad) : null;
        setBezwaar(reden);
        if (!reden) onVerbind(wireVan, naar);
      }
      setWireVan(null);
      setWirePunt(null);
    };
    window.addEventListener("pointermove", beweeg);
    window.addEventListener("pointerup", laatLos);
    window.addEventListener("pointercancel", laatLos);
    return () => {
      window.removeEventListener("pointermove", beweeg);
      window.removeEventListener("pointerup", laatLos);
      window.removeEventListener("pointercancel", laatLos);
    };
  }, [wireVan, zoom, knopen, leerpad, onVerbind]);

  /**
   * Een blok uit het rechterpaneel in beeld brengen.
   *
   * Zonder de zoom aan te raken: het paneel vraagt "laat me dit zien", niet "verander mijn
   * werkniveau". Wie op 150% werkt om een tekstveld te lezen wil daar niet uitgezet worden.
   */
  React.useEffect(() => {
    if (!centreer) return;
    const buiten = buitenRef.current;
    const knoop = knopen.find((k) => k.id === centreer.id);
    if (!buiten || !knoop) return;
    const doel = scrollNaarKnoop(
      knoop,
      { breedte: buiten.clientWidth, hoogte: buiten.clientHeight },
      zoom,
      hoogtes[knoop.id] ?? AANGENOMEN_HOOGTE,
    );
    buiten.scrollTo({ left: doel.scrollX, top: doel.scrollY, behavior: "smooth" });
    onVerandering?.();
    // Bewust op de teller en niet op `knopen`: anders scrollt het canvas opnieuw bij elke
    // bewerking van datzelfde blok, ook als de auteur ergens anders aan het kijken is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centreer?.id, centreer?.teller]);

  /** Klikken in plaats van slepen: het blok komt midden in het zichtbare deel te staan. */
  const plaatsInBeeld = (soort: KnoopSoort) => {
    const buiten = buitenRef.current;
    const midX = buiten ? (buiten.scrollLeft + buiten.clientWidth / 2) / zoom : effBreedte / 2;
    const midY = buiten ? (buiten.scrollTop + buiten.clientHeight / 2) / zoom : effHoogte / 2;
    onPlaatsBlok(soort, midX - KNOOP_BREEDTE / 2, midY - 60);
  };

  /* ------------------------------- geometrie ------------------------------- */

  const perId = React.useMemo(() => new Map(knopen.map((k) => [k.id, k])), [knopen]);

  function pad(vanId: string, naarId: string): string | null {
    const van = perId.get(vanId);
    const naar = perId.get(naarId);
    if (!van || !naar) return null;
    // Binnen een rij loopt de schakel horizontaal van de rechterpoort naar de linkerpoort van de
    // buurman: een korte, rechte verbinding op poorthoogte. Dat is de normale vorm, want een pagina
    // ís een rij. Alleen een schakel die rijen overbrugt (een vertakking naar een andere pagina)
    // buigt, en die vertrekt onderlangs zodat hij nooit over een kaart heen loopt.
    const hVan = hoogtes[van.id] ?? AANGENOMEN_HOOGTE;
    const hNaar = hoogtes[naar.id] ?? AANGENOMEN_HOOGTE;
    const zelfdeRij = Math.abs(naar.y - van.y) < 1;

    if (zelfdeRij) {
      const y = van.y + POORT_HOOGTE;
      return `M${van.x + KNOOP_BREEDTE} ${y} L${naar.x} ${y}`;
    }

    const a = { x: van.x + KNOOP_BREEDTE / 2, y: van.y + hVan };
    const b = { x: naar.x + KNOOP_BREEDTE / 2, y: naar.y };
    void hNaar;
    return `M${a.x} ${a.y} C${a.x} ${a.y + 48} ${b.x} ${b.y - 48} ${b.x} ${b.y}`;
  }

  const cursor =
    gereedschap === "hand"
      ? "cursor-grab active:cursor-grabbing"
      : gereedschap === "stift"
        ? "cursor-crosshair"
        : gereedschap === "gum"
          ? "cursor-cell"
          : gereedschap === "verbind"
            ? "cursor-copy"
            : "";

  const schakelsRaakbaar = gereedschap === "selecteer" || gereedschap === "gum";

  return (
    <div className="relative flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Blokpalet onPlaats={plaatsInBeeld} onSleepStart={paletSleepStart} sleept={sleepSoort} />
        <Zoekvak knopen={knopen} onKies={springNaar} />
      </div>

      <div className="relative">
        <div
          ref={buitenRef}
          // Geen eigen onScroll: het storyboard luistert in de capture-fase op window en vangt
          // daarmee élke scrollende container, inclusief de pagina zelf. Beide aanhaken leverde
          // twee metingen per scroll-event op.
          className="overflow-auto rounded-large border border-stroke bg-canvas shadow-elevation"
          // Gemeten hoogte; tot de eerste meting de oude schatting, zodat er altijd iets staat.
          style={{ height: vakHoogte ?? "max(440px, calc(100vh - 268px))" }}
        >
          <div style={{ width: effBreedte * zoom, height: effHoogte * zoom }}>
            <div
              ref={canvasRef}
              onPointerDown={opCanvasNeer}
              onPointerMove={opBeweging}
              onPointerUp={opEinde}
              onPointerCancel={opEinde}
              onClick={(ev) => {
                if (ev.target === ev.currentTarget && gereedschap === "selecteer") {
                  onSelecteer(null);
                  onSelecteerSchakel(null);
                }
              }}
              className={cn(
                "relative origin-top-left",
                raster &&
                  "bg-[radial-gradient(circle,rgba(27,30,40,.07)_1px,transparent_1.4px)] bg-[length:22px_22px]",
                cursor,
              )}
              style={{ width: effBreedte, height: effHoogte, transform: `scale(${zoom})` }}
            >
              <svg
                className="absolute inset-0 overflow-visible"
                style={{ pointerEvents: "none" }}
                width={effBreedte}
                height={effHoogte}
              >
                <defs>
                  {/* De pijl maakt van een lijn een richting: dít blok komt onder dát blok. */}
                  <marker
                    id="wb-pijl"
                    viewBox="0 0 8 8"
                    refX="6.5"
                    refY="4"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M0 0.5 L7 4 L0 7.5 z" fill={TONE_HEX.flow.ink} />
                  </marker>
                </defs>

                {verbindingen.map((v) => {
                  const d = pad(v.van, v.naar);
                  if (!d) return null;
                  const actief = geselecteerdeSchakel === v.id;
                  return (
                    <g key={v.id}>
                      {actief && (
                        <path d={d} fill="none" strokeWidth={9} stroke={TONE_HEX.flow.from} opacity={0.35} />
                      )}
                      <path
                        d={d}
                        fill="none"
                        strokeWidth={actief ? 2.75 : 2}
                        strokeLinecap="round"
                        stroke={TONE_HEX.flow.ink}
                        opacity={actief ? 1 : 0.6}
                        markerEnd="url(#wb-pijl)"
                      />
                      {/* Onzichtbare, dikke lijn erover: een 2px-lijn is niet aan te klikken. */}
                      <path
                        d={d}
                        fill="none"
                        strokeWidth={16}
                        stroke="transparent"
                        style={{ pointerEvents: schakelsRaakbaar ? "stroke" : "none" }}
                        className={gereedschap === "gum" ? "cursor-cell" : "cursor-pointer"}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (gereedschap === "gum") onVerbreek(v.id);
                          else {
                            onSelecteer(null);
                            onSelecteerSchakel(v.id);
                          }
                        }}
                      />
                    </g>
                  );
                })}

                {wireVan &&
                  wirePunt &&
                  (() => {
                    const bron = perId.get(wireVan);
                    if (!bron) return null;
                    const h = hoogtes[bron.id] ?? AANGENOMEN_HOOGTE;
                    const a = { x: bron.x + KNOOP_BREEDTE, y: bron.y + 21 };
                    return (
                      <path
                        d={`M${a.x} ${a.y} C${a.x + 60} ${a.y} ${wirePunt.x - 60} ${wirePunt.y} ${wirePunt.x} ${wirePunt.y}`}
                        fill="none"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        strokeLinecap="round"
                        stroke={TONE_HEX.flow.ink}
                        opacity={0.75}
                        data-hoogte={h}
                      />
                    );
                  })()}

                {[...streken, ...(huidigeStreek ? [huidigeStreek] : [])].map((s) => (
                  <path
                    key={s.id}
                    d={streekPad(s)}
                    fill="none"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    stroke={TONE_HEX.bloom.ink}
                  />
                ))}
              </svg>

              {/* De hulplijnen: bewijs dát er gesnapt is. Flow, want dit is uitlijning en verband. */}
              {hulplijnen.x !== null && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 z-30 w-px bg-flow-ink/60"
                  style={{ left: hulplijnen.x, height: effHoogte }}
                />
              )}
              {hulplijnen.y !== null && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 z-30 h-px bg-flow-ink/60"
                  style={{ top: hulplijnen.y, width: effBreedte }}
                />
              )}

              {knopen.map((knoop) => {
                const nr = positie.get(knoop.id);
                const aanDeCursor = sleepend.includes(knoop.id);
                return (
                  <div
                    key={knoop.id}
                    data-knoop-id={knoop.id}
                    ref={(el) => registreer(knoop.id, el)}
                    onPointerEnter={() => onHoverKnoop?.(knoop.id)}
                    onPointerLeave={() => onHoverKnoop?.(null)}
                    className={cn(
                      "absolute left-0 top-0",
                      // Alleen `transform` animeren, zoals Prism voorschrijft — en niet tijdens het
                      // slepen zelf: een kaart die de cursor met vertraging volgt voelt kapot.
                      !aanDeCursor && "transition-transform",
                      !aanDeCursor && springClasses("flow"),
                      aanDeCursor && "z-20",
                      // Aangewezen vanuit de zijbalk: even oplichten, zodat het verband zichtbaar
                      // is zonder dat er permanent lijnen over het canvas lopen.
                      gemarkeerd?.includes(knoop.id) && "z-10 ring-2 ring-flow-ink/50 rounded-card",
                    )}
                    style={{
                      transform: `translate3d(${knoop.x}px, ${knoop.y}px, 0)`,
                      width: KNOOP_BREEDTE,
                    }}
                  >
                    <KnoopKaart
                      knoop={knoop}
                      nummer={nr}
                      geselecteerd={selectie.includes(knoop.id)}
                      doelKandidaat={doelen?.has(knoop.id) ?? false}
                      bezig={bezigMet === knoop.id}
                      bronVanWire={wireVan === knoop.id || verbindVan === knoop.id}
                      onHeaderPointerDown={opKnoopNeer(knoop)}
                      onKlik={opKnoopKlik(knoop)}
                      onInstellingen={() => {
                        onSelecteerSchakel(null);
                        onSelecteer(knoop.id);
                      }}
                      onWijzig={(patch) => onWijzigKnoop(knoop.id, patch)}
                      tekst={tekstVan(knoop)}
                      onTekst={(t) => onTekst(knoop, t)}
                      onGenereer={() => onGenereer(knoop.id)}
                      onUitgaandePoort={startWire(knoop.id)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Werkbalk
          gereedschap={gereedschap}
          onGereedschap={(g) => {
            setGereedschap(g);
            setVerbindVan(null);
          }}
          raster={raster}
          onRaster={setRaster}
          zoom={zoom}
          autoSchaal={autoSchaal}
          onZoom={(z) => {
            // Zelf aan de zoom komen betekent: ik wil dit beeld houden.
            setAutoSchaal(false);
            setZoom(z);
            onVerandering?.();
          }}
          onPassend={allesInBeeld}
          onOpruimen={() => onOpruimen(meetHoogtes())}
          hint={
            bezwaar
              ? bezwaar
              : verbindVan
              ? "Klik het blok dat hieronder op de pagina moet komen · Esc om te stoppen"
              : gereedschap === "verbind"
                ? "Klik het blok waar de reeks vandaan komt"
                : gereedschap === "gum"
                  ? "Klik een schakel of tekening om die te wissen"
                  : selectie.length > 1
                    ? `${selectie.length} knopen geselecteerd · sleep ze samen, of Delete om ze te verwijderen`
                    : null
          }
        />
      </div>

      {/* Het sleepbeeld volgt de cursor. `fixed` omdat het buiten het canvas mag komen. */}
      {sleepSoort && sleepPunt && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent bg-grad-flow px-3 py-1.5 text-[12.5px] font-semibold text-flow-on shadow-glow-flow"
          style={{ left: sleepPunt.x, top: sleepPunt.y }}
        >
          {CATEGORIE_LABEL[sleepSoort]}
        </div>
      )}
    </div>
  );
}

/**
 * Statusbolletje: vinkje als het blok af is, open ring als er nog iets mist.
 *
 * Glow betekent in Prism "voltooid", dus het vinkje krijgt de Glow-behandeling. De open ring is
 * neutraal en niet rood — er is niets stuk, er moet alleen nog iets gebeuren.
 */
function StatusBol({ klaar }: { klaar: boolean }) {
  return (
    <span
      title={klaar ? "Dit blok is af" : "Dit blok mist nog iets"}
      aria-label={klaar ? "Af" : "Niet af"}
      className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
        klaar
          ? "bg-grad-glow text-glow-on shadow-glow-glow"
          : "border-2 border-dashed border-ink-faint text-ink-faint",
      )}
    >
      {klaar ? "✓" : ""}
    </span>
  );
}
