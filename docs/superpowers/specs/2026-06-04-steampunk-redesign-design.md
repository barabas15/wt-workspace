# WT Workspace — Dark Steampunk redesign + brain-style gráf (tervdokumentum)

**Dátum:** 2026-06-04
**Állapot:** jóváhagyott terv, implementációs plan következik

---

## 1. Cél és hatókör

Teljes **vizuális redesign** „dark steampunk" stílusra (Mahogany & Amber paletta) az **összes felületen**
(ikon-sáv héj, kontaktlista, fejléc/gombok, gráf), a **gráf újraépítése** Obsidian-szerű brain-style
force-gráffá, és egy **új interakció**: gráf-csomópontra kattintva a bal oldali kereső kitöltődik és a
személy megjelenik a listában.

**Nem változik a funkció:** Gmail OAuth/sync, SLD-alapú csoportosítás, „Egyéb" gyűjtő, csoport-törlés,
sor-gyorsműveletek (✉/🔍/🗑). Csak a megjelenés és a gráf-technológia újul.

**Stílus-szint:** visszafogott dark-industrial (nem „cosplay"): fémes paletta, díszes serif fejlécek,
sárgaréz keretek, finom fém-fény, fogaskerék-motívum apró akcentusként.

---

## 2. Stílus-rendszer (design tokenek)

Központi **`src/theme.css`** `:root` CSS-változókkal; minden komponens-CSS ezekre hivatkozik
(egységes, karbantartható). A `main.tsx` importálja globálisan.

### Tokenek (Mahogany & Amber)
| Token | Érték | Szerep |
| --- | --- | --- |
| `--bg-0` | `#120b08` | legmélyebb háttér (gráf, törzs) |
| `--bg-1` | `#1e1410` | panelek |
| `--bg-2` | `#241712` | ikon-sáv |
| `--bg-3` | `#2e1f18` | sorok, inputok |
| `--accent` | `#e8902f` | borostyán akcentus (aktív, gombok) |
| `--accent-bright` | `#ffb84d` | világos borostyán (hover, glow) |
| `--brass` | `#c9a227` | sárgaréz (keretek, ikonok) |
| `--copper` | `#b87333` | réz (másodlagos) |
| `--text` | `#ecd9c0` | pergamen szöveg |
| `--text-dim` | `#a8906f` | halvány szöveg |
| `--border` | `#3a241b` | keretek/elválasztók |

### Tipográfia
- **Display serif** a fejlécekhez/címkékhez: **Cinzel** (SIL OFL licenc), **becsomagolva** woff2-ként
  `src/assets/fonts/`-ba, `@font-face`-szel a `theme.css`-ben → offline (Tauri) is működik.
- Törzsszöveg: system sans stack (a scaffold alapértelmezettje marad).

### Ornamentika (visszafogott)
- Sárgaréz 1px keretek/elválasztók (`--border` / `--brass`).
- Finom fém-fény CSS-lineáris-gradiensből a panelokon (nincs külön képfájl).
- **Fogaskerék-motívum** akcentusként: a sync-spinner forgó fogaskerék (CSS/SVG), üres állapot ikonja.
- Egyedi webkit-scrollbar (sötét vályú + réz hüvelyk), `::selection` borostyán.

---

## 3. Gráf újraépítés — react-force-graph-2d

A `ContactGraph` belseje **Cytoscape-ről `react-force-graph-2d`-re** cserélődik (canvas; a Cytoscape-et
a gráfból kivezetjük, a függőség eltávolítható). Obsidian-szerű fizika, glow, drag, zoom/pan.

### Adatmodell (B — szervezeten belüli, korlátozott háló)
A `src/modules/contacts/graph.ts` `toGraph`-ja react-force-graph formátumot ad:
`{ nodes: [{id, name, kind, color, val}], links: [{source, target}] }`.
- **Csak person-csomópontok** (nincs org-hub). Az „Egyéb" (`is_personal`/`PERSONAL_DOMAIN`) **kimarad**
  (csomópont és tagjai is) — a meglévő szűrés marad.
- **Klaszteren belüli él-generálás, korlátozottan:** egy szervezet tagjait egy **gyűrű** mentén kötjük
  (i → i+1, körbe), plusz minden tagot a klaszteren belüli **következő `MESH_K` taghoz** (alapért. `K=2`).
  Így tömör, agy-szerű gócok jönnek létre, de az él-szám **lineáris** (~`K·N` szervezetenként),
  nagy szervezetnél is gyors. Nincs szervezetek közti él — a klasztereket a szín különbözteti meg, a
  force centering az egészet egy nagy körbe rendezi (mint a referencián).
- **Csomópont-szín:** szervezetenként, a steampunk-palettához hangolt árnyalatokból (borostyán/réz/
  sárgaréz hue-variációk). Determinisztikus org→szín leképezés.
- **Csomópont-méret (`val`):** minden ember **egyforma** (a meglévő döntés szerint).

### Megjelenítés és interakció (`ContactGraph.tsx`)
- Sötét radiális háttér (`--bg-0`), glow-os node-ok (custom `nodeCanvasObject`: radiális gradiens).
- Halvány borostyán/réz élek, alacsony opacitás.
- **Címke csak hoverre / közeli zoomra** (kevésbé zsúfolt).
- **Drag**, **zoom/pan** (beépített).
- **Kattintás node-ra → `onSelect(email)` ÉS a bal kereső kitöltése** (lásd 4. pont).
- A kiválasztott node kiemelése (erősebb glow / gyűrű), kétirányú (lista ↔ gráf).

---

## 4. Új interakció: gráf-kattintás → bal oldali keresés

A keresőmező állapotát felemeljük a `ContactList`-ből a **`ContactsModule`-ba** (kontrollált input):
- `ContactsModule` tartja a `query` + `selected` állapotot, és átadja a `ContactList`-nek
  (`query`, `onQueryChange`) és a `ContactGraph`-nak (`onSelect`).
- **Gráf-node kattintás** → `setQuery(email)` (+ `setSelected(email)`).
- A `ContactList` **kontrollált** keresőt kap; ha a `query` nem üres, a **találatot tartalmazó csoport(ok)
  automatikusan kinyílnak** (felülírja az alapból-csukva állapotot), így a kattintott személy látszik és
  kiemelődik.

---

## 5. Felületenkénti restyle (tokenekkel)

- **AppShell / ikon-sáv:** `--bg-2`, sárgaréz jobb-keret, aktív elem borostyán; brass ikonok; opcionális
  fogaskerék-elválasztó.
- **ContactsModule fejléc:** serif cím („Kontaktok") brass alávonással; steampunk gombok (borostyán
  kitöltés, brass keret, sync-nél forgó fogaskerék-spinner). A loading-szöveg/„Levelezés beolvasása…"
  marad, csak stílust kap.
- **ContactList:** `--bg-1` háttér, pergamen szöveg, brass csoport-elválasztók, serif csoport-fejléc,
  borostyán kijelölés (`--accent`), fémes avatarok (a `colorFor` palettája melegre hangolva),
  brass/borostyán ✉/🔍/🗑 ikonok.
- **ContactGraph:** sötét radiális háttér + izzó node-ok (3. pont).
- **Globális:** `body` háttér `--bg-0`, scrollbar + `::selection` témázva.

---

## 6. Tesztelési stratégia (TDD)

- **`graph.ts`** (tiszta, jól tesztelhető): klaszteren belüli él-generálás — minden szervezet tagjai
  összekötöttek (gyűrű + `MESH_K`), az **él-szám lineáris/korlátozott** (nem négyzetes), org→szín
  determinisztikus, az „Egyéb" kizárva, person-csak csomópontok.
- **`ContactList`**: kontrollált `query` (a `value`/`onQueryChange` propból), és nem-üres keresésnél a
  találat-csoport **kinyílik** (a személy látszik).
- **`ContactGraph`**: smoke-teszt a `react-force-graph-2d` mockolásával (canvas miatt) — „renderel
  hibamentesen", és node-kattintásra `onSelect` hívódik.
- A meglévő tesztek frissítése a kontrollált-kereső és az új gráf-adat szerint.
- Záró: `npx tsc --noEmit`, `npm test`, `npm run build`, kézi próba `npm run tauri dev`-vel.

---

## 7. Komponensek / fájlok

- **Új:** `src/theme.css` (tokenek + globális), `src/assets/fonts/` (Cinzel woff2 + `@font-face`).
- **Módosul:** `src/main.tsx` (theme import), `src/shell/AppShell.css`, `src/modules/contacts/*.css`
  (tokenekre állítva), `src/modules/contacts/graph.ts` (force-graph adat + korlátozott háló + színek),
  `src/modules/contacts/ContactGraph.tsx` (react-force-graph-2d), `src/modules/contacts/ContactsModule.tsx`
  (query felemelése, gráf-kattintás → kereső), `src/modules/contacts/ContactList.tsx` (kontrollált kereső,
  auto-kinyílás), és a vonatkozó tesztfájlok.
- **Függőség:** `+ react-force-graph-2d`; a `cytoscape` + `@types/cytoscape` eltávolítható.
- **Backend / Rust:** nincs változás.

---

## 8. Rögzített döntések (brainstorm)

- Kapcsolati modell: **B** — szervezeten belüli, **korlátozott** háló (gyűrű + `MESH_K`, lineáris él-szám).
- Stílus: **C paletta — Mahogany & Amber**, **visszafogott dark-industrial**.
- Gráf-könyvtár: **react-force-graph-2d** (Cytoscape kivezetve a gráfból).
- Új interakció: gráf-kattintás → bal kereső kitöltése + lista-szűrés + csoport auto-kinyílás.
- Node-méret: minden ember egyforma (változatlan).
- Font: **Cinzel** becsomagolva (offline).

## 9. Nyitott / jövőbeli (nem ebben)

- Bal oldali gráf-vezérlőpanel (Groups/Filters/Forces, mint az Obsidianban) — most nincs.
- Csomópont-méret a levélszám szerint — most fix.
- Szervezetek közti élek / valódi co-occurrence háló (C modell) — backend-igényes, későbbre.
