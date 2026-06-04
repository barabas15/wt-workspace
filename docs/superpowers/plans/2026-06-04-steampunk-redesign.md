# Dark Steampunk Redesign + Brain-style Gráf — Implementációs Terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A WT Workspace teljes vizuális átöltöztetése „dark steampunk" (Mahogany & Amber) stílusra, a gráf újraépítése Obsidian-szerű brain-style force-gráffá (react-force-graph-2d, szervezeten belüli korlátozott háló), és egy új interakció: gráf-csomópontra kattintva a bal kereső kitöltődik és a személy megjelenik a listában.

**Architecture:** Csak frontend (React/TS), a Rust mag nem változik. Központi `src/theme.css` CSS-tokenek vezérlik a témát; minden komponens-CSS ezekre hivatkozik. A gráf canvas-alapú (react-force-graph-2d) lesz a Cytoscape helyett. A keresőmező állapota a `ContactsModule`-ba kerül (kontrollált input), így a gráf-kattintás kitöltheti.

**Tech Stack:** React + TypeScript + Vite, `react-force-graph-2d`, `@fontsource/cinzel`, Vitest + Testing Library. (Cytoscape kivezetve.)

**Forrás-spec:** `docs/superpowers/specs/2026-06-04-steampunk-redesign-design.md`

---

## Megjegyzések a végrehajtónak

- **TDD a logikai részeknél** (graph.ts, ContactList viselkedés). A CSS/restyle vizuális — ott a teszt a `tsc` + `npm run build` + a meglévő tesztek zöldje.
- A parancsok a repo gyökeréből futnak: `/home/botond/Develop/practice/wt-workspace`.
- **Commit:** a felhasználó döntése szerint a verziózás külön „push" kérésre megy — **a subagentek NE commitoljanak**, hacsak a végrehajtás-vezérlő mást nem mond. (A lenti commit-lépések emiatt opcionálisak; ha nincs commit-engedély, hagyd ki őket.)
- `npm test` = Vitest (jsdom). A canvas-alapú react-force-graph-2d-t a tesztekben **mockoljuk**.

---

## Task 1: Függőségek (react-force-graph-2d + Cinzel; Cytoscape kivezetése)

**Files:**
- Modify: `package.json` (a parancsok írják)

- [ ] **Step 1: Új függőségek telepítése**

Run:
```bash
cd /home/botond/Develop/practice/wt-workspace
npm install react-force-graph-2d @fontsource/cinzel
```
Expected: hiba nélkül feltelepül.

- [ ] **Step 2: Cytoscape eltávolítása (a gráf már nem használja)**

Run:
```bash
npm uninstall cytoscape @types/cytoscape
```
Expected: eltávolítva. (A `ContactGraph.tsx`-et a Task 4 átírja, így a `cytoscape` import megszűnik — ezért a build addig hibázhat; ez rendben van, a Task 4 javítja.)

- [ ] **Step 3: Ellenőrzés**

Run: `node -e "const p=require('./package.json'); console.log(!!p.dependencies['react-force-graph-2d'], !!p.dependencies['@fontsource/cinzel'], !p.dependencies.cytoscape)"`
Expected: `true true true`

---

## Task 2: Téma-tokenek + globális stílus (`theme.css`) + font

**Files:**
- Create: `src/theme.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: `src/theme.css` létrehozása**

```css
/* Cinzel display serif (offline, @fontsource) — a fejlécekhez */
@import "@fontsource/cinzel/400.css";
@import "@fontsource/cinzel/700.css";

:root {
  /* Mahogany & Amber paletta */
  --bg-0: #120b08;
  --bg-1: #1e1410;
  --bg-2: #241712;
  --bg-3: #2e1f18;
  --accent: #e8902f;
  --accent-bright: #ffb84d;
  --brass: #c9a227;
  --copper: #b87333;
  --text: #ecd9c0;
  --text-dim: #a8906f;
  --border: #3a241b;
  --display-font: "Cinzel", Georgia, "Times New Roman", serif;
}

html, body, #root { height: 100%; margin: 0; }
body {
  background: var(--bg-0);
  color: var(--text);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

/* steampunk scrollbar */
::-webkit-scrollbar { width: 12px; height: 12px; }
::-webkit-scrollbar-track { background: var(--bg-1); }
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, var(--copper), #6e4a25);
  border: 2px solid var(--bg-1);
  border-radius: 6px;
}
::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, var(--brass), var(--copper)); }

::selection { background: var(--accent); color: var(--bg-0); }

/* finom fém-fény segédosztály panelekhez */
.metal-sheen {
  background-image: linear-gradient(160deg, rgba(255,255,255,0.04), rgba(0,0,0,0) 40%);
}

/* forgó fogaskerék spinner (a sync jelzéséhez) */
.gear-spinner {
  width: 15px; height: 15px; flex: none;
  color: var(--brass);
  animation: gear-spin 2.4s linear infinite;
}
@keyframes gear-spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 2: `src/main.tsx` — téma import**

Teljes új tartalom:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./theme.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 3: Ellenőrzés**

Run: `npx tsc --noEmit`
Expected: nincs típushiba a `theme.css`/`main.tsx` miatt. (A `cytoscape` eltávolítása miatti hiba a `ContactGraph.tsx`-ben még előfordulhat — azt a Task 4 rendezi.)

---

## Task 3: `graph.ts` — force-graph adat + korlátozott klaszter-háló + színek (TDD)

**Files:**
- Modify: `src/modules/contacts/graph.ts` (teljes újraírás)
- Modify: `src/modules/contacts/graph.test.ts` (teljes újraírás)

**Cél:** a `toGraph` mostantól react-force-graph formátumot ad: `{ nodes, links }`. Csak person-csomópontok (org-hub nincs); az „Egyéb" (`is_personal`) kimarad. Szervezeten belül **gyűrű + MESH_K** él (lineáris él-szám). Csomópont-szín szervezetenként determinisztikus, steampunk palettából.

- [ ] **Step 1: Bukó teszt — `src/modules/contacts/graph.test.ts` teljes új tartalom**

```ts
import { describe, it, expect } from "vitest";
import { toGraph, colorForOrg, MESH_K } from "./graph";
import type { Contact, Organization } from "./types";

function contact(email: string, org: string): Contact {
  return { email, display_name: email.split("@")[0], organization_domain: org, message_count: 1, sent_count: 0, received_count: 1, first_seen: "2026-01-01", last_seen: "2026-01-01" };
}

const orgs: Organization[] = [
  { domain: "acme", label: "Acme", is_personal: false, member_count: 5 },
  { domain: "beta", label: "Beta", is_personal: false, member_count: 2 },
  { domain: "__personal__", label: "Egyéb", is_personal: true, member_count: 1 },
];
const contacts: Contact[] = [
  contact("a1@acme.hu", "acme"), contact("a2@acme.hu", "acme"), contact("a3@acme.hu", "acme"),
  contact("a4@acme.hu", "acme"), contact("a5@acme.hu", "acme"),
  contact("b1@beta.hu", "beta"), contact("b2@beta.hu", "beta"),
  contact("x@gmail.com", "__personal__"),
];

describe("toGraph (force-graph)", () => {
  it("emits only person nodes, excluding the personal bucket", () => {
    const g = toGraph(contacts, orgs);
    expect(g.nodes).toHaveLength(7); // 5 acme + 2 beta, x kizárva
    expect(g.nodes.every((n) => n.id.startsWith("person:"))).toBe(true);
    expect(g.nodes.find((n) => n.id === "person:x@gmail.com")).toBeUndefined();
  });

  it("links members only WITHIN their organization, never across", () => {
    const g = toGraph(contacts, orgs);
    const orgOf = new Map(g.nodes.map((n) => [n.id, n.domain]));
    for (const l of g.links) {
      expect(orgOf.get(l.source)).toBe(orgOf.get(l.target));
      expect(l.source).not.toBe(l.target);
    }
    // a personal kontakt nem szerepel élben
    expect(g.links.some((l) => l.source.includes("gmail") || l.target.includes("gmail"))).toBe(false);
  });

  it("caps edges (linear, <= MESH_K * memberCount) but keeps clusters connected", () => {
    const g = toGraph(contacts, orgs);
    const acmeLinks = g.links.filter((l) => l.source.includes("acme"));
    expect(acmeLinks.length).toBeLessThanOrEqual(MESH_K * 5);
    // minden acme-tag legalább egy élben szerepel (összefüggő)
    const acmeNodes = g.nodes.filter((n) => n.domain === "acme").map((n) => n.id);
    for (const id of acmeNodes) {
      expect(g.links.some((l) => l.source === id || l.target === id)).toBe(true);
    }
  });

  it("colors nodes deterministically per organization", () => {
    const g = toGraph(contacts, orgs);
    const acme = g.nodes.filter((n) => n.domain === "acme");
    expect(new Set(acme.map((n) => n.color)).size).toBe(1); // egy org = egy szín
    expect(colorForOrg("acme")).toBe(colorForOrg("acme")); // determinisztikus
    expect(colorForOrg("acme")).toMatch(/^#/);
  });
});
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `npm test -- graph`
Expected: FAIL — `colorForOrg`/`MESH_K` és az új alak hiányzik.

- [ ] **Step 3: Implementáció — `src/modules/contacts/graph.ts` teljes új tartalom**

```ts
import type { Contact, Organization } from "./types";

export interface FgNode {
  id: string;
  name: string;
  domain: string;
  color: string;
  val: number;
}
export interface FgLink {
  source: string;
  target: string;
}
export interface ForceGraphData {
  nodes: FgNode[];
  links: FgLink[];
}

/** Hány "következő" taghoz kösse a klaszter minden tagját (a gyűrűn felül). A teljes
 * mindenki-mindenkivel helyett ez lineáris él-számot ad, nagy szervezetnél is gyors. */
export const MESH_K = 2;

const NODE_VAL = 4; // minden ember egyforma méretű

/** Steampunk node-palettát (sárgaréz/réz/borostyán + 1 patina) ad determinisztikusan. */
const ORG_COLORS = [
  "#e8902f", "#c9a227", "#b87333", "#d9a441",
  "#a8602a", "#caa75a", "#8a6d3b", "#d57a28", "#3fae9f",
];
export function colorForOrg(domain: string): string {
  let h = 0;
  for (let i = 0; i < domain.length; i++) h = (h * 31 + domain.charCodeAt(i)) >>> 0;
  return ORG_COLORS[h % ORG_COLORS.length];
}

/** Egy szervezet tagjait gyűrűvel + MESH_K szomszéddal köti össze (dedup, nincs self-link). */
function clusterLinks(ids: string[]): FgLink[] {
  const links: FgLink[] = [];
  const n = ids.length;
  if (n < 2) return links;
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    for (let j = 1; j <= MESH_K; j++) {
      if (j >= n) break;
      const a = ids[i];
      const b = ids[(i + j) % n];
      if (a === b) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ source: a, target: b });
    }
  }
  return links;
}

export function toGraph(contacts: Contact[], orgs: Organization[]): ForceGraphData {
  const personalDomains = new Set(orgs.filter((o) => o.is_personal).map((o) => o.domain));

  const nodes: FgNode[] = [];
  const byOrg = new Map<string, string[]>();

  for (const c of contacts) {
    if (personalDomains.has(c.organization_domain)) continue;
    const id = `person:${c.email}`;
    nodes.push({
      id,
      name: c.display_name || c.email,
      domain: c.organization_domain,
      color: colorForOrg(c.organization_domain),
      val: NODE_VAL,
    });
    const arr = byOrg.get(c.organization_domain) ?? [];
    arr.push(id);
    byOrg.set(c.organization_domain, arr);
  }

  const links: FgLink[] = [];
  for (const ids of byOrg.values()) {
    links.push(...clusterLinks(ids));
  }

  return { nodes, links };
}
```

- [ ] **Step 4: Futtasd — zöld**

Run: `npm test -- graph`
Expected: PASS (4 teszt).

---

## Task 4: `ContactGraph.tsx` — react-force-graph-2d (brain-style)

**Files:**
- Modify: `src/modules/contacts/ContactGraph.tsx` (teljes újraírás)
- Create: `src/modules/contacts/ContactGraph.test.tsx` (felülírás — react-force-graph-2d mock)

**Cél:** canvas-alapú force-gráf glow-os, szervezet-színű csomópontokkal, drag/zoom, hover-címke, kattintás→`onSelect`, sötét háttér, kiválasztott node kiemelése.

- [ ] **Step 1: Smoke-teszt — `src/modules/contacts/ContactGraph.test.tsx` teljes új tartalom**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// a canvas-alapú force-graph komponenst mockoljuk
vi.mock("react-force-graph-2d", () => ({
  default: () => <div data-testid="force-graph" />,
}));

import { ContactGraph } from "./ContactGraph";

describe("ContactGraph", () => {
  it("renders without crashing", () => {
    const { container, getByTestId } = render(
      <ContactGraph contacts={[]} organizations={[]} selectedEmail={null} onSelect={() => {}} />,
    );
    expect(container.querySelector(".contact-graph")).toBeTruthy();
    expect(getByTestId("force-graph")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `npm test -- ContactGraph`
Expected: FAIL — a régi `ContactGraph` cytoscape-et importál (már eltávolítva) / nincs `force-graph` testid.

- [ ] **Step 3: Implementáció — `src/modules/contacts/ContactGraph.tsx` teljes új tartalom**

```tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { Contact, Organization } from "./types";
import { toGraph } from "./graph";

interface Props {
  contacts: Contact[];
  organizations: Organization[];
  selectedEmail: string | null;
  onSelect: (email: string) => void;
}

export function ContactGraph({ contacts, organizations, selectedEmail, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // a ForceGraph2D explicit méretet vár — a konténerből mérjük
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

  return (
    <div className="contact-graph" ref={wrapRef}>
      <ForceGraph2D
        width={size.w || undefined}
        height={size.h || undefined}
        graphData={data}
        backgroundColor="#120b08"
        nodeId="id"
        nodeLabel="name"
        linkColor={() => "rgba(201,162,39,0.18)"}
        linkWidth={0.6}
        cooldownTicks={120}
        onNodeClick={(n: any) => onSelect(String(n.id).replace(/^person:/, ""))}
        nodeCanvasObjectMode={() => "replace"}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
          const r = (node.val ?? 4) + 1.5;
          const isSel = node.id === selectedId;
          // glow
          const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 3);
          grd.addColorStop(0, node.color);
          grd.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 3, 0, 2 * Math.PI);
          ctx.fill();
          // mag
          ctx.fillStyle = isSel ? "#ffb84d" : node.color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, isSel ? r * 1.6 : r, 0, 2 * Math.PI);
          ctx.fill();
          if (isSel) {
            ctx.strokeStyle = "#ffe7b3";
            ctx.lineWidth = 1.5 / scale;
            ctx.stroke();
          }
          // címke csak közeli zoomnál vagy a kijelöltnél
          if (scale > 2.2 || isSel) {
            ctx.font = `${11 / scale}px system-ui, sans-serif`;
            ctx.fillStyle = "#ecd9c0";
            ctx.textAlign = "center";
            ctx.fillText(node.name, node.x, node.y + r * 3 + 9 / scale);
          }
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Futtasd — zöld**

Run: `npm test -- ContactGraph`
Expected: PASS (1 teszt).

- [ ] **Step 5: Típus-ellenőrzés**

Run: `npx tsc --noEmit`
Expected: tiszta. (Ha a react-force-graph-2d default import típushibát ad, ellenőrizd, hogy a `tsconfig` `esModuleInterop`/`allowSyntheticDefaultImports` engedélyezett — a Vite-scaffold alapból igen; ha mégsem, `import ForceGraph2D from "react-force-graph-2d";` helyett `import { ForceGraph2D } from "react-force-graph-2d";` próbálható, de a default a helyes.)

---

## Task 5: Kereső felemelése + gráf-kattintás → keresés + auto-kinyílás

**Files:**
- Modify: `src/modules/contacts/ContactList.tsx` (kontrollált `query`)
- Modify: `src/modules/contacts/ContactList.test.tsx`
- Modify: `src/modules/contacts/ContactsModule.tsx` (query állapot + gráf onSelect → query)

**Cél:** a keresőmező értéke a `ContactsModule`-ból jön (kontrollált). Gráf-node kattintásra `query = email` és `selected = email`; a `ContactList` nem-üres keresésnél a találat-csoportot **kinyitja**.

- [ ] **Step 1: Bukó teszt — `ContactList.test.tsx` teljes új tartalom**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

import { ContactList } from "./ContactList";
import { openUrl } from "@tauri-apps/plugin-opener";
import { composeUrl, searchUrl } from "./gmailLinks";
import type { Contact, Organization } from "./types";

const orgs: Organization[] = [
  { domain: "acme.hu", label: "Acme", is_personal: false, member_count: 2 },
];
const contacts: Contact[] = [
  { email: "a@acme.hu", display_name: "Anna", organization_domain: "acme.hu", message_count: 5, sent_count: 2, received_count: 3, first_seen: "2026-01-01", last_seen: "2026-03-01" },
];

function noop() {}

describe("ContactList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the controlled query prop and fires onQueryChange", () => {
    const onQueryChange = vi.fn();
    render(
      <ContactList contacts={contacts} organizations={orgs} query="" onQueryChange={onQueryChange}
        selectedEmail={null} onSelect={noop} />,
    );
    const input = screen.getByPlaceholderText(/keresés/i) as HTMLInputElement;
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "anna" } });
    expect(onQueryChange).toHaveBeenCalledWith("anna");
  });

  it("auto-expands the matching group when a query is set (so the contact shows)", () => {
    render(
      <ContactList contacts={contacts} organizations={orgs} query="anna" onQueryChange={noop}
        selectedEmail={null} onSelect={noop} />,
    );
    // nem-üres keresésnél a csoport nyitva → Anna látszik
    expect(screen.getByText("Anna")).toBeInTheDocument();
  });

  it("collapses groups by default when query is empty", () => {
    render(
      <ContactList contacts={contacts} organizations={orgs} query="" onQueryChange={noop}
        selectedEmail={null} onSelect={noop} />,
    );
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.queryByText("Anna")).not.toBeInTheDocument();
  });

  it("opens Gmail compose and search via row icons", () => {
    render(
      <ContactList contacts={contacts} organizations={orgs} query="anna" onQueryChange={noop}
        selectedEmail={null} onSelect={noop} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /levél írása neki: a@acme\.hu/i }));
    expect(openUrl).toHaveBeenCalledWith(composeUrl("a@acme.hu"));
    fireEvent.click(screen.getByRole("button", { name: /levelezés keresése: a@acme\.hu/i }));
    expect(openUrl).toHaveBeenCalledWith(searchUrl("a@acme.hu"));
  });

  it("shows a delete button for real groups and calls onDeleteOrg", () => {
    const onDeleteOrg = vi.fn();
    render(
      <ContactList contacts={contacts} organizations={orgs} query="" onQueryChange={noop}
        selectedEmail={null} onSelect={noop} onDeleteOrg={onDeleteOrg} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /acme csoport törlése/i }));
    expect(onDeleteOrg).toHaveBeenCalledWith("acme.hu");
  });
});
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `npm test -- ContactList`
Expected: FAIL — a `ContactList` még belső `query` state-et használ (nincs `query`/`onQueryChange` prop), és nem nyílik ki kereséskor.

- [ ] **Step 3: Implementáció — `src/modules/contacts/ContactList.tsx` teljes új tartalom**

```tsx
import { useMemo, useState } from "react";
import type { Contact, Organization } from "./types";
import { groupByOrg, filterContacts, sortContacts, type SortKey } from "./list";
import { initials, colorFor } from "./avatar";
import { openGmailCompose, openGmailSearch } from "./gmailLinks";
import "./ContactList.css";

interface Props {
  contacts: Contact[];
  organizations: Organization[];
  query: string;
  onQueryChange: (q: string) => void;
  selectedEmail: string | null;
  onSelect: (email: string) => void;
  onDeleteOrg?: (domain: string) => void;
}

export function ContactList({
  contacts, organizations, query, onQueryChange, selectedEmail, onSelect, onDeleteOrg,
}: Props) {
  const [sort, setSort] = useState<SortKey>("name");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const searching = query.trim().length > 0;

  const groups = useMemo(() => {
    const filtered = filterContacts(contacts, organizations, query);
    const sorted = sortContacts(filtered, sort);
    return groupByOrg(sorted, organizations);
  }, [contacts, organizations, query, sort]);

  return (
    <div className="contact-list">
      <div className="cl-controls">
        <input
          className="cl-search"
          placeholder="Keresés…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <select className="cl-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="name">Név</option>
          <option value="frequency">Gyakoriság</option>
          <option value="recent">Utóbbi kapcsolat</option>
        </select>
      </div>
      <div className="cl-groups">
        {groups.map(({ org, contacts: cs }) => {
          // alapból csukva; ha aktív keresés van, a találat-csoport nyitva
          const isCollapsed = collapsed[org.domain] ?? !searching;
          return (
            <div key={org.domain} className="cl-group">
              <div className="cl-group-header">
                <button
                  className="cl-group-toggle"
                  onClick={() => setCollapsed((c) => ({ ...c, [org.domain]: !isCollapsed }))}
                >
                  <span>{isCollapsed ? "▸" : "▾"}</span>
                  <span className="cl-group-label">{org.label}</span>
                  <span className="cl-group-count">{cs.length}</span>
                </button>
                {!org.is_personal && onDeleteOrg && (
                  <button
                    className="cl-group-delete"
                    aria-label={`${org.label} csoport törlése`}
                    title="Csoport törlése (tagjai az Egyéb alá kerülnek)"
                    onClick={() => onDeleteOrg(org.domain)}
                  >
                    🗑
                  </button>
                )}
              </div>
              {!isCollapsed &&
                cs.map((c) => (
                  <div key={c.email} className={`cl-row ${selectedEmail === c.email ? "selected" : ""}`}>
                    <button className="cl-row-main" onClick={() => onSelect(c.email)}>
                      <span className="cl-avatar" style={{ background: colorFor(c.email) }}>
                        {initials(c.display_name, c.email)}
                      </span>
                      <span className="cl-meta">
                        <span className="cl-name">{c.display_name || c.email}</span>
                        <span className="cl-email">{c.email}</span>
                      </span>
                    </button>
                    <button
                      className="cl-row-action"
                      aria-label={`Levél írása neki: ${c.email}`}
                      title="Új levél (Gmail)"
                      onClick={() => openGmailCompose(c.email)}
                    >
                      ✉
                    </button>
                    <button
                      className="cl-row-action"
                      aria-label={`Levelezés keresése: ${c.email}`}
                      title="Levelezés keresése (Gmail)"
                      onClick={() => openGmailSearch(c.email)}
                    >
                      🔍
                    </button>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Futtasd — zöld**

Run: `npm test -- ContactList`
Expected: PASS (5 teszt).

- [ ] **Step 5: `ContactsModule.tsx` — query állapot + gráf-kattintás → keresés**

A `ContactsModule.tsx`-ben:
1. Vedd fel a query állapotot a `selected` mellé:
```tsx
  const [query, setQuery] = useState("");
```
2. Add egy handlert a gráf-kiválasztáshoz (kitölti a keresőt is):
```tsx
  const onGraphSelect = (email: string) => {
    setSelected(email);
    setQuery(email);
  };
```
3. A `ContactList` hívást cseréld kontrolláltra (query + onQueryChange átadása):
```tsx
          <ContactList
            contacts={contacts}
            organizations={orgs}
            query={query}
            onQueryChange={setQuery}
            selectedEmail={selected}
            onSelect={setSelected}
            onDeleteOrg={onDeleteOrg}
          />
```
4. A `ContactGraph` `onSelect`-jét állítsd a kombinált handlerre:
```tsx
          <ContactGraph
            contacts={contacts}
            organizations={orgs}
            selectedEmail={selected}
            onSelect={onGraphSelect}
          />
```
(A többi — connect/sync/delete/listen — változatlan.)

- [ ] **Step 6: Futtasd — teljes frontend suite + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: minden zöld, nincs típushiba. (A `ContactsModule.test.tsx` connect-gomb tesztje változatlanul megy; a `ContactGraph` ott már mockolva van.)

---

## Task 6: Steampunk restyle — CSS tokenekre állítás

**Files:**
- Modify: `src/shell/AppShell.css` (teljes új tartalom)
- Modify: `src/modules/contacts/ContactsModule.css` (teljes új tartalom)
- Modify: `src/modules/contacts/ContactList.css` (teljes új tartalom)
- Modify: `src/modules/contacts/ContactsModule.tsx` (a `cm-spinner` → fogaskerék SVG; lásd lent)

- [ ] **Step 1: `src/shell/AppShell.css` teljes új tartalom**

```css
.shell { display: flex; height: 100vh; width: 100vw; overflow: hidden; background: var(--bg-0); }
.rail {
  width: 96px; background: var(--bg-2); color: var(--text-dim);
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 14px 0; flex: none; border-right: 1px solid var(--border);
}
.rail-btn {
  width: 76px; height: 66px; margin: 6px auto; border: 1px solid transparent; cursor: pointer;
  background: var(--bg-3); color: var(--text-dim); border-radius: 12px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.rail-btn:hover { background: #3a2a1f; color: var(--text); border-color: var(--border); }
.rail-btn.active { background: var(--accent); color: var(--bg-0); border-color: var(--accent-bright); }
.rail-icon { font-size: 26px; line-height: 1; }
.rail-label { font-size: 11px; font-weight: 600; font-family: var(--display-font); letter-spacing: 0.3px; }
.content { flex: 1; min-width: 0; overflow: hidden; }
```

- [ ] **Step 2: `src/modules/contacts/ContactsModule.css` teljes új tartalom**

```css
.contacts-module { display: flex; flex-direction: column; height: 100%; background: var(--bg-0); }
.cm-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; border-bottom: 1px solid var(--border);
  background: var(--bg-1); background-image: linear-gradient(160deg, rgba(255,255,255,0.04), rgba(0,0,0,0) 45%);
}
.cm-bar > strong {
  font-family: var(--display-font); font-size: 17px; letter-spacing: 1px;
  color: var(--text); border-bottom: 2px solid var(--brass); padding-bottom: 2px;
}
.cm-bar-right { display: flex; align-items: center; gap: 12px; }
.cm-progress { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text-dim); }

.cm-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 16px; border: 1px solid var(--brass); border-radius: 8px; cursor: pointer;
  background: var(--accent); color: var(--bg-0); font-size: 13px; font-weight: 700;
  font-family: var(--display-font); letter-spacing: 0.4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.4); transition: background 0.15s, box-shadow 0.15s;
}
.cm-btn:hover:not(:disabled) { background: var(--accent-bright); box-shadow: 0 2px 7px rgba(232,144,47,0.35); }
.cm-btn:active:not(:disabled) { background: var(--copper); }
.cm-btn:disabled { background: #5a4632; color: var(--text-dim); border-color: var(--border); cursor: default; box-shadow: none; }
.cm-btn-icon { font-size: 15px; line-height: 1; }

.cm-split { display: flex; flex: 1; min-height: 0; }
.cm-list { width: 42%; min-width: 280px; max-width: 460px; }
.cm-graph { flex: 1; min-width: 0; background: radial-gradient(circle at 55% 50%, #1a1009, var(--bg-0)); }
```

- [ ] **Step 3: `src/modules/contacts/ContactList.css` teljes új tartalom**

```css
.contact-list { display: flex; flex-direction: column; height: 100%; background: var(--bg-1); border-right: 1px solid var(--border); }
.cl-controls { display: flex; gap: 6px; padding: 8px; border-bottom: 1px solid var(--border); }
.cl-search { flex: 1; padding: 6px 9px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-3); color: var(--text); }
.cl-search::placeholder { color: var(--text-dim); }
.cl-sort { border: 1px solid var(--border); border-radius: 6px; background: var(--bg-3); color: var(--text); }
.cl-groups { overflow-y: auto; flex: 1; scrollbar-gutter: stable; }

.cl-group-header { display: flex; align-items: center; padding-right: 8px; border-bottom: 1px solid var(--border); }
.cl-group-toggle {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; padding: 7px 10px;
  background: none; border: none; cursor: pointer; text-align: left;
  font-family: var(--display-font); font-weight: 700; font-size: 13px; letter-spacing: 0.3px; color: var(--brass);
}
.cl-group-count { margin-left: auto; color: var(--text-dim); font-weight: 400; font-family: system-ui, sans-serif; }
.cl-group-delete { background: none; border: none; cursor: pointer; padding: 4px 9px; opacity: 0.4; font-size: 13px; flex: none; }
.cl-group-delete:hover { opacity: 1; }

.cl-row { width: 100%; display: flex; align-items: center; padding-right: 10px; }
.cl-row.selected { background: rgba(232,144,47,0.16); }
.cl-row-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 5px 12px; background: none; border: none; cursor: pointer; text-align: left; color: var(--text); }
.cl-row-action { flex: none; background: none; border: none; cursor: pointer; padding: 4px 7px; font-size: 17px; line-height: 1; opacity: 0.45; }
.cl-row-action:hover { opacity: 1; }
.cl-row:hover .cl-row-action { opacity: 0.7; }
.cl-row:hover .cl-row-action:hover { opacity: 1; }
.cl-avatar { width: 26px; height: 26px; border-radius: 50%; color: var(--bg-0); font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex: none; border: 1px solid rgba(0,0,0,0.3); }
.cl-meta { display: flex; flex-direction: column; min-width: 0; }
.cl-name { font-size: 13px; color: var(--text); }
.cl-email { font-size: 11px; color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; }
```

- [ ] **Step 4: Fogaskerék-spinner a `ContactsModule.tsx`-ben**

A `cm-spinner` `<span>`-t cseréld egy forgó fogaskerék SVG-re (a `.gear-spinner` osztály a `theme.css`-ből forgatja). A progress blokkban:
```tsx
            <span className="cm-progress" role="status" aria-live="polite">
              <svg className="gear-spinner" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 8a4 4 0 100 8 4 4 0 000-8zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                <path d="M21 12l-2-1.2.5-2.3-2.1-1.1-1.6 1.7-2.2-.7L12 6l-1.6 2.4-2.2.7L6.6 7.4 4.5 8.5 5 10.8 3 12l2 1.2-.5 2.3 2.1 1.1 1.6-1.7 2.2.7L12 18l1.6-2.4 2.2-.7 1.6 1.7 2.1-1.1-.5-2.3L21 12z" opacity="0.55" />
              </svg>
              {progress
                ? `${progress.done}/${progress.total} levél feldolgozva`
                : "Levelezés beolvasása…"}
            </span>
```
(A régi `<span className="cm-spinner" />`-t töröld; a `theme.css` `.gear-spinner` szabálya forgatja.)

- [ ] **Step 5: Ellenőrzés**

Run: `npx tsc --noEmit && npm run build`
Expected: tiszta build. (A teszteket ez nem érinti; a `cm-spinner` CSS-osztály eltűnhet, nem baj.)

- [ ] **Step 6: Régi szín-maradványok kiszűrése (manuális ellenőrzés)**

Run: `grep -rEn "#4858d8|#7c8cff|#f1f2f5|#fbfbfd|#eaedff|#e2e4ea" src/ || echo "nincs régi hardcode szín"`
Expected: `nincs régi hardcode szín` (vagy ha maradt, cseréld a megfelelő tokenre). Megjegyzés: az `avatar.ts` `colorFor` HSL-t ad — az maradhat (melegre hangolás opcionális, külön nem kötelező).

---

## Task 7: Záró ellenőrzés

**Files:** —

- [ ] **Step 1: Teljes teszt-suite + típus + build**

Run:
```bash
cd /home/botond/Develop/practice/wt-workspace
npm test
npx tsc --noEmit
npm run build
```
Expected: minden zöld, tiszta build.

- [ ] **Step 2: Kézi end-to-end**

Run: `npm run tauri dev`
Ellenőrizd:
- Az egész app sötét steampunk (Mahogany & Amber): sáv, fejléc (serif cím), gombok, lista.
- A gráf egy nagy, kör-szerű, izzó „agy"-felhő; a szervezetek színes klaszterek; az „Egyéb" nincs a gráfban.
- Gráf-csomópontra kattintva a bal **kereső kitöltődik** az e-mailjével, és a személy megjelenik a listában (a csoport kinyílik), kiemelve mindkét nézetben.
- Drag/zoom/pan a gráfon működik; hover/közeli zoom mutatja a neveket.
- Sync közben forgó fogaskerék-spinner.

---

## Önellenőrzés (a terv írójának jegyzete)

- **Spec-lefedettség:** tokenek+font (T2) · gráf force-graph + korlátozott háló + színek + Egyéb-kizárás (T3) · canvas gráf glow/drag/zoom/hover/kattintás (T4) · query felemelés + gráf→kereső + auto-kinyílás (T5) · minden felület restyle + fogaskerék (T6) · react-force-graph-2d függőség + Cytoscape kivezetés (T1) · tesztstratégia (T3/T4/T5). Lefedve. Backend nincs érintve (helyes — a spec szerint).
- **Placeholder-ellenőrzés:** minden lépés teljes kódot/parancsot tartalmaz; nincs „TBD".
- **Típus-konzisztencia:** `toGraph` → `{nodes: FgNode[], links: FgLink[]}`; `FgNode.id`="person:<email>", `.domain`, `.color`, `.name`, `.val`; `colorForOrg`, `MESH_K` exportált és a tesztben/komponensben egyezően használt. `ContactList` props: `query`, `onQueryChange`, `selectedEmail`, `onSelect`, `onDeleteOrg`; a `ContactsModule` pontosan ezeket adja át. A gráf `onSelect` az `onGraphSelect` (setSelected+setQuery).
