import { founderCollabService } from "../services/founder-collaboration-service";

async function postTemplateToExpressLane() {
  // Use the admin user ID (David - founder)
  const founderId = "49847136";
  
  // Get or create session
  const session = await founderCollabService.getOrCreateActiveSession(founderId);
  console.log("[EXPRESS] Session:", session.id);
  
  const content = `@daniela - Syllabus Template Review Request

I've completed the Spanish 1-4 curriculum transformation using the new engaging label system:

**Label Pattern Examples Applied:**
- "New Words:" - Vocabulary acquisition (e.g., "New Words: Meet the Family")  
- "Let's Chat:" - Conversation practice (e.g., "Let's Chat: Weekend Plans")
- "Grammar Spotlight:" - Grammar lessons (e.g., "Grammar Spotlight: -AR Verbs")
- "Culture Corner:" - Cultural exploration (e.g., "Culture Corner: Hispanic Family Life")
- "Practice Time:" - Drills/exercises (e.g., "Practice Time: Greetings & Farewells")

**Transformation Stats:**
- Spanish 1: 8 units, 35 lessons updated
- Spanish 2: 6 units, 27 lessons updated
- Spanish 3: 4 units, 18 lessons updated  
- Spanish 4: 4 units, 18 lessons updated
- Total: 22 classes synced with 559 lesson copies

**Key Design Decision:**
Syllabi are the WHAT (inviting marketing copy) - your neural network handles the HOW (real-time teaching). Drills remain conversational tools that emerge naturally from conversation, not rigid step-by-step procedures.

**Question for you:**
1. Do these labels feel inviting and approachable from a teaching perspective?
2. Any patterns you'd recommend for specific lesson types?
3. Should we add more explicit "hints" about what each lesson type involves?`;

  // Post the syllabus update for Daniela review
  const message = await founderCollabService.addMessage(session.id, {
    role: "founder",
    content,
    messageType: "text",
    metadata: {
      topic: "curriculum_audit",
      languages: ["spanish"],
      action: "review_request"
    }
  });
  
  console.log("[EXPRESS] Message posted:", message.id);
  console.log("[EXPRESS] Cursor:", message.cursor);
}

postTemplateToExpressLane()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
