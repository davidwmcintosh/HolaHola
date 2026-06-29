/**
 * Broadcast Data Service
 *
 * Provides real-world data (weather, sports, news) for Daniela to deliver
 * as a television anchor mid-conversation — no button required. Daniela calls
 * get_broadcast_data whenever the lesson context calls for it (weather vocab,
 * narrative practice, news comprehension, etc.).
 *
 * Weather: open-meteo.com — free, no API key, WMO weather codes.
 * Sports / News: Perplexity sonar-pro — real headlines via web search.
 *
 * Architecture:
 *   - fetchBroadcastDataForTool() → called from native-fc-handlers GET_BROADCAST_DATA
 *   - Returns a formatted string Daniela uses to compose her broadcast
 *   - City rotates daily per language — deterministic but varied
 *
 * Pre-session brief cache (legacy from initial design — kept for future
 * lesson-based auto-injection):
 *   - setBroadcastBrief / consumeBroadcastBrief — one-shot, 5-min TTL
 */

const BROADCAST_BRIEF_TTL_MS = 5 * 60 * 1000;
const _briefCache = new Map<string, { brief: string; generatedAt: number }>();

// ── Weather cache — 30-min TTL per city (lat+lon key) ───────────────────────
// open-meteo and wttr.in are both keyless/IP-limited services shared across
// all Replit projects on the same server. Caching per city for 30 minutes
// dramatically reduces daily call count: same city, multiple students → 1 hit.
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;
const _weatherCache = new Map<string, { reading: WeatherReading; fetchedAt: number }>();

function weatherCacheKey(city: CityInfo): string {
  return `${city.lat.toFixed(3)},${city.lon.toFixed(3)}`;
}

function getCachedWeather(city: CityInfo): WeatherReading | null {
  const entry = _weatherCache.get(weatherCacheKey(city));
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > WEATHER_CACHE_TTL_MS) {
    _weatherCache.delete(weatherCacheKey(city));
    return null;
  }
  return entry.reading;
}

function setCachedWeather(city: CityInfo, reading: WeatherReading): void {
  _weatherCache.set(weatherCacheKey(city), { reading, fetchedAt: Date.now() });
}

export function setBroadcastBrief(userId: string, brief: string): void {
  _briefCache.set(String(userId), { brief, generatedAt: Date.now() });
}

export function consumeBroadcastBrief(userId: string): string | null {
  const entry = _briefCache.get(String(userId));
  if (!entry) return null;
  _briefCache.delete(String(userId));
  if (Date.now() - entry.generatedAt > BROADCAST_BRIEF_TTL_MS) return null;
  return entry.brief;
}

// ── Language → pool of cities (rotate by day-of-year) ──────────────────────

interface CityInfo {
  name: string;
  country: string;
  channel: string;
  lat: number;
  lon: number;
  timezone: string;
  regionLabel?: string; // e.g. "Chicagoland", "Costa del Sol"
}

type CityPool = CityInfo[];

const LANGUAGE_CITY_POOLS: Record<string, CityPool> = {
  english: [
    { name: 'Chicago', country: 'United States', channel: 'WGN Weather Center', lat: 41.8781, lon: -87.6298, timezone: 'America/Chicago', regionLabel: 'Chicagoland' },
    { name: 'Anchorage', country: 'United States', channel: 'KTUU News', lat: 61.2181, lon: -149.9003, timezone: 'America/Anchorage', regionLabel: 'South-Central Alaska' },
    { name: 'Miami', country: 'United States', channel: 'CBS Miami', lat: 25.7617, lon: -80.1918, timezone: 'America/New_York', regionLabel: 'South Florida' },
    { name: 'New York', country: 'United States', channel: 'NY1 Weather', lat: 40.7128, lon: -74.0060, timezone: 'America/New_York', regionLabel: 'Tri-State Area' },
    { name: 'Seattle', country: 'United States', channel: 'KOMO 4 News', lat: 47.6062, lon: -122.3321, timezone: 'America/Los_Angeles', regionLabel: 'Puget Sound' },
    { name: 'Denver', country: 'United States', channel: 'KMGH Denver 7', lat: 39.7392, lon: -104.9903, timezone: 'America/Denver', regionLabel: 'Front Range' },
  ],
  spanish: [
    { name: 'Madrid', country: 'Spain', channel: 'Canal 8 Noticias', lat: 40.4168, lon: -3.7038, timezone: 'Europe/Madrid' },
    { name: 'Barcelona', country: 'Spain', channel: 'TV3 Meteorología', lat: 41.3851, lon: 2.1734, timezone: 'Europe/Madrid', regionLabel: 'Costa Brava' },
    { name: 'Seville', country: 'Spain', channel: 'Canal Sur', lat: 37.3891, lon: -5.9845, timezone: 'Europe/Madrid', regionLabel: 'Andalucía' },
    { name: 'Buenos Aires', country: 'Argentina', channel: 'Canal 13 Argentina', lat: -34.6037, lon: -58.3816, timezone: 'America/Argentina/Buenos_Aires' },
    { name: 'Mexico City', country: 'Mexico', channel: 'Televisa Noticias', lat: 19.4326, lon: -99.1332, timezone: 'America/Mexico_City' },
    { name: 'Bogotá', country: 'Colombia', channel: 'RCN Clima', lat: 4.7110, lon: -74.0721, timezone: 'America/Bogota' },
  ],
  french: [
    { name: 'Paris', country: 'France', channel: 'France Info Météo', lat: 48.8566, lon: 2.3522, timezone: 'Europe/Paris' },
    { name: 'Lyon', country: 'France', channel: 'BFM Lyon', lat: 45.7640, lon: 4.8357, timezone: 'Europe/Paris', regionLabel: 'Auvergne-Rhône-Alpes' },
    { name: 'Nice', country: 'France', channel: 'France Bleu Côte d\'Azur', lat: 43.7102, lon: 7.2620, timezone: 'Europe/Paris', regionLabel: 'Côte d\'Azur' },
    { name: 'Bordeaux', country: 'France', channel: 'France 3 Nouvelle-Aquitaine', lat: 44.8378, lon: -0.5792, timezone: 'Europe/Paris', regionLabel: 'Gironde' },
    { name: 'Montreal', country: 'Canada', channel: 'TVA Nouvelles Météo', lat: 45.5017, lon: -73.5673, timezone: 'America/Toronto' },
  ],
  german: [
    { name: 'Berlin', country: 'Germany', channel: 'ARD Wetterbericht', lat: 52.5200, lon: 13.4050, timezone: 'Europe/Berlin' },
    { name: 'Hamburg', country: 'Germany', channel: 'NDR Wetter', lat: 53.5511, lon: 9.9937, timezone: 'Europe/Berlin', regionLabel: 'Hansestadt' },
    { name: 'Munich', country: 'Germany', channel: 'BR Wetter', lat: 48.1351, lon: 11.5820, timezone: 'Europe/Berlin', regionLabel: 'Bayern' },
    { name: 'Frankfurt', country: 'Germany', channel: 'Hessenschau Wetter', lat: 50.1109, lon: 8.6821, timezone: 'Europe/Berlin', regionLabel: 'Rhein-Main' },
    { name: 'Cologne', country: 'Germany', channel: 'WDR Wetter', lat: 50.9333, lon: 6.9500, timezone: 'Europe/Berlin', regionLabel: 'Nordrhein-Westfalen' },
  ],
  italian: [
    { name: 'Rome', country: 'Italy', channel: 'RAI Meteo', lat: 41.9028, lon: 12.4964, timezone: 'Europe/Rome' },
    { name: 'Milan', country: 'Italy', channel: 'Mediaset TG5 Meteo', lat: 45.4642, lon: 9.1900, timezone: 'Europe/Rome', regionLabel: 'Lombardia' },
    { name: 'Venice', country: 'Italy', channel: 'TeleNordest Meteo', lat: 45.4408, lon: 12.3155, timezone: 'Europe/Rome', regionLabel: 'Veneto' },
    { name: 'Naples', country: 'Italy', channel: 'Canale 21 Meteo', lat: 40.8518, lon: 14.2681, timezone: 'Europe/Rome', regionLabel: 'Campania' },
    { name: 'Florence', country: 'Italy', channel: 'ToscanaTV Meteo', lat: 43.7696, lon: 11.2558, timezone: 'Europe/Rome', regionLabel: 'Toscana' },
  ],
  portuguese: [
    { name: 'Lisbon', country: 'Portugal', channel: 'RTP Meteorologia', lat: 38.7169, lon: -9.1399, timezone: 'Europe/Lisbon' },
    { name: 'Porto', country: 'Portugal', channel: 'Porto Canal Tempo', lat: 41.1579, lon: -8.6291, timezone: 'Europe/Lisbon', regionLabel: 'Norte de Portugal' },
    { name: 'São Paulo', country: 'Brazil', channel: 'Globo Tempo', lat: -23.5505, lon: -46.6333, timezone: 'America/Sao_Paulo' },
    { name: 'Rio de Janeiro', country: 'Brazil', channel: 'Band Tempo Rio', lat: -22.9068, lon: -43.1729, timezone: 'America/Sao_Paulo' },
  ],
  japanese: [
    { name: 'Tokyo', country: 'Japan', channel: 'NHK 天気予報', lat: 35.6762, lon: 139.6503, timezone: 'Asia/Tokyo' },
    { name: 'Osaka', country: 'Japan', channel: 'MBS 天気予報', lat: 34.6937, lon: 135.5023, timezone: 'Asia/Tokyo', regionLabel: '近畿地方' },
    { name: 'Sapporo', country: 'Japan', channel: 'HTB 天気', lat: 43.0618, lon: 141.3545, timezone: 'Asia/Tokyo', regionLabel: '北海道' },
    { name: 'Fukuoka', country: 'Japan', channel: 'RKB 天気', lat: 33.5904, lon: 130.4017, timezone: 'Asia/Tokyo', regionLabel: '九州北部' },
  ],
  korean: [
    { name: 'Seoul', country: 'South Korea', channel: 'KBS 날씨', lat: 37.5665, lon: 126.9780, timezone: 'Asia/Seoul' },
    { name: 'Busan', country: 'South Korea', channel: 'KNN 날씨', lat: 35.1796, lon: 129.0756, timezone: 'Asia/Seoul', regionLabel: '경남' },
    { name: 'Jeju', country: 'South Korea', channel: 'JIBS 날씨', lat: 33.4996, lon: 126.5312, timezone: 'Asia/Seoul', regionLabel: '제주도' },
  ],
  mandarin: [
    { name: 'Taipei', country: 'Taiwan', channel: '公視氣象', lat: 25.0330, lon: 121.5654, timezone: 'Asia/Taipei' },
    { name: 'Kaohsiung', country: 'Taiwan', channel: '台視氣象', lat: 22.6273, lon: 120.3014, timezone: 'Asia/Taipei', regionLabel: '南台灣' },
    { name: 'Hong Kong', country: 'Hong Kong', channel: 'TVB 天氣預報', lat: 22.3193, lon: 114.1694, timezone: 'Asia/Hong_Kong' },
  ],
  hebrew: [
    { name: 'Tel Aviv', country: 'Israel', channel: 'ערוץ 12 מזג אוויר', lat: 32.0853, lon: 34.7818, timezone: 'Asia/Jerusalem' },
    { name: 'Jerusalem', country: 'Israel', channel: 'כאן 11 מזג אוויר', lat: 31.7683, lon: 35.2137, timezone: 'Asia/Jerusalem', regionLabel: 'הר יהודה' },
    { name: 'Haifa', country: 'Israel', channel: 'חיפה TV מזג אוויר', lat: 32.7940, lon: 34.9896, timezone: 'Asia/Jerusalem', regionLabel: 'הצפון' },
  ],
  arabic: [
    { name: 'Cairo', country: 'Egypt', channel: 'قناة النيل للأخبار', lat: 30.0444, lon: 31.2357, timezone: 'Africa/Cairo' },
    { name: 'Dubai', country: 'UAE', channel: 'دبي واحد', lat: 25.2048, lon: 55.2708, timezone: 'Asia/Dubai' },
    { name: 'Casablanca', country: 'Morocco', channel: '2M الطقس', lat: 33.5731, lon: -7.5898, timezone: 'Africa/Casablanca' },
    { name: 'Amman', country: 'Jordan', channel: 'الأردنية الطقس', lat: 31.9454, lon: 35.9284, timezone: 'Asia/Amman' },
  ],
};

function getRotatingCity(language: string): CityInfo {
  const pool = LANGUAGE_CITY_POOLS[language.toLowerCase()] ?? LANGUAGE_CITY_POOLS['english'];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
  return pool[dayOfYear % pool.length];
}

// ── WMO weather code → description ─────────────────────────────────────────

function describeWeatherCode(code: number): { short: string; detail: string } {
  if (code === 0)  return { short: 'clear skies', detail: 'Beautiful clear skies — excellent visibility all day.' };
  if (code <= 3)   return { short: 'partly cloudy', detail: 'Some clouds moving through, but mostly pleasant.' };
  if (code <= 48)  return { short: 'foggy', detail: 'Dense fog advisory in effect — reduced visibility this morning.' };
  if (code <= 55)  return { short: 'light drizzle', detail: 'Light drizzle expected throughout the day. Umbrella recommended.' };
  if (code <= 65)  return { short: 'rain', detail: 'Rain showers in the forecast. A waterproof jacket is a good idea.' };
  if (code <= 75)  return { short: 'snow', detail: 'Snowfall expected. Roads may be slippery — drive carefully.' };
  if (code <= 82)  return { short: 'rain showers', detail: 'Scattered rain showers, clearing later in the afternoon.' };
  if (code <= 86)  return { short: 'snow showers', detail: 'Snow showers possible, especially at higher elevations.' };
  if (code >= 95)  return { short: 'thunderstorms', detail: 'Thunderstorms likely. Stay indoors when possible.' };
  return { short: 'mixed conditions', detail: 'Variable conditions expected throughout the day.' };
}

/**
 * Map a human-readable condShort string to the exact widget condition slug
 * that WeatherCanvas / set_weather expects (underscore-separated, no spaces).
 * Daniela copies what she reads — this ensures she always has the right key.
 */
function condShortToSlug(condShort: string): string {
  const s = condShort.toLowerCase();
  if (s.includes('thunder')) return 'stormy';
  if (s.includes('snow'))    return 'snowy';
  if (s.includes('partly'))  return 'partly_cloudy';
  if (s.includes('rain') || s.includes('drizzle')) return 'rainy';
  if (s.includes('fog') || s.includes('mist'))     return 'foggy';
  if (s.includes('cloud') || s.includes('overcast') || s.includes('mixed')) return 'cloudy';
  if (s.includes('clear') || s.includes('sunny'))  return 'sunny';
  if (s.includes('wind'))    return 'windy';
  return 'cloudy'; // safe fallback — always renders
}

// ── open-meteo fetch ────────────────────────────────────────────────────────

interface WeatherReading {
  tempC: number;
  tempF: number;
  condShort: string;
  condDetail: string;
  windKmh: number;
  day: string;
  time: string;
  city: CityInfo;
}

async function fetchWeatherOpenMeteo(city: CityInfo): Promise<WeatherReading | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=kmh&temperature_unit=celsius&timezone=${encodeURIComponent(city.timezone)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json() as any;
    if (json.error) return null;
    const c = json.current;
    if (!c) return null;
    const tempC = Math.round(c.temperature_2m ?? 0);
    const { short, detail } = describeWeatherCode(c.weather_code ?? 0);
    const now = new Date();
    return {
      tempC,
      tempF: Math.round(tempC * 9 / 5 + 32),
      condShort: short,
      condDetail: detail,
      windKmh: Math.round(c.wind_speed_10m ?? 0),
      day: now.toLocaleDateString('en-US', { weekday: 'long', timeZone: city.timezone }),
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: city.timezone, hour12: true }),
      city,
    };
  } catch {
    return null;
  }
}

async function fetchWeatherWttrIn(city: CityInfo): Promise<WeatherReading | null> {
  const query = encodeURIComponent(`${city.lat},${city.lon}`);
  const url = `https://wttr.in/${query}?format=j1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(7000), headers: { 'User-Agent': 'HolaHola/1.0' } });
    if (!res.ok) return null;
    const json = await res.json() as any;
    const c = json.current_condition?.[0];
    if (!c) return null;
    const tempC = Math.round(Number(c.temp_C ?? 0));
    const windKmh = Math.round(Number(c.windspeedKmph ?? 0));
    const desc = (c.weatherDesc?.[0]?.value ?? '').toLowerCase();
    let condShort = 'mixed conditions';
    let condDetail = 'Variable conditions expected throughout the day.';
    if (desc.includes('thunder')) { condShort = 'thunderstorms'; condDetail = 'Thunderstorms likely. Stay indoors when possible.'; }
    else if (desc.includes('snow')) { condShort = 'snow'; condDetail = 'Snowfall expected. Roads may be slippery — drive carefully.'; }
    else if (desc.includes('rain') || desc.includes('drizzle')) { condShort = 'rain'; condDetail = 'Rain showers in the forecast. A waterproof jacket is a good idea.'; }
    else if (desc.includes('fog') || desc.includes('mist')) { condShort = 'foggy'; condDetail = 'Reduced visibility this morning — fog advisory in effect.'; }
    else if (desc.includes('overcast') || desc.includes('cloud')) { condShort = 'partly cloudy'; condDetail = 'Some clouds moving through, but mostly pleasant.'; }
    else if (desc.includes('sunny') || desc.includes('clear')) { condShort = 'clear skies'; condDetail = 'Beautiful clear skies — excellent visibility all day.'; }
    const now = new Date();
    return {
      tempC,
      tempF: Math.round(tempC * 9 / 5 + 32),
      condShort,
      condDetail,
      windKmh,
      day: now.toLocaleDateString('en-US', { weekday: 'long', timeZone: city.timezone }),
      time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: city.timezone, hour12: true }),
      city,
    };
  } catch {
    return null;
  }
}

async function fetchWeather(language: string): Promise<WeatherReading | null> {
  const city = getRotatingCity(language);

  // Cache hit — skip the network call entirely
  const cached = getCachedWeather(city);
  if (cached) {
    console.log(`[BroadcastData] Weather cache hit for ${city.name} — ${cached.tempC}°C ${cached.condShort}`);
    return cached;
  }

  const primary = await fetchWeatherOpenMeteo(city);
  if (primary) {
    setCachedWeather(city, primary);
    return primary;
  }

  console.log('[BroadcastData] open-meteo unavailable — falling back to wttr.in');
  const fallback = await fetchWeatherWttrIn(city);
  if (fallback) setCachedWeather(city, fallback);
  return fallback;
}

// ── Perplexity fetch (sports / news) ───────────────────────────────────────

const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';

async function fetchPerplexityBrief(prompt: string): Promise<string | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    console.warn('[BroadcastData] PERPLEXITY_API_KEY not set — sports/news unavailable');
    return null;
  }
  try {
    const res = await fetch(PERPLEXITY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a news briefing assistant. Respond with 3 concise bullet points, no links, no markdown headers. Each bullet should be one sentence of 15-25 words.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json() as any;
    return json.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err: any) {
    console.warn('[BroadcastData] Perplexity fetch failed (non-fatal):', err?.message ?? err);
    return null;
  }
}

// ── Main tool-callable fetch function ──────────────────────────────────────

export type BroadcastType = 'weather' | 'sports' | 'news';

/**
 * Fetch broadcast data for Daniela's get_broadcast_data tool.
 * Returns a formatted string she uses to compose and deliver the broadcast.
 * Always includes weather as context; sports/news adds Perplexity headlines.
 */
export async function fetchBroadcastDataForTool(
  language: string,
  broadcastType: BroadcastType,
  nativeLanguage?: string,
): Promise<string> {
  // US students (native English speakers) expect Fahrenheit in broadcasts.
  // Everyone else gets Celsius — the international standard and what the
  // target-language country itself uses.
  const useF = nativeLanguage?.toLowerCase() === 'english';
  const weather = await fetchWeather(language);

  if (!weather) {
    return `BROADCAST DATA UNAVAILABLE — Weather service is temporarily unreachable. Improvise: describe what today's weather might feel like in a typical ${language}-speaking city and practice the vocabulary with the student.`;
  }

  const { city, tempC, tempF, condShort, condDetail, windKmh, day, time } = weather;
  const regionNote = city.regionLabel ? ` (${city.regionLabel})` : '';
  const condSlug = condShortToSlug(condShort);

  if (broadcastType === 'weather') {
    return [
      `[SOURCE DATA]`,
      `City: ${city.name}${regionNote} | Country: ${city.country} | Channel: ${city.channel}`,
      `Day: ${day} | Time: ${time} local`,
      `Sky: ${condShort} | Widget slug: ${condSlug} ← pass this exactly to set_weather condition field`,
      `Temp: ${useF ? `${tempF}°F` : `${tempC}°C`} — SAY EXACTLY THIS. Do not change or approximate this number.`,
      `Wind: ${windKmh} km/h`,
      `Detail: ${condDetail}`,
      `[REQUIRED VISUAL SETUP — call these tools IN ORDER before speaking]`,
      `0. clear_whiteboard — clears any previous widgets so nothing stacks`,
      `1. open_scene with scene "tv_weather_studio" and target "center" — this places the studio BEHIND your avatar (green-screen mode). Do NOT skip this. Do NOT use target "studio".`,
      `2. widget_state with widget "set_weather", params_json: {"condition":"${condSlug}","celsius":${tempC}}`,
      `3. widget_time with widget "set_thermometer", params_json: {"celsius":${tempC},"showFahrenheit":${useF}}`,
      `[TASK]`,
      `Perform as a local weather anchor. DO NOT read the list.`,
      `1. Open with a natural hook for the day and location.`,
      `2. Report the temperature (${useF ? `${tempF}°F` : `${tempC}°C`}) and sky condition (${condShort}) in your own anchor voice.`,
      `3. Ask the student a level-appropriate question about the weather — make it a real dialogue, not a performance.`,
      `Suggested: "¿Qué crees que deberías llevar hoy?" or "Can you tell me in [language] whether you'd bring an umbrella?"`,
    ].join('\n');
  }

  if (broadcastType === 'sports') {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sportsBrief = await fetchPerplexityBrief(
      `Today is ${today}. What are the MOST RECENT final scores and results from the past 48 hours for major sports in ${city.country} or involving ${city.country} national teams? Focus on games played in the last 2 days. Give up to 3 results with exact dates. Do NOT report results from more than a week ago.`
    );
    return [
      `[SOURCE DATA]`,
      `City: ${city.name} | Country: ${city.country} | Channel: ${city.channel} Deportes | Day: ${day}`,
      sportsBrief
        ? sportsBrief
        : `No live data — improvise: describe an imaginary local match result using sport vocabulary.`,
      `[REQUIRED VISUAL SETUP — call these tools IN ORDER before speaking]`,
      `0. clear_whiteboard — clears any previous widgets`,
      `1. open_scene with scene "tv_newsroom" and target "center" — places the newsroom BEHIND your avatar. Do NOT skip. Do NOT use target "studio".`,
      `IMPORTANT: Do NOT use any weather widgets (set_weather, set_thermometer) for sports broadcasts. Sports headlines belong on the whiteboard if anywhere.`,
      `[TASK]`,
      `Perform as a sports anchor. DO NOT read the list mechanically.`,
      `1. Pick the most interesting story and react to it naturally.`,
      `2. Report it in the target language at the student's ACTFL level.`,
      `3. Invite the student to respond — ask what sport they follow or what they think of the result.`,
    ].join('\n');
  }

  // news
  const newsBrief = await fetchPerplexityBrief(
    `Top 3 news headlines from ${city.country} right now. One sentence each, factual and brief.`
  );
  return [
    `[SOURCE DATA]`,
    `City: ${city.name} | Country: ${city.country} | Channel: ${city.channel} | Day: ${day} | Time: ${time} local`,
    newsBrief
      ? newsBrief
      : `No live data — improvise: describe a plausible local story relevant to everyday life in the region.`,
    `[REQUIRED VISUAL SETUP — call these tools IN ORDER before speaking]`,
    `0. clear_whiteboard — clears any previous widgets`,
    `1. open_scene with scene "tv_newsroom" and target "center" — places the newsroom BEHIND your avatar. Do NOT skip. Do NOT use target "studio".`,
    `IMPORTANT: Do NOT use any weather widgets for news broadcasts.`,
    `[TASK]`,
    `Perform as a news anchor. DO NOT read the list mechanically.`,
    `1. Open with a brief, natural anchor greeting and the date.`,
    `2. Deliver 1-2 headlines in the target language at the student's ACTFL level.`,
    `3. After headlines, ask what the student understood or invite a reaction to one story.`,
  ].join('\n');
}

// ── ACTFL-scaled pre-session brief (for future lesson-based auto-injection) ─

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
  broadcastType: BroadcastType;
}

function actflTier(level: string | null | undefined): 'novice' | 'intermediate' | 'advanced' {
  const l = (level ?? '').toLowerCase();
  if (l.startsWith('advanced') || l.startsWith('superior')) return 'advanced';
  if (l.startsWith('intermediate')) return 'intermediate';
  return 'novice';
}

function buildDeliveryInstruction(tier: 'novice' | 'intermediate' | 'advanced', broadcastType: BroadcastType): string {
  const role = broadcastType === 'weather' ? 'television weather anchor' : broadcastType === 'sports' ? 'sports anchor' : 'news anchor';
  const scaling: Record<string, string> = {
    novice: `2–3 very short sentences. Slow, clear delivery. Introduce one new vocabulary item.`,
    intermediate: `4–6 sentences with natural broadcast phrasing. Model a useful phrase the student can repeat.`,
    advanced: `6–10 sentences at authentic anchor register. Include conditionals, probability language, and a natural sign-off.`,
  };
  return `Open this session as a ${role}. ${scaling[tier]}`;
}

export async function buildBroadcastBrief(
  language: string,
  actflLevel: string | null | undefined,
  broadcastType: BroadcastType = 'weather',
): Promise<{ brief: string; preview: BroadcastPreview } | null> {
  const weather = await fetchWeather(language);
  if (!weather) return null;

  const { city, tempC, tempF, condShort, condDetail, windKmh, day, time } = weather;
  const tier = actflTier(actflLevel);
  const delivery = buildDeliveryInstruction(tier, broadcastType);

  const brief = `[BROADCAST BRIEF]
Channel: ${city.channel}
Location: ${city.name}, ${city.country}
Day/Time: ${day}, ${time} local
Conditions: ${condShort}, ${tempC}°C (${tempF}°F), wind ${windKmh} km/h
Detail: ${condDetail}
Delivery: ${delivery}
[END BROADCAST BRIEF]`;

  const preview: BroadcastPreview = {
    city: city.name, country: city.country, channel: city.channel,
    condition: condShort, tempC, tempF, windKmh, day, time, broadcastType,
  };

  console.log(`[BroadcastData] Brief built — ${city.name} ${tempC}°C ${condShort}`);
  return { brief, preview };
}
