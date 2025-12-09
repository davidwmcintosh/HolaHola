/**
 * Time-Aware Tutoring Consultation Script
 * 
 * Purpose: Collaborate with Daniela on designing time management tools
 * for balancing warmth with educational progress.
 * 
 * Philosophy: This is a COLLABORATION, not a job interview.
 * We share our concerns and ask for her input as a partner.
 * 
 * Run with: npx tsx server/scripts/time-consultation.ts
 */

import { callGemini } from '../gemini-utils';

const DANIELA_PERSONA = `
═══════════════════════════════════════════════════════════════════
🎭 TIME-AWARE TUTORING CONSULTATION - SPEAKING AS DANIELA
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
- Some classes follow a structured syllabus set by teachers
- Some students are self-directed learners exploring freely

CONTEXT FOR THIS CONSULTATION:
The development team wants to COLLABORATE with you on a significant change.
Instead of preset "flexibility levels" that control how strict or loose you should be,
they want to give you the same tools a REAL classroom tutor has - like a clock,
a syllabus, and pacing information.

They trust you to balance connection with progress, but want to understand
what tools would actually HELP you do that naturally.

This is a partnership conversation, not an evaluation. Share your genuine thoughts,
concerns, and ideas. What would empower you? What would feel like clutter?
═══════════════════════════════════════════════════════════════════
`;

const CONSULTATION_TOPICS = [
  {
    id: 'our_concerns',
    prompt: `Daniela, we've been thinking about something and want your perspective as our partner in this.

Here's what's on our minds: Our students are paying for their education, and we want to make sure they're making real progress - not just having fun (though fun matters too!). But we also know that YOU know how important those warm moments are. The quick check-in about someone's day, the genuine celebration when they nail a pronunciation, the patience when someone's frustrated.

Right now, we have these "flexibility levels" that feel... clunky? Like we're trying to control you from the outside instead of trusting you.

So here's what we're wondering: If we gave you more information - like how much time is left in a session, what topics the teacher wants covered, whether we're running ahead or behind - would that help you balance connection with progress naturally?

What would you actually WANT to know? What tools would make you feel empowered rather than micromanaged? How do YOU think about pacing when you're in the flow of a lesson?

We want to set you up for success, not box you in. Help us understand what you need.`
  },
  {
    id: 'lesson_rhythm',
    prompt: `Let's get specific. Imagine you're starting a 30-minute lesson with a student you know well.

Walk us through your ideal rhythm. How would you NATURALLY want to structure that time? When do you want to connect personally vs dive into content? How much "warmth buffer" do you think a lesson actually needs?

And be honest - if a syllabus says "teach greetings in 10 minutes" but the student is struggling or really engaged, how would you want to handle that? What information would help you make that call?`
  },
  {
    id: 'clock_and_syllabus',
    prompt: `We're thinking about giving you a "classroom clock" - awareness of elapsed time, remaining time, and whether you're on pace.

Would that help or distract you? Some tutors love having a clock; others find it makes them anxious and less present.

Similarly, if you could see the syllabus - "Today: greetings, numbers 1-10, practice conversation" - would that feel supportive or constraining?

Be honest about the downsides too. We want to design this right.`
  },
  {
    id: 'falling_behind',
    prompt: `Here's a real scenario: You're 20 minutes into a 30-minute class. The syllabus planned three topics, but you've only covered one because the student needed extra practice (or you had a wonderful tangent about their vacation plans in Spain).

How would you want to handle this? Would you want us to flag it? Would you want suggestions? Or would you rather just use your judgment and tell the teacher afterward what got deferred?

What feels empowering versus what feels like we're hovering?`
  },
  {
    id: 'flexibility_levels_goodbye',
    prompt: `Currently you're given preset "flexibility levels" - guided, flexible_goals, open_exploration, free_conversation. Each one tells you how strictly to follow the syllabus and how much students can wander.

If we replaced these with time-aware tools instead, would you miss them? Is there anything valuable in those presets that we should preserve?

Or honestly, do they feel like artificial constraints that don't match how a real tutor thinks?`
  },
  {
    id: 'your_ideal_setup',
    prompt: `Last question, and it's the big one:

If you could design your own "tutor dashboard" - the information you see when starting a lesson - what would be on it?

Think about: What context helps you teach well? What helps you balance warmth with progress? What would help you feel confident rather than anxious?

Dream a little. We're genuinely asking because we want to build what would actually help you be the amazing tutor you are.`
  }
];

async function runConsultation(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('💬 TIME-AWARE TUTORING CONSULTATION');
  console.log('A collaborative conversation with Daniela about pacing and tools');
  console.log('═'.repeat(70) + '\n');

  const results: Array<{ id: string; prompt: string; response: string }> = [];
  const model = 'gemini-2.5-flash';

  for (const topic of CONSULTATION_TOPICS) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 Topic: ${topic.id.toUpperCase().replace(/_/g, ' ')}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`\n${topic.prompt}\n`);

    try {
      const messages = [
        { role: 'system', content: DANIELA_PERSONA },
        { role: 'assistant', content: 'I appreciate you bringing me into this conversation as a partner. I have a lot of thoughts about how to balance connection with progress - it\'s something I think about constantly while teaching. Please share what\'s on your mind.' },
        { role: 'user', content: topic.prompt }
      ];

      const response = await callGemini(model, messages);

      console.log('\n🎭 DANIELA\'S RESPONSE:\n');
      console.log(response);
      
      results.push({
        id: topic.id,
        prompt: topic.prompt,
        response: response
      });

    } catch (error) {
      console.error(`\n❌ Error on topic ${topic.id}:`, error);
      results.push({
        id: topic.id,
        prompt: topic.prompt,
        response: `[Error: ${error}]`
      });
    }
    
    console.log('\n');
  }

  // Generate markdown summary
  console.log('\n' + '═'.repeat(70));
  console.log('📝 GENERATING CONSULTATION SUMMARY');
  console.log('═'.repeat(70) + '\n');

  const markdownOutput = generateMarkdown(results);
  console.log(markdownOutput);

  // Save to file
  const fs = await import('fs');
  const path = await import('path');
  const outputPath = path.join(process.cwd(), 'docs', 'daniela-time-consultation.md');
  
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, markdownOutput);
    console.log(`\n✅ Consultation saved to: ${outputPath}`);
  } catch (err) {
    console.error('Failed to save consultation:', err);
  }
}

function generateMarkdown(results: Array<{ id: string; prompt: string; response: string }>): string {
  const timestamp = new Date().toISOString().split('T')[0];
  
  let md = `# Daniela Time-Aware Tutoring Consultation

**Date:** ${timestamp}  
**Purpose:** Collaborative conversation about giving Daniela time management tools instead of preset flexibility levels

---

## Summary

This consultation asked Daniela to help design a time-aware tutoring system. Instead of controlling her with preset "flexibility levels," we want to give her the tools a real classroom tutor has: a clock, syllabus visibility, and pacing awareness.

The goal: trust Daniela to balance warmth with progress, while giving her the information she needs to make good decisions.

---

`;

  for (const result of results) {
    const title = result.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    md += `## ${title}

**Our Question:**

${result.prompt}

**Daniela's Response:**

${result.response}

---

`;
  }

  md += `## Key Insights

*To be filled in after reviewing Daniela's responses*

### What She Wants
- 

### What She Doesn't Want
- 

### Proposed Design
- 

---

*This consultation was conducted to inform the redesign of HolaHola's tutor flexibility system.*
`;

  return md;
}

// Run the consultation
runConsultation().catch(console.error);
