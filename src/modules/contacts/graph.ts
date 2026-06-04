import type { Contact, Organization } from "./types";

export interface GraphNode {
  data: { id: string; label: string; kind: "org" | "person"; size: number; domain: string };
}
export interface GraphEdge {
  data: { id: string; source: string; target: string };
}
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const PERSON_SIZE = 18; // minden ember egyforma
const ORG_BASE = 28;
const ORG_PER_MEMBER = 4;

export function toGraph(contacts: Contact[], orgs: Organization[]): Graph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // az "Egyéb" gyűjtő (is_personal) NEM jelenik meg a gráfban — sem a szervezet-csomópont,
  // sem a hozzá tartozó kontaktok.
  const personalDomains = new Set(orgs.filter((o) => o.is_personal).map((o) => o.domain));

  for (const o of orgs) {
    if (o.is_personal) continue;
    nodes.push({
      data: { id: `org:${o.domain}`, label: o.label, kind: "org", size: ORG_BASE + o.member_count * ORG_PER_MEMBER, domain: o.domain },
    });
  }

  for (const c of contacts) {
    if (personalDomains.has(c.organization_domain)) continue;
    nodes.push({
      data: { id: `person:${c.email}`, label: c.display_name || c.email, kind: "person", size: PERSON_SIZE, domain: c.organization_domain },
    });
    edges.push({
      data: { id: `edge:${c.email}`, source: `org:${c.organization_domain}`, target: `person:${c.email}` },
    });
  }

  return { nodes, edges };
}
