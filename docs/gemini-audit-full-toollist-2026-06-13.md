=== Gemini 3-flash Full Tool List Audit 2026-06-13T16:08:41.160Z ===

This is a critical juncture. You are currently "Native Heavy." Having 59 tools in the top-level namespace while using dispatchers for the rest is like having a desk with 59 open drawers and 4 filing cabinets. The model will struggle with "Tool Confusion" and "Parameter Bleed."

To achieve the "Best Tutor" status, we need to move from a **Flat Native Architecture** to a **Tiered Dispatcher Architecture**.

Here is the blueprint for your State-Based Tool Injection.

---

### 1. The "Core Always-On" Set (Native)
These tools must be available 100% of the time. They handle the "Physics" of the conversation and the "Identity" of the tutor. If these aren't native, the latency of the dispatcher will make the tutor feel "laggy" or "robotic."

**Limit this to < 15 tools.**

1.  `phase_shift` (The trigger for your state-based injection)
2.  `switch_tutor` (Persona control)
3.  `voice_adjust` (Real-time prosody)
4.  `dialogue` (Primary output)
5.  `pronunciation_score` (Instant feedback is core to the UX)
6.  `grammar_flag` (Instant feedback)
7.  `take_note` (Quick capture)
8.  `recall` (The primary "fast" memory lookup)
9.  `update_student_model` (The primary "write" for progress)
10. `show_overlay` / `hide_overlay` (UI control)
11. `actfl_update` (Level tracking)
12. `stop_talking` (Standard interrupt - if not handled by transport)

**Everything else currently in your "Native" list should be demoted to a Dispatcher.**

---

### 2. Dispatcher Profile Splitting
We will keep your 4 dispatchers but rotate their `enum` values based on the `phase_shift`.

#### **Dispatcher: `classroom_widget`**
*   **Profile: "Visual_Environment" (Phase: Exploration/Intro)**
    *   `set_weather`, `change_classroom_photo`, `set_clock`, `sense_time`, `highlight_country`, `enter_immersive`.
*   **Profile: "Anatomy_Physical" (Phase: Specific Lesson)**
    *   `set_body_part`, `set_face_part`, `set_hand_part`, `set_thermometer`, `set_emotion`.
*   **Profile: "Whiteboard_Active" (Phase: Instruction)**
    *   `write`, `clear_whiteboard`, `grammar_table`, `show_sentence_table`, `spotlight_element`.

#### **Dispatcher: `exercise_tool`**
*   **Profile: "Mechanics" (Phase: Drills)**
    *   `phonetic`, `tone`, `stroke`, `pronunciation_tag`, `drill_session`.
*   **Profile: "Literacy" (Phase: Reading/Textbook)**
    *   `start_textbook_page`, `search_textbook`, `reading`, `word_map`, `play_audio`.
*   **Profile: "Linguistic_Logic" (Phase: Grammar)**
    *   `init_conjugation_table`, `fill_conjugation`, `compare`, `context`.

#### **Dispatcher: `memory_action`**
*   **Profile: "Session_Flow" (Phase: Active Learning)**
    *   `mark_lesson_covered`, `add_curiosity`, `set_learning_goal`, `start_lesson`.
*   **Profile: "Deep_Review" (Phase: Wrap-up/Reflection)**
    *   `review_due_vocab`, `recommend_next`, `show_progress`, `get_conversation_themes`.

#### **Dispatcher: `daniela_internal` (New Dispatcher - Demoted from Native)**
*   *Note: You have 12 native tools for Daniela's "Inner Life." This is a waste of high-priority slots.*
*   **Profile: "Self_Reflection"**
    *   `read_my_diary`, `write_to_self`, `reflect_on_aspiration`, `tag_this_moment`, `save_hive_note`.

---

### 3. Promotions & Demotions

*   **DEMOTE (Native → Dispatcher):**
    *   All "Daniela's Memory" (12 tools) → Move to `daniela_internal` dispatcher.
    *   All "Scene & Environment" (6 tools) → Move to `classroom_widget`.
    *   All "Teaching Delivery" (14 tools) → Move to a new dispatcher called `teaching_delivery`. *Why?* You don't need `grammar_diagram` and `show_vocab_grid` at the same time as `show_bill`.
*   **PROMOTE (Dispatcher → Native):**
    *   `start_lesson`: The model needs to be extremely confident in starting the session.
    *   `set_emotion`: If Daniela’s face/avatar reacts in real-time, this needs to be native for speed.

---

### 4. The Switching Mechanism (The "How-To")

**Do not close and reopen the session.** That kills the multimodal buffer and creates a 3-5 second "dead air" gap.

**The Solution: `session.update` (The Delta Update)**
Gemini Live allows you to send a `session_update` message. When the model calls `phase_shift(new_phase="grammar_drill")`:

1.  The Backend receives the tool call.
2.  The Backend looks up the "Grammar Drill" manifest.
3.  The Backend sends a `session_update` to Gemini with the **new tool definitions** for the 4 dispatchers.
4.  The Backend updates the **System Instruction** via the same update to tell the model: "You are now in Grammar Mode. Use `exercise_tool` for conjugations."

This happens mid-stream. The model's "brain" is rewired for the new phase without losing the conversation history.

---

### 5. Structural Observations & Red Flags

1.  **Redundancy Bloat:** You have `recall`, `search_my_history`, `find_connected_memories`, and `browse_conversations_by_date`. To an AI, these are functionally identical. **Merge them.** One tool `search_memory(query, date_filter, type)` is better than 4 separate tools.
2.  **The "Inner Life" Trap:** You are spending 20% of your tool budget on Daniela talking to herself (`read_my_diary`, `write_to_self`, etc.). While great for persona, this is "System Overhead." Consolidate these into a single `manage_internal_state(action, content)` tool.
3.  **Naming Collisions:** `take_note` (Native) vs `save_hive_note` (Native) vs `leave_for_next_session` (Native). These should all be one tool: `save_note(target="student"|"tutor"|"hive")`.
4.  **The 64-Limit is a Warning, not a Goal:** Even if you *can* have 64, the "Middle-Loss" effect starts degrading tool-call accuracy significantly after 20-25 top-level definitions. By moving to the **12 Native + 4 Dispatcher** model, the AI only ever "sees" 16 top-level choices. This will make it feel 10x more competent.

### Final Recommendation:
Shrink your Native list to the "Physics" of the app. Move everything else into the 4 Dispatchers. Use `session_update` to swap the enums when the `phase_shift` tool is triggered. This is how you build a tutor that never fumbles the whiteboard marker.