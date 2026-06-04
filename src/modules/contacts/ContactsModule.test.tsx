import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("./api", () => ({
  api: {
    isConnected: vi.fn().mockResolvedValue(false),
    connectGmail: vi.fn().mockResolvedValue(undefined),
    startSync: vi.fn().mockResolvedValue(undefined),
    getContacts: vi.fn().mockResolvedValue([]),
    getOrganizations: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock("./ContactGraph", () => ({ ContactGraph: () => <div data-testid="graph" /> }));

import { ContactsModule } from "./ContactsModule";
import { api } from "./api";

describe("ContactsModule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows connect button when not connected", async () => {
    render(<ContactsModule />);
    await waitFor(() => expect(screen.getByRole("button", { name: /gmail csatlakoztat/i })).toBeInTheDocument());
  });

  it("shows a loading indicator while syncing (before per-message progress)", async () => {
    vi.mocked(api.isConnected).mockResolvedValueOnce(true);
    render(<ContactsModule />);
    const refresh = await screen.findByRole("button", { name: /frissítés/i });
    fireEvent.click(refresh);
    await waitFor(() =>
      expect(screen.getByText(/levelezés beolvasása/i)).toBeInTheDocument(),
    );
  });

  it("shows an alert when connecting fails (e.g. missing GMAIL_CLIENT_ID)", async () => {
    vi.mocked(api.connectGmail).mockRejectedValueOnce("Hiányzó GMAIL_CLIENT_ID környezeti változó");
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<ContactsModule />);
    const btn = await screen.findByRole("button", { name: /gmail csatlakoztat/i });
    fireEvent.click(btn);
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(String(alertSpy.mock.calls[0][0])).toMatch(/GMAIL_CLIENT_ID|csatlakoz/i);
    alertSpy.mockRestore();
  });
});
