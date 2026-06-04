import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import type { Contact, Organization } from "./types";
import { toGraph } from "./graph";

interface Props {
  contacts: Contact[];
  organizations: Organization[];
  selectedEmail: string | null;
  onSelect: (email: string) => void;
}

export function ContactGraph({ contacts, organizations, selectedEmail, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const { nodes, edges } = toGraph(contacts, organizations);
    const cy = cytoscape({
      container: ref.current,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: "node",
          style: {
            width: "data(size)",
            height: "data(size)",
            label: "data(label)",
            "font-size": 8,
            "text-valign": "bottom",
            "background-color": "#7c8cff",
            color: "#333",
          },
        },
        { selector: 'node[kind = "org"]', style: { "background-color": "#4858d8", color: "#fff", "font-size": 10, "font-weight": "bold" } },
        { selector: "edge", style: { width: 1, "line-color": "#cfd4ff", "curve-style": "haystack" } },
        { selector: ".highlighted", style: { "border-width": 3, "border-color": "#ff9d6e" } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
      layout: { name: "cose", animate: false },
    });

    cy.on("tap", 'node[kind = "person"]', (evt) => {
      const id = evt.target.id() as string;
      onSelect(id.replace(/^person:/, ""));
    });

    cyRef.current = cy;
    return () => cy.destroy();
  }, [contacts, organizations, onSelect]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("highlighted");
    if (selectedEmail) {
      cy.$(`#person\\:${CSS.escape(selectedEmail)}`).addClass("highlighted");
    }
  }, [selectedEmail]);

  return <div className="contact-graph" ref={ref} style={{ width: "100%", height: "100%" }} />;
}
