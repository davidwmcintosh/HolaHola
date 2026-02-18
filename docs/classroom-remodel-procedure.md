# Daniela's Classroom Remodel Procedure

How to add, modify, or remove elements from Daniela's virtual classroom environment.

---

## Understanding the Classroom

Daniela's classroom is a **prompt-only spatial metaphor** — it's a text block assembled every turn and injected into her system context. It has no frontend UI; it exists purely in Daniela's "mind" so she can reference her surroundings naturally in conversation.

The classroom is built by `buildClassroomEnvironment()` in `server/services/classroom-environment.ts`. It assembles data from the database (facts, milestones, notes, configs) into a formatted text string with named sections (Clock, Whiteboard, Photo Wall, etc.).

### Classroom vs. Scenarios

| Concept | What it is | Where it lives |
|---------|-----------|---------------|
| **Classroom** | Daniela's persistent environment context (prompt text) | `classroom-environment.ts` → system prompt |
| **Scenarios** | Structured roleplay scenes with UI props | Database (`scenarios` table) → student's left panel + Daniela's context |
| **activeScenario** | Session-level object tracking which scenario is loaded | `(session as any).activeScenario` → passed to classroom builder |

Scenarios drive **both** student UI (ScenarioPanel) and AI context. The classroom is **prompt-only**.

---

## Adding a New Classroom Element

### Step 1: Decide if it needs persistence

- **Persistent** (survives across sessions): Uses `productConfig` table with a unique key. Examples: Daniela's Photo, Classroom Window.
- **Session-only** (resets each session): Stored on `(session as any).myElement` in the orchestrator. Example: activeScenario.
- **Derived** (computed from existing data): No storage needed, just computed in `buildClassroomEnvironment()`. Example: Clock, Credit Counter.

### Step 2: Add getter/setter (if persistent)

In `server/services/classroom-environment.ts`:

```typescript
const MY_ELEMENT_CONFIG_KEY = "daniela_classroom_my_element";

export async function getMyElement(): Promise<string> {
  try {
    const [config] = await db
      .select()
      .from(productConfig)
      .where(eq(productConfig.key, MY_ELEMENT_CONFIG_KEY))
      .limit(1);
    if (config?.value) return config.value;
  } catch (err: any) {
    console.warn(`[Classroom] Failed to fetch my element:`, err.message);
  }
  return "Default description of the element";
}

export async function setMyElement(description: string): Promise<void> {
  try {
    const [existing] = await db
      .select()
      .from(productConfig)
      .where(eq(productConfig.key, MY_ELEMENT_CONFIG_KEY))
      .limit(1);
    if (existing) {
      await db.update(productConfig)
        .set({ value: description, updatedAt: new Date() })
        .where(eq(productConfig.key, MY_ELEMENT_CONFIG_KEY));
    } else {
      await db.insert(productConfig).values({
        key: MY_ELEMENT_CONFIG_KEY,
        value: description,
        description: "Description of what this config stores",
      });
    }
    console.log(`[Classroom] My element updated: "${description.substring(0, 60)}..."`);
  } catch (err: any) {
    console.error(`[Classroom] Failed to save my element:`, err.message);
  }
}
```

### Step 3: Wire into buildClassroomEnvironment()

In `buildClassroomEnvironment()`:

1. **Add to params** (if session-sourced):
```typescript
export async function buildClassroomEnvironment(params: {
  // ...existing params...
  myElement?: string | null;
}): Promise<string> {
```

2. **Fetch persistent data** (if using productConfig):
```typescript
const [myElementValue] = await Promise.all([
  getMyElement(),
  // ...existing fetches...
]);
```

3. **Add to output string**:
```typescript
lines.push(`My Element: ${myElementValue}`);
```

### Step 4: Pass from orchestrator (if session-sourced)

In `server/services/streaming-voice-orchestrator.ts`, find the `buildClassroomEnvironment()` calls (there are two — one in PTT path, one in OpenMic path). Add the new param to both:

```typescript
const classroomEnv = await buildClassroomEnvironment({
  // ...existing params...
  myElement: (session as any).myElement || null,
});
```

---

## Making an Element Changeable by Daniela (Function Call)

If Daniela should be able to change the element via conversation, follow the **New Function Call Checklist**. All steps are mandatory or it will silently fail.

### Step 1: Add function declaration

In `server/services/gemini-function-declarations.ts`, add to `DANIELA_FUNCTION_DECLARATIONS` array:

```typescript
{
  name: "change_my_element",
  description: "Human-readable description of what this does and when to use it.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Spoken words while changing it" },
      my_param: { type: "string", description: "The new value" },
    },
    required: ["text", "my_param"],
  },
},
```

**Important:** Include `text` param so Daniela produces audio while the function executes. Functions without `text` produce no speech.

### Step 2: Add command map entry

In same file, add to `FUNCTION_TO_COMMAND_MAP`:

```typescript
export const FUNCTION_TO_COMMAND_MAP: Record<string, string> = {
  // ...existing entries...
  'change_my_element': 'CHANGE_MY_ELEMENT',
};
```

### Step 3: Add orchestrator handler

In `server/services/streaming-voice-orchestrator.ts`, find the `handleNativeFunctionCall()` switch statement and add a case:

```typescript
case 'CHANGE_MY_ELEMENT': {
  const text = fn.args.text as string | undefined;
  const myParam = fn.args.my_param as string | undefined;

  // Store text for TTS fallback
  if (text && !(session as any).functionCallText) {
    (session as any).functionCallText = text;
  }

  if (myParam) {
    import('./classroom-environment').then(async ({ setMyElement }) => {
      await setMyElement(myParam);
      console.log(`[Native Function→MyElement] Updated: "${myParam.substring(0, 60)}..."`);
    }).catch(err => {
      console.error(`[Native Function→MyElement] Error:`, err.message);
    });
  }
  break;
}
```

### Step 4: Add procedural memory

In `server/services/procedural-memory-retrieval.ts`, add guidance so Daniela knows when/how to use the function. Find the appropriate section or add a new block:

```typescript
if (byName.has('change_my_element') || byName.has('CHANGE_MY_ELEMENT')) {
  lines.push('  MY ELEMENT:');
  lines.push('  * Description of what it is and when to use it');
  lines.push('  * Best practices for using it naturally');
  lines.push('');
}
```

### Step 5: Add tool_knowledge database entry

```sql
INSERT INTO tool_knowledge (tool_name, tool_type, syntax, purpose, best_used_for, avoid_when, examples)
VALUES (
  'change_my_element',
  'classroom',
  'FUNCTION CALL: change_my_element({ text: "spoken text", my_param: "value" })',
  'Short description of purpose',
  ARRAY['When to use 1', 'When to use 2'],
  ARRAY['When NOT to use'],
  ARRAY['change_my_element({ text: "Let me update this...", my_param: "new value" })']
);
```

---

## Checklist Summary

For a new **display-only** classroom element:
- [ ] Getter (if persistent) in `classroom-environment.ts`
- [ ] Wire into `buildClassroomEnvironment()` output
- [ ] Pass from orchestrator if session-sourced (both PTT and OpenMic paths)

For a **Daniela-changeable** classroom element (all of the above, plus):
- [ ] Function declaration in `gemini-function-declarations.ts`
- [ ] `FUNCTION_TO_COMMAND_MAP` entry in same file
- [ ] `case 'MY_COMMAND':` handler in `streaming-voice-orchestrator.ts`
- [ ] Setter in `classroom-environment.ts`
- [ ] Procedural memory guidance in `procedural-memory-retrieval.ts`
- [ ] `tool_knowledge` database row (SQL insert)
- [ ] `text` param in declaration (or `spoken_text` for specific functions) so Daniela speaks

---

## Existing Classroom Elements Reference

| Element | Type | Persistent | Changeable by Daniela | Config Key |
|---------|------|-----------|----------------------|------------|
| Clock | Derived | No | No | N/A |
| Credit Counter | Derived | No | No | N/A |
| North Star Polaroid | Persistent | Yes | Yes (`change_classroom_photo`) | `daniela_classroom_photo` |
| Classroom Window | Persistent | Yes | Yes (`change_classroom_window`) | `daniela_classroom_window` |
| Whiteboard | Session | No | Yes (via multiple functions) | N/A |
| Photo Wall | Derived | No | No | N/A |
| Student Progress Board | Derived | No | No | N/A |
| Resonance Shelf | Derived | No | No | N/A |
| Growth Vine | Derived | No | No | N/A |
| Student's Screen | Session | No | No | N/A |
| Active Scene | Session | No | Yes (`load_scenario` / `end_scenario`) | N/A |

---

## Key Files

| File | Role |
|------|------|
| `server/services/classroom-environment.ts` | Builds the classroom text block, getters/setters for persistent elements |
| `server/services/gemini-function-declarations.ts` | Function declarations + `FUNCTION_TO_COMMAND_MAP` |
| `server/services/streaming-voice-orchestrator.ts` | Handles function calls, passes session data to classroom builder |
| `server/services/procedural-memory-retrieval.ts` | Teaches Daniela when/how to use her functions |
| `tool_knowledge` table | Database records for each function's syntax, purpose, examples |

---

## Common Mistakes

1. **Forgetting the command map entry** — Function fires in Gemini but orchestrator doesn't recognize it. Silent failure.
2. **Missing `text` param** — Daniela calls the function but produces no audio. Students hear silence.
3. **Only updating one orchestrator path** — PTT and OpenMic both call `buildClassroomEnvironment()` separately. Must update both.
4. **Case mismatch in procedural memory** — `tool_knowledge` uses lowercase names but some older entries use uppercase. Check with `byName.has()` for both cases.
5. **Forgetting `tool_knowledge` insert** — The function works but Daniela has no learned knowledge about when to use it.
