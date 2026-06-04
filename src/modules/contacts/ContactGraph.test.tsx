import { describe, it, expect, vi, beforeAll } from "vitest";
import { render } from "@testing-library/react";

// jsdom nem tartalmazza a ResizeObserver-t
beforeAll(() => {
  (globalThis as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// WebGL/Three nem megy jsdom-ban → a komponenst mockoljuk. Plain fv → a ref null marad,
// így a komponens imperatív effektjei guard-olnak és no-opolnak.
vi.mock("react-force-graph-3d", () => ({ default: () => <div data-testid="force-graph-3d" /> }));
vi.mock("three", () => ({ Vector2: class {}, BufferGeometry: class { setAttribute() {} }, BufferAttribute: class {}, PointsMaterial: class {}, Points: class {} }));
vi.mock("d3-force-3d", () => ({ forceX: () => ({ strength: () => ({}) }), forceY: () => ({ strength: () => ({}) }), forceZ: () => ({ strength: () => ({}) }) }));
vi.mock("three/examples/jsm/postprocessing/UnrealBloomPass.js", () => ({ UnrealBloomPass: class {} }));

import { ContactGraph } from "./ContactGraph";

describe("ContactGraph", () => {
  it("renders without crashing", () => {
    const { container, getByTestId } = render(
      <ContactGraph contacts={[]} organizations={[]} selectedEmail={null} onSelect={() => {}} />,
    );
    expect(container.querySelector(".contact-graph")).toBeTruthy();
    expect(getByTestId("force-graph-3d")).toBeTruthy();
  });
});
