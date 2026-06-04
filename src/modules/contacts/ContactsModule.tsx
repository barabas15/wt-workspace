import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "./api";
import type { Contact, Organization } from "./types";
import { ContactList } from "./ContactList";
import { ContactGraph } from "./ContactGraph";
import "./ContactsModule.css";

export function ContactsModule() {
  const [connected, setConnected] = useState<boolean>(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const loadData = useCallback(async () => {
    const [c, o] = await Promise.all([api.getContacts(), api.getOrganizations()]);
    setContacts(c);
    setOrgs(o);
  }, []);

  useEffect(() => {
    api.isConnected().then(setConnected);
    loadData();
  }, [loadData]);

  useEffect(() => {
    const un1 = listen<[number, number]>("sync-progress", (e) => {
      setProgress({ done: e.payload[0], total: e.payload[1] });
    });
    const un2 = listen("sync-done", async () => {
      setSyncing(false);
      setProgress(null);
      await loadData();
    });
    const un3 = listen<string>("sync-error", (e) => {
      setSyncing(false);
      setProgress(null);
      alert(`Szinkron hiba: ${e.payload}`);
    });
    return () => {
      un1.then((f) => f());
      un2.then((f) => f());
      un3.then((f) => f());
    };
  }, [loadData]);

  const onConnect = async () => {
    try {
      await api.connectGmail();
    } catch (err) {
      alert(`Nem sikerült csatlakozni a Gmailhez: ${err}`);
      return;
    }
    setConnected(true);
    await onSync();
  };

  const onSync = async () => {
    setSyncing(true);
    try {
      await api.startSync();
    } catch (err) {
      setSyncing(false);
      setProgress(null);
      alert(`Szinkron hiba: ${err}`);
    }
  };

  const onDeleteOrg = async (domain: string) => {
    if (!window.confirm("Biztosan törlöd ezt a csoportot? A tagjai az „Egyéb” alá kerülnek (újraszinkronnál is).")) {
      return;
    }
    try {
      await api.deleteOrganization(domain);
      await loadData();
    } catch (err) {
      alert(`Nem sikerült törölni a csoportot: ${err}`);
    }
  };

  return (
    <div className="contacts-module">
      <header className="cm-bar">
        <strong>Kontaktok</strong>
        <div className="cm-bar-right">
          {syncing && (
            <span className="cm-progress" role="status" aria-live="polite">
              <span className="cm-spinner" aria-hidden="true" />
              {progress
                ? `${progress.done}/${progress.total} levél feldolgozva`
                : "Levelezés beolvasása…"}
            </span>
          )}
          {!connected ? (
            <button className="cm-btn" onClick={onConnect}>
              <span className="cm-btn-icon" aria-hidden="true">✉</span>
              Gmail csatlakoztatása
            </button>
          ) : (
            <button className="cm-btn" onClick={onSync} disabled={syncing}>
              <span className="cm-btn-icon" aria-hidden="true">↻</span>
              {syncing ? "Szinkronizálás…" : "Frissítés"}
            </button>
          )}
        </div>
      </header>
      <div className="cm-split">
        <div className="cm-list">
          <ContactList contacts={contacts} organizations={orgs} selectedEmail={selected} onSelect={setSelected} onDeleteOrg={onDeleteOrg} />
        </div>
        <div className="cm-graph">
          <ContactGraph contacts={contacts} organizations={orgs} selectedEmail={selected} onSelect={setSelected} />
        </div>
      </div>
    </div>
  );
}
