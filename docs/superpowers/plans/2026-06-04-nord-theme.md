# Nord (slate & frost) Dark Téma — Implementációs Terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A „dark steampunk" (Mahogany & Amber) téma lecserélése **Nord (slate & frost)** palettára — tiszta átszínezés, szerkezeti/logikai változás nélkül.

**Architecture:** A téma a központi `src/theme.css` CSS-tokenekből jön; a recolor főként token-érték csere (a token-nevek maradnak), plusz néhány hardcode hex (gráf canvas-színek + pár CSS-literál) javítása.

**Tech Stack:** React + TS + Vite, `react-force-graph-2d`, Vitest. Nincs új függőség.

**Forrás-spec:** `docs/superpowers/specs/2026-06-04-nord-theme-design.md`

---

## Megjegyzések a végrehajtónak
- A parancsok a repo gyökeréből futnak: `/home/botond/Develop/practice/wt-workspace`.
- **Commit:** a felhasználó döntése szerint külön „push" kérésre megy — **a subagentek NE commitoljanak**, hacsak a vezérlő mást nem mond.
- Ez recolor: nincs új teszt; a „teszt" a `tsc` + `npm test` (a meglévők maradjanak zöldek) + `npm run build` + `grep` a régi színekre.

---

## Task 1: Központi tokenek átírása (`theme.css`)

**Files:**
- Modify: `src/theme.css`

- [ ] **Step 1: A `:root` token-értékek cseréje Nord-ra**

A `src/theme.css`-ben a `:root` blokk token-sorait írd át pontosan ezekre (a `color-scheme: dark;` sor marad, a token-NEVEK változatlanok):
```css
  --bg-0: #20262e;
  --bg-1: #2e3440;
  --bg-2: #2a313c;
  --bg-3: #3b4252;
  --accent: #88c0d0;
  --accent-bright: #aedce0;
  --brass: #81a1c1;
  --copper: #8fbcbb;
  --text: #d8dee9;
  --text-dim: #94a1b5;
  --border: #3b4252;
```
(A `--display-font` sor marad, ahogy van.)

- [ ] **Step 2: A scrollbar gradiens amber-literáljának cseréje**

A `theme.css` scrollbar szabályában a `#6e4a25` literált cseréld `#2e3440`-re:
```css
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, var(--copper), #2e3440);
  border: 2px solid var(--bg-1);
  border-radius: 6px;
}
```

- [ ] **Step 3: Ellenőrzés**

Run: `npx tsc --noEmit && npm run build`
Expected: tiszta build (CSS-változás nem érinti a tsc-t, de a build validálja a CSS-t).

---

## Task 2: Gráf-színek (graph.ts + ContactGraph.tsx)

**Files:**
- Modify: `src/modules/contacts/graph.ts`
- Modify: `src/modules/contacts/ContactGraph.tsx`

- [ ] **Step 1: `ORG_COLORS` Nord-palettára (graph.ts)**

A `src/modules/contacts/graph.ts`-ben az `ORG_COLORS` tömböt cseréld erre:
```ts
const ORG_COLORS = [
  "#88c0d0", "#81a1c1", "#8fbcbb", "#a3be8c",
  "#b48ead", "#5e81ac", "#ebcb8b", "#d08770", "#bf616a",
];
```

- [ ] **Step 2: Gráf-teszt változatlanul zöld**

Run: `npm test -- graph`
Expected: PASS (a `colorForOrg` teszt csak `#`-kezdést ellenőriz; a 4 teszt zöld marad).

- [ ] **Step 3: ContactGraph canvas-színek (ContactGraph.tsx)**

A `src/modules/contacts/ContactGraph.tsx`-ben cseréld a következő literálokat:
- `backgroundColor="#120b08"` → `backgroundColor="#20262e"`
- `linkColor={() => "rgba(201,162,39,0.18)"}` → `linkColor={() => "rgba(136,192,208,0.18)"}`
- a kijelölt mag színe: `ctx.fillStyle = isSel ? "#ffb84d" : node.color;` → `ctx.fillStyle = isSel ? "#aedce0" : node.color;`
- a kijelölt gyűrű: `ctx.strokeStyle = "#ffe7b3";` → `ctx.strokeStyle = "#d8f0f2";`
- a címke színe: `ctx.fillStyle = "#ecd9c0";` → `ctx.fillStyle = "#d8dee9";`

- [ ] **Step 4: Ellenőrzés**

Run: `npx tsc --noEmit && npm test -- ContactGraph graph`
Expected: tsc tiszta; ContactGraph + graph tesztek zöldek.

---

## Task 3: Maradék hardcode hexek + záró ellenőrzés

**Files:**
- Modify: `src/modules/contacts/ContactsModule.css`
- Modify: `src/modules/contacts/ContactList.css`
- Modify: `src/shell/AppShell.css`

- [ ] **Step 1: `ContactsModule.css`**

- `.cm-graph` háttér: `radial-gradient(circle at 55% 50%, #1a1009, var(--bg-0))` → `radial-gradient(circle at 55% 50%, #252d39, var(--bg-0))`
- `.cm-btn:disabled` háttér: `background: #5a4632;` → `background: #434c5e;`

- [ ] **Step 2: `ContactList.css`**

- `.cl-row.selected` háttér: `background: rgba(232,144,47,0.16);` → `background: rgba(136,192,208,0.16);`

- [ ] **Step 3: `AppShell.css`**

- `.rail-btn:hover` háttér: `background: #3a2a1f;` → `background: #3b4252;`

- [ ] **Step 4: Régi amber-színek kiszűrése**

Run:
```bash
grep -rEn "#e8902f|#ffb84d|#c9a227|#b87333|#ecd9c0|#a8906f|#3a241b|#120b08|#1a1009|#5a4632|#3a2a1f|232,144,47|201,162,39|#ffe7b3|#6e4a25|#1a1009" src/ || echo "nincs régi amber szín"
```
Expected: `nincs régi amber szín`. (Ha marad találat, cseréld a Nord-megfelelőre a fenti térkép szerint.)

- [ ] **Step 5: Záró ellenőrzés**

Run:
```bash
npx tsc --noEmit
npm test
npm run build
```
Expected: tsc tiszta; minden teszt zöld (26); build sikeres.

- [ ] **Step 6: Kézi nézet**

Run: `npm run tauri dev`
Ellenőrizd: az egész app Nord (hűvös slate alap, frost cián akcentus); a gráf háttere/élei/izzása frost-színű; a gombok, lista-kijelölés, ikonok, scrollbar, select mind a Nord palettán; sehol nem maradt barna/amber.

---

## Önellenőrzés (a terv írójának jegyzete)

- **Spec-lefedettség:** tokenek (T1) · scrollbar-literál (T1) · ORG_COLORS (T2) · ContactGraph canvas-színek (T2) · ContactsModule/ContactList/AppShell hardcode hexek (T3) · grep + build/teszt (T3). Lefedve.
- **Placeholder-ellenőrzés:** minden lépés konkrét régi→új értéket és parancsot ad; nincs „TBD".
- **Konzisztencia:** a token-NEVEK változatlanok (csak értékek), így a komponens-CSS-ek nem igényelnek további módosítást a felsoroltakon túl; a `colorForOrg` aláírása/visszatérése változatlan → a teszt zöld marad.
