import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

import { ContactList } from "./ContactList";
import { openUrl } from "@tauri-apps/plugin-opener";
import { composeUrl, searchUrl } from "./gmailLinks";
import type { Contact, Organization } from "./types";

const orgs: Organization[] = [
  { domain: "acme.hu", label: "Acme", is_personal: false, member_count: 2 },
];
const contacts: Contact[] = [
  { email: "a@acme.hu", display_name: "Anna", organization_domain: "acme.hu", message_count: 5, sent_count: 2, received_count: 3, first_seen: "2026-01-01", last_seen: "2026-03-01" },
];

function noop() {}

describe("ContactList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the controlled query prop and fires onQueryChange", () => {
    const onQueryChange = vi.fn();
    render(
      <ContactList contacts={contacts} organizations={orgs} query="" onQueryChange={onQueryChange}
        selectedEmail={null} onSelect={noop} />,
    );
    const input = screen.getByPlaceholderText(/keresés/i) as HTMLInputElement;
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "anna" } });
    expect(onQueryChange).toHaveBeenCalledWith("anna");
  });

  it("auto-expands the matching group when a query is set (so the contact shows)", () => {
    render(
      <ContactList contacts={contacts} organizations={orgs} query="anna" onQueryChange={noop}
        selectedEmail={null} onSelect={noop} />,
    );
    expect(screen.getByText("Anna")).toBeInTheDocument();
  });

  it("collapses groups by default when query is empty", () => {
    render(
      <ContactList contacts={contacts} organizations={orgs} query="" onQueryChange={noop}
        selectedEmail={null} onSelect={noop} />,
    );
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.queryByText("Anna")).not.toBeInTheDocument();
  });

  it("opens Gmail compose and search via row icons", () => {
    render(
      <ContactList contacts={contacts} organizations={orgs} query="anna" onQueryChange={noop}
        selectedEmail={null} onSelect={noop} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /levél írása neki: a@acme\.hu/i }));
    expect(openUrl).toHaveBeenCalledWith(composeUrl("a@acme.hu"));
    fireEvent.click(screen.getByRole("button", { name: /levelezés keresése: a@acme\.hu/i }));
    expect(openUrl).toHaveBeenCalledWith(searchUrl("a@acme.hu"));
  });

  it("shows a delete button for real groups and calls onDeleteOrg", () => {
    const onDeleteOrg = vi.fn();
    render(
      <ContactList contacts={contacts} organizations={orgs} query="" onQueryChange={noop}
        selectedEmail={null} onSelect={noop} onDeleteOrg={onDeleteOrg} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /acme csoport törlése/i }));
    expect(onDeleteOrg).toHaveBeenCalledWith("acme.hu");
  });
});
