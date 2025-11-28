# LinguaFlow - AI-Powered Language Learning Platform

## Transform How You Learn Languages

LinguaFlow is a next-generation language learning platform that uses advanced AI to create personalized, immersive conversation practice. Whether you're a solo learner or an educational institution, LinguaFlow adapts to your needs.

---

## Key Features

### Voice-First Learning
**Natural Conversations with AI Tutors**
- Talk naturally in your target language with AI tutors that respond in real-time
- Push-to-talk voice recording with instant transcription
- Ultra-low latency TTS using Cartesia Sonic-3 (40-90ms response time)
- 3-mode subtitle system: Off (full immersion), Target Language Only, or Full Transcript
- Slow repeat button for difficult phrases - AI simplifies and speaks slower
- Replay button to hear the last response again

**Research-Backed Karaoke Subtitles**
- Word-by-word highlighting synchronized with spoken audio
- Pedagogically optimized timing: words appear ~100-150ms BEFORE they're spoken
- Based on cognitive science research showing anticipatory display:
  - Primes the brain for incoming audio
  - Strengthens written-to-spoken word association
  - Improves word recognition and long-term memory retention
- "Target Language Only" mode shows only foreign words, filtering out English
- Smart phrase detection keeps multi-word expressions together (e.g., "Buenos días")

### Emotionally Expressive AI Tutor
**3-Layer Emotion Control System**
- **Personality Presets**: Choose your tutor's base personality
  - Warm: Friendly, encouraging, patient
  - Calm: Neutral, patient, curious
  - Energetic: Excited, enthusiastic, happy
  - Professional: Neutral, calm, focused
- **Expressiveness Slider (1-5)**: Control emotional range
  - Level 1-2: Minimal emotion, baseline only
  - Level 3: Core emotions for personality
  - Level 4: Extended emotion set
  - Level 5: Full spontaneous emotions
- **AI-Driven Dynamic Selection**: AI chooses the right emotion for each response
- **Natural Laughter**: Authentic bonding moments with the tutor

### Pronunciation Feedback
**Real-Time Pronunciation Checking**
- Advanced speech recognition with word-level confidence scoring
- AI tutor provides gentle corrections when pronunciation needs work
- Hear the correct pronunciation immediately with native speaker audio
- Slow repeat mode breaks down difficult words at 0.7x speed
- IPA phonetic guidance for precise syllable pronunciation
- Smart phrase detection recognizes multi-word expressions (e.g., "buenos dias" as one unit)
- Compare your speech to native pronunciation models
- Practice difficult sounds with targeted feedback

### 9 Languages Supported
- Spanish, French, German, Italian, Portuguese
- Japanese, Chinese, Korean, Russian
- Learn any language with explanations in your native language

### Adaptive Difficulty
- **Beginner**: Immersive mode with vocabulary in your native language
- **Intermediate**: Mixed practice with grammar focus
- **Advanced**: Full target language conversations
- Auto-adjusts based on your performance

### ACTFL Standards Integration
- Proficiency tracking aligned with ACTFL World-Readiness Standards
- Can-Do Statements for measurable progress
- FACT criteria tracking (Functions, Accuracy, Context, Text Type)
- Clear progression from Novice to Distinguished levels

### Real-Time ACTFL Advancement Tracking
**Automatic Proficiency Assessment After Every Voice Exchange**
- **Functions**: Tracks communication tasks performed (greetings, questions, introductions, expressing preferences, thanking)
- **Accuracy**: Measures pronunciation confidence from Deepgram speech recognition (per-session, race-condition free)
- **Context**: Monitors topics discussed across conversations
- **Text Type**: Analyzes word count and speech complexity per message

**Smart Advancement Notifications**
- Real-time feedback when you're ready for the next proficiency level
- Encouragement messages when metrics are improving
- Level-specific thresholds aligned with ACTFL World-Readiness Standards:
  - Novice Low: 5 hours practice, 70%+ pronunciation, 3 tasks completed
  - Higher levels require progressively more practice time, accuracy, and task mastery

### One-Word Rule for Beginners
**Pedagogically-Optimized Beginner Practice**
- Validates beginner speech for single conceptual units
- Allows phrase units like "por favor" or "buenos días" as one word
- Smart phrase detection recognizes multi-word expressions
- Gentle feedback via streaming messages when rule is violated
- Builds confidence through focused, achievable practice

---

## Smart Learning Features

### Automatic Vocabulary Extraction
- New words are automatically captured during conversations
- Each word linked back to the conversation where you learned it
- Flip a flashcard and click "View in conversation" to see context

### Spaced Repetition Flashcards
- Scientifically-proven memory optimization
- Due date tracking and review scheduling
- Filter by time period or words due for review

### Three-Phase Organization System

**Phase 1: Star & Filter**
- Star your favorite conversations for quick access
- Filter by time: Today, This Week, This Month, Older
- Quickly find what you need

**Phase 2: Smart Topics**
- AI-powered topic tagging (coming soon)
- Automatically categorize conversations by subject
- Filter vocabulary by topic

**Phase 3: Lesson Bundles**
- Create custom lessons from your content
- Auto-generate weekly lessons from your activity
- Bundle conversations and vocabulary for focused review

### Progress Tracking
- Streak tracking for daily motivation
- Progress charts showing improvement over time
- Vocabulary mastery metrics

---

## Institutional Features

### For Teachers

**Class Management**
- Create unlimited classes with simple 6-character join codes
- Track individual student progress and activity
- View conversation history and vocabulary growth

**Assignment System**
- Create practice, homework, quiz, or project assignments
- Set due dates and point values
- Grade submissions with detailed feedback
- Track completion rates across classes

**Curriculum Builder**
- Build learning paths with units and lessons
- Assign curriculum to classes
- Track student progression through materials

**Standards Alignment**
- ACTFL Can-Do Statement tracking per student
- Progress reports aligned with educational standards
- Evidence-based proficiency assessment

### For Students

**Seamless Joining**
- Enter 6-character code to join classes instantly
- No complex setup required
- Access assignments immediately

**Assignment Tracking**
- View all assignments with due dates
- Submit work directly in the platform
- Receive teacher feedback and grades

**Progress Visibility**
- See your own Can-Do Statement progress
- Track vocabulary growth over time
- View conversation history

### For Administrators

**Super Admin Dashboard**
- Complete user management across the platform
- Role-based access control (Admin, Developer, Teacher, Student)
- Platform-wide metrics and analytics
- Audit logging for security

---

## Technical Excellence

### AI-Powered by the Best
- **Text Chat**: Google Gemini 2.5 Flash/Pro for intelligent responses
- **Speech-to-Text**: Deepgram Nova-3 with 54% better accuracy for non-native speakers
- **Text-to-Speech (Primary)**: Cartesia Sonic-3 with 40-90ms latency and emotion control
- **Text-to-Speech (Fallback)**: Google Cloud Chirp 3 HD for reliable backup
- **Image Generation**: Gemini Flash-Image for contextual visuals

### Voice Mode Architecture
**WebSocket-Based Voice Communication**
- Real-time voice pipeline: speech recognition → AI → text-to-speech
- Fast response times with optimized processing
- Complete pipeline for natural conversation

**Voice Pipeline**:
1. Deepgram Nova-3 STT → Accurate transcription
2. Gemini 2.5 Flash → AI response generation
3. Cartesia Sonic-3 TTS → Ultra-low latency audio synthesis

**Background Learning Integration**:
- Vocabulary extraction happens after each exchange (non-blocking)
- Progress tracking updates automatically
- ACTFL metrics recorded after each voice exchange

### Fast & Reliable
- Sub-300ms speech recognition latency
- Ultra-fast voice responses with Cartesia Sonic-3 (40-90ms TTS latency)
- Deepgram pre-warming eliminates cold start delays
- Dual TTS provider architecture with automatic failover
- Per-session pronunciation confidence tracking (no cross-session data contamination)

### Science-Backed Learning
- Pedagogically calibrated subtitle timing based on cognitive research
- ~100-150ms anticipatory word display optimizes brain priming
- Frame-accurate synchronization using high-precision timing (performance.now + requestAnimationFrame)
- Karaoke highlighting strengthens audio-visual word association for faster memorization

### Works Everywhere
- Progressive Web App (PWA) - install on any device
- Offline indicator with automatic reconnection
- Mobile-responsive design
- Native iOS and Android apps via Capacitor

### Secure & Private
- Replit Auth with Google SSO support
- Role-based authorization on all endpoints
- Input sanitization and validation
- HTTPS encryption for all data

---

## Subscription Tiers

### Free Tier
- Basic voice and text chat
- Limited daily messages
- Core vocabulary features
- Perfect for trying LinguaFlow

### Basic Tier
- Increased message limits
- Full vocabulary and flashcard features
- Progress tracking
- Spaced repetition

### Pro Tier
- Unlimited messages
- Access to Gemini 2.5 Pro (advanced AI)
- Priority voice processing
- Advanced analytics

### Institutional Tier
- All Pro features
- Teacher dashboard and class management
- Assignment and grading system
- Curriculum builder
- Student progress tracking
- ACTFL standards integration
- Dedicated support

---

## Why LinguaFlow?

### vs. Traditional Apps (Duolingo, Babbel)
- **Real conversations** instead of repetitive exercises
- **AI adapts** to your actual level and interests
- **Voice-first** learning for practical speaking skills
- **No gamification gimmicks** - just effective learning

### vs. Human Tutors
- **Available 24/7** - practice anytime
- **No scheduling** - learn on your schedule
- **Fraction of the cost** - unlimited practice
- **No judgment** - make mistakes freely

### vs. Other AI Apps
- **Premium voice quality** - ultra-low latency Cartesia Sonic-3 with emotion control
- **Expressive AI tutors** - configurable personality and emotional range
- **Research-backed learning** - pedagogically optimized karaoke timing for better retention
- **Educational standards** - ACTFL alignment for institutions
- **Complete platform** - vocabulary, flashcards, organization built-in
- **Institutional ready** - full teacher tools and class management

---

## Getting Started

### Individual Learners
1. Sign up with Google or email
2. Choose your target language and native language
3. Select your difficulty level
4. Start a conversation and begin learning!

### Teachers & Institutions
1. Contact us for institutional access
2. Create your teacher account
3. Set up classes with join codes
4. Create assignments and track progress
5. Build custom curriculum paths

---

## Contact

**Website**: [Your website here]
**Support**: [Support email here]
**Demo Request**: [Demo request link here]

---

*LinguaFlow - Where AI Meets Language Learning*

*Last Updated: November 28, 2025*
