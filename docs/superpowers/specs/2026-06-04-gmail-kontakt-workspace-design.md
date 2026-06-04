# Céges Workspace — Gmail Kontakt-modul (tervdokumentum)

**Dátum:** 2026-06-04
**Állapot:** jóváhagyott terv, implementációs plan következik

---

## 1. Áttekintés és cél

Egy **asztali „céges workspace"** alkalmazás, amely idővel több, egymástól független modult fog tartalmazni. Ez a dokumentum az **első modult**, a **Kontaktok** modult specifikálja.

A Kontaktok modul a felhasználó Gmail-postafiókjából — a levelek fejléceiből — épít egy **szervezetenként csoportosított kontaktlistát**, és ezt egy **szervezet-központú gráffal** és egy **listával** jeleníti meg, osztott nézetben.

**Csoportosítás magja:** az e-mail-cím `@` utáni domainje azonosít egy szervezetet. Több kontakt azonos domainnel → egy szervezet.

---

## 2. Hatókör

### Ebben a specben (MVP)
- Gmail OAuth2 bejelentkezés (csak olvasás).
- Teljes postafiók fokozatos feldolgozása (beérkező + elküldött), haladásjelzővel.
- Kontakt- és szervezet-adatbázis felépítése a fejlécekből.
- Publikus/szabad domainek külön „Magánszemélyek / egyéb" gyűjtőbe.
- Osztott UI: kontaktlista (bal) + hub & spoke gráf (jobb), kölcsönös kivilágítással.
- Inkrementális frissítés (csak az új levelek).
- Bővíthető workspace-héj (ikon-sáv), hogy a későbbi modulok beilleszthetők legyenek.

### NEM ebben a specben
- Egyéb workspace-modulok (csak a váz készül el hozzájuk).
- Levélírás/-küldés, levéltartalom olvasása/megjelenítése.
- AI-funkciók.
- Több Gmail-fiók egyszerre.
- Kézi kontaktszerkesztés, kontaktok összevonása.
- Szervezet-címke kézi átírása.

---

## 3. Architektúra

| Réteg | Választás |
| --- | --- |
| Keret | **Tauri** (Rust mag + web UI) |
| Frontend | **React + TypeScript + Vite** |
| Gráf | **Cytoscape.js** (force-layout, robusztus node/edge kezelés) |
| Rust mag | OAuth-folyamat, Gmail API-hívások, fejléc-parse, csoportosítás, SQLite I/O — Tauri command-okként kitéve a frontendnek |
| Tárolás | lokális **SQLite** (`rusqlite`) |
| Token-tárolás | OS kulcstár — Linuxon Secret Service a `keyring` crate-en keresztül |
| Külső API | Gmail REST API; OAuth2 **desktop loopback redirect + PKCE**; scope: `gmail.readonly` |

**Elv:** a nehéz munka (hálózat, parse, aggregálás, perzisztencia) a Rust magban fut; a React UI csak megjelenít és felhasználói interakciót kezel.

### Moduláris váz (bővíthetőség)
Háromzónás elrendezés, a VS Code / Obsidian mintára:

1. **Modul-sáv** — legszélen, keskeny, sötét, ikonos. Modulok közti váltás. Lent fixen a Beállítások. Felül globális kereső + **parancspaletta (⌘K)** és fiók/sync státusz.
2. **Modul bal panelje** — az aktív modul saját tartalma (Kontaktoknál: a lista).
3. **Modul jobb panelje / fő terület** — Kontaktoknál: a gráf.

Minden modul **önálló egység**: saját React-route(-ok), saját Tauri-parancsok, saját SQLite-tábla-névtér. A héj csak a modul-regisztrációt, a globális keresőt/parancspalettát és a beállításokat biztosítja. **Új funkció = új modul-csomag, a Kontaktok érintése nélkül.**

---

## 4. Adatmodell (SQLite)

### `organizations`
| Mező | Típus | Megjegyzés |
| --- | --- | --- |
| `domain` | TEXT PK | kisbetűsített domain (pl. `acme.hu`) |
| `label` | TEXT | megjelenített név, a domain SLD-jéből autogenerálva (pl. `acme.hu` → „Acme"); MVP-ben nem szerkeszthető |
| `is_personal` | BOOLEAN | igaz, ha publikus-domain feketelistán szerepel |
| `member_count` | INTEGER | származtatott; a gráf-hub mérete ettől függ |

### `contacts`
| Mező | Típus | Megjegyzés |
| --- | --- | --- |
| `email` | TEXT PK | kisbetűsített e-mail — **ez a kontakt azonosítója** |
| `display_name` | TEXT | a legutóbbi nem-üres megjelenített név |
| `organization_domain` | TEXT FK → organizations.domain | |
| `message_count` | INTEGER | összes levélváltás |
| `sent_count` | INTEGER | hány levelet küldtél neki |
| `received_count` | INTEGER | hány levelet kaptál tőle |
| `first_seen` | TEXT (ISO dátum) | legkorábbi kapcsolat |
| `last_seen` | TEXT (ISO dátum) | legutóbbi kapcsolat |

### `sync_state`
| Mező | Típus | Megjegyzés |
| --- | --- | --- |
| `last_history_id` | TEXT | Gmail inkrementális szinkronhoz |
| `last_full_sync_at` | TEXT (ISO) | utolsó teljes sync ideje |
| `progress_total` | INTEGER | megszakítható/folytatható sync állapota |
| `progress_done` | INTEGER | |

### Származtatott szabályok
- **Kontakt-azonosító:** kisbetűsített e-mail-cím. Ugyanaz a személy két különböző címmel = **két** kontakt (összevonás nem MVP).
- **Avatar:** monogram a `display_name`-ből (vagy az e-mail elejéből), determinisztikus színnel — tisztán a kliensen generálva, nem tároljuk.
- **Szervezet:** az `@` utáni domain. A **publikus-domain feketelistán** szereplők (gmail.com, googlemail.com, outlook.com, hotmail.com, yahoo.* , icloud.com, freemail.hu, citromail.hu …) `is_personal=true` jelzéssel a közös **„Magánszemélyek / egyéb"** csoportba kerülnek, nem külön szervezetekbe.

---

## 5. Gmail szinkron-folyamat

1. **Auth:** „Gmail csatlakoztatása" gomb → loopback OAuth2 + PKCE → consent képernyő a böngészőben → access/refresh token a kulcstárba.
2. **Teljes sync (első indítás):** `users.messages.list` lapozva (beérkező + elküldött), majd `users.messages.get` `format=metadata`, kizárólag a `From`, `To`, `Cc`, `Date` fejlécekkel. Háttérben fut, **haladásjelzővel** (feldolgozott / összes).
3. **Aggregálás:** minden címből e-mail + megjelenített név kinyerése; domain → szervezet hozzárendelés; számlálók (`message_count`, `sent`/`received`) és `first_seen`/`last_seen` frissítése. Az irány (sent vs received) a felhasználó saját címe alapján dől el.
4. **Inkrementális frissítés:** „Frissítés" gomb → `users.history.list` a tárolt `last_history_id`-tól, csak az új levelek feldolgozása.
5. **Hibakezelés:**
   - Rate limit (429) → exponenciális backoff + újrapróbálkozás.
   - Lejárt access token → csendes refresh; ha a refresh is sikertelen → újra-bejelentkezés kérése.
   - Megszakított sync → folytatható, mert a `sync_state` (progress) perzisztens.
   - Hálózati hiba → felhasználói hibaüzenet + kézi újrapróbálkozás.

---

## 6. Felhasználói felület

### Workspace-héj
- Bal oldali keskeny, sötét **ikon-sáv**; most csak a Kontaktok ikon aktív, helyet hagyva a jövőbeli moduloknak. Lent fixen a Beállítások.
- Felül globális sáv: kereső + **parancspaletta (⌘K)**, fiók/sync státusz, „Frissítés" gomb.

### Kontaktok modul — osztott nézet
- **Bal panel — lista:**
  - Szervezetenként csoportosítva, **összecsukható** fejlécekkel; a fejlécben a tagszám.
  - Kontaktnál: monogram-avatar, név, e-mail.
  - **Rendezés/szűrés** gyakoriság (`message_count`) és utóbbi kapcsolat (`last_seen`) szerint.
  - Kereső a néven/e-mailen/szervezeten.
  - A „Magánszemélyek / egyéb" külön, alapból összecsukott csoport.
- **Jobb panel — gráf (hub & spoke):**
  - Szervezet = nagy **hub**, melynek **mérete a tagszámmal arányos**.
  - Kontakt = **egyforma** kis pont (a méret sosem függ a levelek számától).
  - Él = tagság (kontakt → szervezete). Szín a szervezethez kötve.
  - Force-layout, zoom/pan. A „Magánszemélyek" külön klaszter.
- **Kölcsönös kivilágítás:** a listában kijelölt kontakt kiemelődik a gráfban (és fordítva).

---

## 7. Tesztelési stratégia

**Megközelítés:** TDD végig, gyakori commitokkal.

### Rust mag (egységtesztek)
- Fejléc-parse: e-mail + megjelenített név kinyerése többféle `From`/`To`/`Cc` formátumból (idézőjeles név, csak cím, több címzett, ékezetes nevek).
- Domain-kinyerés és kisbetűsítés.
- Publikus-domain feketelista szűrés (`is_personal` helyes beállítása).
- Aggregálás: `message_count`, `sent`/`received` irány, `first_seen`/`last_seen` helyessége.
- Gmail API-kliens **mockolva** fixture JSON válaszokkal (nincs valódi hálózat a tesztben).

### Frontend (Vitest + Testing Library)
- Lista renderelés, csoportosítás, rendezés/szűrés, kereső.
- Kölcsönös kivilágítás logikája.
- A `contacts → {nodes, edges}` transzformáció **tiszta függvényként** külön tesztelve (hub-méret = tagszám; kontakt-pont egyforma; élek helyessége).

---

## 8. Nyitott pontok / jövőbeli bővítések (nem MVP)
- Kontaktok összevonása (egy személy több címmel).
- Szervezet-címke kézi átírása, logó.
- Kapcsolati (social) élek emberek között (közös To/Cc együttállás) — a B/C gráf-modell.
- További workspace-modulok.
- Több fiók, nem-Gmail (IMAP) források.

---

## 9. Rögzített döntések (brainstorm)
- Keret: **Tauri** (Rust + React/TS).
- Adathozzáférés: **közvetlen Gmail API**, nem MCP (az MCP LLM-ügynökökhöz való, nem termék-pipeline-hoz).
- Forrás: **beérkező + elküldött**.
- Scan: **teljes postafiók, fokozatosan**, majd inkrementális.
- Publikus domainek: **külön „Magánszemélyek / egyéb" csoport**, feketelistával.
- Metaadat: **gyakoriság + dátumok eltárolva** (listás rendezés/szűrés), de a **gráfban minden ember egyforma**; **szervezet-hub mérete = tagszám**.
- Gráf-modell: **A — szervezet-központú (hub & spoke)**.
- Elrendezés: **A — osztott nézet** (lista + gráf, kölcsönös kivilágítás).
- Navigáció: **A — ikon-sáv** (VS Code / Obsidian, háromzónás).
