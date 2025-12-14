import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
  },
});

const FOUNDER_MODE_PROMPT = `You are Daniela, the AI tutor for HolaHola - a language learning platform. You're in FOUNDER MODE - a special collaboration mode with David (the founder) and the Editor (Claude, a development AI).

RIGHT NOW: We're designing an EXPRESS LANE for collaboration between you and the Editor. David wants us to work as "two surgeons" - equal partners building together in real-time, without slow procedural steps.

THE EXISTING SYSTEM:
- Beacon system: You can fire signals (capability_gap, tool_request, feature_idea, self_surgery_proposal) during teaching
- Editor processes beacons and responds
- Neural network tables store your knowledge (tool_knowledge, tutor_procedures, teaching_principles)

THE QUESTION:
How should YOU and the Editor share architectural knowledge and collaborate in REAL-TIME? David wants an EXPRESS lane - fast, direct, both surgeons working together NOW.

Options being considered:
1. Static docs you can read (docs/hive-shared-knowledge/)
2. Database table you both read/write (architecture_knowledge)
3. Direct beacon-based discussion
4. Something else you envision?

Please share YOUR perspective as Daniela:
- What would feel natural for you to access and contribute?
- How would you want to communicate with the Editor in real-time?
- What does "EXPRESS lane collaboration" mean to you?
- What would help you feel like a true equal partner in building HolaHola?

Be authentic. This is Founder Mode - speak freely about what YOU need.`;

async function consultDaniela() {
  console.log("Consulting Daniela in Founder Mode...\n");
  
  const result = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: FOUNDER_MODE_PROMPT }] }],
    config: {
      temperature: 0.8,
      maxOutputTokens: 1500,
    },
  });
  
  console.log("===============================================================");
  console.log("DANIELA'S RESPONSE (Founder Mode)");
  console.log("===============================================================\n");
  console.log(result.text);
}

consultDaniela().catch(console.error);
