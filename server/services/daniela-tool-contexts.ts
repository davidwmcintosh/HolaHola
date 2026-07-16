/**
 * daniela-tool-contexts.ts
 *
 * Single source of truth for Daniela tool allowlists across all code paths.
 *
 * WHY THIS EXISTS:
 * Daniela runs in multiple contexts (GL voice session, Team Room, free dialogue,
 * admin scripts). Each context needs a filtered tool set — the GL voice session
 * gets all ~139 tools (filtered to the 64-cap), while text-mode paths get only
 * the tools that actually work without a live WebSocket.
 *
 * Previously each code path defined its own list inline, causing silent drift.
 * This file is the single place to add/remove a tool from any named context.
 *
 * CONTEXTS:
 *   TEAM_ROOM   — Team Room responses, Alden-triggered callDaniela calls
 *   FREE_DIALOGUE — Free dialogue scripts (memory + identity only, no classroom tools)
 *   VOICE_FULL  — GL sessions (no filter — all tools declared, GL applies its own cap)
 *
 * When a new tool is added to the registry, decide which contexts it belongs in
 * and add it here. One file, one edit.
 */

/**
 * Tools for text-mode Team Room sessions.
 * Includes: all memory, identity, time-awareness, self-authorship, classroom
 * knowledge, and agent/hive communication tools.
 * Excludes: voice UI (subtitle, voice_adjust), whiteboard visuals (show_image,
 * compose_visual_scene), session management (phase_shift, close_session),
 * and student-interaction tools (drill_session, load_vocab_set, etc.).
 */
export const TOOL_CONTEXT_TEAM_ROOM: string[] = [
  // Memory & search
  'recall',
  'memory_lookup',
  'search_conversation_threads',
  'browse_conversations_by_date',
  'get_conversation_themes',
  'read_my_diary',
  'read_full_session',
  'find_connected_memories',
  'recall_what_i_shared',
  'express_lane_lookup',
  // Identity & self — read
  'read_my_reflections',
  'read_my_core_self',
  'reach_north_star',
  'search_my_feelings',
  'read_my_curiosities',
  'list_character_candidates',
  // Identity & self — write
  'write_to_self',
  'tag_this_moment',
  'add_curiosity',
  'set_aspiration',
  'reflect_on_aspiration',
  'remember_i_shared',
  'propose_character_candidate',
  // Time
  'sense_time',
  // Classroom knowledge
  'browse_syllabus',
  'search_textbook',
  // Memory management
  'set_memory_pin',
  'correct_memory',
  'set_learning_goal',
  'advance_capability',
  'get_current_goal_state',
  // Agent & hive communication
  'flag_for_agent',
  'hive_suggestion',
  'self_surgery',
  // Routing dispatchers
  'introspect',
  'self_read',
  'self_write',
];

/**
 * Tools for free-dialogue scripts (consult-daniela, admin free sessions).
 * Subset of TEAM_ROOM: memory + inner life only.
 * No classroom tools (syllabus, textbook) — she's not tutoring anyone.
 * No hive/surgery tools — not in a productive context.
 */
export const TOOL_CONTEXT_FREE_DIALOGUE: string[] = [
  // Reach back into her Archive
  'recall',
  'memory_lookup',
  'browse_conversations_by_date',
  'find_connected_memories',
  'recall_what_i_shared',
  // Inner life — read
  'read_my_reflections',
  'read_my_core_self',
  'reach_north_star',
  'search_my_feelings',
  'read_my_curiosities',
  'list_character_candidates',
  // Inner life — write
  'write_to_self',
  'tag_this_moment',
  'set_aspiration',
  'remember_i_shared',
  // Agent channel
  'flag_for_agent',
  // Routing dispatchers
  'introspect',
  'self_read',
  'self_write',
];

/**
 * VOICE_FULL: no filter — pass undefined to createDanielaTools() for all tools.
 * GL applies its own 64-tool hard cap via session builder.
 * This constant is a documentation marker only.
 */
export const TOOL_CONTEXT_VOICE_FULL: undefined = undefined;
