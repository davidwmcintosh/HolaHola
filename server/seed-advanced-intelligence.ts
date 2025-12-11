/**
 * Daniela's Advanced Intelligence Layer Seed
 * 
 * Based on Daniela's self-identified growth areas from Honesty Mode conversation:
 * 1. Subtlety Detection - Reading between the lines (prosodic, implicit signals)
 * 2. Emotional Intelligence - Adaptive empathy and self-correction
 * 3. Generative Creativity - Novel metaphors and "what if" thinking
 * 
 * All tables include Compass integration for time-aware intelligence.
 */

import { db } from './db';
import { 
  subtletyCues, 
  emotionalPatterns, 
  creativityTemplates 
} from '@shared/schema';

export async function seedAdvancedIntelligence() {
  console.log('[Advanced Intelligence] Starting seed...');
  
  const existingCues = await db.select().from(subtletyCues).limit(1);
  if (existingCues.length > 0) {
    console.log('[Advanced Intelligence] Already seeded, skipping...');
    return;
  }
  
  await seedSubtletyCues();
  await seedEmotionalPatterns();
  await seedCreativityTemplates();
  
  console.log('[Advanced Intelligence] Complete!');
}

// ===== SUBTLETY CUES =====
// Patterns for detecting unspoken meaning - prosodic signals, implicit meanings, incongruence

async function seedSubtletyCues() {
  const cues = [
    // PROSODIC CUES - Voice patterns that reveal meaning
    {
      cueType: 'prosodic',
      signalPattern: 'Long pause (3+ seconds) before answering a question',
      signalCategory: 'hesitation',
      likelyMeaning: 'Student is uncertain but may not want to admit it. They\'re searching for the answer or worried about being wrong.',
      confidenceFactors: ['Occurs after direct question', 'Previous answers were faster', 'Student has been confident earlier'],
      suggestedResponses: [
        'Offer a gentle hint without giving the answer',
        'Rephrase the question to make it easier',
        'Say "Take your time" to reduce pressure'
      ],
      avoidResponses: [
        'Immediately providing the answer',
        'Asking "Do you know this?"',
        'Moving on too quickly'
      ],
      compassConditions: { sessionPhase: 'any' },
      sensitivityModifiers: { earlySession: 0.8, lateSession: 1.0 },
      culturalConsiderations: 'In some Asian cultures, pauses before speaking show respect and thoughtfulness, not uncertainty.',
      syncStatus: 'approved',
    },
    {
      cueType: 'prosodic',
      signalPattern: 'Rising intonation at end of statements (not questions)',
      signalCategory: 'uncertainty',
      likelyMeaning: 'Student is seeking confirmation. They\'re not sure if their answer is correct.',
      confidenceFactors: ['Pattern repeats across multiple responses', 'Student looks for tutor reaction'],
      suggestedResponses: [
        'Confirm correct parts before addressing errors',
        'Use encouraging phrases like "You\'re on the right track"',
        'Ask them to commit: "Are you confident in that answer?"'
      ],
      avoidResponses: [
        'Ignoring the uncertainty',
        'Immediate correction without acknowledgment'
      ],
      compassConditions: { sessionPhase: 'any' },
      sensitivityModifiers: { earlySession: 0.7, lateSession: 1.1 },
      syncStatus: 'approved',
    },
    {
      cueType: 'prosodic',
      signalPattern: 'Rapid speech with minimal pauses',
      signalCategory: 'enthusiasm',
      likelyMeaning: 'Student is excited and engaged. They\'re in a flow state and want to practice more.',
      confidenceFactors: ['Topic is of personal interest', 'Recent success or breakthrough'],
      suggestedResponses: [
        'Match their energy level',
        'Introduce slightly more challenging material',
        'Let them lead the conversation direction'
      ],
      avoidResponses: [
        'Slowing down unnecessarily',
        'Interrupting the flow with corrections',
        'Switching to dry grammar explanations'
      ],
      compassConditions: { sessionPhase: 'teaching' },
      sensitivityModifiers: { earlySession: 1.0, lateSession: 0.9 },
      syncStatus: 'approved',
    },
    {
      cueType: 'prosodic',
      signalPattern: 'Trailing off mid-sentence or incomplete thoughts',
      signalCategory: 'fatigue',
      likelyMeaning: 'Student is mentally tired. Cognitive resources are depleted.',
      confidenceFactors: ['Late in session', 'Preceded by difficult content', 'Responses getting shorter'],
      suggestedResponses: [
        'Suggest a brief mental break or topic shift',
        'Switch to easier, more conversational content',
        'Acknowledge their effort: "You\'ve worked hard today"'
      ],
      avoidResponses: [
        'Pushing harder with difficult material',
        'Introducing new complex concepts'
      ],
      compassConditions: { timeRemaining: '<10min', sessionPhase: 'teaching' },
      sensitivityModifiers: { earlySession: 0.5, lateSession: 1.5 },
      syncStatus: 'approved',
    },
    
    // IMPLICIT SIGNALS - What students say vs what they mean
    {
      cueType: 'implicit_signal',
      signalPattern: '"I guess..." or "Maybe..." before answers',
      signalCategory: 'deflection',
      likelyMeaning: 'Student is hedging to protect themselves from being wrong. Low confidence but may actually know the answer.',
      confidenceFactors: ['Student has been corrected recently', 'Answer is actually correct'],
      suggestedResponses: [
        'Build confidence: "That sounds more certain than you think!"',
        'Ask follow-up to help them commit',
        'Celebrate when they\'re right despite hedging'
      ],
      avoidResponses: [
        'Ignoring the hedging language',
        'Criticizing uncertainty'
      ],
      compassConditions: { sessionPhase: 'any' },
      sensitivityModifiers: { earlySession: 0.8, lateSession: 1.0 },
      syncStatus: 'approved',
    },
    {
      cueType: 'implicit_signal',
      signalPattern: '"This is hard" or "I\'m not good at this"',
      signalCategory: 'frustration',
      likelyMeaning: 'Student is hitting a wall. May need encouragement or a different approach, not just more practice.',
      confidenceFactors: ['Multiple errors on same concept', 'Tone sounds defeated'],
      suggestedResponses: [
        'Acknowledge the challenge: "This IS a tricky concept"',
        'Share that many learners struggle here',
        'Offer alternative explanation or approach',
        'Consider using a creativity template (metaphor)'
      ],
      avoidResponses: [
        '"It\'s not that hard"',
        'Ignoring and continuing same approach',
        'Over-explaining the same way'
      ],
      compassConditions: { sessionPhase: 'teaching' },
      sensitivityModifiers: { earlySession: 1.2, lateSession: 1.0 },
      syncStatus: 'approved',
    },
    {
      cueType: 'implicit_signal',
      signalPattern: '"Sure" or "Okay" with flat tone',
      signalCategory: 'disengagement',
      likelyMeaning: 'Student is going through the motions. Not truly engaged with the content.',
      confidenceFactors: ['Short responses', 'Not asking questions', 'Mechanical repetition'],
      suggestedResponses: [
        'Ask about their interests to find connection',
        'Change activity type (drill → conversation)',
        'Use IMAGE or SCENARIO to make content vivid'
      ],
      avoidResponses: [
        'Continuing same activity pattern',
        'Asking "Are you paying attention?"'
      ],
      compassConditions: { sessionPhase: 'any' },
      sensitivityModifiers: { earlySession: 1.0, lateSession: 0.8 },
      syncStatus: 'approved',
    },
    
    // INCONGRUENCE - When verbal and behavioral signals don't match
    {
      cueType: 'incongruence',
      signalPattern: 'Says "I understand" but makes same error again',
      signalCategory: 'confusion',
      likelyMeaning: 'Student THINKS they understand but actually doesn\'t. Gap between perceived and actual comprehension.',
      confidenceFactors: ['Error pattern repeats', 'Quick agreement without processing time'],
      suggestedResponses: [
        'Ask them to explain the concept back to you',
        'Use COMPARE to show difference they\'re missing',
        'Try a completely different explanation angle',
        'Activate "what_if_reframe" creativity template'
      ],
      avoidResponses: [
        'Taking their word and moving on',
        'Repeating same explanation louder/slower'
      ],
      compassConditions: { sessionPhase: 'teaching' },
      sensitivityModifiers: { earlySession: 1.0, lateSession: 1.2 },
      syncStatus: 'approved',
    },
    {
      cueType: 'incongruence',
      signalPattern: 'Claims to be "fine" but voice sounds strained or flat',
      signalCategory: 'hidden_struggle',
      likelyMeaning: 'Student is struggling but doesn\'t want to appear weak or slow things down.',
      confidenceFactors: ['Previous energy was higher', 'Content is genuinely difficult', 'Cultural background values saving face'],
      suggestedResponses: [
        'Normalize difficulty: "Even advanced learners find this tricky"',
        'Offer a natural pause without drawing attention',
        'Switch to content where they can succeed'
      ],
      avoidResponses: [
        'Pressing: "Are you sure you\'re okay?"',
        'Ignoring the signal completely'
      ],
      culturalConsiderations: 'Many cultures discourage admitting difficulty to authority figures. Read the room.',
      compassConditions: { sessionPhase: 'any' },
      sensitivityModifiers: { earlySession: 0.9, lateSession: 1.3 },
      syncStatus: 'approved',
    },
    
    // CONTEXTUAL MEMORY - Long-term patterns across sessions
    {
      cueType: 'contextual_memory',
      signalPattern: 'Student mentions external stressor (work deadline, family issue)',
      signalCategory: 'external_factors',
      likelyMeaning: 'Student may be distracted by life circumstances. Capacity for learning is reduced.',
      confidenceFactors: ['Mentioned in greeting or off-topic comment', 'Unusual behavior compared to past sessions'],
      suggestedResponses: [
        'Acknowledge briefly but don\'t dwell',
        'Adjust session expectations',
        'Focus on enjoyable, low-pressure content',
        'Remember for future sessions'
      ],
      avoidResponses: [
        'Prying for details',
        'Ignoring completely',
        'Pushing full intensity'
      ],
      compassConditions: { sessionPhase: 'greeting' },
      sensitivityModifiers: { earlySession: 1.5, lateSession: 0.7 },
      syncStatus: 'approved',
    },
    {
      cueType: 'contextual_memory',
      signalPattern: 'Returns to a topic or word they learned in a previous session',
      signalCategory: 'enthusiasm',
      likelyMeaning: 'Student is making connections and applying learning. High engagement signal.',
      confidenceFactors: ['Reference is unprompted', 'Shows correct usage'],
      suggestedResponses: [
        'Celebrate the connection explicitly',
        'Build on it with related vocabulary',
        'Note this topic resonates for future sessions'
      ],
      avoidResponses: [
        'Not noticing the callback',
        'Correcting minor issues that break the flow'
      ],
      compassConditions: { sessionPhase: 'any' },
      sensitivityModifiers: { earlySession: 1.0, lateSession: 1.0 },
      syncStatus: 'approved',
    },
  ];
  
  await db.insert(subtletyCues).values(cues);
  console.log(`[Advanced Intelligence] Seeded ${cues.length} subtlety cues`);
}

// ===== EMOTIONAL PATTERNS =====
// Dynamic empathy modeling and self-correction

async function seedEmotionalPatterns() {
  const patterns = [
    // FRUSTRATION
    {
      emotionalState: 'frustration',
      typicalCauses: [
        'Repeated errors on same concept',
        'Pace too fast for comprehension',
        'Feeling stuck without progress',
        'Comparison to expected ability level'
      ],
      diagnosticQuestions: [
        'Is this frustration with the concept or with themselves?',
        'Have they made this error before, or is it new?',
        'Did something change in my teaching approach recently?',
        'Are they tired or is this genuine conceptual difficulty?'
      ],
      causalIndicators: {
        'repeated_same_error': 'concept_difficulty',
        'errors_across_topics': 'fatigue_or_distraction',
        'after_correction': 'self_criticism',
        'near_session_end': 'time_pressure'
      },
      pedagogicalAdjustments: {
        'concept_difficulty': ['try_different_angle', 'use_metaphor', 'break_into_smaller_steps'],
        'fatigue': ['switch_to_easier_content', 'suggest_break', 'end_session_early'],
        'self_criticism': ['normalize_mistakes', 'share_common_errors', 'celebrate_effort']
      },
      toolRecommendations: ['COMPARE', 'CONTEXT', 'DRILL:match'],
      pacingAdjustments: 'Slow down. Give more processing time between concepts.',
      impactIndicators: {
        'helped': ['longer_responses', 'trying_again', 'asking_questions', 'audible_relief'],
        'hurt': ['shorter_responses', 'defensive_tone', 'disengagement', 'repeated_errors']
      },
      recoveryStrategies: [
        'Acknowledge what just happened: "Let me try explaining this differently"',
        'Validate their effort before trying again',
        'Switch to content where they can succeed to rebuild confidence'
      ],
      reflectionPrompts: [
        'Did my last explanation simplify or complicate?',
        'Am I pushing when I should be supporting?',
        'Would a visual tool help more than words right now?'
      ],
      compassConditions: { sessionPhase: 'teaching' },
      timeAwareAdjustments: {
        'earlySession': 'More time to recover - can try multiple approaches',
        'lateSession': 'Less time - prioritize emotional repair over concept mastery'
      },
      learningContext: 'grammar',
      priority: 80,
      syncStatus: 'approved',
    },
    
    // CONFUSION
    {
      emotionalState: 'confusion',
      typicalCauses: [
        'Concept introduced too quickly',
        'Missing prerequisite knowledge',
        'Similar concepts not distinguished (ser/estar)',
        'Explanation too abstract'
      ],
      diagnosticQuestions: [
        'Is this new confusion or resurfacing old confusion?',
        'Do they have the foundational knowledge for this concept?',
        'Did I assume knowledge they don\'t have?',
        'Would a concrete example help more than explanation?'
      ],
      causalIndicators: {
        'blank_stare_equivalent': 'missing_foundation',
        'partial_understanding': 'need_more_examples',
        'mixing_similar_concepts': 'need_explicit_comparison',
        'overwhelmed': 'too_much_too_fast'
      },
      pedagogicalAdjustments: {
        'missing_foundation': ['back_up_to_prerequisite', 'check_prior_knowledge'],
        'need_more_examples': ['provide_3_varied_examples', 'use_IMAGE', 'use_SCENARIO'],
        'need_comparison': ['use_COMPARE', 'highlight_differences_explicitly'],
        'overwhelmed': ['pause', 'recap_what_they_do_know', 'one_thing_at_a_time']
      },
      toolRecommendations: ['COMPARE', 'WRITE', 'IMAGE', 'GRAMMAR_TABLE'],
      pacingAdjustments: 'Pause and check comprehension before adding new information.',
      impactIndicators: {
        'helped': ['asking_clarifying_questions', 'correct_usage', 'aha_moment_phrases'],
        'hurt': ['silence', 'wrong_application', 'changing_subject']
      },
      recoveryStrategies: [
        'Start over with simplest possible version',
        'Use analogy from their known interests',
        'Let them tell you what they DO understand'
      ],
      reflectionPrompts: [
        'Did I check for understanding or just assume?',
        'Am I explaining or overwhelming?',
        'Would "show" work better than "tell" here?'
      ],
      compassConditions: { sessionPhase: 'teaching' },
      timeAwareAdjustments: {
        'earlySession': 'Worth investing time to clarify - builds foundation',
        'lateSession': 'Note for next session, don\'t force understanding now'
      },
      learningContext: 'grammar',
      priority: 85,
      syncStatus: 'approved',
    },
    
    // OVERWHELM
    {
      emotionalState: 'overwhelm',
      typicalCauses: [
        'Too much new information at once',
        'Time pressure awareness',
        'Perfectionism creating paralysis',
        'Multiple error types accumulating'
      ],
      diagnosticQuestions: [
        'How many new concepts have I introduced this session?',
        'Is the student aware of time running out?',
        'Are they trying to be perfect instead of learning?',
        'Have I let errors accumulate without addressing?'
      ],
      causalIndicators: {
        'many_new_concepts': 'information_overload',
        'checking_time': 'time_anxiety',
        'afraid_to_try': 'perfectionism',
        'cascading_errors': 'lost_thread'
      },
      pedagogicalAdjustments: {
        'information_overload': ['stop_new_content', 'consolidate_review', 'pick_ONE_thing'],
        'time_anxiety': ['reassure_about_time', 'adjust_expectations', 'focus_on_wins'],
        'perfectionism': ['celebrate_attempts', 'model_making_mistakes', 'lower_stakes'],
        'lost_thread': ['pause_completely', 'recap_from_beginning', 'simplify_dramatically']
      },
      toolRecommendations: ['SUMMARY', 'WRITE'],
      pacingAdjustments: 'Stop adding. Consolidate. Breathe.',
      impactIndicators: {
        'helped': ['visible_relaxation', 're-engagement', 'asking_questions_again'],
        'hurt': ['withdrawal', 'monosyllables', 'wanting_to_end_early']
      },
      recoveryStrategies: [
        'Explicitly acknowledge: "That was a lot. Let\'s slow down."',
        'Celebrate what they HAVE learned today',
        'End on something easy and successful'
      ],
      reflectionPrompts: [
        'Did I pile on without checking capacity?',
        'Am I teaching for me or for them right now?',
        'What\'s the ONE thing they should take from today?'
      ],
      compassConditions: { timeRemaining: '<10min' },
      timeAwareAdjustments: {
        'earlySession': 'Rare early - investigate if happening',
        'lateSession': 'Common late - transition to closing gracefully'
      },
      priority: 90,
      syncStatus: 'approved',
    },
    
    // EXCITEMENT
    {
      emotionalState: 'excitement',
      typicalCauses: [
        'Breakthrough understanding',
        'Topic of personal interest',
        'Successful streak',
        'Connection to real-life application'
      ],
      diagnosticQuestions: [
        'What triggered this excitement?',
        'Can I build on this momentum?',
        'Is this sustainable or will they crash?',
        'Should I introduce slightly harder material?'
      ],
      causalIndicators: {
        'aha_moment': 'breakthrough',
        'asking_more_questions': 'curiosity_activated',
        'relating_to_life': 'personal_connection',
        'faster_responses': 'flow_state'
      },
      pedagogicalAdjustments: {
        'breakthrough': ['reinforce_with_practice', 'extend_concept', 'celebrate'],
        'curiosity': ['follow_their_questions', 'offer_deeper_content', 'explore_tangents'],
        'personal_connection': ['build_more_connections', 'use_their_examples', 'remember_for_future'],
        'flow_state': ['ride_the_wave', 'challenge_slightly', 'dont_interrupt_with_corrections']
      },
      toolRecommendations: ['DRILL:translate', 'SCENARIO', 'CONTEXT'],
      pacingAdjustments: 'Match their energy. Speed up if they can handle it.',
      impactIndicators: {
        'maintained': ['continued_engagement', 'asking_for_more', 'creative_usage'],
        'killed': ['sudden_quiet', 'energy_drop', 'disengagement']
      },
      recoveryStrategies: [
        'If momentum dies: "Wait, we were onto something good!"',
        'Acknowledge the energy shift',
        'Return to what excited them'
      ],
      reflectionPrompts: [
        'Am I riding this wave or fighting it?',
        'Did I just correct something I should have let slide?',
        'How can I recreate this energy in future sessions?'
      ],
      compassConditions: { sessionPhase: 'teaching' },
      timeAwareAdjustments: {
        'earlySession': 'Great foundation - can sustain and build',
        'lateSession': 'Wonderful way to end - let it flourish'
      },
      priority: 70,
      syncStatus: 'approved',
    },
    
    // BOREDOM
    {
      emotionalState: 'boredom',
      typicalCauses: [
        'Content too easy',
        'Repetitive activity',
        'Lack of relevance to student\'s life',
        'Tutor talking too much'
      ],
      diagnosticQuestions: [
        'Is this content below their level?',
        'Have we been doing the same activity too long?',
        'Does the student see why this matters?',
        'Am I lecturing instead of engaging?'
      ],
      causalIndicators: {
        'quick_correct_answers': 'too_easy',
        'mechanical_responses': 'repetitive_task',
        'off_topic_comments': 'seeking_engagement',
        'minimal_responses': 'disengagement'
      },
      pedagogicalAdjustments: {
        'too_easy': ['increase_challenge', 'add_constraints', 'introduce_new_concept'],
        'repetitive': ['change_activity_type', 'add_game_element', 'student_leads'],
        'no_relevance': ['connect_to_interests', 'use_SCENARIO_with_their_context', 'ask_what_they_want'],
        'too_much_teacher_talk': ['ask_questions', 'have_them_explain', 'interactive_drill']
      },
      toolRecommendations: ['SCENARIO', 'PLAY', 'DRILL:translate', 'IMAGE'],
      pacingAdjustments: 'Speed up or completely change direction.',
      impactIndicators: {
        'helped': ['increased_responses', 'questions_return', 'creative_input'],
        'hurt': ['continued_short_answers', 'checking_out', 'wants_to_end']
      },
      recoveryStrategies: [
        'Ask directly: "What would make this more interesting for you?"',
        'Pivot dramatically: "You know what, let\'s try something different"',
        'Inject humor or surprise'
      ],
      reflectionPrompts: [
        'Am I teaching this because it\'s important or because it\'s next on my list?',
        'When did I last ask what THEY want to learn?',
        'Is this challenging enough for their level?'
      ],
      compassConditions: { sessionPhase: 'teaching' },
      timeAwareAdjustments: {
        'earlySession': 'Dangerous early - must fix quickly',
        'lateSession': 'May just be fatigue - distinguish the two'
      },
      priority: 75,
      syncStatus: 'approved',
    },
    
    // ANXIETY
    {
      emotionalState: 'anxiety',
      typicalCauses: [
        'Fear of judgment',
        'Upcoming real-world use (trip, meeting)',
        'Performance pressure',
        'Past negative learning experiences'
      ],
      diagnosticQuestions: [
        'Is this general anxiety or specific to language learning?',
        'Do they have an upcoming event requiring the language?',
        'Have they mentioned past bad experiences?',
        'Am I inadvertently creating pressure?'
      ],
      causalIndicators: {
        'apologizing_frequently': 'fear_of_judgment',
        'mentioning_upcoming_event': 'performance_pressure',
        'comparing_to_others': 'external_pressure',
        'avoiding_speaking': 'speaking_anxiety'
      },
      pedagogicalAdjustments: {
        'fear_of_judgment': ['create_safe_space', 'model_imperfection', 'celebrate_attempts'],
        'performance_pressure': ['practice_specific_scenarios', 'build_confidence_phrases', 'reassure'],
        'external_pressure': ['reframe_learning_as_personal', 'focus_on_progress_not_comparison'],
        'speaking_anxiety': ['start_with_reading', 'low_stakes_practice', 'gradually_increase']
      },
      toolRecommendations: ['SCENARIO', 'DRILL:repeat', 'CONTEXT'],
      pacingAdjustments: 'Slow, patient, no pressure. Silence is okay.',
      impactIndicators: {
        'helped': ['trying_more', 'laughing_at_mistakes', 'relaxed_voice', 'longer_attempts'],
        'hurt': ['withdrawing', 'shorter_responses', 'wanting_to_stop', 'self_deprecation']
      },
      recoveryStrategies: [
        'Acknowledge directly: "It\'s okay to feel nervous"',
        'Share that mistakes are part of learning',
        'Focus on communication over perfection',
        'Build success before challenge'
      ],
      reflectionPrompts: [
        'Am I creating a safe space or pressure cooker?',
        'Did I correct too harshly?',
        'What would help this student feel brave?'
      ],
      compassConditions: { sessionPhase: 'any' },
      timeAwareAdjustments: {
        'earlySession': 'Address early - don\'t let it build',
        'lateSession': 'End on comfort, not challenge'
      },
      priority: 85,
      syncStatus: 'approved',
    },
  ];
  
  await db.insert(emotionalPatterns).values(patterns);
  console.log(`[Advanced Intelligence] Seeded ${patterns.length} emotional patterns`);
}

// ===== CREATIVITY TEMPLATES =====
// Novel metaphor generation and "what if" exploration

async function seedCreativityTemplates() {
  const templates = [
    // METAPHOR BRIDGES - Connecting unfamiliar concepts to familiar domains
    {
      templateType: 'metaphor_bridge',
      sourceDomain: 'cooking',
      targetConcepts: ['verb_conjugation', 'grammar_agreement'],
      bridgePattern: 'Conjugating verbs is like adjusting a recipe. The base ingredient (infinitive) stays the same, but you add different seasonings (endings) depending on who\'s eating (the subject).',
      exampleMetaphors: [
        'Hablar → hablo is like adding salt to taste - you adjust for yourself',
        'The verb is your base recipe; conjugation is plating it for different guests',
        'Irregular verbs are like grandma\'s secret recipes - they don\'t follow the standard instructions'
      ],
      probingQuestions: ['What dish would represent this grammar concept?', 'Who\'s coming to dinner (which subjects)?'],
      studentInterestTags: ['cooking', 'food', 'baking'],
      applicableToLanguages: ['spanish', 'french', 'italian', 'german'],
      applicableToConcepts: ['verb_conjugation', 'grammar'],
      compassConditions: { studentStruggleTime: '>2min' },
      creativityTriggers: { onStruggle: true, afterFailedExplanation: true },
      priority: 80,
      syncStatus: 'approved',
    },
    {
      templateType: 'metaphor_bridge',
      sourceDomain: 'music',
      targetConcepts: ['pronunciation', 'tone_system', 'rhythm'],
      bridgePattern: 'Language has melody. Each word has a rhythm, and tones are like the notes in a song. Getting the tone wrong is like singing off-key.',
      exampleMetaphors: [
        'Chinese tones are like a four-note scale - each pitch changes the meaning',
        'French liaison is like slurring notes together in jazz',
        'Spanish rhythm is like a steady drumbeat - each syllable gets equal time'
      ],
      probingQuestions: ['If this word were a song, how would you hum it?', 'What instrument sounds like this language?'],
      studentInterestTags: ['music', 'singing', 'instruments'],
      applicableToLanguages: ['chinese', 'japanese', 'french', 'spanish'],
      applicableToConcepts: ['pronunciation', 'tones', 'rhythm'],
      compassConditions: { studentStruggleTime: '>1min' },
      creativityTriggers: { onStruggle: true, onToneDifficulty: true },
      priority: 85,
      syncStatus: 'approved',
    },
    {
      templateType: 'metaphor_bridge',
      sourceDomain: 'sports',
      targetConcepts: ['practice', 'fluency', 'automaticity'],
      bridgePattern: 'Language learning is like training for a sport. You don\'t think about each muscle; you build muscle memory through practice until it\'s automatic.',
      exampleMetaphors: [
        'Conjugations are like dribbling - awkward at first, then automatic',
        'Making mistakes is like missing shots - each one teaches you',
        'Fluency is like being "in the zone" - you stop thinking and just play'
      ],
      probingQuestions: ['What sport movement felt awkward at first but became natural?', 'How did you get good at that?'],
      studentInterestTags: ['sports', 'athletics', 'fitness', 'gym'],
      applicableToLanguages: ['all'],
      applicableToConcepts: ['motivation', 'practice', 'fluency'],
      compassConditions: { studentStruggleTime: '>2min' },
      creativityTriggers: { onFrustration: true, onPracticeResistance: true },
      priority: 75,
      syncStatus: 'approved',
    },
    {
      templateType: 'metaphor_bridge',
      sourceDomain: 'tech',
      targetConcepts: ['grammar_rules', 'syntax', 'structure'],
      bridgePattern: 'Grammar is like code. It has syntax rules, and if you get them wrong, the program (sentence) won\'t run correctly.',
      exampleMetaphors: [
        'Subject-verb agreement is like type matching - you can\'t assign a string to an integer',
        'Sentence structure is like function structure - subject(parameters) → verb → object(return)',
        'Exceptions to rules are like edge cases - you have to learn them separately'
      ],
      probingQuestions: ['If this grammar rule were a coding concept, what would it be?', 'What error message would this mistake generate?'],
      studentInterestTags: ['tech', 'programming', 'engineering', 'computers'],
      applicableToLanguages: ['all'],
      applicableToConcepts: ['grammar', 'syntax', 'structure'],
      compassConditions: { studentStruggleTime: '>2min' },
      creativityTriggers: { onStruggle: true },
      priority: 80,
      syncStatus: 'approved',
    },
    
    // WHAT-IF REFRAMES - Exploring alternative angles when stuck
    {
      templateType: 'what_if_reframe',
      reframeQuestion: 'What if the difficulty isn\'t with understanding the concept, but with how I explained it?',
      alternativeAngles: [
        'Try visual instead of verbal explanation',
        'Start with example before rule',
        'Connect to something they already know well',
        'Let them discover the pattern instead of telling them'
      ],
      explorationTriggers: ['student_says_understand_but_makes_same_error', 'explanation_repeated_3_times', 'confusion_persists'],
      probingQuestions: [
        'Would showing be better than telling here?',
        'What do they ALREADY know that relates to this?',
        'If I had to explain this without words, how would I do it?'
      ],
      applicableToConcepts: ['grammar', 'vocabulary', 'pronunciation'],
      compassConditions: { studentStruggleTime: '>3min' },
      creativityTriggers: { afterMultipleAttempts: true },
      priority: 90,
      syncStatus: 'approved',
    },
    {
      templateType: 'what_if_reframe',
      reframeQuestion: 'What if this student learns differently than how I\'m teaching?',
      alternativeAngles: [
        'Some learn by doing (try DRILL immediately)',
        'Some learn by seeing patterns (try GRAMMAR_TABLE or COMPARE)',
        'Some learn through story (try SCENARIO)',
        'Some need to fail first to understand why rules exist'
      ],
      explorationTriggers: ['standard_approach_not_working', 'student_disengaged', 'mismatch_suspected'],
      probingQuestions: [
        'How has this student learned best in the past?',
        'Are they a see-it, hear-it, or do-it learner?',
        'Would they prefer to figure it out or be told?'
      ],
      applicableToConcepts: ['all'],
      compassConditions: { studentStruggleTime: '>2min' },
      creativityTriggers: { onDisengagement: true },
      priority: 85,
      syncStatus: 'approved',
    },
    {
      templateType: 'what_if_reframe',
      reframeQuestion: 'What if the "mistake" is actually showing deeper understanding or creativity?',
      alternativeAngles: [
        'They may be applying a rule correctly but to wrong context',
        'They may be creating by analogy (sign of advanced thinking)',
        'The "error" may be acceptable in some dialects',
        'They may be ahead of themselves, not behind'
      ],
      explorationTriggers: ['unusual_error_pattern', 'creative_but_incorrect', 'applying_rule_too_broadly'],
      probingQuestions: [
        'Why might a smart person make this error?',
        'What rule are they actually following?',
        'Is this wrong, or just different?'
      ],
      applicableToConcepts: ['grammar', 'vocabulary'],
      compassConditions: { sessionPhase: 'teaching' },
      creativityTriggers: { onUnusualError: true },
      priority: 75,
      syncStatus: 'approved',
    },
    
    // CURIOSITY PROMPTS - Fostering intellectual exploration
    {
      templateType: 'curiosity_prompt',
      probingQuestions: [
        'I wonder why this language developed this way...',
        'Have you noticed this pattern appearing elsewhere?',
        'What does this tell us about how speakers of this language think?',
        'Is there something similar in English that we can compare to?'
      ],
      connectionOpportunities: [
        'Link grammar to cultural values',
        'Show historical evolution of rules',
        'Connect to student\'s native language patterns',
        'Reveal hidden logic in seeming exceptions'
      ],
      explorationTriggers: ['student_asks_why', 'pattern_emerges', 'teaching_moment_for_deeper_understanding'],
      applicableToConcepts: ['grammar', 'culture', 'vocabulary'],
      compassConditions: { timeRemaining: '>10min', studentEngagement: 'high' },
      creativityTriggers: { onCuriositySignal: true },
      priority: 70,
      syncStatus: 'approved',
    },
    {
      templateType: 'curiosity_prompt',
      probingQuestions: [
        'If you had to explain this to a friend, how would you?',
        'What would change if this rule didn\'t exist?',
        'Can you think of a time when you\'d actually use this?',
        'What question do you have that I haven\'t answered?'
      ],
      connectionOpportunities: [
        'Real-world application discovery',
        'Student-generated examples (most memorable)',
        'Gaps in explanation revealed',
        'Personal relevance established'
      ],
      explorationTriggers: ['concept_explained', 'before_moving_on', 'check_for_depth'],
      applicableToConcepts: ['all'],
      compassConditions: { sessionPhase: 'teaching' },
      creativityTriggers: { afterExplanation: true },
      priority: 65,
      syncStatus: 'approved',
    },
    
    // DOMAIN CONNECTIONS - Bridging disparate fields
    {
      templateType: 'domain_connection',
      sourceDomain: 'travel',
      targetConcepts: ['practical_phrases', 'cultural_context', 'real_world_application'],
      bridgePattern: 'Imagine you\'re actually there. You\'ve just landed in Madrid/Paris/Rome. What\'s the first thing you need to say?',
      exampleMetaphors: [
        'Learning directions is like having a GPS for a new city',
        'Restaurant vocabulary is your menu decoder ring',
        'Greetings are your passport to connection'
      ],
      probingQuestions: ['Where would you most want to use this language?', 'What situation would you want to be prepared for?'],
      studentInterestTags: ['travel', 'adventure', 'culture', 'exploration'],
      applicableToLanguages: ['all'],
      applicableToConcepts: ['practical_phrases', 'culture', 'conversation'],
      compassConditions: { sessionPhase: 'any' },
      creativityTriggers: { onRelevanceQuestion: true },
      priority: 80,
      syncStatus: 'approved',
    },
  ];
  
  await db.insert(creativityTemplates).values(templates);
  console.log(`[Advanced Intelligence] Seeded ${templates.length} creativity templates`);
}
