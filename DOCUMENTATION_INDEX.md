# LinguaFlow Documentation Index

This document provides an overview of all documentation files in the project.

---

## Core Documentation

### replit.md
**Main project documentation**
- Overview and user preferences
- Active issues and troubleshooting
- Architectural principles (Unified Code Principle)
- System architecture (frontend, backend, data models)
- Core features and functionality
- External dependencies (dual OpenAI client architecture)
- Third-party integrations

**When to use**: Understanding overall project structure, architecture decisions, and key features.

---

## Voice Chat Documentation

### REST_VOICE_CHAT.md ⭐ NEW
**Complete REST voice chat architecture documentation**
- Architecture overview (Browser → Whisper → GPT → TTS → Playback)
- API endpoints (`/api/voice/transcribe`, `/api/voice/synthesize`)
- Dual OpenAI client architecture explained
- Usage enforcement and quota tracking
- Audio format support (WebM, MP4, iOS/Safari compatibility)
- Error handling strategies
- Response parsing logic
- Testing and verification (test-openai-key.ts)
- Mobile support
- Accessibility features
- Performance characteristics
- Troubleshooting guide
- Migration notes from WebSocket

**When to use**: Understanding voice features, debugging voice issues, implementing new voice capabilities, API key setup.

---

### VOICE_CHAT_TROUBLESHOOTING.md
**Historical WebSocket debugging timeline**
- Complete investigation of failed WebSocket implementation
- Configuration attempts and failures
- Timeline of debugging efforts (8+ hours)
- Lessons learned

**When to use**: Understanding why we pivoted to REST, historical context, avoiding WebSocket approach.

---

## API Key Documentation

### test-openai-key.ts ⭐ NEW
**API key verification script**
- Tests Whisper (STT)
- Tests TTS (speech synthesis)
- Tests Chat Completions
- Provides detailed error messages
- Confirms USER_OPENAI_API_KEY validity

**Usage**: `tsx test-openai-key.ts`

**When to use**: Verifying API key before/after setup, debugging 401 errors, confirming voice features will work.

---

### API_KEY_VERIFICATION.md
**API key setup instructions**
- How to obtain OpenAI API key
- Where to configure USER_OPENAI_API_KEY
- Common setup issues

**When to use**: Initial project setup, helping new developers configure voice features.

---

### API_KEY_MANAGEMENT.md
**API key management best practices**
- Security considerations
- Rotation procedures
- Environment variable handling

**When to use**: Managing API keys in production, security audits.

---

### API_KEY_FIX_INSTRUCTIONS.md
**Emergency API key troubleshooting**
- Quick fix procedures
- Common error codes
- Diagnostic steps

**When to use**: Voice features suddenly stop working, 401/403 errors appearing.

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
1. Run `tsx test-openai-key.ts` to verify API key
2. Check `REST_VOICE_CHAT.md` → Troubleshooting section
3. Review `replit.md` → API Key Verification section
4. Check workflow logs: `refresh_all_logs` tool

### Understanding Architecture?
1. Start with `replit.md` → System Architecture
2. Read `REST_VOICE_CHAT.md` → Architecture Overview
3. Review `replit.md` → Unified Code Principle

### New Developer Onboarding?
1. Read `replit.md` (overview, architecture, features)
2. Set up API key (follow `API_KEY_VERIFICATION.md`)
3. Run test script: `tsx test-openai-key.ts`
4. Review `REST_VOICE_CHAT.md` (voice features)
5. Check `design_guidelines.md` (UI standards)

### Debugging Voice Issues?
1. Run `tsx test-openai-key.ts` (verify key)
2. Check browser console (F12)
3. Review `REST_VOICE_CHAT.md` → Error Handling
4. Check workflow logs for backend errors
5. Verify USER_OPENAI_API_KEY is set

---

## File Locations

```
project/
├── replit.md                         # Main documentation
├── REST_VOICE_CHAT.md               # Voice chat architecture ⭐ NEW
├── test-openai-key.ts               # API key test script ⭐ NEW
├── VOICE_CHAT_TROUBLESHOOTING.md    # WebSocket failure history
├── API_KEY_VERIFICATION.md          # Key setup guide
├── API_KEY_MANAGEMENT.md            # Key management
├── API_KEY_FIX_INSTRUCTIONS.md      # Emergency fixes
├── CAPACITOR.md                     # Mobile app config
├── design_guidelines.md             # UI/UX guidelines
└── DOCUMENTATION_INDEX.md           # This file
```

---

## Recent Updates (Nov 21, 2025)

### ✅ Completed
- **REST_VOICE_CHAT.md**: Comprehensive voice architecture documentation
- **test-openai-key.ts**: API key verification script
- **replit.md**: Added API Key Verification section
- **replit.md**: Enhanced External Dependencies with dual client explanation

### ✅ Verified
- USER_OPENAI_API_KEY confirmed working (164 chars, sk-proj-* prefix)
- All voice APIs operational (Whisper, TTS, Chat)
- Test script successfully validates key

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

**Last Updated**: November 21, 2025  
**Maintainer**: LinguaFlow Development Team
