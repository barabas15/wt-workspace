# Gráf WebGL Redesign (élő galaxis) — Implementációs Terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 2D-canvas gráf lecserélése egy élő, Obsidian-szerű WebGL „galaxisra" — valódi bloom, 3D mélység, degree-alapú node-méret, csillagpor-háttér, áramló élek, összetartó elrendezés —, fejlesztői élő hangoló-panellel.

**Architecture:** A `react-force-graph-3d` (Three.js) váltja a `react-force-graph-2d`-t a `ContactGraph`-ban. A `graph.ts` `{nodes, links}` adata újrahasználható; a node-méretet a degree-ből számoljuk. A vizuális rétegeket (bloom, starfield, force-ok) imperatívan állítjuk a komponens ref-jén át, egy `GraphSettings` objektumból; a fejlesztői `GraphControls` panel ezt hangolja, a végső értékek bedrótozva.

**Tech Stack:** React+TS, `react-force-graph-3d`, `three`, `d3-force-3d`, Vitest. (A `react-force-graph-2d` a gráfból kivezetve.)

**Forrás-spec:** `docs/superpowers/specs/2026-06-04-graph-webgl-redesign-design.md`

---

## Megjegyzések a végrehajtónak
- Parancsok a repo gyökeréből: `/home/botond/Develop/practice/wt-workspace`.
- **NE commitolj** (a felhasználó külön „push"-ra verzióz).
- A bloom/3D/fizika **vizuálisan nem unit-tesztelhető** → a tesztek itt: `tsc` + `npm test` (smoke) + `npm run build`. A tényleges látványt a **Task 6 élő hangolásban**, a felhasználóval közösen állítjuk be (NEM subagent — ember).
- **API-figyelmeztetés:** a Three postprocessing import-útvonala verziófüggő. Elsőként próbáld: `import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";`. Ha a build nem találja, használd: `import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";`. Jelezd, melyik vált be.

---

## Task 1: Függőségek

**Files:** Modify `package.json` (parancsok írják)

- [ ] **Step 1: Telepítés**

Run:
```bash
cd /home/botond/Develop/practice/wt-workspace
npm install react-force-graph-3d three d3-force-3d
npm install -D @types/three
```
Expected: hibamentes telepítés. (A `three` és `d3-force-3d` a `react-force-graph-3d` motorjai; explicit függőségként vesszük fel, mert közvetlenül importáljuk őket.)

- [ ] **Step 2: react-force-graph-2d eltávolítása (a gráf már nem használja)**

Run: `npm uninstall react-force-graph-2d`
Expected: eltávolítva. (A `ContactGraph.tsx` még importálja → a build addig hibázhat; a Task 4 javítja.)

- [ ] **Step 3: Ellenőrzés**

Run: `node -e "const p=require('./package.json'); console.log(!!p.dependencies['react-force-graph-3d'], !!p.dependencies['three'], !!p.dependencies['d3-force-3d'], !p.dependencies['react-force-graph-2d'])"`
Expected: `true true true true`

---

## Task 2: `graph.ts` — degree-alapú node-méret (TDD)

**Files:**
- Modify: `src/modules/contacts/graph.ts`
- Modify: `src/modules/contacts/graph.test.ts`

**Cél:** a node `val` mezője a kapcsolatszámból (degree) — a hubok nagyobbak. A többi (`toGraph` alak, mesh, színek, „Egyéb" kizárás) változatlan.

- [ ] **Step 1: Bukó teszt — bővítsd a `graph.test.ts`-t ezzel a `describe` blokkal (a fájl meglévő tesztjei maradnak):**

```ts
describe("node sizing by degree", () => {
  it("gives higher val to more-connected nodes (hubs bigger)", () => {
    // 5 tagú acme + 2 tagú beta: az acme-tagoknak több élük van → nagyobb val
    const g = toGraph(contacts, orgs);
    const acme = g.nodes.filter((n) => n.domain === "acme");
    const beta = g.nodes.filter((n) => n.domain === "beta");
    const avg = (ns: typeof g.nodes) => ns.reduce((s, n) => s + n.val, 0) / ns.length;
    expect(avg(acme)).toBeGreaterThan(avg(beta));
    // minden val pozitív, az alapméret felett
    expect(g.nodes.every((n) => n.val >= 3)).toBe(true);
  });
});
```
(A teszt a meglévő `contacts`/`orgs` fixtúrákat használja a fájl tetejéről: acme 5 tag, beta 2 tag.)

- [ ] **Step 2: Futtasd — bukjon**

Run: `npm test -- graph`
Expected: FAIL (jelenleg minden `val` fix `4` → az acme és beta átlag egyenlő, nem nagyobb).

- [ ] **Step 3: Implementáció — `src/modules/contacts/graph.ts`**

Cseréld a `const NODE_VAL = 4;` sort erre:
```ts
const NODE_BASE = 3;        // alapméret (izolált node)
const NODE_PER_DEGREE = 1.1; // minden kapcsolat ennyivel növel
```
A `toGraph` függvényben a node létrehozásánál a `val: NODE_VAL,` helyett tegyél ideiglenes alapértéket:
```ts
      val: NODE_BASE,
```
majd a `links` felépítése UTÁN, a `return` ELŐTT told be a degree-számítást:
```ts
  // node-méret a kapcsolatszámból (degree): a hubok nagyobbak
  const degree = new Map<string, number>();
  for (const l of links) {
    degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
    degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
  }
  for (const n of nodes) {
    n.val = NODE_BASE + (degree.get(n.id) ?? 0) * NODE_PER_DEGREE;
  }
```

- [ ] **Step 4: Futtasd — zöld**

Run: `npm test -- graph`
Expected: PASS (a korábbi graph-tesztek + az új degree-teszt).

---

## Task 3: `GraphControls.tsx` — fejlesztői hangoló-panel

**Files:**
- Create: `src/modules/contacts/GraphControls.tsx`
- Create: `src/modules/contacts/GraphControls.test.tsx`

**Cél:** egy önálló, kontrollált panel-komponens, ami a `GraphSettings`-t szerkeszti csúszkákkal/kapcsolókkal. (A ContactGraph a Task 4-ben használja, flag mögött.)

- [ ] **Step 1: Bukó teszt — `src/modules/contacts/GraphControls.test.tsx`:**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GraphControls, DEFAULT_GRAPH_SETTINGS } from "./GraphControls";

describe("GraphControls", () => {
  it("renders a slider and emits changes", () => {
    const onChange = vi.fn();
    render(<GraphControls settings={DEFAULT_GRAPH_SETTINGS} onChange={onChange} />);
    const bloom = screen.getByLabelText(/bloom strength/i) as HTMLInputElement;
    expect(bloom).toBeInTheDocument();
    fireEvent.change(bloom, { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bloomStrength: 2 }),
    );
  });

  it("toggles a boolean (particles)", () => {
    const onChange = vi.fn();
    render(<GraphControls settings={DEFAULT_GRAPH_SETTINGS} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/edge particles/i));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ particles: !DEFAULT_GRAPH_SETTINGS.particles }),
    );
  });
});
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `npm test -- GraphControls`
Expected: FAIL (nincs `GraphControls`/`DEFAULT_GRAPH_SETTINGS`).

- [ ] **Step 3: Implementáció — `src/modules/contacts/GraphControls.tsx`:**

```tsx
export interface GraphSettings {
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  charge: number;
  linkDistance: number;
  centerGravity: number;
  nodeScale: number;
  particles: boolean;
  starCount: number;
  autoRotate: boolean;
}

// Bedrótozott alapértékek (a Task 6 élő hangolás ezeket finomítja).
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  bloomStrength: 1.8,
  bloomRadius: 0.85,
  bloomThreshold: 0.0,
  charge: -120,
  linkDistance: 36,
  centerGravity: 0.06,
  nodeScale: 1.0,
  particles: true,
  starCount: 1400,
  autoRotate: false,
};

interface Props {
  settings: GraphSettings;
  onChange: (s: GraphSettings) => void;
}

const SLIDERS: { key: keyof GraphSettings; label: string; min: number; max: number; step: number }[] = [
  { key: "bloomStrength", label: "Bloom strength", min: 0, max: 4, step: 0.1 },
  { key: "bloomRadius", label: "Bloom radius", min: 0, max: 2, step: 0.05 },
  { key: "bloomThreshold", label: "Bloom threshold", min: 0, max: 1, step: 0.01 },
  { key: "charge", label: "Charge (repulsion)", min: -400, max: 0, step: 5 },
  { key: "linkDistance", label: "Link distance", min: 5, max: 120, step: 1 },
  { key: "centerGravity", label: "Center gravity", min: 0, max: 0.3, step: 0.005 },
  { key: "nodeScale", label: "Node size scale", min: 0.3, max: 3, step: 0.1 },
  { key: "starCount", label: "Star count", min: 0, max: 4000, step: 100 },
];

export function GraphControls({ settings, onChange }: Props) {
  const setNum = (key: keyof GraphSettings, v: string) =>
    onChange({ ...settings, [key]: Number(v) });
  const setBool = (key: keyof GraphSettings, v: boolean) =>
    onChange({ ...settings, [key]: v });

  return (
    <div className="graph-controls">
      <div className="gc-title">Gráf-beállítások (dev)</div>
      {SLIDERS.map((s) => (
        <label key={s.key} className="gc-row">
          <span>{s.label}</span>
          <input
            type="range"
            aria-label={s.label}
            min={s.min}
            max={s.max}
            step={s.step}
            value={settings[s.key] as number}
            onChange={(e) => setNum(s.key, e.target.value)}
          />
          <span className="gc-val">{settings[s.key] as number}</span>
        </label>
      ))}
      <label className="gc-row">
        <span>Edge particles</span>
        <input
          type="checkbox"
          aria-label="Edge particles"
          checked={settings.particles}
          onChange={(e) => setBool("particles", e.target.checked)}
        />
      </label>
      <label className="gc-row">
        <span>Auto-rotate</span>
        <input
          type="checkbox"
          aria-label="Auto-rotate"
          checked={settings.autoRotate}
          onChange={(e) => setBool("autoRotate", e.target.checked)}
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 4: CSS — told a `src/modules/contacts/ContactsModule.css` végére:**

```css
.graph-controls {
  position: absolute; top: 10px; left: 10px; z-index: 5;
  width: 220px; max-height: 80%; overflow-y: auto;
  background: rgba(20, 26, 34, 0.92); border: 1px solid var(--border); border-radius: 8px;
  padding: 10px; color: var(--text); font-size: 11px;
}
.gc-title { font-weight: 700; color: var(--green); margin-bottom: 8px; }
.gc-row { display: flex; align-items: center; gap: 6px; margin: 4px 0; }
.gc-row > span:first-child { flex: 1; color: var(--text-dim); }
.gc-row input[type="range"] { width: 80px; }
.gc-val { width: 34px; text-align: right; color: var(--text); }
```

- [ ] **Step 5: Futtasd — zöld**

Run: `npm test -- GraphControls`
Expected: PASS (2 teszt).

---

## Task 4: `ContactGraph.tsx` — ForceGraph3D (bloom, starfield, force-ok, hover, panel)

**Files:**
- Modify: `src/modules/contacts/ContactGraph.tsx` (teljes újraírás)
- Modify: `src/modules/contacts/ContactGraph.test.tsx` (felülírás — 3d lib mock)

**Cél:** a teljes 3D galaxis-komponens. A vizuális rétegeket imperatívan állítjuk a `fgRef`-en át, a `GraphSettings`-ből. A `GraphControls` panel csak `SHOW_GRAPH_CONTROLS` flag mellett jelenik meg.

- [ ] **Step 1: Smoke-teszt — `src/modules/contacts/ContactGraph.test.tsx` teljes új tartalom:**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// a WebGL/Three komponenst mockoljuk (canvas + Three nem megy jsdom-ban).
// Plain függvény-komponens → a ref null marad → az imperatív effektek no-opolnak.
vi.mock("react-force-graph-3d", () => ({ default: () => <div data-testid="force-graph-3d" /> }));

import { ContactGraph } from "./ContactGraph";

describe("ContactGraph", () => {
  it("renders without crashing", () => {
    const { container, getByTestId } = render(
      <ContactGraph contacts={[]} organizations={[]} selectedEmail={null} onSelect={() => {}} />,
    );
    expect(container.querySelector(".contact-graph")).toBeTruthy();
    expect(getByTestId("force-graph-3d")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `npm test -- ContactGraph`
Expected: FAIL (a régi ContactGraph a `react-force-graph-2d`-t importálja, ami már nincs).

- [ ] **Step 3: Implementáció — `src/modules/contacts/ContactGraph.tsx` teljes új tartalom:**

```tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { forceX, forceY, forceZ } from "d3-force-3d";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import type { Contact, Organization } from "./types";
import { toGraph } from "./graph";
import { GraphControls, DEFAULT_GRAPH_SETTINGS, type GraphSettings } from "./GraphControls";

// Fejlesztői hangoló-panel kapcsoló. Élő hangoláshoz állítsd true-ra; alapból false.
const SHOW_GRAPH_CONTROLS = false;

interface Props {
  contacts: Contact[];
  organizations: Organization[];
  selectedEmail: string | null;
  onSelect: (email: string) => void;
}

export function ContactGraph({ contacts, organizations, selectedEmail, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const bloomRef = useRef<any>(null);
  const starsRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // konténer-méret méréshez
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => toGraph(contacts, organizations), [contacts, organizations]);
  const selectedId = selectedEmail ? `person:${selectedEmail}` : null;

  // egyszeri scene-beállítás (bloom + starfield), amint a ref kész
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    // bloom a postprocessing composeren
    if (!bloomRef.current && fg.postProcessingComposer) {
      const pass = new UnrealBloomPass(new THREE.Vector2(size.w || 600, size.h || 400), 1.8, 0.85, 0);
      fg.postProcessingComposer().addPass(pass);
      bloomRef.current = pass;
    }
    // csillagpor
    if (fg.scene) buildStars(fg.scene(), settings.starCount);
    // d3 középre-húzó force-ok (a klaszterek összetartásához)
    if (fg.d3Force) {
      fg.d3Force("x", forceX(0).strength(settings.centerGravity));
      fg.d3Force("y", forceY(0).strength(settings.centerGravity));
      fg.d3Force("z", forceZ(0).strength(settings.centerGravity));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);

  function buildStars(scene: any, count: number) {
    if (starsRef.current) {
      scene.remove(starsRef.current);
      starsRef.current.geometry?.dispose?.();
      starsRef.current.material?.dispose?.();
      starsRef.current = null;
    }
    if (count <= 0) return;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 4000;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x9fb4d0, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.7 });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    starsRef.current = points;
  }

  // beállítások alkalmazása (bloom/force/starfield/auto-rotate)
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (bloomRef.current) {
      bloomRef.current.strength = settings.bloomStrength;
      bloomRef.current.radius = settings.bloomRadius;
      bloomRef.current.threshold = settings.bloomThreshold;
    }
    if (fg.d3Force) {
      fg.d3Force("charge")?.strength(settings.charge);
      fg.d3Force("link")?.distance(settings.linkDistance);
      fg.d3Force("x")?.strength(settings.centerGravity);
      fg.d3Force("y")?.strength(settings.centerGravity);
      fg.d3Force("z")?.strength(settings.centerGravity);
    }
    if (fg.scene) buildStars(fg.scene(), settings.starCount);
    if (fg.controls) {
      const c = fg.controls();
      c.autoRotate = settings.autoRotate;
      c.autoRotateSpeed = 0.6;
    }
    fg.d3ReheatSimulation?.();
  }, [settings]);

  // szomszédsági térkép a hover-kiemeléshez
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of data.links) {
      const s = (l as any).source.id ?? (l as any).source;
      const t = (l as any).target.id ?? (l as any).target;
      if (!m.has(s)) m.set(s, new Set());
      if (!m.has(t)) m.set(t, new Set());
      m.get(s)!.add(t);
      m.get(t)!.add(s);
    }
    return m;
  }, [data]);

  const isDimmed = (id: string) =>
    hoverId !== null && id !== hoverId && !(neighbors.get(hoverId)?.has(id));

  return (
    <div className="contact-graph" ref={wrapRef}>
      {SHOW_GRAPH_CONTROLS && <GraphControls settings={settings} onChange={setSettings} />}
      <ForceGraph3D
        ref={fgRef}
        width={size.w || 600}
        height={size.h || 400}
        graphData={data}
        backgroundColor="#0a0f14"
        nodeId="id"
        nodeLabel="name"
        nodeVal={(n: any) => n.val * settings.nodeScale}
        nodeColor={(n: any) =>
          n.id === selectedId ? "#ffffff" : isDimmed(n.id) ? "#2b3440" : n.color
        }
        nodeOpacity={0.95}
        linkColor={(l: any) => {
          const s = l.source.id ?? l.source;
          const t = l.target.id ?? l.target;
          const active = hoverId !== null && (s === hoverId || t === hoverId);
          return active ? "rgba(174,220,224,0.7)" : "rgba(136,192,208,0.15)";
        }}
        linkWidth={0.4}
        linkDirectionalParticles={settings.particles ? 2 : 0}
        linkDirectionalParticleWidth={1.1}
        linkDirectionalParticleSpeed={0.006}
        onNodeHover={(n: any) => setHoverId(n ? n.id : null)}
        onNodeClick={(n: any) => onSelect(String(n.id).replace(/^person:/, ""))}
      />
    </div>
  );
}
```

- [ ] **Step 4: Futtasd — zöld smoke-teszt**

Run: `npm test -- ContactGraph`
Expected: PASS (1 teszt). Ha a `npm test` panaszkodik a `three`/`d3-force-3d`/`UnrealBloomPass` importok betöltésére jsdom alatt, told a teszt tetejére ezeket a mockokat (a komponens csak guard-olt effektben hívja őket, így üres mock elég):
```tsx
vi.mock("three", () => ({ Vector2: class {}, BufferGeometry: class { setAttribute() {} }, BufferAttribute: class {}, PointsMaterial: class {}, Points: class {} }));
vi.mock("d3-force-3d", () => ({ forceX: () => ({ strength: () => ({}) }), forceY: () => ({ strength: () => ({}) }), forceZ: () => ({ strength: () => ({}) }) }));
vi.mock("three/addons/postprocessing/UnrealBloomPass.js", () => ({ UnrealBloomPass: class {} }));
```

- [ ] **Step 5: Build + típus**

Run: `npx tsc --noEmit && npm run build`
Expected: tiszta. **API-ellenőrzés:** ha a `three/addons/postprocessing/UnrealBloomPass.js` import nem oldódik fel a buildben, cseréld `three/examples/jsm/postprocessing/UnrealBloomPass.js`-re (és a teszt-mock útvonalát is). Jelezd, melyik vált be.

---

## Task 5: Záró ellenőrzés (automatikus)

**Files:** —

- [ ] **Step 1: Teljes suite**

Run:
```bash
npx tsc --noEmit
npm test
npm run build
```
Expected: tsc tiszta; minden teszt zöld; build sikeres.

- [ ] **Step 2: Nincs react-force-graph-2d maradvány**

Run: `grep -rn "react-force-graph-2d" src/ || echo "nincs 2d import"`
Expected: `nincs 2d import`.

---

## Task 6: ÉLŐ HANGOLÁS (ember — a felhasználóval, NEM subagent)

**Files:** `src/modules/contacts/ContactGraph.tsx` (a `SHOW_GRAPH_CONTROLS` flag + a `DEFAULT_GRAPH_SETTINGS` a `GraphControls.tsx`-ben)

- [ ] **Step 1: Panel bekapcsolása**

A `ContactGraph.tsx`-ben `const SHOW_GRAPH_CONTROLS = true;`. Indítsd: `npm run tauri dev`.

- [ ] **Step 2: Közös hangolás**

A felhasználóval együtt állítsd a csúszkákat (bloom erősség/sugár/küszöb, charge, link-távolság, középre-gravitáció, node-méret, csillagpor, él-részecskék, auto-forgás), amíg a „galaxis" jól néz ki. Cél: ne essen szét külön körökre, legyen ragyogás és mélység.

- [ ] **Step 3: Értékek bedrótozása**

A megtalált értékeket írd be a `DEFAULT_GRAPH_SETTINGS`-be (`GraphControls.tsx`), majd `SHOW_GRAPH_CONTROLS = false`. (A panel kódja a flag mögött marad későbbi hangoláshoz.)

- [ ] **Step 4: Záró**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: minden zöld. Kézi nézet: a gráf élő, ragyog, forgatható, hoverre kiemel, kattintásra a bal kereső kitöltődik.

---

## Önellenőrzés (a terv írójának jegyzete)

- **Spec-lefedettség:** react-force-graph-3d + 3D (T1, T4) · bloom UnrealBloomPass (T4) · degree-méret (T2) · csillagpor (T4 buildStars) · él-részecskék alapból be (T4 + DEFAULT particles:true) · középre-gravitáció forceX/Y/Z (T4) · hover-kiemelés (T4) · kattintás→kereső megtartva (T4 onNodeClick → onSelect) · auto-rotate alapból ki (DEFAULT autoRotate:false) · élő hangoló-panel flag mögött + bedrótozott defaultok (T3, T4, T6). Lefedve. Backend nincs érintve.
- **Placeholder-ellenőrzés:** konkrét kód/parancs mindenhol; az API-útvonal kétféle lehetősége explicit megadva (nem „TBD").
- **Konzisztencia:** `GraphSettings` mezőnevei (bloomStrength/Radius/Threshold, charge, linkDistance, centerGravity, nodeScale, particles, starCount, autoRotate) egyeznek a `GraphControls` csúszkáival és a `ContactGraph` effektjeivel; `toGraph` `{nodes, links}` + `val` a 3d komponens `nodeVal`-jával; `onSelect` a `person:`-prefix levágásával — a `ContactsModule` `onGraphSelect`-je változatlan.
