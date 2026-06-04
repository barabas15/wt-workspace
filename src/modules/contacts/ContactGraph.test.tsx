import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ContactGraph } from "./ContactGraph";

vi.mock("cytoscape", () => ({
  default: () => ({ on: vi.fn(), layout: () => ({ run: vi.fn() }), elements: () => ({ removeClass: vi.fn() }), $: () => ({ addClass: vi.fn() }), destroy: vi.fn() }),
}));

describe("ContactGraph", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <ContactGraph contacts={[]} organizations={[]} selectedEmail={null} onSelect={() => {}} />
    );
    expect(container.querySelector(".contact-graph")).toBeTruthy();
  });
});
