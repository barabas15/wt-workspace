import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContactList } from "./ContactList";
import type { Contact, Organization } from "./types";

const orgs: Organization[] = [
  { domain: "acme.hu", label: "Acme", is_personal: false, member_count: 2 },
];
const contacts: Contact[] = [
  { email: "a@acme.hu", display_name: "Anna", organization_domain: "acme.hu", message_count: 5, sent_count: 2, received_count: 3, first_seen: "2026-01-01", last_seen: "2026-03-01" },
];

describe("ContactList", () => {
  it("collapses groups by default and fires selection after expanding", () => {
    const onSelect = vi.fn();
    render(<ContactList contacts={contacts} organizations={orgs} selectedEmail={null} onSelect={onSelect} />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    // alapból csukva: Anna nem látszik
    expect(screen.queryByText("Anna")).not.toBeInTheDocument();
    // kinyitjuk a csoportot, majd kiválasztjuk Annát
    fireEvent.click(screen.getByText("Acme"));
    fireEvent.click(screen.getByText("Anna"));
    expect(onSelect).toHaveBeenCalledWith("a@acme.hu");
  });

  it("filters by search query", () => {
    render(<ContactList contacts={contacts} organizations={orgs} selectedEmail={null} onSelect={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/keresés/i), { target: { value: "nincs" } });
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
  });

  it("shows a delete button for real groups and calls onDeleteOrg", () => {
    const onDeleteOrg = vi.fn();
    render(
      <ContactList
        contacts={contacts}
        organizations={orgs}
        selectedEmail={null}
        onSelect={() => {}}
        onDeleteOrg={onDeleteOrg}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /acme csoport törlése/i }));
    expect(onDeleteOrg).toHaveBeenCalledWith("acme.hu");
  });
});
