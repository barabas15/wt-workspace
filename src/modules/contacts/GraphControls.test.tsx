import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GraphControls, DEFAULT_GRAPH_SETTINGS } from "./GraphControls";

describe("GraphControls", () => {
  it("renders a slider and emits changes", () => {
    const onChange = vi.fn();
    render(<GraphControls settings={DEFAULT_GRAPH_SETTINGS} onChange={onChange} />);
    const bloom = screen.getByLabelText(/bloom strength/i) as HTMLInputElement;
    expect(bloom).toBeInTheDocument();
    fireEvent.change(bloom, { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bloomStrength: 2 }));
  });

  it("toggles a boolean (particles)", () => {
    const onChange = vi.fn();
    render(<GraphControls settings={DEFAULT_GRAPH_SETTINGS} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/edge particles/i));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ particles: !DEFAULT_GRAPH_SETTINGS.particles }));
  });
});
