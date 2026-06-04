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
  "#88c0d0", "#81a1c1", "#8fbcbb", "#a3be8c",
  "#b48ead", "#5e81ac", "#ebcb8b", "#d08770", "#bf616a",
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
