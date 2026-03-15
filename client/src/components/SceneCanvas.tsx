/**
 * SceneCanvas — Interactive live-compositing canvas for Daniela lessons.
 *
 * Instead of generating a flat JPEG each time, this component holds a persistent
 * background and renders prop images as CSS-positioned transparent PNG layers.
 * Daniela can add/remove props and update the clock without any server round-trip.
 *
 * Architecture:
 *   - Background: CSS object-cover image in a 16:9 container
 *   - Props: absolutely-positioned <img> at cx/cy percentages (from POSITION_MAP)
 *   - Clock: SVG analog clock rendered client-side from a "H:MM" string
 *   - All transitions: framer-motion fade/scale so the scene feels alive
 */

import { motion, AnimatePresence } from "framer-motion";
import type { SceneCanvasItemData, SceneCanvasProp } from "@shared/whiteboard-types";

// ─── Analog Clock SVG ─────────────────────────────────────────────────────────

function AnalogClock({ time }: { time: string }) {
  const parts = time.split(":");
  const hourRaw = parseInt(parts[0] ?? "12", 10);
  const minute = parseInt(parts[1] ?? "0", 10);
  const hour = hourRaw % 12;

  const hourAngle = (hour + minute / 60) * 30;
  const minuteAngle = minute * 6;

  const hourMarkers = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const isMajor = i % 3 === 0;
    const inner = isMajor ? 39 : 42;
    return {
      x1: 50 + inner * Math.sin(a),
      y1: 50 - inner * Math.cos(a),
      x2: 50 + 46 * Math.sin(a),
      y2: 50 - 46 * Math.cos(a),
      w: isMajor ? 2 : 1,
    };
  });

  const hourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n, i) => {
    const a = (i * 30 * Math.PI) / 180;
    return { n, x: 50 + 33 * Math.sin(a), y: 50 - 33 * Math.cos(a) + 3.5 };
  });

  const handEnd = (angle: number, length: number) => ({
    x: 50 + length * Math.sin((angle * Math.PI) / 180),
    y: 50 - length * Math.cos((angle * Math.PI) / 180),
  });

  const hourTip = handEnd(hourAngle, 25);
  const minuteTip = handEnd(minuteAngle, 37);

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-label={`Clock showing ${time}`}>
      <circle cx="50" cy="50" r="48" fill="white" stroke="#d1d5db" strokeWidth="1.5" />
      {hourMarkers.map((m, i) => (
        <line key={i} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke="#6b7280" strokeWidth={m.w} strokeLinecap="round" />
      ))}
      {hourNumbers.map(({ n, x, y }) => (
        <text key={n} x={x} y={y} textAnchor="middle" fontSize="8" fill="#374151" fontFamily="system-ui, sans-serif" fontWeight="500">
          {n}
        </text>
      ))}
      <line x1="50" y1="50" x2={hourTip.x} y2={hourTip.y} stroke="#111827" strokeWidth="4" strokeLinecap="round" />
      <line x1="50" y1="50" x2={minuteTip.x} y2={minuteTip.y} stroke="#374151" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="2.5" fill="#111827" />
    </svg>
  );
}

// ─── Prop layer ────────────────────────────────────────────────────────────────

function PropLayer({ prop }: { prop: SceneCanvasProp }) {
  return (
    <motion.div
      key={prop.name}
      initial={{ opacity: 0, scale: 0.65 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.65 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="absolute"
      style={{
        left: `${prop.cx * 100}%`,
        top: `${prop.cy * 100}%`,
        width: `${prop.scale * 100}%`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }}
    >
      <img
        src={prop.imageUrl}
        alt={prop.label}
        className="w-full h-auto"
        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.30))" }}
        draggable={false}
      />
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: "calc(100% + 3px)" }}>
        <span className="text-white text-[10px] leading-none font-semibold px-1.5 py-0.5 rounded bg-black/65 whitespace-nowrap">
          {prop.label}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Clock-only canvas (no background) ────────────────────────────────────────

function ClockOnlyCanvas({ time }: { time: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center gap-3 p-6"
    >
      <div className="w-48 h-48 bg-white rounded-full shadow-md border border-border p-2">
        <AnalogClock time={time} />
      </div>
      <span className="text-sm font-mono text-muted-foreground">{time}</span>
    </motion.div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface SceneCanvasProps {
  data: SceneCanvasItemData;
  "data-testid"?: string;
}

export function SceneCanvas({ data, "data-testid": testId }: SceneCanvasProps) {
  const hasBackground = Boolean(data.environmentImageUrl);
  const hasProps = data.props.length > 0;
  const hasClock = Boolean(data.clockTime);

  if (!hasBackground && !hasProps && hasClock) {
    return (
      <div data-testid={testId} className="flex justify-center">
        <ClockOnlyCanvas time={data.clockTime!} />
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      className="relative w-full rounded-lg overflow-hidden bg-muted"
      style={{ aspectRatio: "16 / 9" }}
    >
      {hasBackground && (
        <img
          src={data.environmentImageUrl}
          alt={data.environmentLabel || data.environment.replace(/_/g, " ")}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      )}

      <AnimatePresence>
        {data.props.map((prop) => (
          <PropLayer key={prop.name} prop={prop} />
        ))}
      </AnimatePresence>

      {hasClock && (
        <motion.div
          key={data.clockTime}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="absolute"
          style={{ right: "5%", top: "5%", width: "22%" }}
        >
          <div className="bg-white/92 backdrop-blur-sm rounded-xl p-2 shadow-lg">
            <AnalogClock time={data.clockTime!} />
            <p className="text-center text-[10px] font-mono text-gray-600 mt-1 leading-none">
              {data.clockTime}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
