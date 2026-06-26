/**
 * Broadcast Data Service
 *
 * Fetches real-world data (weather, headlines) for target-language cities
 * and builds an ACTFL-scaled broadcast brief that Daniela delivers as a
 * weather anchor, travel host, or news reader at session open.
 *
 * Weather: open-meteo.com — free, no API key required, WMO weather codes.
 * News: Perplexity citation service (optional, graceful fallback).
 *
 * Architecture: brief is stored in a process-level cache keyed by userId.
 * The WS handler checks and consumes it at GL session start, injecting it
 * as a directive into the system prompt before Daniela opens her mouth.
 */

const BROADCAST_BRIEF_TTL_MS = 5 * 60 * 1000; // 5-minute freshness window

const _broadcastBriefCache = new Map<string, { brief: string; generatedAt: number }>();

export function setBroadcastBrief(userId: string, brief: string): void {
  _broadcastBriefCache.set(String(userId), { brief, generatedAt: Date.now() });
}

export function consumeBroadcastBrief(userId: string): string | null {
  const entry = _broadcastBriefCache.get(String(userId));
  if (!entry) return null;
  _broadcastBriefCache.delete(String(userId)); // one-shot
  if (Date.now() - entry.generatedAt > BROADCAST_BRIEF_TTL_MS) return null;
  return entry.brief;
}

// ── Language → representative city ─────────────────────────────────────────

interface CityInfo {
  name: string;
  country: string;
  countryNative: string; // country name in the target language
  channel: string;       // fictional local channel name for flavor
  lat: number;
  lon: number;
  timezone: string;
  tempUnit: 'C' | 'F';
}

const LANGUAGE_CITIES: Record<string, CityInfo> = {
  spanish: {
    name: 'Madrid', country: 'Spain', countryNative: 'España',
    channel: 'Canal 8 Madrid',
    lat: 40.4168, lon: -3.7038, timezone: 'Europe/Madrid', tempUnit: 'C',
  },
  french: {
    name: 'Paris', country: 'France', countryNative: 'France',
    channel: 'France Info Météo',
    lat: 48.8566, lon: 2.3522, timezone: 'Europe/Paris', tempUnit: 'C',
  },
  german: {
    name: 'Berlin', country: 'Germany', countryNative: 'Deutschland',
    channel: 'ARD Wetterbericht',
    lat: 52.5200, lon: 13.4050, timezone: 'Europe/Berlin', tempUnit: 'C',
  },
  italian: {
    name: 'Rome', country: 'Italy', countryNative: 'Italia',
    channel: 'RAI Meteo',
    lat: 41.9028, lon: 12.4964, timezone: 'Europe/Rome', tempUnit: 'C',
  },
  portuguese: {
    name: 'Lisbon', country: 'Portugal', countryNative: 'Portugal',
    channel: 'RTP Meteorologia',
    lat: 38.7169, lon: -9.1399, timezone: 'Europe/Lisbon', tempUnit: 'C',
  },
  japanese: {
    name: 'Tokyo', country: 'Japan', countryNative: '日本',
    channel: 'NHK 天気予報',
    lat: 35.6762, lon: 139.6503, timezone: 'Asia/Tokyo', tempUnit: 'C',
  },
  korean: {
    name: 'Seoul', country: 'South Korea', countryNative: '대한민국',
    channel: 'KBS 날씨',
    lat: 37.5665, lon: 126.9780, timezone: 'Asia/Seoul', tempUnit: 'C',
  },
  mandarin: {
    name: 'Taipei', country: 'Taiwan', countryNative: '台灣',
    channel: '公視氣象',
    lat: 25.0330, lon: 121.5654, timezone: 'Asia/Taipei', tempUnit: 'C',
  },
  hebrew: {
    name: 'Tel Aviv', country: 'Israel', countryNative: 'ישראל',
    channel: 'ערוץ 12 מזג אוויר',
    lat: 32.0853, lon: 34.7818, timezone: 'Asia/Jerusalem', tempUnit: 'C',
  },
  arabic: {
    name: 'Cairo', country: 'Egypt', countryNative: 'مصر',
    channel: 'قناة النيل للأخبار',
    lat: 30.0444, lon: 31.2357, timezone: 'Africa/Cairo', tempUnit: 'C',
  },
  english: {
    name: 'London', country: 'United Kingdom', countryNative: 'United Kingdom',
    channel: 'BBC Weather',
    lat: 51.5074, lon: -0.1278, timezone: 'Europe/London', tempUnit: 'C',
  },
};

// ── WMO weather code → English description + target-language hint ───────────

function describeWeatherCode(code: number): { short: string; detail: string } {
  if (code === 0) return { short: 'clear skies', detail: 'Beautiful clear skies today — excellent visibility.' };
  if (code <= 3) return { short: 'partly cloudy', detail: 'Some clouds moving through, but mostly pleasant.' };
  if (code <= 48) return { short: 'foggy', detail: 'Dense fog advisory in effect — reduced visibility this morning.' };
  if (code <= 55) return { short: 'light drizzle', detail: 'Light drizzle expected throughout the day. Keep an umbrella handy.' };
  if (code <= 65) return { short: 'rain', detail: 'Rain showers are in the forecast. A waterproof jacket is recommended.' };
  if (code <= 75) return { short: 'snow', detail: 'Snowfall expected. Roads may be affected — drive carefully.' };
  if (code <= 82) return { short: 'rain showers', detail: 'Scattered rain showers, clearing later in the day.' };
  if (code <= 86) return { short: 'snow showers', detail: 'Snow showers possible, particularly at higher elevations.' };
  if (code >= 95) return { short: 'thunderstorms', detail: 'Thunderstorms are likely. Stay indoors if possible.' };
  return { short: 'mixed conditions', detail: 'Variable conditions expected throughout the day.' };
}

// ── open-meteo fetch ────────────────────────────────────────────────────────

interface WeatherData {
  tempC: number;
  weatherCode: number;
  windKmh: number;
  city: CityInfo;
}

async function fetchWeather(language: string): Promise<WeatherData | null> {
  const city = LANGUAGE_CITIES[language.toLowerCase()] ?? LANGUAGE_CITIES['spanish'];
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=kmh&temperature_unit=celsius&timezone=${encodeURIComponent(city.timezone)}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      console.warn(`[BroadcastData] open-meteo returned ${res.status} for ${city.name}`);
      return null;
    }
    const json = await res.json() as any;
    const current = json.current;
    if (!current) return null;
    return {
      tempC: Math.round(current.temperature_2m ?? 0),
      weatherCode: current.weather_code ?? 0,
      windKmh: Math.round(current.wind_speed_10m ?? 0),
      city,
    };
  } catch (err: any) {
    console.warn(`[BroadcastData] Weather fetch failed (non-fatal):`, err?.message ?? err);
    return null;
  }
}

// ── ACTFL-aware brief builder ───────────────────────────────────────────────

export type BroadcastType = 'weather' | 'news' | 'travel';

function actflTier(level: string | null | undefined): 'novice' | 'intermediate' | 'advanced' {
  const l = (level ?? '').toLowerCase();
  if (l.startsWith('advanced') || l.startsWith('superior')) return 'advanced';
  if (l.startsWith('intermediate')) return 'intermediate';
  return 'novice';
}

function buildDeliveryInstruction(tier: 'novice' | 'intermediate' | 'advanced', broadcastType: BroadcastType): string {
  const base = `Open this session as a ${broadcastType === 'weather' ? 'television weather anchor' : broadcastType === 'travel' ? 'travel documentary host' : 'news anchor'} delivering a live broadcast.`;

  const scaling: Record<string, string> = {
    novice: `Use only the most essential words from the brief — 2 to 3 short sentences maximum. No complex vocabulary. Speak slowly and clearly. After the broadcast, naturally transition into the tutoring session by asking if the student understood a key word.`,
    intermediate: `Deliver a complete 4–6 sentence broadcast segment using the full data in the brief. Use natural broadcast phrasing. Include at least one moment where you model a useful phrase for the student. Then invite them to respond.`,
    advanced: `Deliver a full 6–10 sentence broadcast at authentic anchor register. Include probability language, conditions, and a smooth sign-off. Use regional expressions if appropriate. Do not simplify. After the broadcast, engage the student in a spontaneous discussion about what they heard.`,
  };

  return `${base} ${scaling[tier]}`;
}

/**
 * Builds the complete broadcast brief for injection into Daniela's system prompt.
 * The brief is marked [BROADCAST BRIEF] so it reads as context she already has,
 * not as an instruction handed to her — per the prompt style guide.
 */
export async function buildBroadcastBrief(
  language: string,
  actflLevel: string | null | undefined,
  broadcastType: BroadcastType = 'weather',
): Promise<{ brief: string; preview: BroadcastPreview } | null> {
  const weather = await fetchWeather(language);
  if (!weather) {
    console.warn(`[BroadcastData] Could not fetch weather for ${language} — broadcast brief skipped`);
    return null;
  }

  const { tempC, weatherCode, windKmh, city } = weather;
  const { short: condShort, detail: condDetail } = describeWeatherCode(weatherCode);
  const tier = actflTier(actflLevel);
  const deliveryInstruction = buildDeliveryInstruction(tier, broadcastType);

  // Day-of-week for the broadcast greeting
  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: city.timezone });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: city.timezone, hour12: true });

  const brief = `[BROADCAST BRIEF]
Channel: ${city.channel}
Location: ${city.name}, ${city.country}
Day/Time: ${dayName}, ${timeStr} local
Conditions: ${condShort}, ${tempC}°C (${Math.round(tempC * 9 / 5 + 32)}°F), wind ${windKmh} km/h
Detail: ${condDetail}
Student ACTFL level: ${actflLevel ?? 'Novice Mid'}
Delivery: ${deliveryInstruction}
[END BROADCAST BRIEF]`;

  const preview: BroadcastPreview = {
    city: city.name,
    country: city.country,
    channel: city.channel,
    condition: condShort,
    tempC,
    tempF: Math.round(tempC * 9 / 5 + 32),
    windKmh,
    day: dayName,
    time: timeStr,
    tier,
    broadcastType,
  };

  console.log(`[BroadcastData] Brief built — ${city.name} ${tempC}°C ${condShort} (ACTFL ${actflLevel ?? '?'} → ${tier} tier)`);
  return { brief, preview };
}

export interface BroadcastPreview {
  city: string;
  country: string;
  channel: string;
  condition: string;
  tempC: number;
  tempF: number;
  windKmh: number;
  day: string;
  time: string;
  tier: 'novice' | 'intermediate' | 'advanced';
  broadcastType: BroadcastType;
}
