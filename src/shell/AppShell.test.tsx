import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders the module rail with Contacts and Settings", () => {
    render(<AppShell activeModule="contacts" onSelectModule={() => {}}>
      <div>modul-tartalom</div>
    </AppShell>);
    expect(screen.getByRole("button", { name: /kontaktok/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /beállítások/i })).toBeInTheDocument();
    expect(screen.getByText("modul-tartalom")).toBeInTheDocument();
  });
});
