import type { Contact, Organization } from "./types";

export interface OrgGroup {
  org: Organization;
  contacts: Contact[];
}

/** Kontaktok szervezetenként; a personal (is_personal) csoport mindig a végére. */
export function groupByOrg(contacts: Contact[], orgs: Organization[]): OrgGroup[] {
  const byDomain = new Map<string, Contact[]>();
  for (const c of contacts) {
    const arr = byDomain.get(c.organization_domain) ?? [];
    arr.push(c);
    byDomain.set(c.organization_domain, arr);
  }
  const groups = orgs
    .filter((o) => byDomain.has(o.domain))
    .map((o) => ({ org: o, contacts: byDomain.get(o.domain)! }));

  groups.sort((a, b) => {
    if (a.org.is_personal !== b.org.is_personal) return a.org.is_personal ? 1 : -1;
    return a.org.label.localeCompare(b.org.label, "hu");
  });
  return groups;
}

/** Kereső a néven / e-mailen / szervezet-címkén, kis-nagybetű érzéketlen. */
export function filterContacts(contacts: Contact[], orgs: Organization[], query: string): Contact[] {
  const q = query.trim().toLowerCase();
  if (!q) return contacts;
  const labelOf = new Map(orgs.map((o) => [o.domain, o.label.toLowerCase()]));
  return contacts.filter((c) => {
    const label = labelOf.get(c.organization_domain) ?? "";
    return (
      c.display_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.organization_domain.toLowerCase().includes(q) ||
      label.includes(q)
    );
  });
}

export type SortKey = "frequency" | "recent" | "name";

/** Rendezés gyakoriság / utóbbi kapcsolat / név szerint (új tömböt ad). */
export function sortContacts(contacts: Contact[], key: SortKey): Contact[] {
  const out = [...contacts];
  out.sort((a, b) => {
    switch (key) {
      case "frequency":
        return b.message_count - a.message_count;
      case "recent":
        return b.last_seen.localeCompare(a.last_seen);
      case "name":
        return (a.display_name || a.email).localeCompare(b.display_name || b.email, "hu");
    }
  });
  return out;
}
