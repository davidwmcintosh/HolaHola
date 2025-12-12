# Launch Planning Document

*Created: December 8, 2025*

## Current Status

We're preparing to take our AI-powered language tutoring platform from development to production. This document tracks our thinking on hosting, branding, and launch strategy.

---

## Part 1: Hosting Analysis

### Can Replit Handle Thousands of Students? 

**Yes, with the right configuration.**

---

### Deployment Options Deep-Dive

#### Option A: Reserved VM (Recommended for Voice)
| Tier | Specs | Cost | Best For |
|------|-------|------|----------|
| Shared | 0.5 vCPU / 2GB RAM | $20/month | Testing, light usage |
| Dedicated | 1 vCPU / 4GB RAM | $40/month | Early production |
| Dedicated | 2 vCPU / 8GB RAM | $80/month | Growing user base |
| Dedicated | 4 vCPU / 16GB RAM | $160/month | Heavy concurrent usage |

**Pros:**
- No cold starts - instant response for voice chat
- Predictable monthly cost
- 99.9% uptime SLA
- Supports WebSocket + long-running connections
- Single external port (good for our unified WebSocket)

**Cons:**
- Fixed capacity (can't burst beyond VM limits)
- Paying even during low-traffic periods

#### Option B: Autoscale
| Metric | Cost |
|--------|------|
| Base fee | $1/month |
| Compute | 1 CPU-sec = 18 units, 1 RAM-sec = 2 units |
| Requests | Per million |

**Real examples from Replit docs:**
- Personal blog (13.5K compute units): ~$0.04/month
- Small business website (600K units): ~$1.92/month
- API service (3.96M units): ~$12.67/month

**Pros:**
- Scales to zero when idle (cost savings)
- Horizontal scaling (multiple instances)
- 99.95% uptime SLA
- Handles traffic spikes automatically

**Cons:**
- Cold starts after 15 min idle (bad for voice UX)
- 20 concurrent connections per instance
- Not great for long-running WebSocket sessions

#### Option C: Static Deployment (for assets)
- Free hosting
- Global CDN distribution
- $0.10/GB data transfer
- Great for marketing site, docs, static assets

---

### Cost Projections by Scale

**Assumptions:**
- Average voice session: 15 minutes
- Audio streaming: ~50KB/min (TTS output)
- Average sessions per student per month: 20

#### 100 Active Students
| Component | Estimate |
|-----------|----------|
| Reserved VM (1 vCPU/4GB) | $40/month |
| Database | ~$5/month |
| Egress (100 students × 20 sessions × 15min × 50KB) | ~1.5GB - Free (under 100GB allowance) |
| **Total** | **~$45/month** |

#### 1,000 Active Students
| Component | Estimate |
|-----------|----------|
| Reserved VM (2 vCPU/8GB) | $80/month |
| Database | ~$15/month |
| Egress | ~15GB - Free |
| **Total** | **~$95/month** |

#### 10,000 Active Students
| Component | Estimate |
|-----------|----------|
| Reserved VM (4 vCPU/16GB) or Autoscale | $160/month or variable |
| Database | ~$50/month |
| Egress (~150GB) | ~$5/month over allowance |
| **Total** | **~$215/month** |

*Note: Hosting is cheap. Third-party APIs are the real cost at scale - see below.*

---

### Third-Party API Costs (The Real Cost Drivers)

**This is where the money goes at scale.**

#### Deepgram (STT - Speech-to-Text)
| Model | Cost | Notes |
|-------|------|-------|
| Nova-3 | $0.0043/min ($4.30/1K min) | Per-second billing, most accurate |
| Free trial | $200 credit (~45K min) | Credits never expire |

#### Cartesia (TTS - Text-to-Speech)
| Plan | Cost | Characters | Per-Char Rate |
|------|------|------------|---------------|
| Free | $0 | 10K chars | N/A |
| Pro | $5/month | 100K chars | $0.00005/char |
| **Growth (Current)** | **$39/month** | **1.25M chars** | **$0.0000312/char** |
| Scale | $299/month | 8M chars | $0.0000374/char |

**Our Plan:** Growth tier at $39/month - gives us 1.25M characters, enough for ~400 15-min voice sessions.

##### Why Cartesia? (Daniela's Non-Negotiables)

| Feature | Cartesia | ElevenLabs | Google TTS |
|---------|----------|------------|------------|
| **Word-level timestamps** | ✅ Native WebSocket | ✅ Character-level | ⚠️ Not in streaming |
| **WebSocket streaming** | ✅ Native, ~90ms | ✅ Yes, ~75ms | ❌ HTTP only |
| **Emotion control** | ✅ 10+ emotions | ❌ Limited | ❌ No |
| **Variable speed** | ✅ 0.6-1.5x | ✅ Yes | ✅ SSML |
| **Pronunciation dicts** | ✅ IPA support | ❌ No | ✅ SSML phonemes |
| **Natural laughter** | ✅ Yes | ❌ No | ❌ No |
| **Multi-language** | ✅ 42 languages | ✅ 32+ | ✅ 40+ |

**The killer combo:** Word timestamps + WebSocket streaming + emotion control + laughter. 

No other provider offers all of these together. ElevenLabs comes close on timestamps/streaming but lacks emotion control and natural vocalizations. Google lacks WebSocket streaming entirely.

**For Daniela to feel alive, we need:**
- Karaoke-style word highlighting (requires timestamps in stream)
- Sub-100ms response (requires WebSocket)
- Emotional range (happy, curious, encouraging, etc.)
- Natural laughter for warmth

**Verdict:** Cartesia is expensive but irreplaceable for Daniela's personality. Budget accordingly.

#### Google Gemini (LLM)
| Model | Input | Output |
|-------|-------|--------|
| Gemini 1.5 Flash | $0.075/1M tokens | $0.30/1M tokens |
| Gemini 2.5 Flash | $0.15/1M tokens | $0.60/1M tokens |
| Free tier | 15 req/min, 1.5K req/day | Good for development |

---

### Total Cost Projections (Including APIs)

**Assumptions per voice session (15 min average):**
- STT: 15 min audio transcribed
- TTS: ~3,000 characters generated (tutor responses)
- LLM: ~10K tokens input + 2K tokens output

*Note: These are estimates. See "Metrics-Based Refinement" below for how we'll tighten these with real data.*

#### Early Stage: Within Growth Plan Limits
**Cartesia Growth Plan:** $39/month for 1.25M characters (~400 sessions @ 3K chars/session)

| Students | Sessions/mo | TTS Chars | Fits in $39 Plan? | Total Fixed Costs |
|----------|-------------|-----------|-------------------|-------------------|
| 20 | 400 | 1.2M | ✅ Yes | ~$49/mo |
| 40 | 800 | 2.4M | ❌ Need 2x | ~$88/mo |

#### 100 Active Students (20 sessions/month each = 2,000 sessions)
| Component | Monthly Cost |
|-----------|-------------|
| Replit Reserved VM | $40 |
| Database | $5 |
| Deepgram STT (30K min) | $129 |
| Cartesia TTS (6M chars @ $0.0000312) | $187 |
| Gemini LLM (24M tokens) | ~$10 |
| **Total** | **~$371/month** |
| **Per student** | **~$3.71/month** |

#### 1,000 Active Students (20,000 sessions/month)
| Component | Monthly Cost |
|-----------|-------------|
| Replit Reserved VM | $80 |
| Database | $15 |
| Deepgram STT (300K min) | $1,290 |
| Cartesia TTS (60M chars @ $0.0000312) | $1,872 |
| Gemini LLM (240M tokens) | ~$100 |
| **Total** | **~$3,357/month** |
| **Per student** | **~$3.36/month** |

#### 10,000 Active Students (200,000 sessions/month)
| Component | Monthly Cost |
|-----------|-------------|
| Replit Reserved VM | $160 |
| Database | $50 |
| Deepgram STT (3M min) | ~$12,900 (volume discount likely) |
| Cartesia TTS (600M chars) | ~$12,500 (enterprise pricing) |
| Gemini LLM (2.4B tokens) | ~$1,000 |
| **Total** | **~$26,610/month** |
| **Per student** | **~$2.66/month** |

**Key insight:** Per-student cost decreases with scale due to enterprise pricing and fixed hosting costs amortized.

**Pricing strategy implication:** At $15-20/month subscription, you're profitable after ~100-150 students. Before that, you're investing in growth.

---

### Metrics-Based Refinement

**We track real usage data to refine these estimates:**

The `voiceSessions` table captures:
| Metric | Purpose |
|--------|---------|
| `durationSeconds` | Clock time - how long user was in session |
| `ttsCharacters` | Cost time - actual TTS characters billed to Cartesia |
| `sttSeconds` | STT seconds billed to Deepgram |
| `tutorSpeakingSeconds` | Daniela's speaking time |
| `studentSpeakingSeconds` | Student's speaking time |
| `exchangeCount` | Number of back-and-forth exchanges |

**Key ratios to monitor:**
1. **TTS chars per session minute** - If we assume 3K chars/15 min = 200 chars/min, is reality higher or lower?
2. **Clock time vs cost time** - Sessions have pauses, thinking time. How much of a 15-min session is actually billable audio?
3. **Speaking ratio** - If student speaks 60% of the time, that's 60% less TTS than if tutor dominates
4. **Exchange efficiency** - Shorter, punchier responses = less TTS cost

**Action items:**
- [ ] Build admin dashboard showing aggregated metrics
- [ ] Establish baseline ratios from beta testing
- [ ] Adjust cost projections with real data before finalizing pricing tiers
- [ ] Track trend over time (do users talk more as they get comfortable?)

---

### What Replit Provides

| Feature | Status | Notes |
|---------|--------|-------|
| **WebSocket Support** | ✅ | Critical for voice streaming - fully supported |
| **Custom Domains** | ✅ | Full support + subdomains + SSL auto-configured |
| **Uptime SLA** | ✅ | Autoscale: 99.95% / Reserved VM: 99.9% |
| **Real-time Logs** | ✅ | Filterable by error level |
| **Performance Analytics** | ✅ | Response times, page views, top URLs |
| **Usage Alerts** | ✅ | Budget limits and notifications |
| **Secrets Management** | ✅ | Encrypted environment variables |
| **Deployment Previews** | ✅ | Staging environment before production |

---

### Database Strategy

**Production PostgreSQL includes:**
- Point-in-time restore (disaster recovery)
- 7-day soft delete for accidentally deleted DBs
- Connection pooling for high traffic (use `-pooler` URL)
- 10GB storage limit per database
- Serverless billing (compute time + storage)

**Best practices:**
1. Use connection pooling URL for production
2. Set up regular exports/backups beyond Replit's built-in
3. Use deployment previews to test migrations safely
4. Monitor database compute time in billing

---

### Critical Limits to Know

| Limit | Value | Impact |
|-------|-------|--------|
| **Concurrent connections** | 20 per instance | Autoscale spins up more instances; Reserved VM is fixed |
| **Cold start** | After 15 min idle | Reserved VM avoids entirely |
| **Database storage** | 10 GB | Sufficient for early growth |
| **Egress bandwidth** | 100 GB/month included | $0.10/GB after; voice streaming uses bandwidth |
| **Reserved VM ports** | 1 external port | Fine - we use unified WebSocket |

---

### Recommended Architecture for Voice-First Platform

```
                    PRODUCTION SETUP                      
                                                          
   [Custom Domain: yourapp.com]                          
              |                                           
              v                                           
   +----------------------+                              
   |   Reserved VM        |  <-- No cold starts          
   |   2 vCPU / 8GB RAM   |      WebSocket + HTTP        
   |   $80/month          |      Voice streaming ready   
   +----------------------+                              
              |                                           
              v                                           
   +----------------------+                              
   |   PostgreSQL         |  <-- Connection pooling      
   |   (Neon-backed)      |      Point-in-time restore   
   |   Usage-based        |      10GB limit              
   +----------------------+                              
                                                          
   External APIs:                                         
   - Deepgram (STT)                                      
   - Cartesia (TTS)                                      
   - Gemini (LLM)                                        
   - Stripe (payments)                                   
```

**Why Reserved VM for us:**
1. Voice chat needs instant response - no cold starts
2. WebSocket connections are long-running
3. Predictable costs for budgeting
4. Single external port matches our unified WebSocket architecture

---

### Alternative Platforms Considered

| Platform | Pros | Cons |
|----------|------|------|
| **Replit** | All-in-one, WebSocket native, easy deploys, integrated DB | 20 conn/instance, bandwidth costs |
| **Railway** | Similar pricing, good for Node.js | Less integrated, separate DB |
| **Render** | Free tier, good WebSocket support | Cold starts on free tier |
| **Fly.io** | Edge deployment, low latency | More complex setup |
| **AWS/GCP** | Unlimited scale, full control | Complex, expensive at small scale |
| **Vercel** | Great frontend CDN | Serverless poor for WebSocket |

**Decision: Stay on Replit** - Strong fit for current stage and growth. The all-in-one experience (code, DB, secrets, deploys, monitoring) is valuable. Can migrate later if we hit genuine limits.

---

### Production Configuration Checklist

**Deployment Setup:**
- [ ] Choose Reserved VM tier (recommend 1-2 vCPU to start)
- [ ] Configure production secrets (API keys for Deepgram, Cartesia, Stripe, etc.)
- [ ] Set build command (`npm install && npm run build`)
- [ ] Set run command (`npm start` or equivalent)
- [ ] Configure custom domain DNS

**Database:**
- [ ] Enable connection pooling (use `-pooler` DATABASE_URL)
- [ ] Test point-in-time restore process
- [ ] Set up regular data exports/backups
- [ ] Use deployment preview for testing migrations

**Monitoring:**
- [ ] Set up usage alerts / budget limits
- [ ] Configure error notifications
- [ ] Establish baseline performance metrics
- [ ] Document runbook for common issues

**Security:**
- [ ] All secrets in Replit Secrets tool (not hardcoded)
- [ ] API keys never exposed to frontend
- [ ] Server-side auth validation in place
- [ ] Rate limiting configured

---

## Part 2: Naming & Branding

### The Challenge

**Note:** We chose "HolaHola" as our brand. Here was our original naming exploration:

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
| **SpeakFlow** | Voice + natural progression | Similar to HolaHola |

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
| Dec 8, 2025 | Need new name | HolaHola domain unavailable |
| Dec 8, 2025 | Commit to Cartesia TTS | Only provider with word timestamps + WebSocket + emotions + laughter. Irreplaceable for Daniela's personality. Will negotiate enterprise pricing. |
| Dec 8, 2025 | Upgraded to Cartesia Growth | $39/month for 1.25M chars. Enough for ~20 active students. Will use tracked metrics to refine cost model. |
| | | |

---

## Part 5: Class Costs & Tier Pricing (Draft)

*To be finalized after beta testing with real metrics data.*

### Cost Per Voice Hour

**Based on current Cartesia Growth rate ($0.0000312/char):**

| Component | Per Hour | Notes |
|-----------|----------|-------|
| Cartesia TTS | ~$0.75 | ~24K chars/hour (assuming 400 chars/min × 60) |
| Deepgram STT | ~$0.26 | ~60 min @ $0.0043/min |
| Gemini LLM | ~$0.04 | ~40K tokens @ blended rate |
| **Total API cost** | **~$1.05/hour** | Before hosting overhead |

*These estimates assume tutor speaks ~50% of the time. Reality TBD from metrics.*

### Class Allocation Model

Teachers allocate voice tutoring hours to their classes. Students draw from this pool.

| Class Size | Hours Allocated | API Cost | Suggested Class Price |
|------------|-----------------|----------|----------------------|
| 5 students | 10 hrs/month | ~$10.50 | $25-35/month |
| 10 students | 20 hrs/month | ~$21.00 | $45-65/month |
| 20 students | 40 hrs/month | ~$42.00 | $85-120/month |

**Markup rationale:** 2-3x API cost covers hosting, support, platform development.

### Self-Directed Learner Tiers (B2C)

| Tier | Voice Hours/mo | Price | API Cost | Margin |
|------|----------------|-------|----------|--------|
| **Free Trial** | 0.5 hrs (30 min) | $0 | ~$0.53 | Acquisition |
| **Starter** | 2 hrs | $9.99 | ~$2.10 | 79% |
| **Standard** | 5 hrs | $19.99 | ~$5.25 | 74% |
| **Premium** | 15 hrs | $39.99 | ~$15.75 | 61% |
| **Unlimited** | Unlimited | $79.99 | Variable | Risk-based |

**Notes:**
- Heavy users on Premium may exceed margin - acceptable for engagement
- Unlimited tier needs usage cap or fair-use policy
- Consider annual discounts (20% off = 2 months free)

### Institutional Tiers (B2B)

| Tier | Teachers | Students | Voice Hours | Price/mo |
|------|----------|----------|-------------|----------|
| **School Starter** | 3 | 50 | 100 | $199 |
| **School Pro** | 10 | 200 | 500 | $599 |
| **District** | Unlimited | Unlimited | 2000 | $1,999 |

### Refinement Strategy

**Before finalizing pricing:**

1. **Baseline metrics** - Run beta sessions, measure actual TTS chars/session
2. **Clock vs Cost ratio** - What % of session time is billable audio?
3. **Speaking patterns** - Do students speak more over time? (reduces TTS cost)
4. **Session length** - Are 15-min averages accurate?

**After 100 sessions of data:**
- [ ] Calculate actual cost per voice hour
- [ ] Adjust tier allocations based on reality
- [ ] Set final prices with real margin data

---

## Next Steps

1. **Finalize name** - Pick top 3 candidates, check domain availability
2. **Secure domains** - Purchase primary + common TLDs
3. **Create production deployment** - Set up Reserved VM on Replit
4. **Configure custom domain** - Point new domain to Replit
5. **Beta test** - Family validation before wider launch
6. **Gather metrics** - Run 100+ sessions to establish baseline cost ratios
7. **Finalize pricing** - Set tier prices based on real data

---

*This is a living document. Update as decisions are made.*
