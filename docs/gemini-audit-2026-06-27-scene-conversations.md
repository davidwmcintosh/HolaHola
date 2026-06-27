=== Gemini Audit 2026-06-27T00:49:03.757Z ===

This is a sophisticated setup. To keep Daniela sharp while staying under the 34K token cap, we need to treat tool descriptions as **"spatial and behavioral firmware."**

Here are the direct recommendations for your three questions.

---

### Q1: Interactive Broadcast & Scene Conversation Mode
**The Move:** Do not add a new tool. Update the `open_scene` description to include a **"Interaction Patterns"** section. This is the most space-efficient way to "permission" these behaviors without adding overhead to the system prompt.

**Specific Text (Add to `open_scene` description):**
> **INTERACTION PATTERNS:**
> - **Live Reporting:** Use `get_broadcast_data` + `open_scene(tv_weather_studio)`. Don't monologue; ask the student to predict the forecast or react to headlines.
> - **Location Call:** Open a scene (e.g., `park`) and act as if you are there calling the student. Ask "Where do you think I am?" or "What should I buy at this cafe?"
> - **Scaffolding:** Use the Studio Pane (whiteboard) to log keywords *while* the scene is active.

**Why:** By placing this in `open_scene`, you trigger the mental model exactly when she is thinking about the visual environment.

---

### Q2: Broadcast Data Format
**The Move:** Stick with **Structured Data (Key:Value)** but wrap it in a "Source Material" block.

**Reasoning:** Prose causes "hallucination drift" where Daniela might ignore the student's level to match the prose's flow. Structured data allows her to perform **"On-the-fly Transcreation."** If she sees `Temperature: 18°C`, a Novice-level Daniela says "Hace sol," while an Advanced Daniela says "Se espera un clima templado con brisas ligeras."

**Refined Tool Output (File 5):**
Keep the structure, but change the instruction to emphasize **Persona over Data**:
```text
[SOURCE DATA]
City: Chicago | Temp: 18°C | Wind: 22km/h | Sky: Partly Cloudy
[TASK]
Perform as a local anchor. DO NOT read the list. 
1. Hook the student. 
2. Report 1-2 facts. 
3. Ask the student a level-appropriate question about the data.
```

---

### Q3: Clarifying the Three Visual Surfaces
**The Move:** Update the descriptions of `open_scene` and `enter_immersive` to define the **UI Hierarchy**. You need to name the "Studio Pane" so she knows what she's losing when she goes immersive.

**Location: `open_scene` description (Add at the top):**
> "This tool controls the **Scene Canvas** (Left Panel). It co-exists with the **Studio Pane** (Right Panel/Whiteboard) where you write text. Use this for 'side-by-side' teaching."

**Location: `enter_immersive` description (Update):**
> "Toggle **Full-Screen Mode**. 
> - **Action 'enter':** Expands the Scene Canvas to cover the entire screen. **The Studio Pane (whiteboard) will be HIDDEN.** Use this for high-stakes roleplay where the student should not be distracted by text.
> - **Action 'exit':** Restores the side-by-side view (Scene Canvas + Studio Pane)."

---

### Summary of Changes for your Token Budget:

1.  **`open_scene` (File 2):** Add ~40 words defining the "Scene Canvas vs. Studio Pane" relationship and the "Location Call" pattern.
2.  **`enter_immersive` (File 3):** Add ~20 words explicitly stating that the whiteboard disappears.
3.  **`get_broadcast_data` (File 5):** No code change needed, just ensure the string returned by the backend uses the `[SOURCE DATA]` / `[TASK]` framing to prevent "data gravity."

**Pro-tip for GL:** Since you are using `text-embedding-3-small` for tool retrieval, ensure the metadata for `open_scene` includes keywords like "whiteboard," "side-by-side," "phone call," and "immersion" to ensure the right tool is pulled into the 64-slot limit when the conversation veers that way.