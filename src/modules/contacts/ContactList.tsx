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
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18" />
                      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                      <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
                    </svg>
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
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="m3 7 9 6 9-6" />
                      </svg>
                    </button>
                    <button
                      className="cl-row-action"
                      aria-label={`Levelezés keresése: ${c.email}`}
                      title="Levelezés keresése (Gmail)"
                      onClick={() => openGmailSearch(c.email)}
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                      </svg>
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
