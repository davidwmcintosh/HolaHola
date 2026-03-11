/**
 * HolaHola Curriculum Audit Script
 * 
 * Flags quality issues across all curriculum lessons:
 *   1. Objective / vocabulary mismatches
 *   2. Repeated or near-duplicate drills within the same unit
 *   3. Weak drills (too few vocabulary / grammar items)
 *   4. Units with no textbook content seeded
 *   5. Source contribution summary (Tatoeba / Wiktionary / Wikivoyage hit-rates)
 * 
 * Usage:
 *   npx tsx server/scripts/curriculum-audit.ts
 *   npx tsx server/scripts/curriculum-audit.ts --language spanish
 *   npx tsx server/scripts/curriculum-audit.ts --language spanish --unit 2
 */

import { Pool } from 'pg';

const connectionString = process.env.NEON_SHARED_DATABASE_URL;
if (!connectionString) {
  console.error('NEON_SHARED_DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

// --- CLI args ----------------------------------------------------------------
const args = process.argv.slice(2);
const getArg = (flag: string) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};
const filterLanguage = getArg('--language');
const filterUnit     = getArg('--unit') ? Number(getArg('--unit')) : null;

// --- Helpers ----------------------------------------------------------------
const RESET = '\x1b[0m';
const RED   = '\x1b[31m';
const YELLOW= '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN  = '\x1b[36m';
const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';

function section(title: string) {
  console.log(`\n${BOLD}${CYAN}${'─'.repeat(70)}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${CYAN}${'─'.repeat(70)}${RESET}`);
}

function warn(msg: string)  { console.log(`  ${YELLOW}⚠  ${msg}${RESET}`); }
function error(msg: string) { console.log(`  ${RED}✗  ${msg}${RESET}`); }
function ok(msg: string)    { console.log(`  ${GREEN}✓  ${msg}${RESET}`); }
function info(msg: string)  { console.log(`  ${DIM}${msg}${RESET}`); }

// Detect numeric mentions like "20", "twenty" in a string
const numberWords: Record<string, number> = {
  one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
  eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,
  seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,
  fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,hundred:100,thousand:1000,
};

function extractMaxNumberMentioned(text: string): number {
  const lower = text.toLowerCase();
  let max = 0;
  // digit sequences
  const digitMatches = lower.match(/\b(\d+)\b/g) || [];
  for (const d of digitMatches) max = Math.max(max, parseInt(d, 10));
  // word numbers
  for (const [word, val] of Object.entries(numberWords)) {
    if (lower.includes(word)) max = Math.max(max, val);
  }
  return max;
}

function countVocabNum(vocab: string[]): number {
  // count how many number words are in the vocabulary list
  return vocab.filter(v => {
    const lower = v.toLowerCase();
    // digits: cero/zero, uno/one, dos/two, etc.
    return Object.keys(numberWords).some(w => lower.includes(w)) ||
           /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|once|doce|trece|catorce|quince|dieciséis|diecisiete|dieciocho|diecinueve|veinte|vingt|zwanzig|venti|nihongo)\b/i.test(lower);
  }).length;
}

// Naïve similarity: shared word overlap
function similarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const setB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  if (setA.size === 0 && setB.size === 0) return 1;
  let shared = 0;
  for (const w of setA) if (setB.has(w)) shared++;
  return shared / Math.max(setA.size, setB.size);
}

// --- Main -------------------------------------------------------------------
async function main() {
  const client = await pool.connect();

  try {
    console.log(`\n${BOLD}HolaHola Curriculum Audit${RESET}`);
    if (filterLanguage) info(`Filtering language: ${filterLanguage}`);
    if (filterUnit)     info(`Filtering unit order: ${filterUnit}`);

    // 1. Fetch all lessons with their path / unit info
    const langClause  = filterLanguage ? `AND cp.language = '${filterLanguage}'` : '';
    const unitClause  = filterUnit     ? `AND cu.order_index = ${filterUnit}`    : '';

    const { rows: lessons } = await client.query(`
      SELECT
        cl.id, cl.name, cl.description, cl.lesson_type, cl.objectives,
        cl.required_vocabulary, cl.required_grammar,
        cl.enrichment_notes, cl.enriched_at,
        cu.id as unit_id, cu.name as unit_name, cu.order_index as unit_order,
        cp.language, cp.name as path_name
      FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cu.id = cl.curriculum_unit_id
      JOIN curriculum_paths cp ON cp.id = cu.curriculum_path_id
      WHERE 1=1 ${langClause} ${unitClause}
      ORDER BY cp.language, cp.name, cu.order_index, cl.name
    `);

    // 2. Fetch textbook content existence
    const { rows: seededRows } = await client.query(`
      SELECT DISTINCT lesson_id FROM textbook_lesson_content
    `);
    const seededSet = new Set(seededRows.map((r: any) => r.lesson_id));

    // ── Issue counters ───────────────────────────────────────────────────────
    const issues: Record<string, {lesson: string; path: string; unit: string; details: string}[]> = {
      vocab_mismatch:   [],
      weak_drill:       [],
      duplicate_drill:  [],
      no_textbook:      [],
    };

    // Group lessons by unit for duplicate detection
    const byUnit = new Map<string, typeof lessons>();
    for (const l of lessons) {
      const key = l.unit_id;
      if (!byUnit.has(key)) byUnit.set(key, []);
      byUnit.get(key)!.push(l);
    }

    // ── Check 1: Objective / vocabulary mismatch ─────────────────────────────
    for (const l of lessons) {
      const vocab: string[] = l.required_vocabulary || [];
      const objectives: string[] = l.objectives || [];
      const objText = objectives.join(' ');

      const claimedMax = extractMaxNumberMentioned(objText);
      if (claimedMax > 0 && vocab.length > 0) {
        const vocabNums = countVocabNum(vocab);
        // if the objective mentions a number ceiling and vocab has number words but not enough
        if (claimedMax >= 10 && vocabNums < claimedMax / 2) {
          issues.vocab_mismatch.push({
            lesson: l.name,
            path: l.path_name,
            unit: l.unit_name,
            details: `Objective says count to ${claimedMax}, but only ${vocabNums} number word(s) in vocab (${vocab.length} total items)`,
          });
        }
      }

      // Objective mentions a topic clearly absent from vocab
      const mentionsFood = /food|meal|eat|drink|restaurant/i.test(objText);
      const vocabHasFood = vocab.some(v => /food|meal|eat|drink|restaurant|comida|boire|essen/i.test(v));
      if (mentionsFood && !vocabHasFood && vocab.length > 0) {
        issues.vocab_mismatch.push({
          lesson: l.name,
          path: l.path_name,
          unit: l.unit_name,
          details: `Objective mentions food/meals but no food vocabulary found`,
        });
      }
    }

    // ── Check 2: Weak drills (≤ 5 vocab items for a vocabulary/drill lesson) ─
    for (const l of lessons) {
      const isDrill = /practice time|drill|new words|vocabulary/i.test(l.name) ||
                      l.lesson_type === 'vocabulary_drill';
      const vocab: string[] = l.required_vocabulary || [];
      if (isDrill && vocab.length <= 5 && vocab.length > 0) {
        issues.weak_drill.push({
          lesson: l.name,
          path: l.path_name,
          unit: l.unit_name,
          details: `Only ${vocab.length} vocabulary item(s) — typical drills have 12–14`,
        });
      }
      if (isDrill && vocab.length === 0) {
        issues.weak_drill.push({
          lesson: l.name,
          path: l.path_name,
          unit: l.unit_name,
          details: 'No vocabulary items at all',
        });
      }
    }

    // ── Check 3: Duplicate / near-duplicate drills within same unit ──────────
    for (const [, unitLessons] of byUnit) {
      const drills = unitLessons.filter(l =>
        /practice time|drill|let.*chat|new words/i.test(l.name) ||
        l.lesson_type === 'vocabulary_drill' || l.lesson_type === 'conversation'
      );
      for (let i = 0; i < drills.length; i++) {
        for (let j = i + 1; j < drills.length; j++) {
          const sim = similarity(drills[i].name, drills[j].name);
          if (sim >= 0.6) {
            issues.duplicate_drill.push({
              lesson: drills[i].name,
              path: drills[i].path_name,
              unit: drills[i].unit_name,
              details: `Very similar to "${drills[j].name}" (${Math.round(sim * 100)}% overlap)`,
            });
          }
        }
      }
    }

    // ── Check 4: Missing textbook content ────────────────────────────────────
    for (const l of lessons) {
      if (!seededSet.has(l.id)) {
        issues.no_textbook.push({
          lesson: l.name,
          path: l.path_name,
          unit: l.unit_name,
          details: 'No textbook_lesson_content row found',
        });
      }
    }

    // ── Source contribution stats ─────────────────────────────────────────────
    section('SOURCE CONTRIBUTION RATES');
    const enriched = lessons.filter(l => l.enrichment_notes);
    const total = enriched.length;

    const wikiCount = enriched.filter(l => {
      const w = l.enrichment_notes?.wiktionary || '';
      return /\d+ of \d+ words confirmed/.test(w) && !/^0 of/.test(w);
    }).length;

    const tatoebaCount = enriched.filter(l => {
      const t = l.enrichment_notes?.tatoeba || '';
      return /sentences available/i.test(t) || /\d+ sentences/.test(t);
    }).length;

    const wikivoyageCount = enriched.filter(l => {
      const wv = l.enrichment_notes?.wikivoyage || '';
      return /found/i.test(wv) && !/not applicable|not available/i.test(wv);
    }).length;

    console.log(`\n  Total enriched lessons : ${total}`);
    console.log(`  Wiktionary contributed : ${wikiCount} / ${total} (${Math.round(wikiCount/total*100)}%)`);
    console.log(`  Tatoeba contributed    : ${tatoebaCount} / ${total} (${Math.round(tatoebaCount/total*100)}%)`);
    console.log(`  Wikivoyage contributed : ${wikivoyageCount} / ${total} (${Math.round(wikivoyageCount/total*100)}%)`);

    // ── Print all issues ──────────────────────────────────────────────────────
    section(`OBJECTIVE / VOCABULARY MISMATCHES  (${issues.vocab_mismatch.length})`);
    if (issues.vocab_mismatch.length === 0) {
      ok('None found');
    } else {
      for (const i of issues.vocab_mismatch) {
        error(`[${i.path}] ${i.unit} → ${i.lesson}`);
        info(`       ${i.details}`);
      }
    }

    section(`WEAK DRILLS  (${issues.weak_drill.length})`);
    if (issues.weak_drill.length === 0) {
      ok('None found');
    } else {
      for (const i of issues.weak_drill) {
        warn(`[${i.path}] ${i.unit} → ${i.lesson}`);
        info(`       ${i.details}`);
      }
    }

    section(`DUPLICATE / NEAR-DUPLICATE DRILLS IN SAME UNIT  (${issues.duplicate_drill.length})`);
    if (issues.duplicate_drill.length === 0) {
      ok('None found');
    } else {
      for (const i of issues.duplicate_drill) {
        warn(`[${i.path}] ${i.unit} → ${i.lesson}`);
        info(`       ${i.details}`);
      }
    }

    section(`MISSING TEXTBOOK CONTENT  (${issues.no_textbook.length})`);
    if (issues.no_textbook.length === 0) {
      ok('All lessons have textbook content');
    } else {
      for (const i of issues.no_textbook) {
        error(`[${i.path}] ${i.unit} → ${i.lesson}`);
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    section('SUMMARY');
    const totalIssues = Object.values(issues).reduce((s, v) => s + v.length, 0);
    console.log(`\n  Total lessons audited   : ${lessons.length}`);
    console.log(`  Vocab mismatches        : ${issues.vocab_mismatch.length}`);
    console.log(`  Weak drills             : ${issues.weak_drill.length}`);
    console.log(`  Duplicate drills        : ${issues.duplicate_drill.length}`);
    console.log(`  Missing textbook content: ${issues.no_textbook.length}`);
    console.log(`  ─────────────────────────────────────`);
    const color = totalIssues === 0 ? GREEN : totalIssues < 20 ? YELLOW : RED;
    console.log(`  ${color}${BOLD}Total issues            : ${totalIssues}${RESET}\n`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
