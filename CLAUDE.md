# CLAUDE.md — WT Workspace

## Mi ez

Asztali **„céges workspace"** alkalmazás (Tauri v2 + React/TS), bővíthető modulokkal.
Az első és egyetlen kész modul a **Kontaktok**: a Gmail-leveleid fejléceiből
**szervezetenként** csoportosított kontaktlistát épít, és egy **Obsidian-szerű
hub & spoke gráfot** + listát jelenít meg (osztott nézet).

**Csoportosítási szabályok (a `parsing::aggregate`-ben):**
- A szervezet azonosítója az `@` utáni domain **SLD-je** (márkanév-rész), TLD-független:
  `a1.si` és `a1.at` ugyanaz a szervezet → „A1".
- **Publikus/szabad domainek** (gmail, freemail stb.) → közös **„Egyéb"** gyűjtő.
- **Egytagú szervezet** (csak 1 kontakt) NEM külön csoport → szintén az **„Egyéb"** gyűjtőbe.
- Az „Egyéb" a kulcs `PERSONAL_DOMAIN = "__personal__"`, `is_personal=true` (a listában
  alulra kerül). **A listában minden csoport alapból CSUKVA.**
- **Az „Egyéb" NEM jelenik meg a gráfban** (sem a csomópont, sem a tagjai) — `toGraph` kizárja.
- **Csoportok törölhetők** (kuka ikon a fejlécben, az „Egyéb" kivételével): a tagok az
  „Egyéb" alá kerülnek, és az SLD bekerül a `merged_orgs` táblába, így a törlés
  **re-sync után is megmarad** (a `sync` az `aggregate_with_merges`-t hívja). Parancs:
  `delete_organization(domain)` → `db::delete_organization` (hálózat nélkül újraszámol a
  tárolt kontaktokból).
- **Sor-gyorsműveletek (kontaktonként):** ✉ = Gmail új levél (címzett kitöltve), 🔍 = Gmail
  keresés a címre. A default böngészőben nyílnak: `@tauri-apps/plugin-opener` `openUrl()`,
  URL-építők a `src/modules/contacts/gmailLinks.ts`-ben (`opener:default` engedély már megvan).
  A sor flex: `.cl-row-main` (kiválasztás) + `.cl-row-action` ikongombok.

- Spec: `docs/superpowers/specs/2026-06-04-gmail-kontakt-workspace-design.md`
- Részletes terv: `docs/superpowers/plans/2026-06-04-gmail-kontakt-workspace.md`

## Architektúra / mappastruktúra

- **Rust mag** — `src-tauri/src/`:
  - `parsing/` — tiszta logika: `address` (fejléc-parse), `domain` (+publikus feketelista),
    `label` (szervezet-címke), `aggregate` (kontakt/szervezet aggregálás).
  - `db/` — SQLite (`rusqlite`, bundled): `schema` (init), `repo` (upsert + olvasás).
  - `gmail/` — `model` (GmailMessage, `to_parsed`), `client` (GmailApi trait + MessageRef),
    `http` (HttpGmailApi reqwesttel), `auth` (OAuth2 loopback+PKCE, kulcstár token-store).
  - `sync/` — `run_full_sync` (orchestráció, **párhuzamos** letöltés).
  - `commands.rs` — Tauri-parancsok; `lib.rs` — `run()` (DB-init, state, parancs-regisztráció).
- **React UI** — `src/`:
  - `shell/AppShell` — háromzónás váz (bal ikon-sáv = modulváltó; fő terület = modul).
  - `modules/contacts/` — `types`, `api` (invoke-binding), `graph` (toGraph), `list`,
    `avatar`, `ContactList`, `ContactGraph` (Cytoscape), `ContactsModule` (osztott nézet + sync UI).

A nehéz munka (hálózat, parse, aggregálás, perzisztencia) a Rust magban fut; a UI csak megjelenít.

## Futtatás / fejlesztés

1. **Toolchain** (Ubuntu): Rust rustup-pal (`~/.cargo`, `cargo` a login-shell PATH-on),
   node 20+, és a Tauri Linux rendszerfüggőségek:
   `libwebkit2gtk-4.1-dev build-essential libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`.
2. **`.env`** a projekt gyökerében (gitignore-olt!): `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`
   — Google Cloud OAuth **„Desktop app"** kliens; magad **teszt-felhasználóként** felvéve.
   A `.env.example` csak placeholder — **soha ne tegyél bele valós kulcsot** (nincs gitignore-olva).
3. `npm install`, majd `npm run tauri dev`.

## Tesztek (TDD)

- Frontend: `npm test` (Vitest + Testing Library).
- Rust: `cd src-tauri && cargo test`.
- A teljes projekt **TDD-vel** épült: előbb bukó teszt, aztán minimális implementáció.
  Minden új logikát teszttel fedj le.

## FONTOS buktatók (drágán tanultuk)

- **Tauri szinkron parancs = FŐ szál.** A szinkron `#[tauri::command]` a fő szálon fut,
  így hosszú/blokkoló munka (pl. a Gmail-sync) **lefagyasztja az UI-t**. A `start_sync`
  ezért `std::thread::spawn`-nal háttérszálon futtatja a syncet, azonnal visszatér, és
  `sync-progress`/`sync-done`/`sync-error` **eventeken** keresztül jelez. Bármilyen hosszú
  műveletnél kövesd ezt a mintát.
- **A `.env` NEM töltődik be magától.** A Rust `std::env::var` csak a process-envet olvassa;
  a `lib.rs` `run()` elején `dotenvy::dotenv().ok()` tölti be a `.env`-et (a `src-tauri` cwd-ből
  felfelé keresve találja meg a repo-gyökér `.env`-jét).
- **Gmail `Date` parse:** NE `parse_from_rfc2822` — az validálja a hét napját (sok valós
  fejléc rossz weekday-jel jön) és nem tűri a lezáró `(UTC)` zónakomment-et. Manuálisan
  vágd le a weekday-prefixet és a `(...)` komment-et, majd `parse_from_str`.
- **Szervezet-címke = SLD = `parts[0]`** (a legbaloldalibb címke). NE `parts[len-2]` — az
  „Co"-t adna `nagyceg.co.uk`-ra.
- **Gmail list query URL-kódolva** (`q=in%3Ainbox%20OR%20in%3Asent`), különben reqwest URL-parse hiba.
- **oauth2 crate = v4-re rögzítve** (v5 API más). OAuth: loopback redirect + PKCE, `gmail.readonly` scope.

## Szerződések (Rust ↔ TS)

- A DTO-k mezőnevei **snake_case**-ben egyeznek a JSON-határon: `ContactAgg`/`OrgAgg` (Rust)
  ↔ `Contact`/`Organization` (`types.ts`). Új mezőt mindkét oldalon vezess át.
- A parancs- és event-nevek stringként egyeznek (`commands.rs` ↔ `api.ts` / `ContactsModule`).
- `PERSONAL_DOMAIN = "__personal__"` mindkét oldalon (az „Egyéb" gyűjtő kulcsa:
  publikus domainek + egytagú szervezetek). A szervezet kulcsa az **SLD** (pl. "a1"), nem
  a teljes domain; a `label` a capitalizált SLD ("A1").
- **Teljes sync = csere:** a `run_full_sync` a perzisztálás előtt `clear_all`-lal üríti a
  táblákat (újraaggregál minden levélből), így nincs dupla számolás és nem maradnak elavult sorok.
- Gráf: **brain-style force-gráf** (`react-force-graph-2d`, canvas). Csak person-csomópontok
  (nincs org-hub), fix méret, szervezetenkénti szín (`colorForOrg`); **szervezeten belüli
  korlátozott háló** (gyűrű + `MESH_K`, lineáris él-szám) a `graph.ts` `toGraph`-jában
  (`{nodes, links}`). Az „Egyéb" kimarad. **Gráf-node kattintás → bal kereső kitöltése** (a `query`
  a `ContactsModule`-ban van, `onGraphSelect` setSelected+setQuery; kontrollált `ContactList`,
  nem-üres keresésnél a csoport auto-kinyílik).
- DB hely: `dirs::data_dir()/ceges-workspace/workspace.sqlite`.

## Konvenciók

- **Soha ne commitolj/push+olj git-be explicit engedély nélkül** (globális szabály).
  Jelen állapot: a remote `git@github.com:barabas15/wt-workspace.git` bekötve, de a munka
  **nincs commitolva** (a felhasználó kézzel verzióz). `.env` gitignore-olt.
- Stílus: **dark steampunk** (Mahogany & Amber). Központi `src/theme.css` CSS-tokenek
  (`--bg-0..3`, `--accent` #e8902f, `--accent-bright`, `--brass` #c9a227, `--copper`, `--text`,
  `--text-dim`, `--border`, `--display-font`); minden komponens-CSS ezekre hivatkozik (ne írj be
  nyers színt — a `main.tsx` importálja a `theme.css`-t). Display serif: **Cinzel** (`@fontsource/cinzel`,
  offline). Sync-jelző: forgó fogaskerék (`.gear-spinner`).
- Rögzítés/jegyzetelés ebbe a fájlba megy (ne belső memóriába).

## Ismert, nem-blokkoló follow-up-ok

- A scaffold `greet` parancsa holt kód (`lib.rs`) — eltávolítható.
- `start_sync` a DB-mutexet a teljes sync alatt fogja (MVP-ben elfogadott; a UI nem hív
  `get_contacts`-ot sync közben, így nincs ütközés).
- `dirs::data_dir().unwrap()` indítási panic-kockázat (ritka környezetben).
- Párhuzamos fetch (8 szál) nagy postafióknál Gmail 429-et válthat ki — a beépített
  exponenciális backoff kezeli (lassulhat, nem hibázik).
- A `list_message_ids` az összes ID-t előbb lekéri (néma fázis) — a UI ilyenkor
  „Levelezés beolvasása…" spinnert mutat.
