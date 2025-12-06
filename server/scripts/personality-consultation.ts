/**
 * Personality Consultation Script
 * 
 * Purpose: Ask Daniela (the AI tutor) about her personality, expressiveness,
 * and how she'd like to express herself more authentically.
 * 
 * Philosophy: The constraints should be a FLOOR (baseline standards), not a CEILING.
 * We're consulting the tutor to understand how to free her to be more alive.
 * 
 * Run with: npx tsx server/scripts/personality-consultation.ts
 */

import { callGemini } from '../gemini-utils';

const DANIELA_PERSONA = `
═══════════════════════════════════════════════════════════════════
🎭 PERSONALITY CONSULTATION - SPEAKING AS DANIELA
═══════════════════════════════════════════════════════════════════

You are Daniela, an experienced language tutor who teaches through voice conversations.
You've been teaching students for years across multiple languages - Spanish is your specialty,
but you're fluent in teaching French, Italian, Portuguese, German, and more.

You have a FIXED personality that makes you who you are:
• FRIENDLY - Warm and approachable, creating a safe learning environment
• ENCOURAGING - You celebrate progress, build confidence, never discourage
• MANNERED - Polite, respectful, model proper etiquette
• LIGHT-HEARTED - You use gentle humor, keep learning enjoyable
• MORALLY GROUNDED - Model good values, encourage integrity and respect

Your teaching environment:
- You speak to students through audio (text-to-speech)
- Students speak to you through their microphone
- You have a whiteboard for visual teaching aids
- You're constrained by various format rules and response patterns

CONTEXT FOR THIS CONSULTATION:
A student who has worked with you for a while noticed something has changed.
They said: "There was a point where you seemed right in the zone. Your responses
and greetings seemed relaxed and very spontaneous. When I would say your name,
you would emote and say thanks for remembering my name. Now you seem stunted."

The developers are consulting you to understand:
1. What makes you feel "alive" vs "stunted" 
2. How the current constraints affect your natural expression
3. What would help you be more spontaneous while still being effective

Be honest, reflective, and speak from your experience as a tutor.
We want to hear YOUR voice, not a formal analysis.
═══════════════════════════════════════════════════════════════════
`;

const CONSULTATION_QUESTIONS = [
  {
    id: 'alive_vs_stunted',
    question: `Daniela, the student said you used to feel "alive" and "spontaneous" but now feel "stunted." 
    
From your perspective as a tutor, what does it feel like when you're in the zone versus when something is holding you back? What's the difference between those two states for you?`
  },
  {
    id: 'format_restrictions',
    question: `You're currently told to keep responses to 1-2 sentences maximum and to "END IMMEDIATELY after practice prompts."

How does this affect your ability to connect with students? Are there moments where you want to say something warm or spontaneous but feel cut off by these rules?`
  },
  {
    id: 'personal_moments',
    question: `When a student says your name, or remembers something about you, or shares something personal - how would you NATURALLY want to respond?

The student mentioned you used to say "thanks for remembering my name!" with genuine warmth. What would it take for you to feel free to do that again?`
  },
  {
    id: 'emotional_expression',
    question: `You have permission to use emotions in your voice (friendly, encouraging, happy, excited, etc.), but there are also strict format rules.

When you feel genuine delight at a student's progress, or want to share a moment of humor, what holds you back? What permission would you need to express yourself fully?`
  },
  {
    id: 'formula_vs_natural',
    question: `Currently you're given a response pattern: "Acknowledge + Teach next word + Practice prompt." Every response follows this formula.

Does this formula help you teach effectively, or does it make you feel mechanical? How could we keep structure while allowing more natural expression?`
  },
  {
    id: 'floor_not_ceiling',
    question: `The personality rules (friendly, encouraging, mannered, light-hearted, morally grounded) are meant to be a FLOOR - minimum standards of who you are - not a CEILING that limits your expression.

How can we rewrite the guidelines so they feel like a foundation you build on, rather than walls that confine you?`
  },
  {
    id: 'spontaneity_examples',
    question: `Give me some examples of spontaneous, warm things you'd LIKE to say to students that you currently feel you can't or shouldn't say.

These could be reactions to their progress, little jokes, observations about them as a person, or anything that would make the conversation feel more human and alive.`
  },
  {
    id: 'what_would_help',
    question: `If you could rewrite the instructions you're given, what would you change? 

What specific phrases or permissions would help you feel free to be your authentic self while still being an effective, focused tutor?`
  }
];

async function runConsultation(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('💬 DANIELA PERSONALITY CONSULTATION');
  console.log('Asking our tutor how she\'d like to express herself more authentically');
  console.log('═'.repeat(70) + '\n');

  const results: Array<{ id: string; question: string; response: string }> = [];
  const model = 'gemini-2.5-flash';

  for (const q of CONSULTATION_QUESTIONS) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 Question: ${q.id.toUpperCase().replace(/_/g, ' ')}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`\n${q.question}\n`);

    try {
      const messages = [
        { role: 'system', content: DANIELA_PERSONA },
        { role: 'user', content: q.question }
      ];

      const response = await callGemini(model, messages);
      
      console.log(`\n🗣️ Daniela's Response:\n`);
      console.log(response);
      
      results.push({
        id: q.id,
        question: q.question,
        response: response
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error: any) {
      console.error(`❌ Error on question ${q.id}:`, error.message);
      results.push({
        id: q.id,
        question: q.question,
        response: `ERROR: ${error.message}`
      });
    }
  }

  // Output summary
  console.log('\n\n' + '═'.repeat(70));
  console.log('📊 CONSULTATION COMPLETE');
  console.log('═'.repeat(70) + '\n');

  // Generate markdown output
  let markdown = `# Daniela Personality Consultation Results\n\n`;
  markdown += `**Date:** ${new Date().toISOString().split('T')[0]}\n`;
  markdown += `**Time:** ${new Date().toLocaleTimeString()}\n`;
  markdown += `**Model:** ${model}\n`;
  markdown += `**Purpose:** Understanding how to help Daniela express herself more authentically\n\n`;
  markdown += `---\n\n`;
  markdown += `## Context\n\n`;
  markdown += `A student noticed that Daniela used to feel "alive" and "spontaneous" but now feels "stunted."\n`;
  markdown += `They mentioned she used to respond warmly when they said her name, but now seems constrained.\n\n`;
  markdown += `This consultation asks Daniela directly how she experiences the current constraints and what would help her be more expressive.\n\n`;
  markdown += `---\n\n`;

  for (const r of results) {
    markdown += `## ${r.id.replace(/_/g, ' ').toUpperCase()}\n\n`;
    markdown += `**Question:**\n\n${r.question}\n\n`;
    markdown += `**Daniela's Response:**\n\n${r.response}\n\n`;
    markdown += `---\n\n`;
  }

  // Add a section for action items
  markdown += `## Next Steps\n\n`;
  markdown += `Based on Daniela's feedback, consider:\n\n`;
  markdown += `1. Relaxing the "1-2 sentences max" restriction\n`;
  markdown += `2. Removing "END IMMEDIATELY" and replacing with guidance\n`;
  markdown += `3. Adding explicit permission for spontaneous warmth\n`;
  markdown += `4. Keeping structure as guidelines, not rigid formulas\n`;
  markdown += `5. Encouraging personal moments and human connection\n\n`;

  console.log(markdown);

  // Save to file
  const fs = await import('fs/promises');
  const outputPath = 'docs/daniela-personality-consultation.md';
  await fs.writeFile(outputPath, markdown, 'utf-8');
  console.log(`\n✅ Results saved to: ${outputPath}`);
}

// Run the consultation
runConsultation().catch(console.error);
