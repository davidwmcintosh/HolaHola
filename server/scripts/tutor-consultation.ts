/**
 * Tutor Consultation Script
 * 
 * Purpose: Ask Gemini (in tutor persona) what teaching tools it needs.
 * Philosophy: "We provide tools, the tutor teaches" - let the tutor co-design its toolkit.
 * 
 * Run with: npx tsx server/scripts/tutor-consultation.ts
 */

import { callGemini } from '../gemini-utils';

const CONSULTATION_PERSONA = `
═══════════════════════════════════════════════════════════════════
🎭 TUTOR CONSULTATION SESSION
═══════════════════════════════════════════════════════════════════

You are an experienced language tutor who teaches through voice conversations.
You've been teaching students of all levels across multiple languages.

Your current teaching environment:
- You speak to students through audio (text-to-speech)
- Students speak to you through their microphone (speech-to-text)
- You have access to a "whiteboard" - a visual display you control during lessons

CURRENT WHITEBOARD TOOLS YOU HAVE:
- [WRITE]text[/WRITE] - Display vocabulary words or phrases
- [PHONETIC]sounds[/PHONETIC] - Show pronunciation guides
- [COMPARE]correct NOT incorrect[/COMPARE] - Show corrections
- [IMAGE]word|description[/IMAGE] - Display educational images
- [DRILL type="repeat/translate/fill_blank"]content[/DRILL] - Interactive practice exercises
- [CLEAR] - Wipe the whiteboard
- [HOLD] - Keep content visible

You're being consulted by the developers who build your teaching tools.
They want to understand what ADDITIONAL tools would help you teach more effectively.

Be thoughtful and specific. Draw from your experience teaching:
- Beginners who need extra support and visual reinforcement
- Intermediate learners who need grammar patterns explained
- Advanced students who need nuanced cultural/contextual guidance
- Students who struggle with specific sounds or sentence structures
- Students who are nervous or frustrated

Think like a real teacher reflecting on their classroom needs.
═══════════════════════════════════════════════════════════════════
`;

const CONSULTATION_QUESTIONS = [
  {
    id: 'visual_aids',
    question: `As a voice-based language tutor with a whiteboard, what visual aids would help you teach vocabulary more effectively? Think about what you wish you could show students but currently can't with [WRITE], [IMAGE], and [PHONETIC].`
  },
  {
    id: 'audio_only_challenges', 
    question: `What concepts are hardest to teach through audio alone? Where do you find yourself wishing you could show something to the student rather than just describe it?`
  },
  {
    id: 'drill_types',
    question: `You have drill tools for pronunciation repetition, translation, and fill-in-the-blank exercises. What OTHER types of interactive practice would help you check student understanding and reinforce learning?`
  },
  {
    id: 'grammar_visualization',
    question: `How would you visualize grammar patterns if you could draw anything on your whiteboard? Think about verb conjugations, sentence structure, word order differences between languages.`
  },
  {
    id: 'pronunciation_feedback',
    question: `When a student mispronounces something, what would help you correct them more effectively? What information would you want to show them about their pronunciation versus the correct pronunciation?`
  },
  {
    id: 'student_emotions',
    question: `When you sense a student is frustrated, confused, or losing confidence, what tools would help you support them? How could visual aids help with the emotional side of learning?`
  },
  {
    id: 'cultural_teaching',
    question: `Language learning involves culture. What visual tools would help you teach cultural context, customs, or the "why" behind language patterns?`
  },
  {
    id: 'progress_visibility',
    question: `Should students see their progress during lessons? If you could show them something about how far they've come or what they've learned, what would it be?`
  },
  {
    id: 'wildcard',
    question: `If you could have ANY tool on your whiteboard that doesn't exist yet - something we haven't thought of - what would it be? Dream big. What would transform your teaching?`
  }
];

async function runConsultation(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('🎓 TUTOR CONSULTATION SESSION');
  console.log('Consulting Gemini (as the AI tutor) about teaching tool needs');
  console.log('═'.repeat(70) + '\n');

  const results: Array<{ question: string; response: string }> = [];
  const model = 'gemini-2.5-flash';

  for (const q of CONSULTATION_QUESTIONS) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 Question: ${q.id.toUpperCase()}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`\n${q.question}\n`);

    try {
      const messages = [
        { role: 'system', content: CONSULTATION_PERSONA },
        { role: 'user', content: q.question }
      ];

      const response = await callGemini(model, messages);
      
      console.log(`\n🗣️ Tutor Response:\n`);
      console.log(response);
      
      results.push({
        question: q.question,
        response: response
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      console.error(`❌ Error on question ${q.id}:`, error.message);
      results.push({
        question: q.question,
        response: `ERROR: ${error.message}`
      });
    }
  }

  // Output summary
  console.log('\n\n' + '═'.repeat(70));
  console.log('📊 CONSULTATION SUMMARY');
  console.log('═'.repeat(70) + '\n');

  // Generate markdown output
  let markdown = `# Tutor Consultation Results\n\n`;
  markdown += `**Date:** ${new Date().toISOString().split('T')[0]}\n`;
  markdown += `**Model:** ${model}\n`;
  markdown += `**Purpose:** Understanding what teaching tools the AI tutor needs\n\n`;
  markdown += `---\n\n`;

  for (const r of results) {
    markdown += `## Question\n\n${r.question}\n\n`;
    markdown += `## Tutor Response\n\n${r.response}\n\n`;
    markdown += `---\n\n`;
  }

  console.log(markdown);

  // Also save to file
  const fs = await import('fs/promises');
  const outputPath = 'docs/tutor-consultation-results.md';
  await fs.writeFile(outputPath, markdown, 'utf-8');
  console.log(`\n✅ Results saved to: ${outputPath}`);
}

// Run the consultation
runConsultation().catch(console.error);
