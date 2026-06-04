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
}

export function ContactList({ contacts, organizations, selectedEmail, onSelect }: Props) {
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
          const isCollapsed = collapsed[org.domain] ?? org.is_personal;
          return (
            <div key={org.domain} className="cl-group">
              <button
                className="cl-group-header"
                onClick={() => setCollapsed((c) => ({ ...c, [org.domain]: !isCollapsed }))}
              >
                <span>{isCollapsed ? "▸" : "▾"}</span>
                <span className="cl-group-label">{org.label}</span>
                <span className="cl-group-count">{cs.length}</span>
              </button>
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
