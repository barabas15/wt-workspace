/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { Contact, Organization } from "./types";
import { toGraph } from "./graph";

interface Props {
  contacts: Contact[];
  organizations: Organization[];
  selectedEmail: string | null;
  onSelect: (email: string) => void;
}

export function ContactGraph({ contacts, organizations, selectedEmail, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => toGraph(contacts, organizations), [contacts, organizations]);
  const selectedId = selectedEmail ? `person:${selectedEmail}` : null;

  return (
    <div className="contact-graph" ref={wrapRef}>
      <ForceGraph2D
        width={size.w || 600}
        height={size.h || 400}
        graphData={data}
        backgroundColor="#20262e"
        nodeId="id"
        nodeLabel="name"
        linkColor={() => "rgba(136,192,208,0.18)"}
        linkWidth={0.6}
        cooldownTicks={120}
        onNodeClick={(n: any) => onSelect(String(n.id).replace(/^person:/, ""))}
        nodeCanvasObjectMode={() => "replace"}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
          if (node.x == null || node.y == null) return;
          const r = (node.val ?? 4) + 1.5;
          const isSel = node.id === selectedId;
          const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 3);
          grd.addColorStop(0, node.color);
          grd.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 3, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = isSel ? "#aedce0" : node.color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, isSel ? r * 1.6 : r, 0, 2 * Math.PI);
          ctx.fill();
          if (isSel) {
            ctx.strokeStyle = "#d8f0f2";
            ctx.lineWidth = 1.5 / scale;
            ctx.stroke();
          }
          if (scale > 2.2 || isSel) {
            ctx.font = `${11 / scale}px system-ui, sans-serif`;
            ctx.fillStyle = "#d8dee9";
            ctx.textAlign = "center";
            ctx.fillText(node.name, node.x, node.y + r * 3 + 9 / scale);
          }
        }}
      />
    </div>
  );
}
