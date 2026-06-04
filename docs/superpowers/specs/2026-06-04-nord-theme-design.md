# WT Workspace — Nord (slate & frost) dark téma (tervdokumentum)

**Dátum:** 2026-06-04
**Állapot:** jóváhagyott terv, implementációs plan következik

---

## 1. Cél

A jelenlegi „dark steampunk" (Mahogany & Amber) téma lecserélése **Nord (slate & frost)**
dark palettára. **Tiszta átszínezés** — nincs szerkezeti, elrendezésbeli vagy logikai változás.
A téma a központi `src/theme.css` CSS-tokenekből jön; a recolor nagyrészt token-érték csere,
plusz néhány hardcode hex (főleg a gráf canvas-színei) javítása.

## 2. Megközelítés

A token **neveket megtartjuk** (`--accent`, `--brass`, `--copper`, `--bg-*`, `--text*`, `--border`),
csak az **értékeiket** írjuk át Nord-ra — így minden komponens-CSS automatikusan átszíneződik.
(Megjegyzés: a `--brass`/`--copper` nevek megmaradnak, de mostantól Nord frost-árnyalatokat
tartalmaznak; átnevezés nem éri meg a churnt.)

## 3. Token-térkép (`src/theme.css`)

| Token | Új (Nord) érték |
| --- | --- |
| `--bg-0` | `#20262e` |
| `--bg-1` | `#2e3440` |
| `--bg-2` | `#2a313c` |
| `--bg-3` | `#3b4252` |
| `--accent` | `#88c0d0` (frost cián — aktív, gombok) |
| `--accent-bright` | `#aedce0` (hover, glow) |
| `--brass` | `#81a1c1` (frost kék — keretek, fejlécek, ikonok) |
| `--copper` | `#8fbcbb` (frost zöld — másodlagos ikonszín) |
| `--text` | `#d8dee9` |
| `--text-dim` | `#94a1b5` |
| `--border` | `#3b4252` |

`color-scheme: dark`, scrollbar, `.gear-spinner`, `.metal-sheen` marad. A scrollbar thumb
gradiensében a `#6e4a25` literál → `#2e3440`.

## 4. Nem-token pontok (hardcode hexek)

- **`src/modules/contacts/graph.ts` — `ORG_COLORS`** → Nord-paletta (frost + aurora, hogy a
  szervezet-klaszterek elkülönüljenek):
  `["#88c0d0", "#81a1c1", "#8fbcbb", "#a3be8c", "#b48ead", "#5e81ac", "#ebcb8b", "#d08770", "#bf616a"]`
- **`src/modules/contacts/ContactGraph.tsx`**: `backgroundColor` `#120b08`→`#20262e`;
  `linkColor` `rgba(201,162,39,0.18)`→`rgba(136,192,208,0.18)`; kijelölt mag `#ffb84d`→`#aedce0`;
  gyűrű `#ffe7b3`→`#d8f0f2`; címke `#ecd9c0`→`#d8dee9`.
- **`src/modules/contacts/ContactsModule.css`**: `.cm-graph` radial `#1a1009`→`#252d39`;
  `.cm-btn:disabled` `#5a4632`→`#434c5e`.
- **`src/modules/contacts/ContactList.css`**: `.cl-row.selected` `rgba(232,144,47,0.16)`→`rgba(136,192,208,0.16)`.
- **`src/shell/AppShell.css`**: `.rail-btn:hover` `#3a2a1f`→`#3b4252`.

## 5. Érintett fájlok

`src/theme.css`, `src/modules/contacts/graph.ts`, `src/modules/contacts/ContactGraph.tsx`,
`src/modules/contacts/ContactsModule.css`, `src/modules/contacts/ContactList.css`,
`src/shell/AppShell.css`. **Logika és tesztek nem változnak** (a `colorForOrg` teszt csak
`#`-kezdést ellenőriz → marad zöld).

## 6. Ellenőrzés

`npx tsc --noEmit` + `npm test` + `npm run build`; `grep` a régi amber-hexekre
(`#e8902f|#ffb84d|#c9a227|#b87333|#ecd9c0|#a8906f|#3a241b|#120b08|#1a1009|#5a4632|#3a2a1f|232,144,47|201,162,39`)
— ne maradjon találat a `src/`-ben; kézi nézet `npm run tauri dev`-vel.

## 7. Rögzített döntés

- Paletta: **Nord (slate & frost)** — frost cián elsődleges akcentus, frost kék/zöld másodlagos,
  aurora-színek a gráf-klaszterekhez. Tiszta recolor, központi tokeneken keresztül.
