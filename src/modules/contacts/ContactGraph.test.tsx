import { describe, it, expect, vi, beforeAll } from "vitest";
import { render } from "@testing-library/react";

// a canvas-alapú force-graph komponenst mockoljuk
vi.mock("react-force-graph-2d", () => ({
  default: () => <div data-testid="force-graph" />,
}));

// jsdom nem tartalmazza a ResizeObserver-t
beforeAll(() => {
  (globalThis as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

import { ContactGraph } from "./ContactGraph";

describe("ContactGraph", () => {
  it("renders without crashing", () => {
    const { container, getByTestId } = render(
      <ContactGraph contacts={[]} organizations={[]} selectedEmail={null} onSelect={() => {}} />,
    );
    expect(container.querySelector(".contact-graph")).toBeTruthy();
    expect(getByTestId("force-graph")).toBeTruthy();
  });
});
