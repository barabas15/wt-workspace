import type { ReactNode } from "react";
import "./AppShell.css";

export type ModuleId = "contacts" | "settings";

interface Props {
  activeModule: ModuleId;
  onSelectModule: (m: ModuleId) => void;
  children: ReactNode;
}

const MODULES: { id: ModuleId; icon: string; label: string }[] = [
  { id: "contacts", icon: "@", label: "Kontaktok" },
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
              <span className="rail-label">{m.label}</span>
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
            <span className="rail-label">Beáll.</span>
          </button>
        </div>
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}
