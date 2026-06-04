import { useMemo, useState } from "react";
import type { Contact, Organization } from "./types";
import { groupByOrg, filterContacts, sortContacts, type SortKey } from "./list";
import { initials, colorFor } from "./avatar";
import "./ContactList.css";

interface Props {
  contacts: Contact[];
  organizations: Organization[];
  selectedEmail: string | null;
  onSelect: (email: string) => void;
  onDeleteOrg?: (domain: string) => void;
}

export function ContactList({ contacts, organizations, selectedEmail, onSelect, onDeleteOrg }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="cl-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="name">Név</option>
          <option value="frequency">Gyakoriság</option>
          <option value="recent">Utóbbi kapcsolat</option>
        </select>
      </div>
      <div className="cl-groups">
        {groups.map(({ org, contacts: cs }) => {
          // a csoportok alapból CSUKVA vannak
          const isCollapsed = collapsed[org.domain] ?? true;
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
                  <button
                    key={c.email}
                    className={`cl-row ${selectedEmail === c.email ? "selected" : ""}`}
                    onClick={() => onSelect(c.email)}
                  >
                    <span className="cl-avatar" style={{ background: colorFor(c.email) }}>
                      {initials(c.display_name, c.email)}
                    </span>
                    <span className="cl-meta">
                      <span className="cl-name">{c.display_name || c.email}</span>
                      <span className="cl-email">{c.email}</span>
                    </span>
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
