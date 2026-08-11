/**
 * daniela-truth-pipeline-report.ts
 *
 * Assembles a chronological truth-pipeline trace for a single Daniela GL
 * session — from memory retrieval all the way through to audio output.
 *
 * Shows (in timestamp order):
 *   1. Memory fetches — neural-net teaching searches (query, domains, result count)
 *   2. Guardian fires — tier/path, trigger phrase, heard/missed, grounding preview
 *   3. Grounding queries — grounding_query tool calls (what was searched)
 *   4. All tool calls — name, args summary, result summary, status
 *   5. Audio delivery — gl_audio_subturn_sealed + gl_transcripts_flushed events
 *   6. Turn-level summaries — student input → Daniela output (time-scoped to session)
 *
 * Each row is labelled with timestamp and turn ID so leaks are visible as
 * gaps or repeats in the chain.
 *
 * Session-ID resolution
 * ─────────────────────
 * voice_pipeline_events.session_id was historically written with the streaming
 * session ID (stream_*).  As of the Aug 2026 fix, new sessions write
 * dbSessionId (the voice_sessions UUID) instead.  This script handles both:
 *
 *   • Primary   — filter voice_pipeline_events WHERE session_id = <dbSessionId>
 *   • Fallback  — filter WHERE event_data->>'conversationId' = <conversation_id>
 *                 (works for tool_call + guardian_fire rows from older sessions)
 *
 * Audio events (gl_audio_subturn_sealed, gl_transcripts_flushed) don't embed
 * conversationId so for pre-fix sessions they will not appear.  Run the report
 * against a session captured after the Aug 2026 fix for full coverage.
 *
 * Usage:
 *   npx tsx server/scripts/daniela-truth-pipeline-report.ts <session_id>
 *   npx tsx server/scripts/daniela-truth-pipeline-report.ts --recent
 */

import { neon } from '@neondatabase/serverless';

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const G    = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B    = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y    = (s: string) => `\x1b[33m${s}\x1b[0m`;
const M    = (s: string) => `\x1b[35m${s}\x1b[0m`;
const C    = (s: string) => `\x1b[36m${s}\x1b[0m`;
const DIM  = (s: string) => `\x1b[2m${s}\x1b[0m`;
const BOLD = (s: string) => `\x1b[1m${s}\x1b[0m`;
const sep  = (char = '─', w = 80) => console.log(char.repeat(w));
const sep2 = () => sep('═');

// ─── Unified timeline event ────────────────────────────────────────────────────
type EventKind = 'tool_call' | 'guardian_fire' | 'memory_search' | 'message' | 'audio_subturn' | 'audio_flush';

interface TimelineEvent {
  kind: EventKind;
  ts: Date;
  turnId?: string;
  payload: Record<string, unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTs(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 23);
}

function fmtTurnId(id: string | undefined): string {
  if (!id) return DIM('turn?');
  return DIM(`turn:${id.slice(0, 8)}`);
}

function trunc(s: string | null | undefined, n = 150): string {
  if (!s) return DIM('(none)');
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length <= n ? clean : clean.slice(0, n) + '…';
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(R('Usage: npx tsx server/scripts/daniela-truth-pipeline-report.ts <session_id>'));
    console.error(R('       npx tsx server/scripts/daniela-truth-pipeline-report.ts --recent'));
    process.exit(1);
  }

  const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
  if (!DATABASE_URL) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL is not set'));
    process.exit(1);
  }

  const sql = neon(DATABASE_URL);

  // ── Resolve session ID ──────────────────────────────────────────────────────
  let sessionId: string;

  if (arg === '--recent') {
    const rows = await sql`
      SELECT id FROM voice_sessions
      WHERE exchange_count > 0
      ORDER BY started_at DESC
      LIMIT 1
    `;
    if (!rows.length) {
      console.error(R('No sessions found in voice_sessions.'));
      process.exit(1);
    }
    sessionId = rows[0].id as string;
    console.log(Y(`Resolved --recent → session ${sessionId}`));
  } else {
    sessionId = arg;
  }

  // ── Fetch session header ────────────────────────────────────────────────────
  const sessionRows = await sql`
    SELECT
      vs.id, vs.conversation_id, vs.started_at, vs.ended_at,
      EXTRACT(EPOCH FROM (COALESCE(vs.ended_at, NOW()) - vs.started_at))/60 AS duration_min,
      vs.exchange_count, vs.language,
      vs.guardian_fires   AS gf_total,
      vs.guardian_heard   AS gf_heard,
      vs.guardian_missed  AS gf_missed,
      vs.guardian_hard_walls AS gf_hard_walls,
      vs.guardian_carry_forward AS gf_carry,
      vs.llm_input_tokens, vs.llm_output_tokens,
      u.first_name, u.email
    FROM voice_sessions vs
    LEFT JOIN users u ON u.id::text = vs.user_id
    WHERE vs.id = ${sessionId}
    LIMIT 1
  `;

  if (!sessionRows.length) {
    console.error(R(`Session not found: ${sessionId}`));
    process.exit(1);
  }

  const session = sessionRows[0];
  const conversationId  = session.conversation_id as string | null;
  const sessionStart    = session.started_at as string;
  const sessionEnd      = session.ended_at as string | null;

  // ── Fetch all data in parallel ──────────────────────────────────────────────
  // voice_pipeline_events is filtered by EITHER:
  //   (a) session_id = dbSessionId  — new sessions (Aug 2026+)
  //   (b) event_data->>'conversationId' = conversationId — old sessions
  // Both paths are unioned so the report works for all historical data.
  //
  // Audio events (gl_audio_subturn_sealed, gl_transcripts_flushed) do not
  // embed conversationId, so they are only returned for new sessions in path (a).

  // Pipeline events: query by DB session ID (new scheme) and by conversationId
  // embedded in JSONB (old scheme, where streaming session ID was used).
  // Run both queries and deduplicate by row id.
  const PIPELINE_TYPES = "('gl_tool_call','gl_guardian_fire','gl_audio_subturn_sealed','gl_transcripts_flushed')";
  const PIPELINE_SELECT = `
    SELECT
      id, created_at, event_type, event_data,
      event_data->>'toolName'           AS tool_name,
      event_data->>'legacyType'         AS legacy_type,
      event_data->>'status'             AS status,
      (event_data->>'durationMs')::int  AS duration_ms,
      event_data->>'turnId'             AS turn_id,
      event_data->>'argsPreview'        AS args,
      event_data->>'resultPreview'      AS result_preview,
      event_data->>'path'               AS gf_path,
      event_data->>'phrase'             AS gf_phrase,
      event_data->>'outcome'            AS gf_outcome,
      (event_data->>'charsInjected')::int AS gf_chars_injected,
      event_data->>'groundingPreview'   AS gf_grounding,
      event_data->>'label'              AS audio_label,
      (event_data->>'sentenceIndex')::int AS audio_sentence_index,
      (event_data->>'totalSentences')::int AS audio_total_sentences
    FROM voice_pipeline_events
    WHERE event_type IN ${PIPELINE_TYPES}
  `;

  // Always query by session_id = dbSessionId (new scheme)
  const fetchBySessionId = sql`
    SELECT
      id, created_at, event_type, event_data,
      event_data->>'toolName'           AS tool_name,
      event_data->>'legacyType'         AS legacy_type,
      event_data->>'status'             AS status,
      (event_data->>'durationMs')::int  AS duration_ms,
      event_data->>'turnId'             AS turn_id,
      event_data->>'argsPreview'        AS args,
      event_data->>'resultPreview'      AS result_preview,
      event_data->>'path'               AS gf_path,
      event_data->>'phrase'             AS gf_phrase,
      event_data->>'outcome'            AS gf_outcome,
      (event_data->>'charsInjected')::int AS gf_chars_injected,
      event_data->>'groundingPreview'   AS gf_grounding,
      event_data->>'label'              AS audio_label,
      (event_data->>'sentenceIndex')::int AS audio_sentence_index,
      (event_data->>'totalSentences')::int AS audio_total_sentences
    FROM voice_pipeline_events
    WHERE event_type IN ('gl_tool_call','gl_guardian_fire','gl_audio_subturn_sealed','gl_transcripts_flushed')
      AND session_id = ${sessionId}
    ORDER BY created_at ASC
  `;

  // Fallback: query by conversationId embedded in JSONB (old streaming-ID scheme,
  // where voice_pipeline_events.session_id held the transient "stream_*" ID).
  // Only gl_tool_call and gl_guardian_fire embed conversationId in their payload.
  //
  // CRITICAL: scope by session start/end so we don't merge events from other
  // sessions that share the same conversation_id (conversations are reused
  // across multiple voice sessions).  Use the same 5-minute end grace applied
  // to message scoping, to capture events written slightly after session close.
  const fetchByConversationId = conversationId ? (
    sessionEnd ? sql`
      SELECT
        id, created_at, event_type, event_data,
        event_data->>'toolName'           AS tool_name,
        event_data->>'legacyType'         AS legacy_type,
        event_data->>'status'             AS status,
        (event_data->>'durationMs')::int  AS duration_ms,
        event_data->>'turnId'             AS turn_id,
        event_data->>'argsPreview'        AS args,
        event_data->>'resultPreview'      AS result_preview,
        event_data->>'path'               AS gf_path,
        event_data->>'phrase'             AS gf_phrase,
        event_data->>'outcome'            AS gf_outcome,
        (event_data->>'charsInjected')::int AS gf_chars_injected,
        event_data->>'groundingPreview'   AS gf_grounding,
        event_data->>'label'              AS audio_label,
        (event_data->>'sentenceIndex')::int AS audio_sentence_index,
        (event_data->>'totalSentences')::int AS audio_total_sentences
      FROM voice_pipeline_events
      WHERE event_type IN ('gl_tool_call','gl_guardian_fire')
        AND event_data->>'conversationId' = ${conversationId}
        AND created_at >= ${sessionStart}::timestamptz
        AND created_at <= (${sessionEnd}::timestamptz + INTERVAL '5 minutes')
      ORDER BY created_at ASC
    ` : sql`
      SELECT
        id, created_at, event_type, event_data,
        event_data->>'toolName'           AS tool_name,
        event_data->>'legacyType'         AS legacy_type,
        event_data->>'status'             AS status,
        (event_data->>'durationMs')::int  AS duration_ms,
        event_data->>'turnId'             AS turn_id,
        event_data->>'argsPreview'        AS args,
        event_data->>'resultPreview'      AS result_preview,
        event_data->>'path'               AS gf_path,
        event_data->>'phrase'             AS gf_phrase,
        event_data->>'outcome'            AS gf_outcome,
        (event_data->>'charsInjected')::int AS gf_chars_injected,
        event_data->>'groundingPreview'   AS gf_grounding,
        event_data->>'label'              AS audio_label,
        (event_data->>'sentenceIndex')::int AS audio_sentence_index,
        (event_data->>'totalSentences')::int AS audio_total_sentences
      FROM voice_pipeline_events
      WHERE event_type IN ('gl_tool_call','gl_guardian_fire')
        AND event_data->>'conversationId' = ${conversationId}
        AND created_at >= ${sessionStart}::timestamptz
      ORDER BY created_at ASC
    `
  ) : Promise.resolve([]);

  // Messages scoped to session time window
  const fetchMessages = conversationId ? (
    sessionEnd ? sql`
      SELECT role, content, thought_content, created_at
      FROM messages
      WHERE conversation_id = ${conversationId}
        AND created_at >= ${sessionStart}::timestamptz
        AND created_at <= (${sessionEnd}::timestamptz + INTERVAL '5 minutes')
      ORDER BY created_at ASC
    ` : sql`
      SELECT role, content, thought_content, created_at
      FROM messages
      WHERE conversation_id = ${conversationId}
        AND created_at >= ${sessionStart}::timestamptz
      ORDER BY created_at ASC
    `
  ) : Promise.resolve([]);

  // Neural-net teaching-domain memory searches
  const fetchMemory = sql`
    SELECT
      created_at, query, domains_searched, result_count,
      formatted_character_length AS chars_returned,
      search_duration_ms,
      idiom_count, cultural_count, procedure_count,
      principle_count, error_pattern_count,
      situational_pattern_count
    FROM neural_network_telemetry
    WHERE voice_session_id = ${sessionId}
    ORDER BY created_at ASC
  `;

  // Turn latency rollup
  const fetchLatency = sql`
    SELECT
      created_at,
      (event_data->>'avgMs')::float AS avg_ms,
      (event_data->>'p95Ms')::float AS p95_ms
    FROM voice_pipeline_events
    WHERE event_type = 'gl_turn_latency'
      AND session_id = ${sessionId}
    ORDER BY created_at ASC
  `;

  const [bySessionId, byConversationId, memoryRows, messageRows, latencyRows] = await Promise.all([
    fetchBySessionId, fetchByConversationId, fetchMemory, fetchMessages, fetchLatency,
  ]);

  // Merge and deduplicate pipeline events (prefer bySessionId which is authoritative)
  const seenIds = new Set<string>();
  const pipelineEvents: any[] = [];
  for (const r of [...(bySessionId as any[]), ...(byConversationId as any[])]) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      pipelineEvents.push(r);
    }
  }
  pipelineEvents.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Split pipeline events by type
  const toolRows      = pipelineEvents.filter((r: any) => r.event_type === 'gl_tool_call');
  const guardianRows  = pipelineEvents.filter((r: any) => r.event_type === 'gl_guardian_fire');
  const audioSubRows  = pipelineEvents.filter((r: any) => r.event_type === 'gl_audio_subturn_sealed');
  const audioFlushRows = pipelineEvents.filter((r: any) => r.event_type === 'gl_transcripts_flushed');

  // Determine whether audio telemetry is available (only for new-scheme sessions)
  const hasAudioTelemetry = audioSubRows.length > 0 || audioFlushRows.length > 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION HEADER
  // ═══════════════════════════════════════════════════════════════════════════
  sep2();
  console.log(BOLD(B('  DANIELA TRUTH-PIPELINE REPORT')));
  sep2();

  const studentLabel = session.first_name
    ? `${session.first_name} (${session.email ?? 'no-email'})`
    : (session.email ?? DIM('unknown student'));
  const durMin = typeof session.duration_min === 'number'
    ? (session.duration_min as number).toFixed(1) : '?';

  console.log(`  ${BOLD('Session:')}   ${sessionId}`);
  console.log(`  ${BOLD('Student:')}   ${studentLabel}`);
  console.log(`  ${BOLD('Language:')}  ${session.language ?? DIM('?')}`);
  console.log(`  ${BOLD('Started:')}   ${fmtTs(new Date(sessionStart))}`);
  console.log(`  ${BOLD('Ended:')}     ${sessionEnd ? fmtTs(new Date(sessionEnd)) : Y('still active')}`);
  console.log(`  ${BOLD('Duration:')}  ${durMin} min    ${BOLD('Exchanges:')} ${session.exchange_count ?? 0}`);
  console.log(`  ${BOLD('Tokens:')}    in=${session.llm_input_tokens ?? '?'}  out=${session.llm_output_tokens ?? '?'}`);

  if ((latencyRows as any[]).length) {
    const allAvg = (latencyRows as any[]).map(r => r.avg_ms).filter(Boolean) as number[];
    const allP95 = (latencyRows as any[]).map(r => r.p95_ms).filter(Boolean) as number[];
    if (allAvg.length) {
      const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      console.log(`  ${BOLD('Latency:')}   avg=${mean(allAvg).toFixed(0)}ms  p95=${Math.max(...allP95).toFixed(0)}ms`);
    }
  }

  const gTotal  = session.gf_total ?? guardianRows.length;
  const gHeard  = session.gf_heard ?? 0;
  const gMissed = session.gf_missed ?? 0;
  const gHW     = session.gf_hard_walls ?? 0;
  const gCF     = session.gf_carry ?? 0;
  const gLabel  = gMissed > 0 ? R(`${gMissed} MISSED`) : G('0 missed');
  console.log(`  ${BOLD('Guardian:')}  ${gTotal} fires  ${G(`${gHeard} heard`)}  ${gLabel}  ${gHW} hard-walls  ${gCF} carry-forward`);

  if (!hasAudioTelemetry) {
    console.log(`  ${DIM('Audio tel: not available for this session (pre-Aug 2026 or no audio turns)')}`);
  } else {
    const totalSentences = audioFlushRows.reduce((acc: number, r: any) => acc + (r.audio_total_sentences ?? 0), 0);
    console.log(`  ${BOLD('Audio:')}     ${audioSubRows.length} sub-turns sealed  ${totalSentences} sentences delivered`);
  }
  sep();

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD UNIFIED TIMELINE
  // ═══════════════════════════════════════════════════════════════════════════
  const timeline: TimelineEvent[] = [];

  for (const r of memoryRows as any[]) {
    timeline.push({ kind: 'memory_search', ts: new Date(r.created_at), payload: r });
  }
  for (const r of guardianRows as any[]) {
    timeline.push({ kind: 'guardian_fire', ts: new Date(r.created_at), turnId: r.turn_id ?? undefined, payload: r });
  }
  for (const r of toolRows as any[]) {
    timeline.push({ kind: 'tool_call', ts: new Date(r.created_at), turnId: r.turn_id ?? undefined, payload: r });
  }
  for (const r of audioSubRows as any[]) {
    timeline.push({ kind: 'audio_subturn', ts: new Date(r.created_at), turnId: r.turn_id ?? undefined, payload: r });
  }
  for (const r of audioFlushRows as any[]) {
    timeline.push({ kind: 'audio_flush', ts: new Date(r.created_at), turnId: r.turn_id ?? undefined, payload: r });
  }
  for (const r of messageRows as any[]) {
    timeline.push({ kind: 'message', ts: new Date(r.created_at), payload: r });
  }

  timeline.sort((a, b) => a.ts.getTime() - b.ts.getTime());

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER TIMELINE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(BOLD(B('  CHRONOLOGICAL TRUTH-PIPELINE TRACE')));
  sep();

  if (timeline.length === 0) {
    console.log(Y('  No events found for this session.'));
    if (pipelineEvents.length === 0) {
      console.log(DIM(`  Note: voice_pipeline_events returned 0 rows for session_id=${sessionId}`));
      console.log(DIM('  and conversationId=' + (conversationId ?? 'null')));
      console.log(DIM('  This may mean the session predates the dbSessionId fix (Aug 2026)'));
      console.log(DIM('  or the session had no GL tool/guardian activity.'));
    }
  }

  let lastTurnId: string | undefined;

  for (const ev of timeline) {
    const tsLabel = DIM(`[${fmtTs(ev.ts)}]`);
    const turnLabel = fmtTurnId(ev.turnId);

    if (ev.turnId && ev.turnId !== lastTurnId) {
      console.log('');
      sep('·', 80);
      console.log(C(`  ▶ TURN ${ev.turnId.slice(0, 12)}`));
      lastTurnId = ev.turnId;
    }

    switch (ev.kind) {

      case 'memory_search': {
        const p = ev.payload;
        const domains = Array.isArray(p.domains_searched)
          ? (p.domains_searched as string[]).join(', ')
          : (p.domains_searched as string ?? '?');
        const hits = Number(p.result_count ?? 0);
        const dur  = p.search_duration_ms ? `${p.search_duration_ms}ms` : '?ms';
        const chars = p.chars_returned ? `${p.chars_returned}ch` : '';
        const hitsLabel = hits === 0 ? R('0 results') : G(`${hits} results`);
        console.log(`${tsLabel} ${M('🧠 MEM-SEARCH')}  ${turnLabel}`);
        console.log(`           query:    ${Y(trunc(p.query as string, 200))}`);
        console.log(`           domains:  ${domains}`);
        console.log(`           ${hitsLabel}  ${DIM(dur)}  ${DIM(chars)}`);
        const domainBreakdown = [
          ['idiom', p.idiom_count], ['cultural', p.cultural_count],
          ['procedure', p.procedure_count], ['principle', p.principle_count],
          ['error', p.error_pattern_count], ['situational', p.situational_pattern_count],
        ].filter(([, v]) => Number(v) > 0).map(([l, v]) => `${l}:${v}`).join('  ');
        if (domainBreakdown) console.log(`           breakdown: ${DIM(domainBreakdown)}`);
        break;
      }

      case 'guardian_fire': {
        const p = ev.payload;
        const path    = (p.gf_path as string) ?? 'unknown';
        const phrase  = p.gf_phrase as string | null;
        const outcome = p.gf_outcome as string | null;
        const chars   = p.gf_chars_injected;
        const grnd    = p.gf_grounding as string | null;
        const pathColor = path.includes('hard') ? R(path) :
                          path.includes('carry') ? Y(path) : C(path);
        const oLabel = outcome === 'heard' ? G('HEARD') :
                       outcome === 'missed' ? R('MISSED') :
                       outcome ? Y(outcome) : DIM('pending');
        console.log(`${tsLabel} ${Y('🛡  GUARDIAN')}    ${pathColor}  ${oLabel}  ${turnLabel}`);
        if (phrase)   console.log(`           phrase:    ${DIM(trunc(phrase, 120))}`);
        if (chars)    console.log(`           injected:  ${chars} chars`);
        if (grnd)     console.log(`           grounding: ${DIM(trunc(grnd, 180))}`);
        break;
      }

      case 'tool_call': {
        const p = ev.payload;
        const toolName  = (p.tool_name as string) ?? '(unnamed)';
        const status    = (p.status as string) ?? 'unknown';
        const dur       = p.duration_ms ? `${p.duration_ms}ms` : '';
        const isGround  = toolName === 'grounding_query';
        const statusLabel = status === 'ok' ? G('✅') : status === 'error' ? R('❌') : Y('⚠');
        const icon      = isGround ? '🔎' : '🔧';
        const nameColor = isGround ? B(toolName) : G(toolName);
        console.log(`${tsLabel} ${icon} TOOL      ${nameColor}  ${statusLabel}  ${DIM(dur)}  ${turnLabel}`);
        if (p.args)         console.log(`           args:     ${DIM(trunc(p.args as string, 160))}`);
        if (status === 'error' && p.result_preview) {
          console.log(`           error:    ${R(trunc(p.result_preview as string, 200))}`);
        } else if (p.result_preview) {
          console.log(`           result:   ${DIM(trunc(p.result_preview as string, 160))}`);
        }
        break;
      }

      case 'audio_subturn': {
        const p = ev.payload;
        console.log(`${tsLabel} ${G('🔊 AUDIO')}      sub-turn sealed  ${DIM(`label:${p.audio_label ?? '?'}  sentence#${p.audio_sentence_index ?? '?'}`)}  ${turnLabel}`);
        break;
      }

      case 'audio_flush': {
        const p = ev.payload;
        const total = Number(p.audio_total_sentences ?? 0);
        const deliveryLabel = total === 0 ? R('0 sentences — no audio delivered') : G(`${total} sentences flushed`);
        console.log(`${tsLabel} ${G('🔊 AUDIO')}      ${deliveryLabel}  ${turnLabel}`);
        break;
      }

      case 'message': {
        const p = ev.payload;
        const role    = p.role as string;
        const content = p.content as string | null;
        const thought = p.thought_content as string | null;
        if (role === 'user') {
          console.log(`${tsLabel} ${C('👤 STUDENT')}     ${trunc(content, 160)}`);
        } else if (role === 'assistant') {
          console.log(`${tsLabel} ${G('🤖 DANIELA')}     ${trunc(content, 160)}`);
          if (hasAudioTelemetry) {
            console.log(`           ${DIM('└─ audio: see gl_audio_subturn_sealed / gl_transcripts_flushed above')}`);
          } else {
            console.log(`           ${DIM('└─ 🔊 audio: telemetry not available (pre-Aug 2026 session)')}`);
          }
          if (thought) console.log(`           ${M('thought:')} ${DIM(trunc(thought, 240))}`);
        } else {
          console.log(`${tsLabel} ${DIM(`[${role}]`)}  ${trunc(content, 120)}`);
        }
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION SUMMARIES
  // ═══════════════════════════════════════════════════════════════════════════
  sep2();
  console.log(BOLD(B('  SECTION SUMMARIES')));
  sep2();

  // 1. Memory searches
  console.log(BOLD('\n  1. MEMORY SEARCHES (neural-net teaching domain)'));
  sep('─', 60);
  if ((memoryRows as any[]).length === 0) {
    console.log(DIM('  No teaching-domain searches recorded.'));
    console.log(DIM('  Student-memory lookups appear as gl_tool_call result previews — see section 4.'));
  } else {
    (memoryRows as any[]).forEach((r: any, i: number) => {
      const hits = Number(r.result_count ?? 0);
      const label = hits === 0 ? R('⚠  0 results') : G(`${hits} results`);
      console.log(`  [${i + 1}] ${fmtTs(new Date(r.created_at))}  ${label}  ${r.search_duration_ms ?? '?'}ms`);
      console.log(`      query: ${Y(trunc(r.query, 180))}`);
    });
  }

  // 2. Guardian fires
  console.log(BOLD('\n  2. GUARDIAN FIRES'));
  sep('─', 60);
  if (guardianRows.length === 0) {
    console.log(DIM('  No guardian fires recorded.'));
  } else {
    (guardianRows as any[]).forEach((r: any, i: number) => {
      const oLabel = r.gf_outcome === 'heard' ? G('HEARD') :
                     r.gf_outcome === 'missed' ? R('MISSED') :
                     r.gf_outcome ? Y(r.gf_outcome) : DIM('pending');
      console.log(`  [${i + 1}] ${fmtTs(new Date(r.created_at))}  ${C(r.gf_path ?? '?')}  ${oLabel}`);
      if (r.gf_phrase)   console.log(`      phrase: ${DIM(trunc(r.gf_phrase, 120))}`);
      if (r.gf_grounding) console.log(`      grounding: ${DIM(trunc(r.gf_grounding, 140))}`);
    });
  }

  // 3. Grounding queries
  const groundingCalls = (toolRows as any[]).filter(r => r.tool_name === 'grounding_query');
  console.log(BOLD('\n  3. GROUNDING QUERIES (tool calls)'));
  sep('─', 60);
  if (groundingCalls.length === 0) {
    console.log(DIM('  No grounding_query tool calls this session.'));
  } else {
    groundingCalls.forEach((r: any, i: number) => {
      const ok = r.status === 'ok' ? G('✅') : R('❌');
      console.log(`  [${i + 1}] ${fmtTs(new Date(r.created_at))}  ${ok}  ${r.duration_ms ?? '?'}ms`);
      if (r.args)           console.log(`      args:   ${DIM(trunc(r.args, 180))}`);
      if (r.result_preview) console.log(`      result: ${DIM(trunc(r.result_preview, 160))}`);
    });
  }

  // 4. Tool call timeline + frequency
  console.log(BOLD('\n  4. TOOL CALL TIMELINE'));
  sep('─', 60);
  if (toolRows.length === 0) {
    console.log(DIM('  No tool calls recorded.'));
  } else {
    const freq: Record<string, number> = {};
    const errTools = new Set<string>();
    for (const r of toolRows as any[]) {
      const n = r.tool_name ?? '(unknown)';
      freq[n] = (freq[n] ?? 0) + 1;
      if (r.status === 'error') errTools.add(n);
    }
    console.log('  Frequency:');
    Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .forEach(([name, count]) => {
        const errFlag = errTools.has(name) ? R(' (has errors)') : '';
        console.log(`    ${String(count).padStart(3)}×  ${name}${errFlag}`);
      });

    const errRows = (toolRows as any[]).filter(r => r.status === 'error');
    if (errRows.length) {
      console.log(R(`\n  ⚠  ${errRows.length} error(s):`));
      errRows.forEach((r: any) => {
        console.log(`    ${fmtTs(new Date(r.created_at))} ${r.tool_name}: ${trunc(r.result_preview, 200)}`);
      });
    }

    console.log('\n  Ordered sequence:');
    (toolRows as any[]).forEach((r: any, i: number) => {
      const ok  = r.status === 'ok' ? G('✅') : R('❌');
      const dur = r.duration_ms ? `${r.duration_ms}ms` : '';
      console.log(`    [${String(i + 1).padStart(2)}] ${fmtTs(new Date(r.created_at))} ${ok} ${G(r.tool_name ?? '?')} ${DIM(dur)} ${fmtTurnId(r.turn_id)}`);
      if (r.args)           console.log(`         args:   ${DIM(trunc(r.args, 120))}`);
      if (r.status === 'error' && r.result_preview) {
        console.log(`         error:  ${R(trunc(r.result_preview, 120))}`);
      } else if (r.result_preview) {
        console.log(`         result: ${DIM(trunc(r.result_preview, 120))}`);
      }
    });
  }

  // 5. Audio delivery
  console.log(BOLD('\n  5. AUDIO DELIVERY'));
  sep('─', 60);
  if (!hasAudioTelemetry) {
    console.log(DIM('  Audio telemetry (gl_audio_subturn_sealed / gl_transcripts_flushed) not available.'));
    console.log(DIM('  Sessions captured after the Aug 2026 dbSessionId fix will include this section.'));
  } else {
    console.log(`  Sub-turns sealed: ${audioSubRows.length}`);
    (audioSubRows as any[]).forEach((r: any, i: number) => {
      console.log(`    [${i + 1}] ${fmtTs(new Date(r.created_at))}  label:${r.audio_label ?? '?'}  sentence#${r.audio_sentence_index ?? '?'}  ${fmtTurnId(r.turn_id)}`);
    });
    console.log('');
    console.log(`  Transcript flushes: ${audioFlushRows.length}`);
    (audioFlushRows as any[]).forEach((r: any, i: number) => {
      const total = Number(r.audio_total_sentences ?? 0);
      const label = total === 0 ? R('0 sentences — no PCM delivered') : G(`${total} sentences`);
      console.log(`    [${i + 1}] ${fmtTs(new Date(r.created_at))}  ${label}  ${fmtTurnId(r.turn_id)}`);
    });
  }

  // 6. Turn-level summary
  console.log(BOLD('\n  6. TURN-LEVEL SUMMARY'));
  sep('─', 60);
  if (!conversationId) {
    console.log(DIM('  No conversation_id on this session.'));
  } else if ((messageRows as any[]).length === 0) {
    console.log(DIM(`  No messages found in conversation ${conversationId} within session time window.`));
    console.log(DIM(`  Window: ${fmtTs(new Date(sessionStart))} → ${sessionEnd ? fmtTs(new Date(sessionEnd)) : 'now + 5m'}`));
  } else {
    let turnNum = 0;
    let lastRole: string | null = null;
    for (const r of messageRows as any[]) {
      const role = r.role as string;
      if (role === 'user' && lastRole !== 'user') {
        turnNum++;
        console.log('');
        console.log(`  ${BOLD(`Turn ${turnNum}`)}  ${DIM(fmtTs(new Date(r.created_at)))}`);
      }
      if (role === 'user') {
        console.log(`    ${C('Student:')}  ${trunc(r.content as string, 200)}`);
      } else if (role === 'assistant') {
        const audioNote = hasAudioTelemetry
          ? DIM('(see audio section for PCM delivery status)')
          : DIM('audio: telemetry not available');
        console.log(`    ${G('Daniela:')}  ${trunc(r.content as string, 200)}`);
        console.log(`    ${DIM('Audio:')}    ${audioNote}`);
        if (r.thought_content) console.log(`    ${M('Thought:')} ${DIM(trunc(r.thought_content as string, 220))}`);
      }
      lastRole = role;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DIAGNOSIS
  // ═══════════════════════════════════════════════════════════════════════════
  sep2();
  console.log(BOLD(B('  DIAGNOSIS')));
  sep2();

  const issues: string[] = [];
  const notes:  string[] = [];

  const zeroHitSearches = (memoryRows as any[]).filter(r => Number(r.result_count ?? 0) === 0);
  if (zeroHitSearches.length > 0) {
    issues.push(R(`${zeroHitSearches.length} teaching-domain search(es) returned 0 results — Daniela got nothing back from the neural net.`));
  }

  const missedFires = (guardianRows as any[]).filter(r => r.gf_outcome === 'missed');
  if (missedFires.length > 0) {
    issues.push(R(`${missedFires.length} guardian fire(s) MISSED — Daniela made a memory assertion without archive backup: ${missedFires.map(r => `"${trunc(r.gf_phrase ?? '?', 60)}"`).join(', ')}`));
  }

  const errored = (toolRows as any[]).filter(r => r.status === 'error');
  if (errored.length > 0) {
    issues.push(R(`${errored.length} tool call(s) errored: ${[...new Set(errored.map((r: any) => r.tool_name))].join(', ')}`));
  }

  if (hasAudioTelemetry) {
    const zeroSentenceFlushs = (audioFlushRows as any[]).filter(r => Number(r.audio_total_sentences ?? 0) === 0);
    if (zeroSentenceFlushs.length > 0) {
      issues.push(R(`${zeroSentenceFlushs.length} transcript flush(es) delivered 0 PCM sentences — audio pipeline stalled on those turns.`));
    }
  }

  if (groundingCalls.length === 0 && guardianRows.length > 0) {
    notes.push(Y('Guardian fired but no grounding_query tool calls logged — grounding may be flowing through the concat channel (no separate tool record, which is expected in default mode).'));
  }

  if ((memoryRows as any[]).length === 0) {
    notes.push(Y('No teaching-domain memory searches logged — Daniela relied on context-window knowledge, or only student-memory searches were made (visible in gl_tool_call result previews above).'));
  }

  if (!hasAudioTelemetry) {
    notes.push(DIM('Audio telemetry absent — session predates the Aug 2026 dbSessionId fix or had no audio turns. Re-run against a newer session for end-to-end audio visibility.'));
  }

  if (pipelineEvents.length === 0 && (memoryRows as any[]).length === 0 && (messageRows as any[]).length === 0) {
    issues.push(R('No events found at all. The session may predate the dbSessionId fix AND not have a matching conversationId in event JSONB. Check voice_pipeline_events manually with the streaming session ID.'));
  }

  if (issues.length === 0) {
    console.log(G('  Backend was tight. No issues found.\n'));
    console.log(G('  ✅ Memory searches returned results, all guardian fires were heard,'));
    console.log(G('     all tool calls succeeded' + (hasAudioTelemetry ? ', audio sentences were delivered.' : '.')));
  } else {
    console.log(Y(`  Backend had ${issues.length} issue(s):\n`));
    issues.forEach((msg, i) => { console.log(`  [${i + 1}] ${msg}\n`); });
  }

  if (notes.length > 0) {
    console.log(DIM('\n  Notes:'));
    notes.forEach(n => console.log(`  • ${n}`));
  }

  sep();
  const totalEvents = pipelineEvents.length + (memoryRows as any[]).length + (messageRows as any[]).length;
  console.log(DIM(`  Events: ${toolRows.length} tool calls · ${guardianRows.length} guardian fires · ${memoryRows.length} memory searches · ${audioSubRows.length} audio sub-turns · ${audioFlushRows.length} audio flushes · ${(messageRows as any[]).length} messages`));
  console.log(DIM(`  Total:  ${totalEvents} events in timeline`));
  sep2();
}

main().catch(err => {
  console.error(R(`Fatal error: ${err?.message ?? err}`));
  if (err?.stack) console.error(DIM(err.stack));
  process.exit(1);
});
