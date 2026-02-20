import { TextAudioPlayButton } from "@/components/AudioPlayButton";

interface VocabItem {
  word: string;
  translation: string;
  targetLanguage?: string;
}

type CategoryTheme = 'food' | 'drinks' | 'clothing' | 'colors' | 'school_subjects' | 'school_supplies' | 'hobbies' | 'places' | 'travel' | 'health' | 'technology' | 'nature' | 'family' | 'body' | 'weather' | 'animals' | 'default';

const CATEGORY_ICONS: Record<string, (props: { className?: string }) => JSX.Element> = {
  'el arroz': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="10" y="18" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M14 18c0-4 3-8 6-8s6 4 6 8" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="17" cy="24" r="1" fill="currentColor"/><circle cx="23" cy="24" r="1" fill="currentColor"/><circle cx="20" cy="27" r="1" fill="currentColor"/></svg>
  ),
  'el pollo': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><ellipse cx="20" cy="22" rx="10" ry="8" stroke="currentColor" strokeWidth="2"/><path d="M17 14c0-3 2-5 3-5s3 2 3 5" stroke="currentColor" strokeWidth="1.5"/><circle cx="17" cy="20" r="1" fill="currentColor"/></svg>
  ),
  'el pescado': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><ellipse cx="18" cy="20" rx="10" ry="7" stroke="currentColor" strokeWidth="2"/><path d="M28 20l6-5v10l-6-5z" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/></svg>
  ),
  'la ensalada': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M8 22c0-6 5-10 12-10s12 4 12 10" stroke="currentColor" strokeWidth="2"/><path d="M8 22h24" stroke="currentColor" strokeWidth="2"/><path d="M10 26c2 3 5 5 10 5s8-2 10-5" stroke="currentColor" strokeWidth="2"/><path d="M16 18c-1-3 0-5 2-5" stroke="currentColor" strokeWidth="1.5"/><path d="M24 18c1-3 0-5-2-5" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'la sopa': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M8 20h24" stroke="currentColor" strokeWidth="2"/><path d="M10 20c0 6 4 10 10 10s10-4 10-10" stroke="currentColor" strokeWidth="2"/><path d="M14 14c0-2 1-3 1-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M20 12c0-2 1-3 1-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M26 14c0-2 1-3 1-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'el pan': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><ellipse cx="20" cy="22" rx="12" ry="6" stroke="currentColor" strokeWidth="2"/><path d="M10 19c2-5 5-7 10-7s8 2 10 7" stroke="currentColor" strokeWidth="2"/><path d="M16 19v-3M20 18v-4M24 19v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'el queso': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M6 28l14-18 14 18H6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="16" cy="23" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="24" cy="25" r="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el huevo': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><ellipse cx="20" cy="22" rx="9" ry="11" stroke="currentColor" strokeWidth="2"/><circle cx="20" cy="24" r="4" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'la fruta': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><circle cx="20" cy="23" r="9" stroke="currentColor" strokeWidth="2"/><path d="M20 14c-1-3 0-5 2-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M20 14c2-1 4-1 5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'las verduras': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><ellipse cx="16" cy="26" rx="5" ry="7" stroke="currentColor" strokeWidth="2"/><ellipse cx="24" cy="26" rx="5" ry="7" stroke="currentColor" strokeWidth="2"/><path d="M16 19c-1-3 0-6 2-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M24 19c1-3 0-6-2-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'la carne': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><ellipse cx="20" cy="22" rx="11" ry="8" stroke="currentColor" strokeWidth="2"/><path d="M14 20c1-2 3-3 6-3s5 1 6 3" stroke="currentColor" strokeWidth="1.5"/><ellipse cx="20" cy="22" rx="4" ry="2" stroke="currentColor" strokeWidth="1"/></svg>
  ),
  'la pizza': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M20 8l-14 24h28L20 8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="18" cy="22" r="2" fill="currentColor" opacity="0.4"/><circle cx="24" cy="24" r="1.5" fill="currentColor" opacity="0.4"/><circle cx="20" cy="28" r="2" fill="currentColor" opacity="0.4"/></svg>
  ),
  'el agua': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M20 8c-5 8-10 14-10 19a10 10 0 0020 0c0-5-5-11-10-19z" stroke="currentColor" strokeWidth="2"/><path d="M15 24c2-1 5-1 8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'la leche': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="12" y="14" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M12 14l2-4h12l2 4" stroke="currentColor" strokeWidth="2"/><rect x="16" y="18" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el jugo': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M13 12h14l-2 20H15L13 12z" stroke="currentColor" strokeWidth="2"/><path d="M16 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="20" cy="22" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el café': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="9" y="16" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M27 19c3 0 5 2 5 4s-2 4-5 4" stroke="currentColor" strokeWidth="2"/><path d="M14 12c0-2 1-3 1-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M18 10c0-2 1-3 1-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M22 12c0-2 1-3 1-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'el té': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="10" y="18" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M26 21c3 0 4 1 4 3s-1 3-4 3" stroke="currentColor" strokeWidth="2"/><path d="M16 13c0-2 1-4 1-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M20 14c0-1 1-3 1-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'el refresco': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="14" y="10" width="12" height="22" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M14 16h12" stroke="currentColor" strokeWidth="1.5"/><path d="M14 26h12" stroke="currentColor" strokeWidth="1.5"/><circle cx="20" cy="21" r="2" stroke="currentColor" strokeWidth="1"/></svg>
  ),
  'la limonada': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M12 14h16l-2 18H14L12 14z" stroke="currentColor" strokeWidth="2"/><circle cx="20" cy="23" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M18 11l-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M8 14h24" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el chocolate caliente': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="10" y="18" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M26 21c3 0 4 1 4 3s-1 3-4 3" stroke="currentColor" strokeWidth="2"/><path d="M13 14c1-2 2-3 2-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M18 12c1-2 2-3 2-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M23 14c1-2 2-3 2-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'el batido': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M13 14h14l-3 18h-8L13 14z" stroke="currentColor" strokeWidth="2"/><path d="M10 14h20" stroke="currentColor" strokeWidth="2"/><path d="M22 10l4-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="18" cy="22" r="1" fill="currentColor"/><circle cx="22" cy="25" r="1" fill="currentColor"/></svg>
  ),
  'el jugo de naranja': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M13 12h14l-2 20H15L13 12z" stroke="currentColor" strokeWidth="2"/><circle cx="20" cy="22" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M20 18v8M16 22h8" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
  ),
  'la camisa': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M14 10l-6 6 4 3 2-3v16h12V16l2 3 4-3-6-6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 10c1 2 3 3 6 3s5-1 6-3" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'los pantalones': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M12 8h16v8l-3 16h-4l-1-12-1 12h-4L12 16V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M12 14h16" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el vestido': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M16 8c1 2 2 3 4 3s3-1 4-3" stroke="currentColor" strokeWidth="2"/><path d="M16 8l-2 10 6 2 6-2-2-10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 18l-4 14h20l-4-14" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
  ),
  'la falda': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="14" y="10" width="12" height="5" rx="1" stroke="currentColor" strokeWidth="2"/><path d="M14 15l-4 17h20l-4-17" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
  ),
  'los zapatos': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M6 24c0-3 2-5 5-6l8-2c3 0 5 1 7 3l6 3v4H6v-2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M6 26h26" stroke="currentColor" strokeWidth="2"/></svg>
  ),
  'la chaqueta': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M14 10l-6 6 4 3 2-3v16h12V16l2 3 4-3-6-6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 10c1 2 3 3 6 3s5-1 6-3" stroke="currentColor" strokeWidth="1.5"/><path d="M20 13v19" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el sombrero': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><ellipse cx="20" cy="26" rx="14" ry="4" stroke="currentColor" strokeWidth="2"/><path d="M12 26c0-8 4-14 8-14s8 6 8 14" stroke="currentColor" strokeWidth="2"/></svg>
  ),
  'los calcetines': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M14 8v14c0 3-2 5-2 8s2 4 5 4 5-1 6-3l3-5V8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 16h12" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'la camiseta': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M14 10l-5 5 3 3 2-2v16h12V16l2 2 3-3-5-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 10c1 2 3 3 6 3s5-1 6-3" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el suéter': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M14 10l-6 6 4 3 2-3v16h12V16l2 3 4-3-6-6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 10c1 2 3 3 6 3s5-1 6-3" stroke="currentColor" strokeWidth="1.5"/><path d="M10 28h20M10 24h20" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/></svg>
  ),
  'las botas': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M14 8v16c0 2-2 4-2 6s1 3 4 3h10c2 0 3-1 3-3l-1-6V8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 18h14" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el abrigo': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M14 10l-6 6 4 3 2-3v16h12V16l2 3 4-3-6-6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 10c1 2 3 3 6 3s5-1 6-3" stroke="currentColor" strokeWidth="1.5"/><path d="M20 13v19" stroke="currentColor" strokeWidth="1.5"/><circle cx="18" cy="20" r="1" fill="currentColor"/><circle cx="18" cy="25" r="1" fill="currentColor"/></svg>
  ),
  'la escuela': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="8" y="18" width="24" height="14" rx="1" stroke="currentColor" strokeWidth="2"/><path d="M8 18l12-8 12 8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><rect x="17" y="24" width="6" height="8" stroke="currentColor" strokeWidth="1.5"/><rect x="10" y="22" width="4" height="4" stroke="currentColor" strokeWidth="1"/><rect x="26" y="22" width="4" height="4" stroke="currentColor" strokeWidth="1"/></svg>
  ),
  'la biblioteca': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="8" y="18" width="24" height="14" rx="1" stroke="currentColor" strokeWidth="2"/><path d="M6 18h28" stroke="currentColor" strokeWidth="2"/><rect x="12" y="10" width="16" height="8" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="13" y="22" width="3" height="7" stroke="currentColor" strokeWidth="1"/><rect x="18" y="22" width="3" height="7" stroke="currentColor" strokeWidth="1"/><rect x="23" y="22" width="3" height="7" stroke="currentColor" strokeWidth="1"/></svg>
  ),
  'el hospital': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="10" y="14" width="20" height="18" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="17" y="8" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M18.5 10v3M17 11.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><rect x="16" y="24" width="8" height="8" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el supermercado': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="6" y="16" width="28" height="16" rx="1" stroke="currentColor" strokeWidth="2"/><path d="M6 16h28" stroke="currentColor" strokeWidth="2"/><path d="M6 12h28" stroke="currentColor" strokeWidth="2.5"/><path d="M12 20h4M12 24h4M24 20h4M24 24h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'el parque': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M20 10c-4 0-8 3-8 8h16c0-5-4-8-8-8z" stroke="currentColor" strokeWidth="2"/><rect x="19" y="18" width="2" height="10" stroke="currentColor" strokeWidth="1.5"/><path d="M6 30h28" stroke="currentColor" strokeWidth="2"/><path d="M10 30c0-3 2-5 4-5" stroke="currentColor" strokeWidth="1.5"/><path d="M30 30c0-3-2-5-4-5" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el restaurante': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><circle cx="20" cy="24" r="8" stroke="currentColor" strokeWidth="2"/><path d="M16 22h8" stroke="currentColor" strokeWidth="1.5"/><path d="M14 10v8M14 10l-2 4M14 10l2 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M26 10v4c0 2-1 3-2 4v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'el pasaporte': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="10" y="8" width="20" height="26" rx="2" stroke="currentColor" strokeWidth="2"/><circle cx="20" cy="20" r="5" stroke="currentColor" strokeWidth="1.5"/><circle cx="20" cy="20" r="2" stroke="currentColor" strokeWidth="1"/><path d="M14 30h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'la maleta': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="8" y="14" width="24" height="16" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M15 14V10c0-1 1-2 2-2h6c1 0 2 1 2 2v4" stroke="currentColor" strokeWidth="2"/><path d="M8 20h24" stroke="currentColor" strokeWidth="1.5"/><circle cx="14" cy="32" r="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="26" cy="32" r="2" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el boleto': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="6" y="14" width="28" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M26 14v14" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/><path d="M10 18h12" stroke="currentColor" strokeWidth="1.5"/><path d="M10 22h8" stroke="currentColor" strokeWidth="1"/></svg>
  ),
  'el hotel': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="10" y="10" width="20" height="22" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="4" height="4" stroke="currentColor" strokeWidth="1.5"/><rect x="22" y="14" width="4" height="4" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="22" width="4" height="4" stroke="currentColor" strokeWidth="1.5"/><rect x="22" y="22" width="4" height="4" stroke="currentColor" strokeWidth="1.5"/><rect x="17" y="28" width="6" height="4" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el avión': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M20 6v28" stroke="currentColor" strokeWidth="2"/><path d="M20 14l-12 6 12-2 12 2-12-6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M20 28l-6 4 6-1 6 1-6-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
  ),
  'la playa': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M4 26c4-2 8-2 12 0s8 2 12 0s8 2 12 0" stroke="currentColor" strokeWidth="2"/><circle cx="30" cy="10" r="5" stroke="currentColor" strokeWidth="2"/><path d="M30 5l0-1M35 10l1 0M30 15l0 1M25 10l-1 0M33.5 6.5l.7-.7M33.5 13.5l.7.7M26.5 6.5l-.7-.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 10l-6 16M14 10l6 16M14 10c-4 1-7 4-7 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'el mapa': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M8 10l8 4 8-4 8 4v20l-8-4-8 4-8-4V10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M16 14v20M24 10v20" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'las matemáticas': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M12 14h16M20 6v16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><path d="M12 28h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><path d="M12 34h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
  ),
  'las ciencias': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M16 8v12l-6 10c-1 2 0 4 2 4h16c2 0 3-2 2-4l-6-10V8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="17" cy="28" r="1.5" fill="currentColor"/><circle cx="23" cy="26" r="1" fill="currentColor"/></svg>
  ),
  'la historia': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M10 8c0-1 1-2 2-2h16c1 0 2 1 2 2v24c0 1-1 2-2 2H12c-1 0-2-1-2-2V8z" stroke="currentColor" strokeWidth="2"/><path d="M14 12h12M14 16h12M14 20h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M10 8c3 0 4 1 4 3" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el inglés': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><text x="12" y="28" className="fill-current" fontSize="18" fontWeight="bold" fontFamily="serif">A</text></svg>
  ),
  'el español': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><text x="12" y="28" className="fill-current" fontSize="18" fontWeight="bold" fontFamily="serif">Ñ</text></svg>
  ),
  'el arte': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><circle cx="20" cy="18" r="10" stroke="currentColor" strokeWidth="2"/><circle cx="16" cy="15" r="2" fill="currentColor" opacity="0.3"/><circle cx="23" cy="14" r="1.5" fill="currentColor" opacity="0.3"/><circle cx="18" cy="21" r="1.5" fill="currentColor" opacity="0.3"/><path d="M26 18c2 0 3 1 3 2s-1 2-3 2-2-1-2-2 0-2 2-2z" fill="currentColor" opacity="0.3"/><path d="M16 30l4-4 2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  ),
  'la música': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><circle cx="14" cy="28" r="4" stroke="currentColor" strokeWidth="2"/><circle cx="28" cy="24" r="4" stroke="currentColor" strokeWidth="2"/><path d="M18 28V12l14-4v16" stroke="currentColor" strokeWidth="2"/></svg>
  ),
  'la educación física': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><circle cx="20" cy="10" r="3" stroke="currentColor" strokeWidth="2"/><path d="M20 13v10M14 18h12M16 23l-3 9M24 23l3 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  ),
  'la geografía': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="2"/><ellipse cx="20" cy="20" rx="5" ry="12" stroke="currentColor" strokeWidth="1.5"/><path d="M8 20h24" stroke="currentColor" strokeWidth="1.5"/><path d="M10 14h20M10 26h20" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/></svg>
  ),
  'la informática': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="8" y="10" width="24" height="16" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M14 30h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M18 26v4M22 26v4" stroke="currentColor" strokeWidth="1.5"/><path d="M13 16h4M13 19h6M13 22h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'el libro': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M8 8h10c2 0 3 1 3 2v22c-1-1-2-1-3-1H8V8z" stroke="currentColor" strokeWidth="2"/><path d="M32 8H22c-2 0-3 1-3 2v22c1-1 2-1 3-1h10V8z" stroke="currentColor" strokeWidth="2"/></svg>
  ),
  'el cuaderno': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="10" y="6" width="20" height="28" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 6v28" stroke="currentColor" strokeWidth="1.5"/><path d="M8 12h4M8 18h4M8 24h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'el lápiz': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M28 6l6 6-18 18H10V24L28 6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M24 10l6 6" stroke="currentColor" strokeWidth="1.5"/><path d="M10 30l4-4" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el bolígrafo': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M26 6l6 6-16 16H10V22L26 6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M10 28l2 6 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
  ),
  'el borrador': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="8" y="16" width="24" height="12" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M8 22h24" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'la regla': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="4" y="16" width="32" height="10" rx="1" stroke="currentColor" strokeWidth="2"/><path d="M10 16v4M16 16v6M22 16v4M28 16v6" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'la mochila': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="10" y="12" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2"/><path d="M14 12c0-4 3-6 6-6s6 2 6 6" stroke="currentColor" strokeWidth="2"/><rect x="14" y="20" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'el escritorio': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="6" y="14" width="28" height="4" rx="1" stroke="currentColor" strokeWidth="2"/><path d="M10 18v14M30 18v14" stroke="currentColor" strokeWidth="2"/><rect x="14" y="18" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'la silla': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M12 8v14h16V8" stroke="currentColor" strokeWidth="2"/><path d="M10 22h20" stroke="currentColor" strokeWidth="2"/><path d="M12 22v10M28 22v10" stroke="currentColor" strokeWidth="2"/></svg>
  ),
  'la pizarra': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="6" y="8" width="28" height="18" rx="1" stroke="currentColor" strokeWidth="2"/><path d="M18 26v6M22 26v6M14 32h12" stroke="currentColor" strokeWidth="2"/><path d="M12 14h6M12 18h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'las tijeras': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><circle cx="14" cy="28" r="4" stroke="currentColor" strokeWidth="2"/><circle cx="26" cy="28" r="4" stroke="currentColor" strokeWidth="2"/><path d="M16 24L28 8M24 24L12 8" stroke="currentColor" strokeWidth="2"/></svg>
  ),
  'el pegamento': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="14" y="14" width="12" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M17 14V10c0-1 1-2 3-2s3 1 3 2v4" stroke="currentColor" strokeWidth="2"/><path d="M14 20h12" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'jugar deportes': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><circle cx="20" cy="20" r="10" stroke="currentColor" strokeWidth="2"/><path d="M14 12l6 8-6 8M26 12l-6 8 6 8" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'leer': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M8 8h10c2 0 3 1 3 2v22c-1-1-2-1-3-1H8V8z" stroke="currentColor" strokeWidth="2"/><path d="M32 8H22c-2 0-3 1-3 2v22c1-1 2-1 3-1h10V8z" stroke="currentColor" strokeWidth="2"/><path d="M12 14h4M12 18h4M24 14h4M24 18h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
  ),
  'dibujar': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M26 6l6 6-16 16H10V22L26 6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M10 32h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'cocinar': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><path d="M8 22h24" stroke="currentColor" strokeWidth="2"/><path d="M10 22c0 6 4 10 10 10s10-4 10-10" stroke="currentColor" strokeWidth="2"/><path d="M14 16c0-2 1-3 1-3M20 14c0-2 1-3 1-3M26 16c0-2 1-3 1-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M20 10V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  ),
  'cantar': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><circle cx="18" cy="28" r="4" stroke="currentColor" strokeWidth="2"/><path d="M22 28V10" stroke="currentColor" strokeWidth="2"/><path d="M22 10h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M28 16c2 0 3-1 3-3s-1-3-3-3" stroke="currentColor" strokeWidth="1.5"/><path d="M30 18c3 0 4-2 4-5s-1-5-4-5" stroke="currentColor" strokeWidth="1.5"/></svg>
  ),
  'bailar': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><circle cx="20" cy="8" r="3" stroke="currentColor" strokeWidth="2"/><path d="M20 11v8M14 15l6 4M26 15l-6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M16 19l-4 12M24 19l4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
  ),
  'nadar': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="2"/><path d="M14 17l8-3 4 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 28c4-2 8-2 12 0s8 2 12 0s8 2 8 0" stroke="currentColor" strokeWidth="2"/></svg>
  ),
  'correr': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><circle cx="22" cy="8" r="3" stroke="currentColor" strokeWidth="2"/><path d="M18 13l4 4 6-2M22 17l-4 8-4 2M22 17l2 8 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  'jugar videojuegos': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="6" y="14" width="28" height="14" rx="4" stroke="currentColor" strokeWidth="2"/><circle cx="14" cy="21" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M14 18v6M11 21h6" stroke="currentColor" strokeWidth="1"/><circle cx="26" cy="19" r="1.5" fill="currentColor"/><circle cx="28" cy="23" r="1.5" fill="currentColor"/></svg>
  ),
  'ver películas': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="6" y="10" width="28" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M6 14h28M6 24h28" stroke="currentColor" strokeWidth="1"/><path d="M10 10v18M14 10v18M26 10v18M30 10v18" stroke="currentColor" strokeWidth="1"/><path d="M18 17l6 3-6 3V17z" fill="currentColor" opacity="0.3"/></svg>
  ),
  'escuchar música': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><circle cx="20" cy="20" r="10" stroke="currentColor" strokeWidth="2"/><circle cx="20" cy="20" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M8 20h2M30 20h2M20 8v2M20 30v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  'sacar fotos': ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none"><rect x="6" y="14" width="28" height="18" rx="3" stroke="currentColor" strokeWidth="2"/><circle cx="20" cy="23" r="5" stroke="currentColor" strokeWidth="2"/><rect x="16" y="10" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/><circle cx="20" cy="23" r="2" stroke="currentColor" strokeWidth="1"/></svg>
  ),
};

function getDefaultIcon(word: string): (props: { className?: string }) => JSX.Element {
  return ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} fill="none">
      <rect x="8" y="8" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="2"/>
      <text x="20" y="24" textAnchor="middle" className="fill-current" fontSize="14" fontWeight="bold">
        {word.replace(/^(el |la |los |las |un |una )/, '').charAt(0).toUpperCase()}
      </text>
    </svg>
  );
}

const COLOR_MAP: Record<string, string> = {
  'rojo': '#EF4444',
  'azul': '#3B82F6',
  'verde': '#22C55E',
  'amarillo': '#EAB308',
  'blanco': '#F8FAFC',
  'negro': '#1E293B',
  'anaranjado': '#F97316',
  'morado': '#A855F7',
  'rosado': '#EC4899',
  'grande': '',
  'pequeño': '',
  'mediano': '',
};

const CATEGORY_THEME_COLORS: Record<CategoryTheme, { bg: string; border: string; iconColor: string; headerBg: string }> = {
  food: { bg: 'bg-orange-500/5', border: 'border-orange-500/20', iconColor: 'text-orange-600 dark:text-orange-400', headerBg: 'from-orange-500/15 to-orange-500/5' },
  drinks: { bg: 'bg-cyan-500/5', border: 'border-cyan-500/20', iconColor: 'text-cyan-600 dark:text-cyan-400', headerBg: 'from-cyan-500/15 to-cyan-500/5' },
  clothing: { bg: 'bg-violet-500/5', border: 'border-violet-500/20', iconColor: 'text-violet-600 dark:text-violet-400', headerBg: 'from-violet-500/15 to-violet-500/5' },
  colors: { bg: 'bg-pink-500/5', border: 'border-pink-500/20', iconColor: 'text-pink-600 dark:text-pink-400', headerBg: 'from-pink-500/15 to-pink-500/5' },
  school_subjects: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', iconColor: 'text-blue-600 dark:text-blue-400', headerBg: 'from-blue-500/15 to-blue-500/5' },
  school_supplies: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', iconColor: 'text-amber-600 dark:text-amber-400', headerBg: 'from-amber-500/15 to-amber-500/5' },
  hobbies: { bg: 'bg-green-500/5', border: 'border-green-500/20', iconColor: 'text-green-600 dark:text-green-400', headerBg: 'from-green-500/15 to-green-500/5' },
  places: { bg: 'bg-indigo-500/5', border: 'border-indigo-500/20', iconColor: 'text-indigo-600 dark:text-indigo-400', headerBg: 'from-indigo-500/15 to-indigo-500/5' },
  travel: { bg: 'bg-teal-500/5', border: 'border-teal-500/20', iconColor: 'text-teal-600 dark:text-teal-400', headerBg: 'from-teal-500/15 to-teal-500/5' },
  health: { bg: 'bg-red-500/5', border: 'border-red-500/20', iconColor: 'text-red-600 dark:text-red-400', headerBg: 'from-red-500/15 to-red-500/5' },
  technology: { bg: 'bg-slate-500/5', border: 'border-slate-500/20', iconColor: 'text-slate-600 dark:text-slate-400', headerBg: 'from-slate-500/15 to-slate-500/5' },
  nature: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', iconColor: 'text-emerald-600 dark:text-emerald-400', headerBg: 'from-emerald-500/15 to-emerald-500/5' },
  family: { bg: 'bg-rose-500/5', border: 'border-rose-500/20', iconColor: 'text-rose-600 dark:text-rose-400', headerBg: 'from-rose-500/15 to-rose-500/5' },
  body: { bg: 'bg-fuchsia-500/5', border: 'border-fuchsia-500/20', iconColor: 'text-fuchsia-600 dark:text-fuchsia-400', headerBg: 'from-fuchsia-500/15 to-fuchsia-500/5' },
  weather: { bg: 'bg-sky-500/5', border: 'border-sky-500/20', iconColor: 'text-sky-600 dark:text-sky-400', headerBg: 'from-sky-500/15 to-sky-500/5' },
  animals: { bg: 'bg-lime-500/5', border: 'border-lime-500/20', iconColor: 'text-lime-600 dark:text-lime-400', headerBg: 'from-lime-500/15 to-lime-500/5' },
  default: { bg: 'bg-primary/5', border: 'border-primary/20', iconColor: 'text-primary', headerBg: 'from-primary/15 to-primary/5' },
};

const CATEGORY_LABELS: Record<CategoryTheme, string> = {
  food: 'Food & Dining',
  drinks: 'Drinks & Beverages',
  clothing: 'Clothing & Fashion',
  colors: 'Colors & Sizes',
  school_subjects: 'School Subjects',
  school_supplies: 'School Supplies',
  hobbies: 'Hobbies & Activities',
  places: 'Places in the Community',
  travel: 'Travel & Vacation',
  health: 'Health & Wellness',
  technology: 'Technology',
  nature: 'Nature & Environment',
  family: 'Family & Relationships',
  body: 'Body & Health',
  weather: 'Weather & Seasons',
  animals: 'Animals',
  default: 'Vocabulary',
};

export function detectCategory(lessonName: string, drills?: { targetText: string; prompt: string }[]): CategoryTheme {
  const name = lessonName.toLowerCase();
  if (name.includes('food') || name.includes('comida') || name.includes('favorites')) return 'food';
  if (name.includes('drink') || name.includes('bebida')) return 'drinks';
  if (name.includes('cloth') || name.includes('ropa') || name.includes('shopping') || name.includes('compras')) return 'clothing';
  if (name.includes('color') || name.includes('size')) return 'colors';
  if (name.includes('subject') || name.includes('asignatura') || name.includes('materia')) return 'school_subjects';
  if (name.includes('supplies') || name.includes('útiles') || name.includes('school life') || name.includes('escuela')) return 'school_supplies';
  if (name.includes('hobby') || name.includes('hobbies') || name.includes('pasatiempo') || name.includes('free time') || name.includes('activit')) return 'hobbies';
  if (name.includes('place') || name.includes('ciudad') || name.includes('community') || name.includes('town')) return 'places';
  if (name.includes('travel') || name.includes('vacation') || name.includes('vacacion') || name.includes('viaje')) return 'travel';
  if (name.includes('health') || name.includes('salud') || name.includes('wellness')) return 'health';
  if (name.includes('tech') || name.includes('tecnología') || name.includes('social media')) return 'technology';
  if (name.includes('nature') || name.includes('environment') || name.includes('medio ambiente')) return 'nature';
  if (name.includes('family') || name.includes('familia')) return 'family';
  if (name.includes('body') || name.includes('cuerpo')) return 'body';
  if (name.includes('weather') || name.includes('clima') || name.includes('tiempo')) return 'weather';
  if (name.includes('animal')) return 'animals';
  return 'default';
}

interface SeeAndSayGridProps {
  items: VocabItem[];
  category: CategoryTheme;
  language?: string;
  lessonName?: string;
  className?: string;
}

export function SeeAndSayGrid({ items, category, language, lessonName, className = '' }: SeeAndSayGridProps) {
  const theme = CATEGORY_THEME_COLORS[category] || CATEGORY_THEME_COLORS.default;
  const label = lessonName || CATEGORY_LABELS[category] || 'Vocabulary';

  if (items.length === 0) return null;

  if (category === 'colors') {
    return <ColorSwatchGrid items={items} language={language} className={className} />;
  }

  return (
    <div className={`rounded-lg border ${theme.border} overflow-hidden ${className}`} data-testid="see-and-say-grid">
      <div className={`bg-gradient-to-r ${theme.headerBg} px-4 py-3 border-b ${theme.border}`}>
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full ${theme.bg} border ${theme.border} flex items-center justify-center`}>
            <svg viewBox="0 0 24 24" className={`w-4 h-4 ${theme.iconColor}`} fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold">See & Say</h4>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((item, i) => {
            const IconComponent = CATEGORY_ICONS[item.word.toLowerCase()] || getDefaultIcon(item.word);
            return (
              <div
                key={i}
                className={`rounded-md ${theme.bg} border ${theme.border} p-3 flex flex-col items-center text-center gap-1.5 hover-elevate transition-colors`}
                data-testid={`see-and-say-item-${i}`}
              >
                <div className={`w-12 h-12 ${theme.iconColor} flex items-center justify-center`}>
                  <IconComponent className="w-full h-full" />
                </div>
                <div className="flex items-center gap-1">
                  {language && (
                    <TextAudioPlayButton
                      text={item.word}
                      language={language}
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-6 w-6"
                    />
                  )}
                  <p className="font-semibold text-sm leading-tight">{item.word}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-tight">{item.translation}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ColorSwatchGridProps {
  items: VocabItem[];
  language?: string;
  className?: string;
}

export function ColorSwatchGrid({ items, language, className = '' }: ColorSwatchGridProps) {
  const colorItems = items.filter(item => COLOR_MAP[item.word.toLowerCase()] !== undefined);
  const sizeItems = items.filter(item => COLOR_MAP[item.word.toLowerCase()] === undefined || COLOR_MAP[item.word.toLowerCase()] === '');

  const actualColorItems = colorItems.filter(item => COLOR_MAP[item.word.toLowerCase()] !== '');

  return (
    <div className={`rounded-lg border border-pink-500/20 overflow-hidden ${className}`} data-testid="color-swatch-grid">
      <div className="bg-gradient-to-r from-pink-500/15 to-purple-500/10 px-4 py-3 border-b border-pink-500/20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-400 via-blue-400 to-green-400 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold">See & Say</h4>
            <p className="text-xs text-muted-foreground">Colors & Sizes</p>
          </div>
        </div>
      </div>

      <div className="p-3">
        {actualColorItems.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {actualColorItems.map((item, i) => {
              const hex = COLOR_MAP[item.word.toLowerCase()] || '#888';
              const isLight = item.word.toLowerCase() === 'blanco' || item.word.toLowerCase() === 'amarillo';
              return (
                <div
                  key={i}
                  className="rounded-md overflow-hidden border border-border/50"
                  data-testid={`color-swatch-${i}`}
                >
                  <div
                    className="h-14 flex items-end justify-center pb-1"
                    style={{ backgroundColor: hex }}
                  >
                    {language && (
                      <TextAudioPlayButton
                        text={item.word}
                        language={language}
                        size="sm"
                        variant="ghost"
                        className={`shrink-0 h-5 w-5 ${isLight ? 'text-gray-800' : 'text-white'}`}
                      />
                    )}
                  </div>
                  <div className="bg-card p-2 text-center">
                    <p className="font-semibold text-sm">{item.word}</p>
                    <p className="text-xs text-muted-foreground">{item.translation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {sizeItems.length > 0 && (
          <>
            <p className="text-xs font-medium text-muted-foreground mb-2 mt-1">Sizes</p>
            <div className="flex items-end justify-center gap-3">
              {sizeItems.map((item, i) => {
                const sizeClass = item.word.toLowerCase() === 'grande' ? 'w-16 h-16' :
                  item.word.toLowerCase() === 'mediano' ? 'w-12 h-12' : 'w-8 h-8';
                return (
                  <div key={i} className="flex flex-col items-center gap-1" data-testid={`size-item-${i}`}>
                    <div className={`${sizeClass} rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center`}>
                      {language && (
                        <TextAudioPlayButton
                          text={item.word}
                          language={language}
                          size="sm"
                          variant="ghost"
                          className="shrink-0 h-5 w-5"
                        />
                      )}
                    </div>
                    <p className="font-semibold text-xs">{item.word}</p>
                    <p className="text-xs text-muted-foreground">{item.translation}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface SeeAndSayFromDrillsProps {
  drills: { id: string; itemType: string; prompt: string; targetText: string; difficulty: number; mastered: boolean; attempts: number }[];
  lessonName: string;
  language?: string;
  className?: string;
}

export function SeeAndSayFromDrills({ drills, lessonName, language, className = '' }: SeeAndSayFromDrillsProps) {
  const vocabDrills = drills
    .filter(d => d.itemType === 'listen_repeat' || d.itemType === 'translate_speak')
    .filter(d => d.targetText && d.targetText.length < 50);

  if (vocabDrills.length < 4) return null;

  const category = detectCategory(lessonName, vocabDrills);
  const items: VocabItem[] = vocabDrills.map(d => ({
    word: d.targetText,
    translation: d.prompt,
  }));

  return (
    <SeeAndSayGrid
      items={items}
      category={category}
      language={language}
      lessonName={lessonName}
      className={className}
    />
  );
}
