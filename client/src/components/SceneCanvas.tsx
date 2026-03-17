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
  BodyDiagramData,
  ThermometerData,
  EmotionData,
  WeatherData,
  WorldMapData,
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

// ─── Thermometer Canvas ───────────────────────────────────────────────────────

function ThermometerCanvas({ data }: { data: ThermometerData }) {
  const { celsius, labelText, showFahrenheit } = data;
  const minTemp = -30, maxTemp = 60;
  const pct = Math.min(1, Math.max(0, (celsius - minTemp) / (maxTemp - minTemp)));
  const fahrenheit = Math.round(celsius * 9 / 5 + 32);
  const tubeTop = 32, tubeBottom = 260, tubeHeight = tubeBottom - tubeTop;
  const fillHeight = pct * tubeHeight;
  const fillY = tubeBottom - fillHeight;
  const fillColor = celsius <= 0 ? '#3b82f6' : celsius <= 15 ? '#22c55e' : celsius <= 30 ? '#f97316' : '#ef4444';
  const ticks = [-20, -10, 0, 10, 20, 30, 40, 50].filter(t => t >= minTemp && t <= maxTemp);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-3 p-6"
    >
      <svg viewBox="0 0 130 330" className="w-20 sm:w-28" aria-label={`Thermometer: ${celsius}°C`}>
        {/* Tick marks */}
        {ticks.map(t => {
          const y = tubeBottom - ((t - minTemp) / (maxTemp - minTemp)) * tubeHeight;
          const isMajor = t % 20 === 0;
          return (
            <g key={t}>
              <line x1="66" y1={y} x2={isMajor ? 80 : 76} y2={y} stroke="currentColor" strokeWidth={isMajor ? 1.5 : 1} className="text-muted-foreground" />
              {isMajor && (
                <text x="85" y={y + 4} fontSize="10" fill="currentColor" className="text-muted-foreground" fontFamily="system-ui,sans-serif">{t}°</text>
              )}
            </g>
          );
        })}
        {/* Zero line */}
        {(() => { const y = tubeBottom - ((0 - minTemp) / (maxTemp - minTemp)) * tubeHeight; return <line key="zero" x1="56" y1={y} x2="82" y2={y} stroke="#6b7280" strokeWidth="1.5" strokeDasharray="3,2" />; })()}
        {/* Tube background */}
        <rect x="52" y={tubeTop} width="20" height={tubeHeight} rx="10" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* Mercury fill */}
        <motion.rect
          x="55" rx="8"
          y={fillY} width="14" height={fillHeight}
          fill={fillColor}
          initial={{ height: 0, y: tubeBottom }}
          animate={{ height: fillHeight, y: fillY }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        />
        {/* Tube overlay (border on top) */}
        <rect x="52" y={tubeTop} width="20" height={tubeHeight} rx="10" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" />
        {/* Bulb */}
        <circle cx="62" cy={tubeBottom + 16} r="20" fill={fillColor} />
        <circle cx="62" cy={tubeBottom + 16} r="20" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" />
        <text x="62" y={tubeBottom + 21} textAnchor="middle" fontSize="11" fill="white" fontWeight="700" fontFamily="system-ui,sans-serif">{celsius}°</text>
      </svg>
      <div className="text-center">
        <p className="text-3xl font-bold tabular-nums">{celsius}°C</p>
        {showFahrenheit && <p className="text-sm text-muted-foreground">{fahrenheit}°F</p>}
        {labelText && <p className="text-sm text-muted-foreground mt-1 italic">{labelText}</p>}
      </div>
    </motion.div>
  );
}

// ─── Emotion Face Canvas ──────────────────────────────────────────────────────

const EMOTION_CONFIG: Record<string, {
  faceColor: string;
  mouth: string;
  eyeClose: boolean;
  eyeWide: boolean;
  browLeft: string;
  browRight: string;
}> = {
  happy:    { faceColor: '#facc15', mouth: 'M 40 75 Q 60 92 80 75', eyeClose: false, eyeWide: false, browLeft: 'M 35 48 Q 45 44 55 48', browRight: 'M 65 48 Q 75 44 85 48' },
  excited:  { faceColor: '#fb923c', mouth: 'M 35 72 Q 60 98 85 72', eyeClose: false, eyeWide: true,  browLeft: 'M 33 44 Q 44 38 55 44', browRight: 'M 65 44 Q 76 38 87 44' },
  sad:      { faceColor: '#60a5fa', mouth: 'M 40 82 Q 60 68 80 82', eyeClose: false, eyeWide: false, browLeft: 'M 35 50 Q 45 46 55 52', browRight: 'M 65 52 Q 75 46 85 50' },
  angry:    { faceColor: '#f87171', mouth: 'M 40 82 Q 60 72 80 82', eyeClose: true,  eyeWide: false, browLeft: 'M 35 46 Q 45 52 55 48', browRight: 'M 65 48 Q 75 52 85 46' },
  surprised:{ faceColor: '#c084fc', mouth: 'M 52 72 Q 60 88 68 72', eyeClose: false, eyeWide: true,  browLeft: 'M 33 44 Q 44 38 55 44', browRight: 'M 65 44 Q 76 38 87 44' },
  afraid:   { faceColor: '#86efac', mouth: 'M 42 78 Q 60 90 78 78', eyeClose: false, eyeWide: true,  browLeft: 'M 35 52 Q 45 44 55 50', browRight: 'M 65 50 Q 75 44 85 52' },
  confused: { faceColor: '#67e8f9', mouth: 'M 40 76 Q 52 72 65 79', eyeClose: false, eyeWide: false, browLeft: 'M 35 50 Q 45 46 55 50', browRight: 'M 65 48 Q 75 44 83 50' },
  tired:    { faceColor: '#94a3b8', mouth: 'M 42 76 L 78 76',      eyeClose: true,  eyeWide: false, browLeft: 'M 35 52 Q 45 52 55 52', browRight: 'M 65 52 Q 75 52 85 52' },
  nervous:  { faceColor: '#fda4af', mouth: 'M 40 76 Q 50 70 60 78 Q 70 85 80 76', eyeClose: false, eyeWide: false, browLeft: 'M 35 52 Q 45 46 55 52', browRight: 'M 65 52 Q 75 46 85 52' },
  disgusted:{ faceColor: '#a3e635', mouth: 'M 38 82 Q 60 70 82 82', eyeClose: true, eyeWide: false, browLeft: 'M 35 46 Q 45 52 55 48', browRight: 'M 65 48 Q 75 52 85 46' },
  bored:    { faceColor: '#9ca3af', mouth: 'M 40 76 L 80 76',      eyeClose: true,  eyeWide: false, browLeft: 'M 35 52 Q 45 52 55 52', browRight: 'M 65 52 Q 75 52 85 52' },
};

function EmotionFaceCanvas({ data }: { data: EmotionData }) {
  const cfg = EMOTION_CONFIG[data.emotion] ?? EMOTION_CONFIG['happy'];
  const eyeRy = cfg.eyeWide ? 10 : cfg.eyeClose ? 3 : 7;
  return (
    <motion.div
      key={data.emotion}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, type: 'spring', stiffness: 160, damping: 14 }}
      className="flex flex-col items-center gap-3 p-6"
    >
      <svg viewBox="0 0 120 130" className="w-32 sm:w-44" aria-label={`Emotion: ${data.emotion}`}>
        {/* Face */}
        <circle cx="60" cy="60" r="52" fill={cfg.faceColor} />
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="2" />
        {/* Eyebrows */}
        <path d={cfg.browLeft}  fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="3.5" strokeLinecap="round" />
        <path d={cfg.browRight} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="3.5" strokeLinecap="round" />
        {/* Eyes */}
        <ellipse cx="44" cy="58" rx="7" ry={eyeRy} fill="rgba(0,0,0,0.75)" />
        <ellipse cx="76" cy="58" rx="7" ry={eyeRy} fill="rgba(0,0,0,0.75)" />
        {!cfg.eyeClose && !cfg.eyeWide && (
          <>
            <circle cx="46" cy="55" r="2" fill="white" />
            <circle cx="78" cy="55" r="2" fill="white" />
          </>
        )}
        {/* Mouth */}
        <path d={cfg.mouth} fill="none" stroke="rgba(0,0,0,0.7)" strokeWidth="4" strokeLinecap="round" />
      </svg>
      {data.label && (
        <span className="text-xl font-semibold tracking-wide">{data.label}</span>
      )}
    </motion.div>
  );
}

// ─── Weather Canvas ───────────────────────────────────────────────────────────

function WeatherIcon({ condition, size = 80 }: { condition: string; size?: number }) {
  const s = size;
  const c = s / 2;
  switch (condition) {
    case 'sunny': case 'hot': return (
      <svg viewBox="0 0 100 100" width={s} height={s} aria-hidden>
        <circle cx="50" cy="50" r="22" fill={condition === 'hot' ? '#ef4444' : '#facc15'} />
        {[0,45,90,135,180,225,270,315].map(a => {
          const r1 = 28, r2 = 42;
          const rad = (a * Math.PI) / 180;
          return <line key={a} x1={50+r1*Math.cos(rad)} y1={50+r1*Math.sin(rad)} x2={50+r2*Math.cos(rad)} y2={50+r2*Math.sin(rad)} stroke={condition === 'hot' ? '#ef4444' : '#facc15'} strokeWidth="4" strokeLinecap="round" />;
        })}
      </svg>
    );
    case 'cold': return (
      <svg viewBox="0 0 100 100" width={s} height={s} aria-hidden>
        <line x1="50" y1="12" x2="50" y2="88" stroke="#60a5fa" strokeWidth="6" strokeLinecap="round" />
        <line x1="12" y1="50" x2="88" y2="50" stroke="#60a5fa" strokeWidth="6" strokeLinecap="round" />
        <line x1="22" y1="22" x2="78" y2="78" stroke="#60a5fa" strokeWidth="6" strokeLinecap="round" />
        <line x1="78" y1="22" x2="22" y2="78" stroke="#60a5fa" strokeWidth="6" strokeLinecap="round" />
        {[[50,12],[50,88],[12,50],[88,50],[22,22],[78,78],[78,22],[22,78]].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="5" fill="#60a5fa" />
        ))}
      </svg>
    );
    case 'cloudy': return (
      <svg viewBox="0 0 100 100" width={s} height={s} aria-hidden>
        <ellipse cx="50" cy="58" rx="32" ry="20" fill="#94a3b8" />
        <circle cx="36" cy="54" r="16" fill="#94a3b8" />
        <circle cx="60" cy="50" r="20" fill="#94a3b8" />
      </svg>
    );
    case 'partly_cloudy': return (
      <svg viewBox="0 0 100 100" width={s} height={s} aria-hidden>
        <circle cx="38" cy="36" r="18" fill="#facc15" />
        {[0,60,120,180,240,300].map(a => { const rad=(a*Math.PI)/180; return <line key={a} x1={38+22*Math.cos(rad)} y1={36+22*Math.sin(rad)} x2={38+30*Math.cos(rad)} y2={36+30*Math.sin(rad)} stroke="#facc15" strokeWidth="3.5" strokeLinecap="round" />; })}
        <ellipse cx="60" cy="66" rx="28" ry="17" fill="#94a3b8" />
        <circle cx="46" cy="62" r="14" fill="#94a3b8" />
        <circle cx="68" cy="58" r="17" fill="#94a3b8" />
      </svg>
    );
    case 'rainy': return (
      <svg viewBox="0 0 100 100" width={s} height={s} aria-hidden>
        <ellipse cx="50" cy="44" rx="30" ry="18" fill="#64748b" />
        <circle cx="36" cy="40" r="14" fill="#64748b" />
        <circle cx="60" cy="36" r="18" fill="#64748b" />
        {[[34,68],[50,74],[66,68],[42,82],[58,82]].map(([x,y],i) => (
          <line key={i} x1={x} y1={y} x2={x-4} y2={y+10} stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" />
        ))}
      </svg>
    );
    case 'stormy': return (
      <svg viewBox="0 0 100 100" width={s} height={s} aria-hidden>
        <ellipse cx="50" cy="36" rx="30" ry="17" fill="#475569" />
        <circle cx="36" cy="32" r="13" fill="#475569" />
        <circle cx="60" cy="28" r="17" fill="#475569" />
        <path d="M 54 52 L 44 72 L 52 72 L 42 90 L 62 65 L 54 65 Z" fill="#facc15" />
      </svg>
    );
    case 'snowy': return (
      <svg viewBox="0 0 100 100" width={s} height={s} aria-hidden>
        <ellipse cx="50" cy="40" rx="30" ry="18" fill="#94a3b8" />
        <circle cx="36" cy="36" r="14" fill="#94a3b8" />
        <circle cx="60" cy="32" r="18" fill="#94a3b8" />
        {[[32,66],[50,72],[68,66],[40,82],[60,82]].map(([x,y],i) => (
          <text key={i} x={x} y={y} textAnchor="middle" fontSize="14" fill="#bfdbfe">❄</text>
        ))}
      </svg>
    );
    case 'windy': return (
      <svg viewBox="0 0 100 100" width={s} height={s} aria-hidden>
        {[[20,38,70,38],[15,52,80,52],[20,66,60,66]].map(([x1,y1,x2,y2],i) => (
          <path key={i} d={`M ${x1} ${y1} Q ${(x1+x2)/2} ${y1-10} ${x2} ${y1}`} fill="none" stroke="#60a5fa" strokeWidth="4.5" strokeLinecap="round" />
        ))}
      </svg>
    );
    case 'foggy': return (
      <svg viewBox="0 0 100 100" width={s} height={s} aria-hidden>
        {[30,44,58,72].map((y, i) => (
          <line key={i} x1={i%2===0?18:24} y1={y} x2={i%2===0?82:76} y2={y} stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
        ))}
      </svg>
    );
    default: return (
      <svg viewBox="0 0 100 100" width={s} height={s} aria-hidden>
        <circle cx="50" cy="50" r="40" fill="#e2e8f0" />
        <text x="50" y="56" textAnchor="middle" fontSize="30" fill="#64748b">?</text>
      </svg>
    );
  }
}

function WeatherCanvas({ data }: { data: WeatherData }) {
  const bgColors: Record<string, string> = {
    sunny: 'from-yellow-100 to-orange-50 dark:from-yellow-950 dark:to-orange-950',
    hot: 'from-red-100 to-orange-50 dark:from-red-950 dark:to-orange-950',
    cold: 'from-blue-100 to-cyan-50 dark:from-blue-950 dark:to-cyan-950',
    snowy: 'from-blue-50 to-slate-50 dark:from-blue-950 dark:to-slate-950',
    rainy: 'from-slate-100 to-blue-50 dark:from-slate-900 dark:to-blue-950',
    stormy: 'from-slate-200 to-slate-100 dark:from-slate-900 dark:to-slate-800',
    cloudy: 'from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800',
    partly_cloudy: 'from-sky-100 to-yellow-50 dark:from-sky-950 dark:to-yellow-950',
    windy: 'from-cyan-100 to-sky-50 dark:from-cyan-950 dark:to-sky-950',
    foggy: 'from-slate-100 to-gray-50 dark:from-slate-900 dark:to-gray-900',
  };
  const bg = bgColors[data.condition] ?? 'from-muted to-background';
  return (
    <motion.div
      key={data.condition}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className={`flex flex-col items-center gap-4 p-8 rounded-2xl bg-gradient-to-br ${bg}`}
    >
      <WeatherIcon condition={data.condition} size={100} />
      {data.label && (
        <span className="text-2xl font-semibold tracking-wide text-center">{data.label}</span>
      )}
      {data.celsius !== undefined && (
        <span className="text-lg font-mono text-muted-foreground">{data.celsius}°C</span>
      )}
    </motion.div>
  );
}

// ─── Body Diagram Canvas ──────────────────────────────────────────────────────

type SvgShape =
  | { k: 'circle'; cx: number; cy: number; r: number }
  | { k: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { k: 'path'; d: string };

interface BodyPartSpec {
  aliases: string[];
  shapes: SvgShape[];
  labelX: number; labelY: number;
}

const BODY_PARTS: Record<string, BodyPartSpec> = {
  head:         { aliases: ['cabeza','tête','Kopf','头','頭','rosto'],         shapes: [{ k:'circle', cx:100, cy:42, r:30 }],                                labelX:136, labelY:42 },
  hair:         { aliases: ['pelo','cabello','cheveux','Haar','头发'],          shapes: [{ k:'path', d:'M 72 36 Q 76 8 100 10 Q 124 8 128 36 Q 120 20 100 18 Q 80 20 72 36 Z' }], labelX:136, labelY:18 },
  face:         { aliases: ['cara','visage','Gesicht','脸'],                    shapes: [{ k:'circle', cx:100, cy:46, r:22 }],                                labelX:136, labelY:46 },
  left_eye:     { aliases: ['ojo izquierdo','left eye'],                       shapes: [{ k:'ellipse', cx:91, cy:38, rx:6, ry:5 }],                          labelX:136, labelY:38 },
  right_eye:    { aliases: ['ojo derecho','right eye'],                        shapes: [{ k:'ellipse', cx:109, cy:38, rx:6, ry:5 }],                         labelX:136, labelY:38 },
  eyes:         { aliases: ['ojos','yeux','Augen','眼睛','目'],                 shapes: [{ k:'ellipse', cx:91, cy:38, rx:6, ry:5 },{ k:'ellipse', cx:109, cy:38, rx:6, ry:5 }], labelX:136, labelY:38 },
  nose:         { aliases: ['nariz','nez','Nase','鼻子','鼻'],                  shapes: [{ k:'ellipse', cx:100, cy:47, rx:4, ry:5 }],                         labelX:136, labelY:47 },
  mouth:        { aliases: ['boca','bouche','Mund','嘴','口'],                  shapes: [{ k:'rect', x:90, y:55, w:20, h:8, rx:4 }],                         labelX:136, labelY:59 },
  ear:          { aliases: ['oreja','oreille','Ohr','耳'],                      shapes: [{ k:'ellipse', cx:69, cy:44, rx:5, ry:8 },{ k:'ellipse', cx:131, cy:44, rx:5, ry:8 }], labelX:136, labelY:44 },
  neck:         { aliases: ['cuello','cou','Hals','脖子','首'],                 shapes: [{ k:'rect', x:91, y:71, w:18, h:16, rx:4 }],                        labelX:136, labelY:79 },
  left_shoulder:{ aliases: ['hombro izquierdo'],                               shapes: [{ k:'ellipse', cx:63, cy:89, rx:18, ry:11 }],                        labelX:28, labelY:89 },
  right_shoulder:{ aliases:['hombro derecho'],                                 shapes: [{ k:'ellipse', cx:137, cy:89, rx:18, ry:11 }],                       labelX:136, labelY:89 },
  shoulders:    { aliases: ['hombros','épaules','Schultern','肩'],              shapes: [{ k:'ellipse', cx:63, cy:89, rx:18, ry:11 },{ k:'ellipse', cx:137, cy:89, rx:18, ry:11 }], labelX:136, labelY:89 },
  chest:        { aliases: ['pecho','poitrine','Brust','胸'],                   shapes: [{ k:'rect', x:73, y:87, w:54, h:68, rx:5 }],                        labelX:136, labelY:121 },
  torso:        { aliases: ['torso','tronc','Rumpf','躯干'],                    shapes: [{ k:'rect', x:73, y:87, w:54, h:68, rx:5 },{ k:'rect', x:73, y:152, w:54, h:40, rx:5 }], labelX:136, labelY:121 },
  abdomen:      { aliases: ['estómago','abdomen','ventre','Bauch','お腹','腹'], shapes: [{ k:'rect', x:73, y:152, w:54, h:40, rx:5 }],                       labelX:136, labelY:172 },
  left_arm:     { aliases: ['brazo izquierdo','left arm'],                     shapes: [{ k:'rect', x:45, y:87, w:30, h:60, rx:12 }],                       labelX:28, labelY:117 },
  right_arm:    { aliases: ['brazo derecho','right arm'],                      shapes: [{ k:'rect', x:125, y:87, w:30, h:60, rx:12 }],                      labelX:136, labelY:117 },
  arms:         { aliases: ['brazos','bras','Arme','腕','手腕'],                shapes: [{ k:'rect', x:45, y:87, w:30, h:60, rx:12 },{ k:'rect', x:125, y:87, w:30, h:60, rx:12 }], labelX:136, labelY:117 },
  left_elbow:   { aliases: ['codo izquierdo'],                                 shapes: [{ k:'circle', cx:60, cy:147, r:12 }],                                labelX:28, labelY:147 },
  right_elbow:  { aliases: ['codo derecho'],                                   shapes: [{ k:'circle', cx:140, cy:147, r:12 }],                               labelX:136, labelY:147 },
  elbow:        { aliases: ['codo','coude','Ellbogen','肘'],                    shapes: [{ k:'circle', cx:60, cy:147, r:12 },{ k:'circle', cx:140, cy:147, r:12 }], labelX:136, labelY:147 },
  left_forearm: { aliases: ['antebrazo izquierdo'],                            shapes: [{ k:'rect', x:46, y:157, w:26, h:55, rx:10 }],                      labelX:28, labelY:184 },
  right_forearm:{ aliases: ['antebrazo derecho'],                              shapes: [{ k:'rect', x:128, y:157, w:26, h:55, rx:10 }],                     labelX:136, labelY:184 },
  left_hand:    { aliases: ['mano izquierda'],                                 shapes: [{ k:'rect', x:42, y:210, w:32, h:34, rx:10 }],                      labelX:28, labelY:227 },
  right_hand:   { aliases: ['mano derecha'],                                   shapes: [{ k:'rect', x:126, y:210, w:32, h:34, rx:10 }],                     labelX:136, labelY:227 },
  hands:        { aliases: ['manos','mains','Hände','手'],                      shapes: [{ k:'rect', x:42, y:210, w:32, h:34, rx:10 },{ k:'rect', x:126, y:210, w:32, h:34, rx:10 }], labelX:136, labelY:227 },
  hips:         { aliases: ['cadera','hanches','Hüfte','腰'],                   shapes: [{ k:'rect', x:67, y:190, w:66, h:32, rx:5 }],                       labelX:136, labelY:206 },
  left_leg:     { aliases: ['pierna izquierda'],                               shapes: [{ k:'rect', x:68, y:220, w:34, h:80, rx:12 },{k:'circle',cx:85,cy:300,r:12},{k:'rect',x:70,y:310,w:30,h:65,rx:10}], labelX:28, labelY:280 },
  right_leg:    { aliases: ['pierna derecha'],                                 shapes: [{ k:'rect', x:98, y:220, w:34, h:80, rx:12 },{k:'circle',cx:115,cy:300,r:12},{k:'rect',x:100,y:310,w:30,h:65,rx:10}], labelX:136, labelY:280 },
  legs:         { aliases: ['piernas','jambes','Beine','足','脚'],              shapes: [{ k:'rect', x:68, y:220, w:34, h:80, rx:12 },{k:'circle',cx:85,cy:300,r:12},{k:'rect',x:70,y:310,w:30,h:65,rx:10},{k:'rect',x:98,y:220,w:34,h:80,rx:12},{k:'circle',cx:115,cy:300,r:12},{k:'rect',x:100,y:310,w:30,h:65,rx:10}], labelX:136, labelY:280 },
  left_knee:    { aliases: ['rodilla izquierda'],                              shapes: [{ k:'circle', cx:85, cy:300, r:12 }],                                labelX:28, labelY:300 },
  right_knee:   { aliases: ['rodilla derecha'],                                shapes: [{ k:'circle', cx:115, cy:300, r:12 }],                               labelX:136, labelY:300 },
  knee:         { aliases: ['rodilla','genou','Knie','膝'],                     shapes: [{ k:'circle', cx:85, cy:300, r:12 },{ k:'circle', cx:115, cy:300, r:12 }], labelX:136, labelY:300 },
  left_foot:    { aliases: ['pie izquierdo'],                                  shapes: [{ k:'ellipse', cx:82, cy:384, rx:26, ry:12 }],                       labelX:28, labelY:390 },
  right_foot:   { aliases: ['pie derecho'],                                    shapes: [{ k:'ellipse', cx:118, cy:384, rx:26, ry:12 }],                      labelX:136, labelY:390 },
  feet:         { aliases: ['pies','pieds','Füße','足の裏','脚'],               shapes: [{ k:'ellipse', cx:82, cy:384, rx:26, ry:12 },{ k:'ellipse', cx:118, cy:384, rx:26, ry:12 }], labelX:136, labelY:390 },
  back:         { aliases: ['espalda','dos','Rücken','背中','背'],              shapes: [{ k:'rect', x:73, y:87, w:54, h:100, rx:5 }],                       labelX:136, labelY:137 },
};

function resolveBodyParts(parts: string[]): Set<string> {
  const resolved = new Set<string>();
  const lc = parts.map(p => p.toLowerCase());
  for (const [key, spec] of Object.entries(BODY_PARTS)) {
    for (const input of lc) {
      if (input === key || spec.aliases.some(a => a.toLowerCase() === input)) {
        resolved.add(key);
        break;
      }
    }
  }
  if (resolved.size === 0) parts.forEach(p => resolved.add(p.toLowerCase()));
  return resolved;
}

function renderShape(shape: SvgShape, fill: string, stroke: string) {
  switch (shape.k) {
    case 'circle':  return <circle cx={shape.cx} cy={shape.cy} r={shape.r} fill={fill} stroke={stroke} strokeWidth="1.5" />;
    case 'ellipse': return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={fill} stroke={stroke} strokeWidth="1.5" />;
    case 'rect':    return <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.rx ?? 0} fill={fill} stroke={stroke} strokeWidth="1.5" />;
    case 'path':    return <path d={shape.d} fill={fill} stroke={stroke} strokeWidth="1.5" />;
  }
}

function BodyDiagramCanvas({ data }: { data: BodyDiagramData }) {
  const highlighted = resolveBodyParts(data.highlightParts);
  const baseFill = 'hsl(var(--muted))';
  const baseStroke = 'hsl(var(--border))';
  const hlFill = 'hsl(var(--primary) / 0.85)';
  const hlStroke = 'hsl(var(--primary))';
  const labelParts = Array.from(highlighted).map(key => ({
    key,
    label: (data.labels?.[key]) ?? key.replace(/_/g, ' '),
  }));
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center gap-2 p-4"
    >
      <svg viewBox="0 0 200 400" className="w-28 sm:w-36" aria-label="Body diagram">
        {Object.entries(BODY_PARTS).map(([key, spec]) => {
          const isHighlighted = highlighted.has(key);
          const fill = isHighlighted ? hlFill : baseFill;
          const stroke = isHighlighted ? hlStroke : baseStroke;
          return (
            <g key={key}>
              {spec.shapes.map((shape, i) => (
                <g key={i}>
                  {renderShape(shape, fill, stroke)}
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      {labelParts.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 mt-1 max-w-48">
          {labelParts.map(({ key, label }) => (
            <motion.span
              key={key}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
            >
              {label}
            </motion.span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── World Map Canvas ─────────────────────────────────────────────────────────

interface CountryDef { x: number; y: number; name: string; short: string }
const WORLD_COUNTRIES: Record<string, CountryDef> = {
  spain:               { x:222, y:46,  name:'España',           short:'ES' },
  mexico:              { x:58,  y:102, name:'México',           short:'MX' },
  guatemala:           { x:67,  y:122, name:'Guatemala',        short:'GT' },
  honduras:            { x:77,  y:131, name:'Honduras',         short:'HN' },
  el_salvador:         { x:65,  y:140, name:'El Salvador',      short:'SV' },
  nicaragua:           { x:74,  y:150, name:'Nicaragua',        short:'NI' },
  costa_rica:          { x:74,  y:161, name:'Costa Rica',       short:'CR' },
  panama:              { x:82,  y:172, name:'Panamá',           short:'PA' },
  cuba:                { x:118, y:103, name:'Cuba',             short:'CU' },
  dominican_republic:  { x:140, y:112, name:'Rep. Dom.',        short:'DO' },
  puerto_rico:         { x:158, y:116, name:'Puerto Rico',      short:'PR' },
  colombia:            { x:98,  y:186, name:'Colombia',         short:'CO' },
  venezuela:           { x:127, y:175, name:'Venezuela',        short:'VE' },
  ecuador:             { x:84,  y:204, name:'Ecuador',          short:'EC' },
  peru:                { x:90,  y:222, name:'Perú',             short:'PE' },
  bolivia:             { x:112, y:242, name:'Bolivia',          short:'BO' },
  chile:               { x:94,  y:278, name:'Chile',            short:'CL' },
  argentina:           { x:116, y:312, name:'Argentina',        short:'AR' },
  uruguay:             { x:136, y:314, name:'Uruguay',          short:'UY' },
  paraguay:            { x:125, y:268, name:'Paraguay',         short:'PY' },
  equatorial_guinea:   { x:206, y:176, name:'Guinea Ec.',       short:'GQ' },
  philippines:         { x:272, y:104, name:'Filipinas',        short:'PH' },
  western_sahara:      { x:210, y:88,  name:'Sáhara Occidental',short:'EH' },
};

function WorldMapCanvas({ data }: { data: WorldMapData }) {
  const hlSlugs = new Set(data.highlightCountries.map(s => s.toLowerCase().replace(/ /g,'_').replace(/-/g,'_')));
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center gap-3 p-4 w-full"
    >
      <svg viewBox="0 0 310 370" className="w-full max-w-sm" aria-label="Spanish-speaking countries map">
        {/* Ocean background */}
        <rect x="0" y="0" width="310" height="370" fill="hsl(var(--primary) / 0.06)" rx="8" />
        {/* Simplified continent silhouettes */}
        {/* North + Central America */}
        <path d="M 18 55 L 55 38 L 95 30 L 140 40 L 148 58 L 134 72 L 104 82 L 84 95 L 92 110 L 100 130 L 92 175 L 82 178 L 74 162 L 60 150 L 50 118 L 36 92 Z" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="0.8" />
        {/* Caribbean (rough outline) */}
        <ellipse cx="118" cy="103" rx="8" ry="4" fill="hsl(var(--muted))" />
        <ellipse cx="140" cy="112" rx="5" ry="3" fill="hsl(var(--muted))" />
        {/* South America */}
        <path d="M 86 182 L 144 172 L 168 200 L 175 255 L 165 320 L 148 348 L 122 350 L 98 328 L 76 280 L 76 234 L 84 200 Z" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="0.8" />
        {/* Europe (Spain area) */}
        <rect x="200" y="34" width="36" height="24" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="0.8" />
        {/* Africa (for Equatorial Guinea) */}
        <rect x="190" y="162" width="40" height="36" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="0.8" />
        {/* Philippines */}
        <rect x="260" y="90" width="24" height="28" rx="4" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="0.8" />

        {/* Country dots */}
        {Object.entries(WORLD_COUNTRIES).map(([slug, c]) => {
          const isHl = hlSlugs.has(slug);
          const label = (data.labels?.[slug]) ?? (isHl ? c.name : c.short);
          return (
            <motion.g key={slug} initial={isHl ? { scale: 0.5 } : { scale: 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}>
              <circle cx={c.x} cy={c.y} r={isHl ? 8 : 5}
                fill={isHl ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.35)'}
                stroke={isHl ? 'hsl(var(--primary-foreground) / 0.6)' : 'none'}
                strokeWidth="1.5"
              />
              {isHl && (
                <>
                  <rect x={c.x + 11} y={c.y - 8} width={label.length * 5.5 + 6} height="14" rx="3"
                    fill="hsl(var(--primary))" />
                  <text x={c.x + 14} y={c.y + 2} fontSize="8" fill="hsl(var(--primary-foreground))"
                    fontFamily="system-ui,sans-serif" fontWeight="600">{label}</text>
                </>
              )}
              {!isHl && (
                <text x={c.x} y={c.y + 16} textAnchor="middle" fontSize="6"
                  fill="hsl(var(--muted-foreground) / 0.7)" fontFamily="system-ui,sans-serif">{c.short}</text>
              )}
            </motion.g>
          );
        })}
      </svg>
      {hlSlugs.size > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {Array.from(hlSlugs).map(slug => {
            const c = WORLD_COUNTRIES[slug];
            if (!c) return null;
            const label = data.labels?.[slug] ?? c.name;
            return (
              <span key={slug} className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {label}
              </span>
            );
          })}
        </div>
      )}
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
  const hasBody = Boolean(data.bodyDiagram);
  const hasThermometer = Boolean(data.thermometerData);
  const hasEmotion = Boolean(data.emotionData);
  const hasWeather = Boolean(data.weatherData);
  const hasWorldMap = Boolean(data.worldMapData);

  // ── Standalone grammar/visual canvas modes (no spatial scene active) ─────────
  // Priority: body > world map > conjugation > calendar > thermometer > emotion > weather > clock
  if (!hasBackground && !hasProps) {
    if (hasBody) return <div data-testid={testId} className="w-full min-h-32"><BodyDiagramCanvas data={data.bodyDiagram!} /></div>;
    if (hasWorldMap) return <div data-testid={testId} className="w-full"><WorldMapCanvas data={data.worldMapData!} /></div>;
    if (hasConjugation) return <div data-testid={testId} className="w-full min-h-32"><ConjugationTableCanvas table={data.conjugationTable!} /></div>;
    if (hasCalendar) return <div data-testid={testId} className="w-full min-h-32"><CalendarCanvas cal={data.calendarData!} /></div>;
    if (hasThermometer) return <div data-testid={testId} className="flex justify-center"><ThermometerCanvas data={data.thermometerData!} /></div>;
    if (hasEmotion) return <div data-testid={testId} className="flex justify-center"><EmotionFaceCanvas data={data.emotionData!} /></div>;
    if (hasWeather) return <div data-testid={testId} className="flex justify-center p-4"><WeatherCanvas data={data.weatherData!} /></div>;
    if (hasClock) return <div data-testid={testId} className="flex justify-center"><ClockOnlyCanvas time={data.clockTime!} /></div>;
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

      {/* Phase 2 overlays on top of spatial scene (right side panel) */}
      {(hasConjugation || hasCalendar || hasBody || hasWorldMap || hasThermometer || hasEmotion || hasWeather) && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute right-2 top-2 bottom-2 w-44 sm:w-52 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg overflow-auto"
        >
          {hasConjugation && <ConjugationTableCanvas table={data.conjugationTable!} />}
          {hasCalendar && <CalendarCanvas cal={data.calendarData!} />}
          {hasBody && <BodyDiagramCanvas data={data.bodyDiagram!} />}
          {hasWorldMap && <WorldMapCanvas data={data.worldMapData!} />}
          {hasThermometer && <ThermometerCanvas data={data.thermometerData!} />}
          {hasEmotion && <EmotionFaceCanvas data={data.emotionData!} />}
          {hasWeather && <WeatherCanvas data={data.weatherData!} />}
        </motion.div>
      )}
    </div>
  );
}
