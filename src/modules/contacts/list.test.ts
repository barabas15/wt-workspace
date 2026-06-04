import { describe, it, expect } from "vitest";
import { groupByOrg, filterContacts, sortContacts } from "./list";
import type { Contact, Organization } from "./types";

const orgs: Organization[] = [
  { domain: "acme.hu", label: "Acme", is_personal: false, member_count: 2 },
  { domain: "__personal__", label: "Magánszemélyek / egyéb", is_personal: true, member_count: 1 },
  { domain: "webtown.hu", label: "Webtown", is_personal: false, member_count: 1 },
];
const contacts: Contact[] = [
  { email: "a@acme.hu", display_name: "Anna", organization_domain: "acme.hu", message_count: 5, sent_count: 2, received_count: 3, first_seen: "2026-01-01", last_seen: "2026-03-01" },
  { email: "b@acme.hu", display_name: "Béla", organization_domain: "acme.hu", message_count: 50, sent_count: 9, received_count: 41, first_seen: "2026-01-01", last_seen: "2026-05-01" },
  { email: "x@gmail.com", display_name: "Xavér", organization_domain: "__personal__", message_count: 1, sent_count: 0, received_count: 1, first_seen: "2026-02-01", last_seen: "2026-02-01" },
  { email: "w@webtown.hu", display_name: "Wanda", organization_domain: "webtown.hu", message_count: 9, sent_count: 4, received_count: 5, first_seen: "2026-01-15", last_seen: "2026-04-01" },
];

describe("groupByOrg", () => {
  it("groups contacts under their org and puts personal bucket last", () => {
    const groups = groupByOrg(contacts, orgs);
    expect(groups.map((g) => g.org.domain)).toEqual(["acme.hu", "webtown.hu", "__personal__"]);
    expect(groups[0].contacts).toHaveLength(2);
  });
});

describe("filterContacts", () => {
  it("matches name, email or org label, case-insensitive", () => {
    expect(filterContacts(contacts, orgs, "anna").map((c) => c.email)).toEqual(["a@acme.hu"]);
    expect(filterContacts(contacts, orgs, "ACME").map((c) => c.email).sort()).toEqual(["a@acme.hu", "b@acme.hu"]);
    expect(filterContacts(contacts, orgs, "gmail").map((c) => c.email)).toEqual(["x@gmail.com"]);
  });
});

describe("sortContacts", () => {
  it("sorts by frequency desc", () => {
    const r = sortContacts(contacts, "frequency");
    expect(r[0].email).toBe("b@acme.hu");
  });
  it("sorts by last contact desc", () => {
    const r = sortContacts(contacts, "recent");
    expect(r[0].email).toBe("b@acme.hu");
  });
});
