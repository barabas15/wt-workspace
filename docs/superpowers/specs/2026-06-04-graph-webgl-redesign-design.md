# WT Workspace — Gráf WebGL redesign (élő galaxis) tervdokumentum

**Dátum:** 2026-06-04
**Állapot:** jóváhagyott terv, implementációs plan következik

---

## 1. Cél

A jelenlegi 2D-canvas gráf „élettelen": lapos node-ok, gyenge glow, minden klaszter külön
gyűrűbe rendeződik. Cél egy **élő, Obsidian-szerű galaxis**: valódi ragyogás (bloom),
mélység, méret-variáció, csillagpor-háttér, áramló élek, és összetartó (nem széteső) elrendezés.

## 2. Technológia

- **`react-force-graph-3d`** (Three.js), **3D** (`numDimensions=3`), forgatható (OrbitControls:
  drag = orbit, görgő = zoom — beépített). Ugyanaz a szerző/adatforma, mint a jelenlegi `react-force-graph-2d`,
  így a `graph.ts` nodes/links struktúrája újrahasználható.
- A `react-force-graph-2d` a gráfból kivezethető (a `ContactGraph` 3d-re vált). `three` mint peer-függőség.

## 3. „Life" rétegek

- **Bloom:** Three.js `UnrealBloomPass` a `ForceGraph3D` `postProcessingComposer()`-én keresztül.
  Hangolható: erősség (strength), sugár (radius), küszöb (threshold).
- **Méret-variáció:** a node `val` mezője a **degree-ből** (kapcsolatszám) számolva → a hubok
  nagyobbak/fényesebbek. A `graph.ts` számolja ki a degree-t a links alapján és állítja a `val`-t
  (alap + skála·degree). (Eddig minden node fix méretű volt.)
- **Csillagpor-háttér:** `THREE.Points` starfield a jelenet hátterében (parallaxis-mélység
  forgatáskor) + mély Nord vignetta/köd-gradiens scene-háttér (`#0a0f14` környéke).
- **Élek:** halvány, színezett vonalak; **mozgó fény-részecskék** az éleken
  (`linkDirectionalParticles` finoman, ALAPÉRTELMEZÉSBEN BE) → áramlás-érzet.
- **Szín:** szervezetenként a meglévő Nord `ORG_COLORS` (frost + aurora), a bloomhoz hangolva.

## 4. Fizika (a „minden kör külön" javítása)

A d3 force-ok hangolása: **charge** (taszítás) erőssége, **link-távolság**, és egy **gyenge
középre-húzó gravitáció** (pl. `d3Force` center + enyhe radiális/„x/y/z toward origin"),
hogy a különálló klaszterek **egy összefüggő masszába** rendeződjenek, ne külön gyűrűkbe.
Az intra-org korlátozott háló (gyűrű + `MESH_K`) a `graph.ts`-ben marad.

## 5. Interakció

- Drag = forgatás, görgő = zoom (OrbitControls).
- **Hover:** a node + szomszédai/élei kiemelődnek, a többi elhalványul; címke megjelenik.
- **Kattintás:** a MEGLÉVŐ viselkedés — `onSelect(email)` → kiválasztás + a bal kereső kitöltése
  (a `ContactsModule` `onGraphSelect`-je változatlan).
- **Auto-forgás:** ALAPÉRTELMEZÉSBEN KI (sokaknak zavaró); a hangoló-panelen bekapcsolható.

## 6. Élő hangoló-panel (fejlesztői)

Ideiglenes overlay a gráf fölött, csúszkákkal/kapcsolókkal: bloom erősség/sugár/küszöb, charge,
link-távolság, középre-gravitáció, node-méret-skála, él-részecskék ki/be, csillagpor sűrűség,
auto-forgás ki/be. Cél: **élő, közös hangolás** `npm run tauri dev`-ben. Amikor megvan a kívánt
beállítás, a kiválasztott értékek **alapértelmezett konstansként bedrótozva** kerülnek a kódba;
a panel egy fejlesztői flag (`SHOW_GRAPH_CONTROLS`) mögött marad (alapból kikapcsolva), nem törlünk
működő kódot. A panel a Nord témát követi.

## 7. Komponensek / fájlok

- `package.json`: `+ react-force-graph-3d`, `+ three` (a `react-force-graph-2d` a gráfból kivezetve;
  a függőség eltávolítható, ha máshol nem kell).
- `src/modules/contacts/graph.ts`: degree-alapú `val` (unit-teszttel); `ORG_COLORS`/`colorForOrg` marad.
- `src/modules/contacts/ContactGraph.tsx`: átírás `ForceGraph3D`-re — bloom, starfield, force-hangolás,
  hover-kiemelés, a meglévő kattintás-interakció megtartva; a hangoló-panel beépítése.
- (Új) `src/modules/contacts/GraphControls.tsx`: a fejlesztői hangoló-overlay (flag mögött).
- `src/modules/contacts/ContactGraph.test.tsx`: smoke-teszt a `react-force-graph-3d` mockolásával.
- Backend / Rust: nincs változás.

## 8. Tesztelés

- `graph.ts` degree→`val` tiszta függvény unit-teszttel (a hubok nagyobbak; izolált node alap-méret).
- `ContactGraph` smoke (mockolt 3d lib): „renderel hibamentesen" + kattintás → `onSelect`.
- A bloom/3D/fizika vizuálisan nem unit-tesztelhető → **kézi, élő hangolás** a panel csúszkáival,
  majd a végső konstansok bedrótozása.
- Záró: `npx tsc --noEmit`, `npm test`, `npm run build`, kézi E2E.

## 9. Rögzített döntések (brainstorm)

- Renderelés: **WebGL** (`react-force-graph-3d`, Three.js), **enyhe 3D mélység** (forgatható).
- Bloom: Three `UnrealBloomPass`. Méret a degree-ből. Csillagpor-háttér. Él-részecskék **alapból BE**.
  Auto-forgás **alapból KI**. Középre-gravitáció a klaszter-szétesés ellen.
- Fejlesztői **élő hangoló-panel** flag mögött; a végső értékek bedrótozva.

## 10. Nyitott / jövőbeli (nem ebben)

- A gráf-vezérlőpanel végleges, felhasználónak szánt változata (most fejlesztői).
- VR/AR nézet (a lib tudná) — nem cél.
