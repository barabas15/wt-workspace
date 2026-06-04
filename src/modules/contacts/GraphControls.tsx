export interface GraphSettings {
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  charge: number;
  linkDistance: number;
  centerGravity: number;
  nodeScale: number;
  particles: boolean;
  starCount: number;
  autoRotate: boolean;
}

// Bedrótozott alapértékek (a felhasználó élő hangolásából véglegesítve).
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  bloomStrength: 0,
  bloomRadius: 0.55,
  bloomThreshold: 0.58,
  charge: -100,
  linkDistance: 23,
  centerGravity: 0.075,
  nodeScale: 0.7,
  particles: false,
  starCount: 1800,
  autoRotate: false,
};

interface Props {
  settings: GraphSettings;
  onChange: (s: GraphSettings) => void;
}

const SLIDERS: { key: keyof GraphSettings; label: string; min: number; max: number; step: number }[] = [
  { key: "bloomStrength", label: "Bloom strength", min: 0, max: 4, step: 0.1 },
  { key: "bloomRadius", label: "Bloom radius", min: 0, max: 2, step: 0.05 },
  { key: "bloomThreshold", label: "Bloom threshold", min: 0, max: 1, step: 0.01 },
  { key: "charge", label: "Charge (repulsion)", min: -400, max: 0, step: 5 },
  { key: "linkDistance", label: "Link distance", min: 5, max: 120, step: 1 },
  { key: "centerGravity", label: "Center gravity", min: 0, max: 0.3, step: 0.005 },
  { key: "nodeScale", label: "Node size scale", min: 0.3, max: 3, step: 0.1 },
  { key: "starCount", label: "Star count", min: 0, max: 4000, step: 100 },
];

export function GraphControls({ settings, onChange }: Props) {
  const setNum = (key: keyof GraphSettings, v: string) =>
    onChange({ ...settings, [key]: Number(v) });
  const setBool = (key: keyof GraphSettings, v: boolean) =>
    onChange({ ...settings, [key]: v });

  return (
    <div className="graph-controls">
      <div className="gc-title">Gráf-beállítások (dev)</div>
      {SLIDERS.map((s) => (
        <label key={s.key} className="gc-row">
          <span>{s.label}</span>
          <input
            type="range"
            aria-label={s.label}
            min={s.min}
            max={s.max}
            step={s.step}
            value={settings[s.key] as number}
            onChange={(e) => setNum(s.key, e.target.value)}
          />
          <span className="gc-val">{settings[s.key] as number}</span>
        </label>
      ))}
      <label className="gc-row">
        <span>Edge particles</span>
        <input
          type="checkbox"
          aria-label="Edge particles"
          checked={settings.particles}
          onChange={(e) => setBool("particles", e.target.checked)}
        />
      </label>
      <label className="gc-row">
        <span>Auto-rotate</span>
        <input
          type="checkbox"
          aria-label="Auto-rotate"
          checked={settings.autoRotate}
          onChange={(e) => setBool("autoRotate", e.target.checked)}
        />
      </label>
    </div>
  );
}
