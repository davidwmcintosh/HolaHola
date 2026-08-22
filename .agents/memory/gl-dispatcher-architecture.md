---
name: GL dispatcher architecture
description: Hybrid dispatcher pattern for Gemini Live's 64-tool hard limit — all 139 tools accessible via 59 native + 4 dispatcher declarations.
---

# GL Dispatcher Architecture

**Why:** Gemini Live has a hard 64-tool declaration limit per session. The registry had 139 tools; 76 were excluded, leaving critical tools (Kanji stroke, phonetic, tones, conjugation tables, all memory/admin tools) inaccessible in voice sessions.

**Solution:** Hybrid — 59 native + 4 dispatchers = 63 ≤ 64.

## 4 Dispatchers
- `classroom_widget(widget, params_json)` → 27 visual widget tools (clock, anatomy, weather, map, whiteboard, scene, menus…)
- `exercise_tool(type, params_json)` → 19 language exercise tools (stroke, phonetic, tone, conjugation, drills, textbook…)
- `memory_action(action, params_json)` → 15 memory/progress tools (save memory, browse syllabus, mark covered, goals…)
- `admin_action(action, params_json)` → 15 admin tools (consent, hive suggestion, express lane, close session…)

## Key decisions
- **`params_json: string`** (not object) — per Gemini 3.x's explicit recommendation for better GL schema adherence. Gemini reliably generates valid JSON strings when told to; it struggles with nested object schemas.
- **Fuzzy parse:** `parseDispatcherParams()` in native-fc-handlers.ts handles single-quote JSON and the "redundant key" failure mode (`{set_clock:{time:"3:30"}} → {time:"3:30"}`).
- **Routing:** `lookupLegacyType(toolName)` → synthetic `ExtractedFunctionCall` → `this.handle()` recursively. Zero duplication — existing handlers untouched.
- **4 native tools demoted** to free slots: `show_menu`, `show_daily_plan`, `set_right_pane`, `sense_time` (all accessible via classroom_widget dispatcher).

## How to apply
- Adding a new tool: add it to the relevant dispatcher's `enum` in parametersJsonSchema. No other changes.
- Adding a new dispatcher: add registry entry (legacyType SCREAMING_SNAKE) + handler case + enum entries + update GL_DISPATCHER_SYSTEM_PROMPT examples.
- Dispatcher reliability: Gemini 3.x estimated 85-90% for simple tools with clear enum values.

**Why NOT params:object:** Gemini consistently struggles with nested object schemas in GL function calling — it either sends the tool name as a redundant key or fails to match the schema. String-encoded JSON sidesteps the schema enforcement entirely.
