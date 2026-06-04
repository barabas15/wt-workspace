/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { forceX, forceY, forceZ } from "d3-force-3d";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Contact, Organization } from "./types";
import { toGraph } from "./graph";
import { GraphControls, DEFAULT_GRAPH_SETTINGS, type GraphSettings } from "./GraphControls";

const SETTINGS_KEY = "wt.graphSettings";

function loadSettings(): GraphSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_GRAPH_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* sérült/elérhetetlen storage → defaultok */
  }
  return DEFAULT_GRAPH_SETTINGS;
}

interface Props {
  contacts: Contact[];
  organizations: Organization[];
  selectedEmail: string | null;
  onSelect: (email: string) => void;
}

export function ContactGraph({ contacts, organizations, selectedEmail, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const bloomRef = useRef<any>(null);
  const starsRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [settings, setSettings] = useState<GraphSettings>(loadSettings);
  const [showControls, setShowControls] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // beállítások mentése, hogy újratöltés után is megmaradjanak
  const updateSettings = (s: GraphSettings) => {
    setSettings(s);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      /* storage nem elérhető → csak memóriában marad */
    }
  };

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

  function buildStars(scene: any, count: number) {
    if (starsRef.current) {
      scene.remove(starsRef.current);
      starsRef.current.geometry?.dispose?.();
      starsRef.current.material?.dispose?.();
      starsRef.current = null;
    }
    if (count <= 0) return;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 4000;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x9fb4d0, size: 1.6, sizeAttenuation: true, transparent: true, opacity: 0.7 });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    starsRef.current = points;
  }

  // egyszeri scene-beállítás, amint a ref kész
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (!bloomRef.current && fg.postProcessingComposer) {
      const pass = new UnrealBloomPass(new THREE.Vector2(size.w || 600, size.h || 400), 1.8, 0.85, 0);
      fg.postProcessingComposer().addPass(pass);
      bloomRef.current = pass;
    }
    if (fg.scene) buildStars(fg.scene(), settings.starCount);
    if (fg.d3Force) {
      fg.d3Force("x", forceX(0).strength(settings.centerGravity));
      fg.d3Force("y", forceY(0).strength(settings.centerGravity));
      fg.d3Force("z", forceZ(0).strength(settings.centerGravity));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);

  // beállítások alkalmazása
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (bloomRef.current) {
      bloomRef.current.strength = settings.bloomStrength;
      bloomRef.current.radius = settings.bloomRadius;
      bloomRef.current.threshold = settings.bloomThreshold;
    }
    if (fg.d3Force) {
      fg.d3Force("charge")?.strength(settings.charge);
      fg.d3Force("link")?.distance(settings.linkDistance);
      fg.d3Force("x")?.strength(settings.centerGravity);
      fg.d3Force("y")?.strength(settings.centerGravity);
      fg.d3Force("z")?.strength(settings.centerGravity);
    }
    if (fg.scene) buildStars(fg.scene(), settings.starCount);
    if (fg.controls) {
      const c = fg.controls();
      c.autoRotate = settings.autoRotate;
      c.autoRotateSpeed = 0.6;
    }
    fg.d3ReheatSimulation?.();
  }, [settings]);

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of data.links) {
      const s = (l as any).source.id ?? (l as any).source;
      const t = (l as any).target.id ?? (l as any).target;
      if (!m.has(s)) m.set(s, new Set());
      if (!m.has(t)) m.set(t, new Set());
      m.get(s)!.add(t);
      m.get(t)!.add(s);
    }
    return m;
  }, [data]);

  const isDimmed = (id: string) =>
    hoverId !== null && id !== hoverId && !(neighbors.get(hoverId)?.has(id));

  return (
    <div className="contact-graph" ref={wrapRef}>
      <button
        className="graph-controls-toggle"
        aria-label="Gráf-beállítások"
        title="Gráf-beállítások"
        onClick={() => setShowControls((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 8a4 4 0 100 8 4 4 0 000-8zm0 6a2 2 0 110-4 2 2 0 010 4z" />
          <path d="M21 12l-2-1.2.5-2.3-2.1-1.1-1.6 1.7-2.2-.7L12 6l-1.6 2.4-2.2.7L6.6 7.4 4.5 8.5 5 10.8 3 12l2 1.2-.5 2.3 2.1 1.1 1.6-1.7 2.2.7L12 18l1.6-2.4 2.2-.7 1.6 1.7 2.1-1.1-.5-2.3L21 12z" opacity="0.55" />
        </svg>
      </button>
      {showControls && <GraphControls settings={settings} onChange={updateSettings} />}
      <ForceGraph3D
        ref={fgRef}
        width={size.w || 600}
        height={size.h || 400}
        graphData={data}
        backgroundColor="#0a0f14"
        nodeId="id"
        nodeLabel="name"
        nodeVal={(n: any) => n.val * settings.nodeScale}
        nodeColor={(n: any) =>
          n.id === selectedId ? "#ffffff" : isDimmed(n.id) ? "#2b3440" : n.color
        }
        nodeOpacity={0.95}
        linkColor={(l: any) => {
          const s = l.source.id ?? l.source;
          const t = l.target.id ?? l.target;
          const active = hoverId !== null && (s === hoverId || t === hoverId);
          return active ? "rgba(174,220,224,0.7)" : "rgba(136,192,208,0.15)";
        }}
        linkWidth={0.4}
        linkDirectionalParticles={settings.particles ? 2 : 0}
        linkDirectionalParticleWidth={1.1}
        linkDirectionalParticleSpeed={0.006}
        onNodeHover={(n: any) => setHoverId(n ? n.id : null)}
        onNodeClick={(n: any) => onSelect(String(n.id).replace(/^person:/, ""))}
      />
    </div>
  );
}
