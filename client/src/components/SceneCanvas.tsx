/**
 * SceneCanvas — Interactive live-compositing canvas for Daniela lessons.
 *
 * Phase 1 (Spatial):
 *   - Background: CSS object-cover image in a 16:9 container
 *   - Props: absolutely-positioned transparent PNGs at cx/cy percentages
 *   - Clock: SVG analog clock rendered client-side from a "H:MM" string
 *
 * Phase 2 (Grammar canvas — full-panel, replaces spatial view when active):
 *   - ConjugationTableCanvas: progressive fill-in verb conjugation table
 *   - CalendarCanvas: month grid with day/date highlighting
 */

import { motion, AnimatePresence } from "framer-motion";
import type {
  SceneCanvasItemData,
  SceneCanvasProp,
  ConjugationTableData,
  CalendarData,
} from "@shared/whiteboard-types";

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

// ─── Conjugation Table Canvas ─────────────────────────────────────────────────

function ConjugationTableCanvas({ table }: { table: ConjugationTableData }) {
  return (
    <motion.div
      key={`${table.verb}-${table.tense}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 bg-background"
      data-testid="canvas-conjugation"
    >
      {/* Header */}
      <div className="mb-5 text-center">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {table.verb}
        </div>
        <div className="text-sm text-muted-foreground mt-1 font-medium">
          {table.tense}
        </div>
      </div>

      {/* Table */}
      <div className="w-full max-w-xs sm:max-w-sm">
        <div className="rounded-lg border border-border overflow-hidden">
          {table.cells.map((cell, i) => {
            const isHighlighted = table.highlightPronoun === cell.pronoun;
            const isNew = cell.isNew;
            const hasForm = cell.form !== null;

            return (
              <motion.div
                key={`${cell.pronoun}-${i}`}
                className={[
                  "flex items-center",
                  i > 0 ? "border-t border-border" : "",
                  isHighlighted ? "bg-primary/8" : "bg-card",
                ].join(" ")}
              >
                {/* Pronoun column */}
                <div
                  className={[
                    "flex-shrink-0 w-28 sm:w-32 px-3 py-2.5 text-sm",
                    isHighlighted ? "font-bold text-primary" : "font-medium text-muted-foreground",
                  ].join(" ")}
                >
                  <span>{cell.pronoun}</span>
                  {cell.pronounAlt && (
                    <span className="block text-[11px] text-muted-foreground/60">{cell.pronounAlt}</span>
                  )}
                </div>

                {/* Divider */}
                <div className="self-stretch w-px bg-border" />

                {/* Form column */}
                <div className="flex-1 px-3 py-2.5">
                  {hasForm ? (
                    <motion.span
                      key={cell.form}
                      initial={isNew ? { opacity: 0, scale: 0.85 } : false}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className={[
                        "text-sm font-semibold",
                        isHighlighted ? "text-primary" : "text-foreground",
                        isNew ? "underline decoration-primary/40 decoration-2 underline-offset-2" : "",
                      ].join(" ")}
                    >
                      {cell.form}
                    </motion.span>
                  ) : (
                    <span className="text-sm text-muted-foreground/40 font-mono tracking-widest select-none">
                      ___
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Calendar Canvas ──────────────────────────────────────────────────────────

function CalendarCanvas({ cal }: { cal: CalendarData }) {
  const startDow = cal.startDow ?? 1; // default Mon-first

  // Compute first day of month's day-of-week (0=Sun)
  const firstDate = new Date(cal.year, cal.monthNumber - 1, 1);
  const firstDow = firstDate.getDay(); // 0=Sun

  // Offset: how many empty cells before day 1
  // startDow=1 (Mon-first): Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
  // startDow=0 (Sun-first): Sun=0, Mon=1, ...
  const offset = ((firstDow - startDow) + 7) % 7;

  const daysInMonth = new Date(cal.year, cal.monthNumber, 0).getDate();

  // Build 6-row × 7-col grid
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const highlight = cal.highlightDay;
  const marked = new Set(cal.markedDays ?? []);
  const hlDowIdx = cal.highlightDowIndex;

  const dayNames = cal.dayNames.length === 7
    ? cal.dayNames
    : ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

  return (
    <motion.div
      key={`${cal.month}-${cal.year}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 bg-background"
      data-testid="canvas-calendar"
    >
      {/* Month / Year header */}
      <div className="mb-4 text-center">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground capitalize">
          {cal.month}
        </div>
        <div className="text-sm text-muted-foreground mt-0.5">{cal.year}</div>
      </div>

      {/* Calendar grid */}
      <div className="w-full max-w-xs sm:max-w-sm">
        {/* Day-name header row */}
        <div className="grid grid-cols-7 mb-1">
          {dayNames.map((name, colIdx) => (
            <div
              key={colIdx}
              className={[
                "text-center text-[11px] font-semibold py-1 rounded",
                hlDowIdx === colIdx
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground",
              ].join(" ")}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Date rows */}
        <div className="grid grid-cols-7 gap-0.5">
          {rows.map((row, rIdx) =>
            row.map((day, colIdx) => {
              const isHighlight = day !== null && day === highlight;
              const isMarked = day !== null && marked.has(day);
              const isDowHighlight = hlDowIdx === colIdx && day !== null;

              return (
                <motion.div
                  key={`${rIdx}-${colIdx}`}
                  initial={isHighlight ? { scale: 0.7, opacity: 0 } : false}
                  animate={isHighlight ? { scale: 1, opacity: 1 } : {}}
                  transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
                  className={[
                    "aspect-square flex items-center justify-center rounded text-sm font-medium select-none",
                    day === null ? "" : "cursor-default",
                    isHighlight
                      ? "bg-primary text-primary-foreground font-bold shadow-sm"
                      : isMarked
                        ? "bg-primary/15 text-primary"
                        : isDowHighlight
                          ? "bg-primary/8 text-foreground"
                          : day !== null
                            ? "text-foreground hover-elevate"
                            : "",
                  ].join(" ")}
                >
                  {day}
                </motion.div>
              );
            })
          )}
        </div>
      </div>
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
  const hasConjugation = Boolean(data.conjugationTable);
  const hasCalendar = Boolean(data.calendarData);

  // ── Grammar canvas modes (Phase 2) ──────────────────────────────────────────
  // These fill the full panel. If a grammar canvas is active AND there's no
  // background scene, show just the grammar canvas. If both are active (e.g.
  // grammar table shown during a scene lesson), overlay the grammar canvas.

  if (!hasBackground && !hasProps && hasConjugation) {
    return (
      <div data-testid={testId} className="w-full min-h-32">
        <ConjugationTableCanvas table={data.conjugationTable!} />
      </div>
    );
  }

  if (!hasBackground && !hasProps && hasCalendar) {
    return (
      <div data-testid={testId} className="w-full min-h-32">
        <CalendarCanvas cal={data.calendarData!} />
      </div>
    );
  }

  // ── Clock-only (no scene) ────────────────────────────────────────────────────
  if (!hasBackground && !hasProps && hasClock) {
    return (
      <div data-testid={testId} className="flex justify-center">
        <ClockOnlyCanvas time={data.clockTime!} />
      </div>
    );
  }

  // ── Full spatial scene canvas ────────────────────────────────────────────────
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

      {/* Grammar overlays on top of spatial scene (corner panel) */}
      {hasConjugation && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute right-2 top-2 bottom-2 w-44 sm:w-52 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg overflow-auto"
        >
          <ConjugationTableCanvas table={data.conjugationTable!} />
        </motion.div>
      )}

      {hasCalendar && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute right-2 top-2 bottom-2 w-48 sm:w-56 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg overflow-auto"
        >
          <CalendarCanvas cal={data.calendarData!} />
        </motion.div>
      )}
    </div>
  );
}
