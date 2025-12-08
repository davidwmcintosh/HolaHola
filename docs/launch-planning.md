# Launch Planning Document

*Created: December 8, 2025*

## Current Status

We're preparing to take our AI-powered language tutoring platform from development to production. This document tracks our thinking on hosting, branding, and launch strategy.

---

## Part 1: Hosting Analysis

### Can Replit Handle Thousands of Students? 

**Yes, with the right configuration.**

### What Replit Offers

| Feature | Status | Notes |
|---------|--------|-------|
| **Autoscaling** | ✅ | Automatically adds servers on traffic spikes, scales to zero when idle |
| **WebSocket Support** | ✅ | Critical for voice streaming - fully supported |
| **Custom Domains** | ✅ | Full support for custom domains and subdomains |
| **Uptime SLA** | ✅ | Autoscale: 99.95% / Reserved VM: 99.9% |
| **Monitoring** | ✅ | Real-time logs, page views, response times |
| **Managed Database** | ✅ | Postgres with connection pooling for high traffic |

### Critical Limits to Know

| Limit | Value | Impact |
|-------|-------|--------|
| **Concurrent connections** | 20 per instance | Autoscale spins up multiple instances (20 × N) |
| **Cold start** | After 15 min idle | Reserved VM avoids this entirely |
| **Database storage** | 10 GB | Sufficient for student data, vocabulary, conversations |
| **Egress bandwidth** | 100 GB/month included | Voice audio streaming uses bandwidth - monitor |

### Pricing Breakdown

**Reserved VM (Always-On - Recommended for Voice):**
| Tier | Specs | Cost |
|------|-------|------|
| Shared | 0.5 vCPU / 2GB RAM | $20/month |
| Dedicated | 1 vCPU / 4GB RAM | $40/month |
| Dedicated | 2 vCPU / 8GB RAM | $80/month |
| Dedicated | 4 vCPU / 16GB RAM | $160/month |

**Autoscale (Variable Traffic):**
- Base: $1/month
- Compute Units: CPU × 18 + RAM × 2 per second
- Per million requests
- Example: 300K requests/month ≈ $14

### Recommended Architecture

**Hybrid Approach for Voice-First Platform:**

1. **Reserved VM for Core App** - No cold starts. Students get instant response when starting voice chat. $40-80/month for the core experience is worth it.

2. **Monitor and Adjust** - Start with Reserved VM, observe usage patterns. If concurrent usage explodes, consider Autoscale for horizontal scaling.

3. **Connection Pooling** - Use `-pooler` database URL for production traffic.

### Alternative Platforms Considered

| Platform | Pros | Cons |
|----------|------|------|
| **Replit** | All-in-one, WebSocket native, easy deploys | 20 conn/instance, bandwidth costs |
| **Railway/Render** | Similar pricing, Node.js friendly | Less integrated |
| **AWS/GCP** | Unlimited scale, full control | Complex, expensive at small scale |
| **Vercel** | Great frontend CDN | Serverless poor for WebSocket |

**Decision: Stay on Replit** - Strong fit for current stage and growth. Migrate later if we hit genuine limits (thousands of concurrent voice sessions is a good problem to have).

---

## Part 2: Naming & Branding

### The Challenge

**LinguaFlow** is not available as a domain. We need a new name that captures:

- AI-powered / conversational learning
- Personal / adaptive experience  
- Daniela as the tutor personality
- Natural, flowing language acquisition
- Modern, approachable feel

### What We Learned From Competitors

| Brand | Why It Works |
|-------|--------------|
| **Duolingo** | Portmanteau (duo + lingo), 4 syllables but memorable mascot |
| **Babbel** | Playful on "babble", conversational focus, 2 syllables |
| **Mondly** | Coined word ("mondo" = world), modern/tech feel |
| **Drops** | One word, visual metaphor (drops of learning) |
| **HelloTalk** | Descriptive + friendly greeting |

**Key patterns:**
- 2-3 syllables max
- Include roots like "lingo," "speak," "talk" for instant recognition
- One-word punch is powerful
- Match name to methodology

### Our Unique Angle

**The tutors ARE the product.** Not a platform with tutors - the tutors themselves are the experience. Each has their own personality, teaching style, and relationship with the student. The technology enables this, but the tutors are what you're really buying.

**What makes us different:**
- Voice-first, conversational learning
- AI tutors that remember you and adapt
- Multiple tutor personalities to choose from
- ACTFL-aligned progression
- The relationship with YOUR tutor

**Naming implication:** The brand should feel like a *collective of experts*, a *team of tutors*, or a *place where great tutors live*.

### Refined Naming Directions

**Direction A: Voice/Conversation Focus** ⭐ *Matches methodology*
Emphasizes the conversational, voice-first approach - the platform where you *talk* to learn.
| Name | Pros | Cons |
|------|------|------|
| **Parla** | Italian for "speak", 2 syllables, elegant, international | Might need explanation |
| **Habla** | Spanish for "speak", 2 syllables, direct | Might seem Spanish-only |
| **VoxTutor** | "Voice tutor", clear | Sounds technical |
| **TalkPath** | Journey + speaking | Might be generic |
| **SpeakFlow** | Voice + natural progression | Similar to LinguaFlow |

**Direction B: Made-Up/Brandable** ⭐ *Fully ownable*
Unique, ownable, no existing meaning - can become whatever you define.
| Name | Pros | Cons |
|------|------|------|
| **Lingora** | "Lingua" + euphonic ending, 3 syllables | No inherent meaning |
| **Fluencia** | Romance feel, evokes "fluency", elegant | 4 syllables |
| **Voxly** | "Vox" (voice) + tech suffix, modern | Might feel corporate |
| **Parlai** | "Parla" + AI, clever fusion | Pronunciation unclear (par-LYE?) |
| **Tutera** | "Tutor" + feminine/friendly ending | Could work well |
| **Speakara** | "Speak" + euphonic ending | 3 syllables, flows |

**Direction C: Emotional/Aspirational**
Captures the feeling of breakthrough - fear→confidence.
| Name | Pros | Cons |
|------|------|------|
| **FreeToSpeak** | Emotional, captures the journey | 3 words, long |
| **SpeakFree** | Shorter, same emotion | Domain likely taken |
| **VoiceUnlocked** | Journey metaphor, powerful | 4 syllables |
| **Fearless** | Bold, emotional | Too generic, not language-specific |

**Direction D: Tutor Collective Concept** ⭐⭐ *Tutors ARE the product*
The brand IS the tutors. A collective, a studio, a roster of experts.
| Name | Pros | Cons |
|------|------|------|
| **Tutora** | "Tutor" + warm/feminine ending, feels like a name itself | Simple, elegant |
| **TheTutors** | Direct, bold, confident | Might be too generic |
| **TutorHouse** | "Studio" feel, place where tutors live | 3 syllables |
| **VoiceTutors** | Method + product in one | Descriptive but clear |
| **TutorStudio** | Creative collective feel | Might sound like marketplace |
| **Maestros** | "Teachers/masters" in Romance languages | Strong, might feel pretentious |
| **LosTutores** | Spanish "The Tutors", personality | Might feel Spanish-only |

**Direction E: Relationship-Forward**
Emphasizes the bond between student and tutor.
| Name | Pros | Cons |
|------|------|------|
| **MyTutor** | Personal possession, "this is MY tutor" | Likely taken |
| **TutorMe** | Action-oriented, request feel | Similar products exist |
| **YourTutor** | Direct relationship | Generic |
| **MeetYourTutor** | Action + relationship | Long |

**Direction F: The "Studio/House" Model**
Like a record label or creative studio - the brand is where great tutors come from.
| Name | Pros | Cons |
|------|------|------|
| **SpeakHouse** | "House" implies roster, speaking implies method | 2 syllables each word |
| **VoxHouse** | Latin "voice" + house | Modern, clean |
| **LinguaHouse** | Language + house | Clear, 4 syllables |
| **TutorLab** | Experimental, modern | Might feel tech-heavy |

---

### My Current Thinking

**The tutors ARE the product.** So the brand should either:

**Option A: BE the tutors (collective noun)**
- *Tutora* - Simple, elegant, sounds like a name itself
- *Maestros* - Bold, "masters" in Romance languages

**Option B: BE the house where great tutors live**
- *SpeakHouse* - Voice method + roster feel
- *VoxHouse* - Latin "voice" + studio vibe

**Option C: Made-up but tutor-feeling**
- *Lingora* - Language root, warm ending
- *Fluencia* - Fluency evoked, elegant

---

### Top 3 Revised (Tutors = Product)

1. **Tutora** (.com, .ai) - Simple, warm, sounds like a person's name. "Learn with Tutora" works. Individual tutors (Daniela, Marco) are "Tutora tutors." Short, memorable, the brand IS the tutors.

2. **Lingora** (.com, .ai) - Completely ownable. "Lingua" signals language, "-ora" ending matches Tutora's warmth. "Meet your Lingora tutor."

3. **SpeakHouse** (.com, .ai) - Voice-first method baked in. "House" implies a roster of talent. "Daniela is a SpeakHouse tutor."

**The core pitch:**
> "At [Brand], you don't just get an app. You get a tutor who knows you."

**Pitch variations:**
- "Not an app. A tutor."
- "Your tutor remembers. Your tutor adapts. Your tutor cares."
- "Apps teach languages. Tutors teach people."
- "Meet the tutors who actually know your name."
- "The difference between an app and a tutor? A tutor knows you."
- "Learning a language is personal. Your tutor should be too."

---

## Part 3: Pre-Launch Checklist

### Technical Readiness
- [ ] Voice streaming stability tested at scale
- [ ] Database connection pooling configured
- [ ] Error monitoring in place
- [ ] Performance metrics baseline established
- [ ] Stripe subscription flows tested end-to-end
- [ ] Mobile (PWA/Capacitor) builds verified

### Branding & Assets
- [ ] Final name selected
- [ ] Domain purchased
- [ ] Logo designed
- [ ] App icons for iOS/Android
- [ ] Social media handles secured
- [ ] Email domain configured

### Content & Legal
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Cookie consent (if needed for EU)
- [ ] Subscription pricing finalized

### Launch Strategy
- [ ] Beta user list compiled
- [ ] Launch announcement drafted
- [ ] Support channels ready
- [ ] Analytics/tracking configured

---

## Part 4: Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Dec 8, 2025 | Stay on Replit for hosting | Good fit for growth stage, easy scaling, WebSocket support |
| Dec 8, 2025 | Need new name | LinguaFlow domain unavailable |
| | | |

---

## Next Steps

1. **Finalize name** - Pick top 3 candidates, check domain availability
2. **Secure domains** - Purchase primary + common TLDs
3. **Create production deployment** - Set up Reserved VM on Replit
4. **Configure custom domain** - Point new domain to Replit
5. **Beta test** - Family validation before wider launch

---

*This is a living document. Update as decisions are made.*
