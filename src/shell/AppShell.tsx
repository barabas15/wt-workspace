import type { ReactNode } from "react";
import "./AppShell.css";

export type ModuleId = "contacts" | "settings";

interface Props {
  activeModule: ModuleId;
  onSelectModule: (m: ModuleId) => void;
  children: ReactNode;
}

const MODULES: { id: ModuleId; icon: ReactNode; label: string }[] = [
  {
    id: "contacts",
    label: "Kontaktok",
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    ),
  },
];

export function AppShell({ activeModule, onSelectModule, children }: Props) {
  return (
    <div className="shell">
      <nav className="rail" aria-label="Modulok">
        <div className="rail-top">
          {MODULES.map((m) => (
            <button
              key={m.id}
              className={`rail-btn ${activeModule === m.id ? "active" : ""}`}
              aria-label={m.label}
              onClick={() => onSelectModule(m.id)}
            >
              <span className="rail-icon">{m.icon}</span>
            </button>
          ))}
        </div>
        <div className="rail-bottom">
          <button
            className={`rail-btn ${activeModule === "settings" ? "active" : ""}`}
            aria-label="Beállítások"
            onClick={() => onSelectModule("settings")}
          >
            <span className="rail-icon">⚙</span>
          </button>
        </div>
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}
