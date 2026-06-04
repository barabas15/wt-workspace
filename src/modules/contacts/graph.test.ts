import { describe, it, expect } from "vitest";
import { toGraph } from "./graph";
import type { Contact, Organization } from "./types";

const orgs: Organization[] = [
  { domain: "acme.hu", label: "Acme", is_personal: false, member_count: 2 },
  { domain: "__personal__", label: "Magánszemélyek / egyéb", is_personal: true, member_count: 1 },
];
const contacts: Contact[] = [
  { email: "a@acme.hu", display_name: "Anna", organization_domain: "acme.hu", message_count: 5, sent_count: 2, received_count: 3, first_seen: "2026-01-01", last_seen: "2026-03-01" },
  { email: "b@acme.hu", display_name: "Béla", organization_domain: "acme.hu", message_count: 99, sent_count: 9, received_count: 90, first_seen: "2026-01-01", last_seen: "2026-03-01" },
  { email: "x@gmail.com", display_name: "X", organization_domain: "__personal__", message_count: 1, sent_count: 0, received_count: 1, first_seen: "2026-02-01", last_seen: "2026-02-01" },
];

describe("toGraph", () => {
  it("creates org and contact nodes plus membership edges", () => {
    const g = toGraph(contacts, orgs);
    const orgNodes = g.nodes.filter((n) => n.data.kind === "org");
    const personNodes = g.nodes.filter((n) => n.data.kind === "person");
    expect(orgNodes).toHaveLength(2);
    expect(personNodes).toHaveLength(3);
    expect(g.edges).toHaveLength(3);
  });

  it("org node size scales with member_count, person size is constant", () => {
    const g = toGraph(contacts, orgs);
    const acme = g.nodes.find((n) => n.data.id === "org:acme.hu")!;
    const personal = g.nodes.find((n) => n.data.id === "org:__personal__")!;
    expect(acme.data.size).toBeGreaterThan(personal.data.size);
    const anna = g.nodes.find((n) => n.data.id === "person:a@acme.hu")!;
    const bela = g.nodes.find((n) => n.data.id === "person:b@acme.hu")!;
    expect(anna.data.size).toBe(bela.data.size);
  });
});
