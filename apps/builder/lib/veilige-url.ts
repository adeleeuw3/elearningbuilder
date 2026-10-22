/**
 * De poort voor elke URL die de server namens de auteur ophaalt.
 *
 * `CLAUDE.md` §6 eist dit voor alles wat door gebruikersinvoer beïnvloed wordt, en de mediazoeker
 * is precies dat geval: een zoekterm van de auteur bepaalt welke adressen er terugkomen, en de
 * server haalt die op. Zonder poort is dat een SSRF-gat — een aanvaller die kan sturen welk adres
 * hier binnenkomt laat de server bij `169.254.169.254` de cloud-credentials ophalen, of bij
 * `127.0.0.1` de interne diensten aftasten. De server staat aan de goede kant van de firewall; dat
 * is precies waarom dit misbruikt kan worden.
 *
 * Twee sloten, geen van beide alleen voldoende:
 *
 * 1. **Een allowlist van hosts.** Alleen de CDN's van de bronnen die we bewust hebben gekozen. Een
 *    blocklist van "gevaarlijke" adressen is bij voorbaat verloren: er is altijd een notatie die
 *    niet in de lijst staat (decimale IP's, IPv6-mapped, hoofdletters, trailing dot).
 * 2. **Geen letterlijke IP-adressen, geen inloggegevens, alleen https, alleen de standaardpoort.**
 *    Een letterlijk IP komt bij deze bronnen nooit voor, dus dat kost niets en sluit de hele
 *    familie van adresnotaties in één keer uit.
 *
 * Wat hier NIET in zit: DNS-resolutie. Een allowlist-host die naar een privé-adres wijst (DNS
 * rebinding) blijft mogelijk. Dat afvangen vraagt om resolven en dan verbinden met het IP zelf, en
 * dat kan `fetch` niet. De allowlist maakt het klein: het zou betekenen dat Pexels of Pixabay hun
 * eigen DNS tegen ons keert.
 */

/** Waar de bytes van een medium vandaan mogen komen. Exacte host of een subdomein daarvan. */
export const MEDIA_HOSTS = [
  // Pexels
  "images.pexels.com",
  "videos.pexels.com",
  "player.vimeo.com", // Pexels serveert sommige videobestanden hiervandaan
  // Pixabay
  "pixabay.com",
  "cdn.pixabay.com",
  // YouTube-voorbeeldplaatjes (de video zelf halen we niet op — zie de externe-videoknoop)
  "i.ytimg.com",
  "img.youtube.com",
] as const;

/** De API's waar we zelf naartoe bellen. Los van de mediahosts: dit zijn andere adressen. */
export const API_HOSTS = [
  "api.pexels.com",
  "pixabay.com",
  "www.googleapis.com",
] as const;

export type UrlUitslag = { ok: true; url: URL } | { ok: false; reden: string };

/** Is dit een letterlijk IP-adres in plaats van een naam? IPv4, IPv6 en de rare notaties erbij. */
export function isLetterlijkIp(host: string): boolean {
  // IPv6 komt in een URL tussen blokhaken binnen; `URL.hostname` laat die staan.
  if (host.startsWith("[")) return true;
  // Alles wat alleen uit cijfers, punten, `x` en hexcijfers bestaat en geen letter-TLD heeft:
  // 127.0.0.1, 2130706433 (decimaal), 0x7f.1, 0177.0.0.1 — allemaal hetzelfde adres.
  const laatste = host.split(".").pop() ?? "";
  return /^(0x[0-9a-f]+|\d+)$/i.test(laatste);
}

/**
 * Keurt een URL tegen een allowlist.
 *
 * Geeft de ontlede URL terug in plaats van een booleaan, zodat de aanroeper met de gekeurde waarde
 * verder gaat en niet met de string die hij zelf nog een keer moet ontleden — daar sluipt het
 * verschil binnen tussen wat gekeurd is en wat opgehaald wordt.
 */
export function keurUrl(ruw: string, hosts: readonly string[]): UrlUitslag {
  let url: URL;
  try {
    url = new URL(ruw);
  } catch {
    return { ok: false, reden: "Dat is geen geldige URL." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reden: "Alleen https wordt opgehaald." };
  }
  if (url.username || url.password) {
    return { ok: false, reden: "Een URL met inloggegevens wordt niet opgehaald." };
  }
  if (url.port && url.port !== "443") {
    return { ok: false, reden: `Alleen poort 443 wordt opgehaald, niet ${url.port}.` };
  }

  // Kleine letters en een eventuele punt aan het eind eraf: `Pixabay.COM.` en `pixabay.com` zijn
  // voor DNS hetzelfde adres, en zonder deze stap staat er één van de twee niet in de lijst.
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isLetterlijkIp(host)) {
    return { ok: false, reden: "Een letterlijk IP-adres wordt niet opgehaald." };
  }
  const mag = hosts.some((h) => host === h || host.endsWith(`.${h}`));
  if (!mag) {
    return { ok: false, reden: `${host} staat niet in de lijst met toegestane bronnen.` };
  }

  return { ok: true, url };
}

/**
 * Haalt bytes op achter de poort, met een harde bovengrens.
 *
 * Omleidingen worden zelf gevolgd en opnieuw gekeurd. `fetch` volgt ze standaard zonder iets te
 * vragen, en dan is de eerste keuring waardeloos: een toegestane host die naar `127.0.0.1`
 * doorstuurt komt er zo alsnog doorheen.
 *
 * De bovengrens wordt tijdens het lezen bewaakt en niet achteraf uit `content-length`: die kop komt
 * van de andere kant en hoeft niet te kloppen.
 */
export async function haalVeilig(
  ruw: string,
  hosts: readonly string[],
  maxBytes: number,
  opties: { headers?: Record<string, string>; maxOmleidingen?: number } = {},
): Promise<{ ok: true; bytes: Uint8Array; mime: string } | { ok: false; reden: string }> {
  let adres = ruw;
  const maxOmleidingen = opties.maxOmleidingen ?? 3;

  for (let hop = 0; hop <= maxOmleidingen; hop += 1) {
    const gekeurd = keurUrl(adres, hosts);
    if (!gekeurd.ok) return gekeurd;

    let res: Response;
    try {
      res = await fetch(gekeurd.url, {
        redirect: "manual",
        headers: opties.headers ?? {},
      });
    } catch {
      return { ok: false, reden: "De bron was niet bereikbaar." };
    }

    if (res.status >= 300 && res.status < 400) {
      const naar = res.headers.get("location");
      if (!naar) return { ok: false, reden: "De bron stuurde door zonder adres." };
      // Relatief mag: dat blijft op dezelfde host, die al gekeurd is.
      adres = new URL(naar, gekeurd.url).toString();
      continue;
    }
    if (!res.ok) {
      return { ok: false, reden: `De bron antwoordde met status ${res.status}.` };
    }

    const body = res.body;
    if (!body) return { ok: false, reden: "De bron stuurde niets terug." };

    const stukken: Uint8Array[] = [];
    let totaal = 0;
    const lezer = body.getReader();
    for (;;) {
      const { done, value } = await lezer.read();
      if (done) break;
      totaal += value.byteLength;
      if (totaal > maxBytes) {
        await lezer.cancel();
        return { ok: false, reden: "Dit bestand is groter dan wat we ophalen." };
      }
      stukken.push(value);
    }

    const bytes = new Uint8Array(totaal);
    let plek = 0;
    for (const stuk of stukken) {
      bytes.set(stuk, plek);
      plek += stuk.byteLength;
    }
    return {
      ok: true,
      bytes,
      mime: (res.headers.get("content-type") ?? "").split(";")[0]!.trim(),
    };
  }

  return { ok: false, reden: "De bron bleef doorsturen." };
}
