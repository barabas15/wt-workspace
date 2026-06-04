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
    expect(g.nodes).toHaveLength(7);
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
    expect(g.links.some((l) => l.source.includes("gmail") || l.target.includes("gmail"))).toBe(false);
  });

  it("caps edges (linear, <= MESH_K * memberCount) but keeps clusters connected", () => {
    const g = toGraph(contacts, orgs);
    const acmeLinks = g.links.filter((l) => l.source.includes("acme"));
    expect(acmeLinks.length).toBeLessThanOrEqual(MESH_K * 5);
    const acmeNodes = g.nodes.filter((n) => n.domain === "acme").map((n) => n.id);
    for (const id of acmeNodes) {
      expect(g.links.some((l) => l.source === id || l.target === id)).toBe(true);
    }
  });

  it("colors nodes deterministically per organization", () => {
    const g = toGraph(contacts, orgs);
    const acme = g.nodes.filter((n) => n.domain === "acme");
    expect(new Set(acme.map((n) => n.color)).size).toBe(1);
    expect(colorForOrg("acme")).toBe(colorForOrg("acme"));
    expect(colorForOrg("acme")).toMatch(/^#/);
  });
});
