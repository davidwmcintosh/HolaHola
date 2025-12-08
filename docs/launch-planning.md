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
| Plan | Cost | Characters |
|------|------|------------|
| Pro | $5/month | 100K chars (~$0.00005/char) |
| Scale | $299/month | 8M chars (~$0.000037/char) |
| Free | $0 | 10K chars |

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

#### 100 Active Students (20 sessions/month each = 2,000 sessions)
| Component | Monthly Cost |
|-----------|-------------|
| Replit Reserved VM | $40 |
| Database | $5 |
| Deepgram STT (30K min) | $129 |
| Cartesia TTS (6M chars) | $224 (Scale plan) |
| Gemini LLM (24M tokens) | ~$10 |
| **Total** | **~$408/month** |
| **Per student** | **~$4.08/month** |

#### 1,000 Active Students (20,000 sessions/month)
| Component | Monthly Cost |
|-----------|-------------|
| Replit Reserved VM | $80 |
| Database | $15 |
| Deepgram STT (300K min) | $1,290 |
| Cartesia TTS (60M chars) | ~$2,240 (enterprise pricing likely) |
| Gemini LLM (240M tokens) | ~$100 |
| **Total** | **~$3,725/month** |
| **Per student** | **~$3.73/month** |

#### 10,000 Active Students (200,000 sessions/month)
| Component | Monthly Cost |
|-----------|-------------|
| Replit Reserved VM | $160 |
| Database | $50 |
| Deepgram STT (3M min) | ~$12,900 (volume discount likely) |
| Cartesia TTS (600M chars) | ~$15,000 (enterprise) |
| Gemini LLM (2.4B tokens) | ~$1,000 |
| **Total** | **~$29,110/month** |
| **Per student** | **~$2.91/month** |

**Key insight:** Per-student cost decreases with scale due to enterprise pricing and fixed hosting costs amortized.

**Pricing strategy implication:** At $15-20/month subscription, you're profitable after ~200-300 students. Before that, you're investing in growth.

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
| Dec 8, 2025 | Commit to Cartesia TTS | Only provider with word timestamps + WebSocket + emotions + laughter. Irreplaceable for Daniela's personality. Will negotiate enterprise pricing. |
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
