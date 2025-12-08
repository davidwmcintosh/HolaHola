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

**Daniela is our differentiator.** No major player has a named AI tutor as the brand. This is interesting territory - personal, human, memorable.

### Refined Naming Directions

**Direction A: Daniela-Forward** ⭐ *Unique in market*
The tutor IS the brand. Personal, memorable, human.
| Name | Pros | Cons |
|------|------|------|
| **HolaDaniela** | Spanish greeting + name, 5 syllables, warm | Might seem Spanish-only |
| **TalkToDaniela** | Clear action, friendly | Long (5 syllables) |
| **Daniela.ai** | Clean, modern | Might be taken |
| **AskDaniela** | Active verb, curious | 4 syllables |
| **ConDaniela** | "With Daniela" in Spanish, short | Might not resonate globally |

**Direction B: Voice/Conversation Focus**
Emphasizes the conversational, voice-first approach.
| Name | Pros | Cons |
|------|------|------|
| **Parla** | Italian for "speak", 2 syllables, elegant | Might need explanation |
| **Habla** | Spanish for "speak", 2 syllables | Might seem Spanish-only |
| **VoxTutor** | "Voice tutor", clear | Sounds technical |
| **SpeakPath** | Journey + speaking | Might be generic |

**Direction C: Made-Up/Brandable**
Unique, ownable, no existing meaning.
| Name | Pros | Cons |
|------|------|------|
| **Lingora** | "Lingua" + euphonic ending, 3 syllables | No meaning |
| **Fluencia** | Spanish feel, "fluency" + elegance | 4 syllables |
| **Voxly** | "Vox" (voice) + tech suffix | Might feel corporate |
| **Parlai** | "Parla" + AI, clever | Pronunciation unclear |

**Direction D: Emotional/Aspirational**
Captures the feeling of breakthrough.
| Name | Pros | Cons |
|------|------|------|
| **FreeToSpeak** | Emotional, captures fear→confidence | 3 words |
| **SpeakFree** | Shorter, same emotion | Domain likely taken |
| **VoiceUnlocked** | Journey metaphor | 4 syllables |

### My Recommendation

**Top 3 to check domain availability:**

1. **AskDaniela** (.com, .ai) - Personal, action-oriented, unique in market. "Just ask Daniela" marketing writes itself.

2. **Parla** (.com, .ai, .io) - Elegant, international (Italian "speak"), 2 syllables, sophisticated feel. Works because we teach 9 languages, not just Spanish.

3. **Fluencia** (.com, .ai) - Romance language feel, evokes "fluency", 4 syllables but flows well. Could work with tagline "Where fluency flows."

**Honorable mentions:** HolaDaniela (if Spanish-forward is okay), Lingora (completely ownable)

### Why Daniela-Forward Could Win

- **Trust**: People trust people, not apps
- **Word of mouth**: "Have you tried talking to Daniela?" 
- **Differentiation**: Nobody else has this
- **Story**: "Meet Daniela, your AI tutor who actually remembers you"
- **Future-proof**: As AI tutors become common, having a named personality stands out

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
