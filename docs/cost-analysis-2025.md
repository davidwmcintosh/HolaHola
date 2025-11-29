# LinguaFlow Cost Analysis & Subscription Tiers (November 2025)

## Executive Summary

This document provides an updated cost analysis following the migration from OpenAI to Deepgram/Gemini/Cartesia, reflecting current 2025 pricing and proposing sustainable subscription tiers.

---

## 1. Current Technology Stack

### Voice Pipeline (Streaming)
```
Student speaks → Deepgram Nova-3 (STT) → Gemini 2.5 Flash (LLM) → Cartesia Sonic-3 (TTS) → Student hears
                     ↓                        ↓                         ↓
                 Real-time              Streaming JSON            WebSocket Audio
                 $0.46/hr               $0.30/$2.50 per 1M       ~$0.03/min
```

### Text Chat Pipeline
```
Student types → Gemini 2.5 Flash (LLM) → Response
                     ↓
              $0.30/$2.50 per 1M tokens
```

---

## 2. Service Pricing (November 2025)

### 2.1 Speech-to-Text (STT): Deepgram Nova-3

| Mode | Per Minute | Per Hour | Per 1000 Minutes |
|------|------------|----------|------------------|
| **Real-time (Streaming)** | $0.0077 | $0.462 | $7.70 |
| Batch (Pre-recorded) | $0.0043 | $0.258 | $4.30 |

**Notes:**
- Per-second billing (no wasted time)
- 54.3% better accuracy for non-native speakers than competitors
- Real-time mode required for streaming voice chat

### 2.2 Large Language Model (LLM): Gemini

| Model | Input (per 1M) | Output (per 1M) | Context | Best For |
|-------|----------------|-----------------|---------|----------|
| **Gemini 2.5 Flash** | $0.30 | $2.50 | 1M | Current production |
| **Gemini 2.5 Flash-Lite** | $0.10 | $0.40 | 1M | Cost optimization (TBD) |
| Gemini 2.5 Pro | $1.25 | $10.00 | 2M | Complex reasoning |

**Price History (Gemini 2.5 Flash):**
- Preview (Early 2025): $0.15 input / $0.60 output
- GA (June 2025): $0.30 input / $2.50 output
- Change: +100% input, +317% output

### 2.3 Text-to-Speech (TTS): Cartesia Sonic-3

| Plan | Monthly Cost | Characters | Per Character | ~Minutes of Speech |
|------|--------------|------------|---------------|-------------------|
| Free | $0 | 20,000 | - | ~11 min |
| Pro | $5 | 100,000 | $0.00005 | ~55 min |
| Startup | $49 | 1,250,000 | $0.000039 | ~694 min |
| Scale | $299 | 8,000,000 | $0.000037 | ~4,444 min |

**Notes:**
- 1 credit = 1 character
- ~1,800 characters per minute of speech
- Ultra-low latency: 40-90ms time-to-first-audio
- Emotion control, speed adjustment included

### 2.4 TTS Fallback: Google Cloud Chirp 3 HD

| Tier | Per 1M Characters |
|------|-------------------|
| Standard | $16.00 |

**Used when:** Cartesia unavailable or for specific voice requirements

---

## 3. Per-Conversation Cost Analysis

### 3.1 Assumptions (Average Voice Conversation)

| Metric | Value | Notes |
|--------|-------|-------|
| Student speaking time | 2 minutes | Multiple utterances |
| Tutor speaking time | 3 minutes | Longer explanations |
| LLM input tokens | ~2,000 | System prompt + history + user input |
| LLM output tokens | ~500 | Tutor response |
| TTS characters | ~5,400 | 3 min × 1,800 chars/min |

### 3.2 Cost Per Voice Exchange (Round-Trip)

| Service | Calculation | Cost |
|---------|-------------|------|
| **STT (Deepgram)** | 2 min × $0.0077/min | $0.0154 |
| **LLM (Gemini Flash)** | (2K × $0.30 + 500 × $2.50) / 1M | $0.00185 |
| **TTS (Cartesia)** | 5,400 chars × $0.00005 | $0.27 |
| **Total per exchange** | | **$0.287** |

### 3.3 Cost Per Text Exchange

| Service | Calculation | Cost |
|---------|-------------|------|
| **LLM (Gemini Flash)** | (2K × $0.30 + 500 × $2.50) / 1M | $0.00185 |
| **Total per exchange** | | **$0.002** |

### 3.4 Key Insight: TTS Dominates Voice Costs

| Component | % of Voice Cost |
|-----------|-----------------|
| TTS (Cartesia) | **94%** |
| STT (Deepgram) | 5% |
| LLM (Gemini) | <1% |

**Recommendation:** Optimize TTS usage or move to higher Cartesia tier for volume discounts.

---

## 4. Monthly Cost Projections by User Type

### 4.1 Casual Learner (Free Tier Target)
- 10 voice conversations/month
- 20 text conversations/month
- ~20 min voice, ~20 text exchanges

| Service | Cost |
|---------|------|
| Voice (10 × $0.287) | $2.87 |
| Text (20 × $0.002) | $0.04 |
| **Total** | **$2.91/user/month** |

### 4.2 Active Learner (Paid Tier Target)
- 50 voice conversations/month
- 50 text conversations/month
- ~100 min voice, ~50 text exchanges

| Service | Cost |
|---------|------|
| Voice (50 × $0.287) | $14.35 |
| Text (50 × $0.002) | $0.10 |
| **Total** | **$14.45/user/month** |

### 4.3 Power User (Pro Tier Target)
- 150 voice conversations/month
- 100 text conversations/month
- ~300 min voice, ~100 text exchanges

| Service | Cost |
|---------|------|
| Voice (150 × $0.287) | $43.05 |
| Text (100 × $0.002) | $0.20 |
| **Total** | **$43.25/user/month** |

### 4.4 Institutional Student
- 100 voice conversations/month (in-class + homework)
- 50 text conversations/month
- ~200 min voice, ~50 text exchanges

| Service | Cost |
|---------|------|
| Voice (100 × $0.287) | $28.70 |
| Text (50 × $0.002) | $0.10 |
| **Total** | **$28.80/student/month** |

---

## 5. Proposed Subscription Tiers

### 5.1 Individual Tiers

| Tier | Price | Voice/Month | Text | Cost to Serve | Margin |
|------|-------|-------------|------|---------------|--------|
| **Free** | $0 | 10 | Unlimited | $2.91 | -$2.91 (acquisition) |
| **Basic** | $9.99 | 50 | Unlimited | $14.45 | -$4.46 (loss leader) |
| **Pro** | $24.99 | 200 | Unlimited | $57.40 | -$32.41 (needs adjustment) |

### 5.2 Problem: Negative Margins

At current pricing, **voice is too expensive** for flat-rate unlimited plans:
- 200 voice conversations = ~$57 in API costs
- Cannot offer unlimited voice at $24.99

### 5.3 Recommended Tier Structure (Sustainable)

| Tier | Price | Voice Credits | Text | Est. Cost | Margin |
|------|-------|---------------|------|-----------|--------|
| **Free** | $0 | 10/month | Unlimited | $2.91 | -$2.91 |
| **Starter** | $9.99 | 30/month | Unlimited | $8.61 | +$1.38 (14%) |
| **Plus** | $19.99 | 75/month | Unlimited | $21.53 | -$1.54 |
| **Pro** | $39.99 | 200/month | Unlimited | $57.40 | -$17.41 |
| **Unlimited** | $79.99 | Unlimited* | Unlimited | ~$80 avg | ~$0 |

*Unlimited assumes fair-use cap of ~300 conversations/month

### 5.4 Alternative: Usage-Based Pricing

| Tier | Base Price | Included Voice | Additional Voice |
|------|------------|----------------|------------------|
| **Free** | $0 | 10 | Not available |
| **Pay-as-you-go** | $4.99 | 10 | $0.35/conversation |
| **Pro** | $19.99 | 50 | $0.30/conversation |
| **Unlimited** | $79.99 | Unlimited* | - |

---

## 6. Institutional Pricing

### 6.1 Per-Seat Model

| Tier | Price | Per Student/Month | Notes |
|------|-------|-------------------|-------|
| **Classroom** | $7/seat/month | 100 voice, unlimited text | Billed annually |
| **Department** | $5/seat/month | 100 voice, unlimited text | 100+ seats |
| **Enterprise** | Custom | Custom | 500+ seats |

### 6.2 Cost Analysis (Classroom Tier)

- Revenue: $7/student/month
- Cost: $28.80/student/month
- **Margin: -$21.80/student/month**

### 6.3 Problem: Institutional Pricing Unsustainable

At $7/seat/month with 100 voice conversations:
- API cost: ~$28.80
- Loss: $21.80 per student per month

**Recommendations:**
1. Reduce voice allocation to 30/month ($8.61 cost → profitable at $7/seat with volume)
2. Raise institutional price to $15/seat/month
3. Offer tiered institutional plans based on voice usage

---

## 7. Cost Optimization Strategies

### 7.1 Short-term (Immediate)

| Strategy | Savings | Effort |
|----------|---------|--------|
| Upgrade to Cartesia Startup ($49/mo) | 22% on TTS | Low |
| Implement conversation caching | 10-20% on LLM | Medium |
| Smart TTS length limits | 15% on TTS | Low |

### 7.2 Medium-term (1-3 months)

| Strategy | Savings | Effort |
|----------|---------|--------|
| Evaluate Gemini 2.5 Flash-Lite | 60-85% on LLM | Medium |
| Implement response streaming (shorter TTS) | 20% on TTS | Medium |
| Batch mode for non-real-time features | 44% on STT | Medium |

### 7.3 Long-term (3-6 months)

| Strategy | Savings | Effort |
|----------|---------|--------|
| Negotiate volume pricing | 20-40% overall | High |
| Self-hosted TTS evaluation | 50%+ on TTS | High |
| Hybrid cloud architecture | 30% overall | High |

---

## 8. Comparison to Previous Stack

### 8.1 Old Stack (Pre-Migration)
- STT: OpenAI Whisper ($0.36/hr) - User-provided API key
- LLM: GPT-4o-mini ($0.15/$0.60 per 1M)
- TTS: Google Cloud Chirp 3 HD (~$16/1M chars)

### 8.2 Current Stack
- STT: Deepgram Nova-3 ($0.46/hr) - Platform-provided
- LLM: Gemini 2.5 Flash ($0.30/$2.50 per 1M)
- TTS: Cartesia Sonic-3 (~$0.05/1K chars)

### 8.3 Cost Change Summary

| Component | Old Cost | New Cost | Change |
|-----------|----------|----------|--------|
| STT (per hour) | $0.36 (user pays) | $0.46 (platform pays) | +28% (but no user friction!) |
| LLM (per 1M output) | $0.60 | $2.50 | +317% |
| TTS (per 1K chars) | ~$0.016 | ~$0.05 | +213% |

### 8.4 Key Tradeoffs

**What We Gained:**
- No API key friction (users don't need OpenAI accounts)
- Better STT accuracy for language learners (54.3% improvement)
- Ultra-low latency TTS (40-90ms vs 200ms+)
- Emotion control and expressive voices
- 2M context window capability

**What Changed:**
- Platform now bears all API costs
- Per-conversation cost increased ~2-3x
- Need to optimize pricing tiers

---

## 9. Action Items

### Immediate
- [ ] Align code with documented tier limits
- [ ] Upgrade Cartesia to Startup plan ($49/mo)
- [ ] Implement voice usage tracking dashboard

### This Sprint
- [ ] Evaluate Gemini 2.5 Flash-Lite for routine conversations
- [ ] Revise subscription pricing to ensure positive margins
- [ ] Add overage billing for exceeded limits

### Next Sprint
- [ ] Implement hybrid LLM routing (Lite for simple, Flash for complex)
- [ ] Build usage analytics dashboard
- [ ] Create institutional pricing calculator

---

## 10. Appendix: Pricing Sources

- Deepgram: https://deepgram.com/pricing (November 2025)
- Google Gemini: https://ai.google.dev/gemini-api/docs/pricing (November 2025)
- Cartesia: https://cartesia.ai/pricing (November 2025)
- Google Cloud TTS: https://cloud.google.com/text-to-speech/pricing (November 2025)

---

*Last Updated: November 29, 2025*
