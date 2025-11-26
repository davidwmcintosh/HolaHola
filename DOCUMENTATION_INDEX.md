# LinguaFlow Documentation Index

This document provides an overview of all documentation files in the project.

---

## Sales & Marketing

### FEATURES.md
**Complete product features document for marketing**
- Platform overview and value proposition
- Key features (voice learning, 9 languages, adaptive difficulty)
- Smart learning features (vocabulary extraction, flashcards, organization)
- Institutional features (teacher tools, assignments, curriculum)
- Subscription tiers (Free, Basic, Pro, Institutional)
- Competitive positioning (vs Duolingo, tutors, other AI apps)
- Getting started guides for learners and institutions

**When to use**: Sales presentations, marketing materials, investor decks, website content.

---

## Core Documentation

### replit.md
**Main project documentation**
- Overview and user preferences
- Active issues and troubleshooting
- Architectural principles (Unified Code Principle)
- System architecture (frontend, backend, data models)
- Core features and functionality
- External dependencies (Gemini, Deepgram, Google Cloud TTS)
- Third-party integrations

**When to use**: Understanding overall project structure, architecture decisions, and key features.

---

## User Guides

### TEACHER_GUIDE.md ⭐ NEW
**Complete teacher user manual**
- Getting started and logging in
- Step-by-step class creation process
- Adding students (6-character code system)
- Creating assignments (practice, homework, quiz, project)
- Grading student submissions
- Using the curriculum builder (paths/units/lessons)
- Viewing student progress and analytics
- Tips, best practices, and troubleshooting
- Quick reference tables

**When to use**: Training teachers, onboarding new educators, answering "how do I..." questions.

---

### ADMIN_GUIDE.md ⭐ NEW
**Backend administrator manual**
- Granting teacher access via SQL
- PostgreSQL database management
- User account administration
- Class and enrollment management
- Subscription/tier configuration
- System configuration and environment variables
- Troubleshooting common backend issues
- Security best practices
- SQL query reference library
- Database schema documentation

**When to use**: Backend administration, database management, troubleshooting system-level issues.

---

## Voice Chat Documentation

⚠️ **ACTIVE SYSTEM**: RestVoiceChat.tsx (REST-based)  
⚠️ **DEPRECATED**: VoiceChat.tsx (WebSocket-based) - DO NOT USE

### docs/voice-chat-setup.md ⭐ CURRENT SYSTEM
**Complete REST voice chat architecture documentation**
- **Component**: `RestVoiceChat.tsx` (client/src/components/RestVoiceChat.tsx)
- **API Client**: `restVoiceApi.ts` (client/src/lib/restVoiceApi.ts)
- Architecture overview (Browser → Deepgram Nova-3 → Gemini → Cartesia Sonic-3 TTS → Playback)
- API endpoints (`/api/voice/transcribe`, `/api/voice/synthesize`, `/api/admin/tts-meta`)
- AI services: Deepgram Nova-3 (STT), Gemini 2.5 Flash (Chat), Cartesia Sonic-3 (Primary TTS), Google Cloud Chirp HD (Fallback TTS)
- **3-Layer Emotion Control System**: Personality presets, expressiveness slider, AI-driven emotion selection
- Usage enforcement and quota tracking
- Audio format support (WebM, MP4, iOS/Safari compatibility)
- Error handling strategies
- Response parsing logic
- Mobile support
- Accessibility features
- Performance: <300ms STT latency, 40-90ms TTS latency, 54.3% better accuracy for non-native speakers
- Troubleshooting guide
- Migration notes (OpenAI → Gemini/Deepgram, November 2025; Google Cloud → Cartesia TTS, November 2025)

**When to use**: Understanding voice features, debugging voice issues, implementing new voice capabilities.

### Voice Console (Admin Feature) ⭐ NEW
**Admin/Developer voice management tool** (`/admin/voices`)
- Preview all available tutor voices across 9 languages
- Audition voices with different emotion settings (personality, expressiveness, emotion)
- Test voice samples before deploying to users
- Compare target language and native language voice samples
- Access via: Admin Dashboard → Voice Console

**When to use**: Configuring tutor voices, testing emotion settings, quality assurance for voice features.

---

### docs/LLM-Migration-Analysis.md ⚠️ HISTORICAL REFERENCE
**Historical LLM migration analysis (COMPLETED November 2025)**
- Cost-benefit analysis: OpenAI → Gemini/Deepgram
- Voice STT comparison (Whisper → Deepgram Nova-3)
- Text LLM comparison (GPT → Gemini)
- Migration decision rationale
- Expected vs actual costs ($650 estimated → $7 actual)
- Annual savings projections (~$600/year)

**When to use**: Understanding migration decisions, cost analysis reference, architectural history.

---

## AI Integration Documentation

⚠️ **NOTE**: All AI services now use Replit AI Integrations (no user API keys needed)

### Current AI Services (November 2025)
- **Text Chat**: Gemini 2.5 Flash (Free/Basic/Institutional), Gemini 2.5 Pro (Pro tier)
- **Voice STT**: Deepgram Nova-3 with auto-detect mode
- **Voice TTS (Primary)**: Cartesia Sonic-3 with 40-90ms latency and 3-layer emotion control
- **Voice TTS (Fallback)**: Google Cloud Chirp 3 HD voices (automatic failover)
- **Image Generation**: Gemini Flash-Image

### docs/Development-Cost-Projections.md ⭐ NEW
**Development cost reference based on actual migrations**
- $7 baseline: Complete LLM migration (November 2025)
- Cost estimation formulas for future work
- Small/Medium/Large task categorization
- Examples and guidelines

**When to use**: Estimating development effort, planning feature work, budget projections.

---

### Historical API Key Documentation (Pre-Migration)

The following files reference the old OpenAI-based architecture and are preserved for historical context:

- **test-openai-key.ts**: OpenAI API key verification (deprecated)
- **API_KEY_VERIFICATION.md**: OpenAI key setup (deprecated)
- **API_KEY_MANAGEMENT.md**: OpenAI key management (deprecated)
- **API_KEY_FIX_INSTRUCTIONS.md**: OpenAI troubleshooting (deprecated)

---

## Institutional Features Documentation

### docs/institutional-standards-integration.md ⭐ PRODUCTION-READY
**Complete B2B institutional features implementation**
- ACTFL standards integration (proficiency levels, Can-Do statements)
- Teacher dashboard and class management
- Assignment creation, submission, and grading workflows
- Curriculum builder (paths/units/lessons hierarchy)
- Student enrollment system (6-character class codes)
- Frontend route guards + backend authorization
- Standardized form architecture across 6 pages
- Production status: Milestones 1-3.5 COMPLETED

**When to use**: Understanding institutional features, teacher workflows, student management, assignment systems.

---

## Other Documentation

### CAPACITOR.md
**Native mobile app configuration**
- iOS and Android setup
- Capacitor configuration
- Build procedures
- Native capabilities

**When to use**: Building native mobile apps, configuring native features.

---

### design_guidelines.md
**UI/UX design guidelines**
- Color schemes
- Typography
- Component usage
- Responsive design patterns

**When to use**: Implementing new UI features, ensuring design consistency.

---

## Quick Reference

### Voice Features Not Working?
1. Check browser console (F12) for frontend errors
2. Review `docs/voice-chat-setup.md` → Troubleshooting section
3. Check workflow logs for backend errors
4. Verify AI integrations are configured (Deepgram, Google Cloud TTS)

### Understanding Architecture?
1. Start with `replit.md` → System Architecture
2. Read `docs/voice-chat-setup.md` → Architecture Overview
3. Review `docs/LLM-Migration-Analysis.md` → Migration History
4. Check `replit.md` → Unified Code Principle

### New Teacher Onboarding?
1. Read `TEACHER_GUIDE.md` (complete user manual)
2. Review class creation workflow
3. Learn assignment and grading processes
4. Understand curriculum builder

### New Administrator Setup?
1. Read `ADMIN_GUIDE.md` (backend administration)
2. Learn how to grant teacher access
3. Review database management procedures
4. Understand security best practices

### New Developer Onboarding?
1. Read `replit.md` (overview, architecture, features)
2. Review `docs/voice-chat-setup.md` (voice features)
3. Check `design_guidelines.md` (UI standards)
4. Review `docs/Development-Cost-Projections.md` (cost estimates)

### Debugging Voice Issues?
1. Check browser console (F12) for frontend errors
2. Review workflow logs for backend errors
3. Check `docs/voice-chat-setup.md` → Troubleshooting
4. Verify Deepgram and Google Cloud TTS credentials are set

---

## File Locations

```
project/
├── replit.md                                # Main documentation
├── FEATURES.md                              # Sales/marketing features doc
├── TEACHER_GUIDE.md                         # Teacher user manual
├── ADMIN_GUIDE.md                           # Administrator backend guide
├── docs/
│   ├── voice-chat-setup.md                 # Voice chat architecture ⭐ UPDATED
│   ├── LLM-Migration-Analysis.md           # Migration history (Nov 2025)
│   ├── Development-Cost-Projections.md     # Cost estimation reference
│   └── institutional-standards-integration.md
├── DEVELOPER_QUICK_COMMANDS.md             # Developer SQL commands
├── DOCUMENTATION_INDEX.md                  # This file
├── CAPACITOR.md                            # Mobile app config
├── design_guidelines.md                    # UI/UX guidelines
├── client/src/pages/admin/
│   └── VoiceConsole.tsx                    # Voice Console admin page ⭐ NEW
├── server/services/
│   └── tts-service.ts                      # Dual TTS provider architecture
└── [deprecated]/                           # Historical files
    ├── REST_VOICE_CHAT.md                  # Old voice docs
    ├── VOICE_CHAT_TROUBLESHOOTING.md       # WebSocket history
    ├── API_KEY_*.md                        # Old OpenAI key docs
    └── test-openai-key.ts                  # Old test script
```

---

## Recent Updates (Nov 26, 2025)

### ✅ Cartesia Sonic-3 TTS Integration (Nov 26)
- **Primary TTS**: Google Cloud Chirp HD → Cartesia Sonic-3 (40-90ms latency)
- **3-Layer Emotion Control**: Personality presets, expressiveness slider (1-5), AI-driven emotion selection
- **Personality Presets**: warm, calm, energetic, professional
- **Voice Console**: Admin/developer tool for voice audition and testing
- **Automatic Failover**: Seamless fallback to Google Cloud if Cartesia unavailable
- **Phoneme Pronunciation**: IPA-based pronunciation for foreign words in English responses

### ✅ LLM Migration Completed (Nov 23)
- **Text Chat**: OpenAI GPT-4o-mini → Gemini 2.5 Flash
- **Voice STT**: OpenAI Whisper → Deepgram Nova-3
- **Image Generation**: DALL-E 3 → Gemini Flash-Image
- **TTS**: Google Cloud Chirp 3 HD (at that time, now Cartesia Sonic-3)
- **Cost**: $7 total migration cost
- **Savings**: ~$600/year ongoing

### ✅ Institutional Features Completed (Nov 23)
- **Teacher Dashboard**: Class management, student tracking, progress reports
- **Assignment System**: Full creation, submission, and grading workflows
- **Curriculum Builder**: Hierarchical path/unit/lesson structure
- **Student Features**: Class joining, assignment submission
- **Security**: Frontend route guards + backend authorization
- **Form Architecture**: Standardized shadcn Form + zodResolver across all 6 pages
- **Backend**: 32 storage methods, 29 secure API endpoints

### ✅ Production Polish Completed (Nov 24)
- **Offline Support**: OfflineIndicator with automatic reconnection, enhanced service worker caching
- **Mobile Responsiveness**: Responsive text sizing (text-3xl md:text-4xl) across all pages
- **Security Hardening**: Unified frontend/backend validation with max-length constraints (200/2000/10000 chars)
- **Input Sanitization**: .trim() on all inputs, form composition from shared schemas
- **PWA Enhancement**: Comprehensive API route caching including /api/teacher/*, /api/student/*, /api/curriculum/*

### ✅ Documentation Updated (Nov 26)
- `FEATURES.md`: Added emotion control system, Cartesia TTS, personality presets
- `docs/voice-chat-setup.md`: Updated to reflect Cartesia Sonic-3 architecture and emotion system
- `DOCUMENTATION_INDEX.md`: Added Voice Console admin feature, updated TTS references
- `ADMIN_GUIDE.md`: Added Voice Console section for tutor voice management
- `replit.md`: Updated with Voice Console admin feature reference

---

## Maintenance

### When Adding Features
1. Document in `replit.md` → Core Features
2. If voice-related, update `REST_VOICE_CHAT.md`
3. Update this index if adding new documentation files

### When Fixing Bugs
1. Document solution in relevant file
2. Add to troubleshooting sections
3. Update test scripts if needed

### When Changing Architecture
1. Update `replit.md` → System Architecture
2. Update component-specific docs (e.g., `REST_VOICE_CHAT.md`)
3. Add migration notes if breaking changes

---

**Last Updated**: November 26, 2025  
**Current AI Stack**: Gemini 2.5 Flash/Pro (text), Deepgram Nova-3 (STT), Cartesia Sonic-3 (Primary TTS), Google Cloud Chirp HD (Fallback TTS), Gemini Flash-Image (images)  
**Production Status**: Production-ready with offline support, mobile responsiveness, security hardening, and emotionally expressive AI tutors  
**Maintainer**: LinguaFlow Development Team
