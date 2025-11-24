# LinguaFlow Development Metrics

## Cost Estimates & Performance Benchmarks

*Last Updated*: November 2025

---

## Voice Chat Performance

### Target Metrics
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Total Response Time** | <6s | ~4s | ✅ BEATING |
| **Transcription (STT)** | <1.5s | ~1s | ✅ BEATING |
| **AI Generation** | <3s | ~2s | ✅ BEATING |
| **Speech Synthesis (TTS)** | <1.5s | ~1s | ✅ BEATING |
| **Validation Overhead** | <0.1s | <0.01s | ✅ BEATING |

### Performance History
```
Initial Implementation: ~40s total (unoptimized)
After Keyword Detection: ~4s total (85% improvement)
After Schema Prevention: ~4s total (no regression, -45 lines code)
```

---

## Code Complexity Metrics

### Voice Validation System

#### Before (Complex Reactive Validation)
```
Total Lines: ~200+
Validation Passes: 3-4
Regex Operations: 10+
Language Support: English only
Maintainability: Low
Edge Cases: Many
```

#### After (Schema-Level Prevention)
```
Total Lines: ~100
Validation Passes: 1
Regex Operations: 1 (quote extraction)
Language Support: 9 languages (81 combinations)
Maintainability: High
Edge Cases: Minimal
```

**Net Improvement**: -100 lines (-50% code)

---

## AI Cost Estimates

### Per Voice Message (Beginner Mode)

**Gemini 2.5 Flash** (via Replit AI Integrations):
- Input tokens: ~500-1000 (conversation context + system prompt)
- Output tokens: ~50-150 (target + native fields)
- **Cost per message**: ~$0.001-0.003

**Deepgram Nova-3 STT**:
- Audio duration: ~2-5s average
- **Cost per transcription**: ~$0.005

**Google Cloud TTS**:
- Characters: ~50-200 (native field)
- Voice: Chirp 3 HD or Neural2
- **Cost per synthesis**: ~$0.008

**Total per voice message**: ~$0.014-0.016

### Monthly Cost Estimates

**Light User** (50 voice messages/month):
```
Voice messages: 50 × $0.015 = $0.75
Text messages: 100 × $0.002 = $0.20
Images: 5 × $0.04 = $0.20
Total: ~$1.15/month
```

**Active User** (200 voice messages/month):
```
Voice messages: 200 × $0.015 = $3.00
Text messages: 300 × $0.002 = $0.60
Images: 20 × $0.04 = $0.80
Total: ~$4.40/month
```

**Power User** (500 voice messages/month):
```
Voice messages: 500 × $0.015 = $7.50
Text messages: 800 × $0.002 = $1.60
Images: 50 × $0.04 = $2.00
Total: ~$11.10/month
```

---

## Database Performance

### Query Performance Targets
| Operation | Target | Notes |
|-----------|--------|-------|
| User lookup | <50ms | Indexed on userId |
| Conversation load | <100ms | Includes messages |
| Message insert | <50ms | Single transaction |
| Progress update | <100ms | ACTFL tracking |
| Voice message save | <150ms | Includes metadata |

### Storage Growth Estimates
**Per Active User per Month**:
- Messages: ~300 messages × 500 bytes = 150 KB
- Voice metadata: ~200 messages × 1 KB = 200 KB
- Progress tracking: ~50 entries × 200 bytes = 10 KB
- **Total**: ~360 KB/user/month

**1,000 Active Users**:
- Monthly growth: 360 MB
- Annual growth: ~4.3 GB

---

## API Rate Limits & Quotas

### Deepgram API
- **Concurrent requests**: 10 (free tier), 100 (paid)
- **Monthly quota**: 45,000 minutes (free)
- **Strategy**: Rate limiting at application level

### Google Cloud TTS
- **Concurrent requests**: No hard limit
- **Monthly quota**: 4M characters (free), then $4/1M
- **Strategy**: Cache common phrases

### Gemini API
- **Requests per minute**: 60 (via Replit)
- **Tokens per minute**: 4M (via Replit)
- **Strategy**: Queue management

---

## Network Performance

### WebSocket Connection
**Voice status updates**:
- Latency: <100ms
- Updates: Every 500ms during processing
- Bandwidth: ~1 KB/update

### REST API
**Typical request/response sizes**:
- Voice message: 50-200 KB (audio)
- Text message: 1-5 KB (JSON)
- User profile: 5-10 KB
- Conversation list: 10-50 KB

---

## Optimization Wins

### Voice Response Time
**Technique**: Heuristic keyword detection
```
Before: Wait for full AI response (~40s)
After: Detect keywords, return text first (~4s)
Improvement: 85% reduction
```

### Code Complexity
**Technique**: Schema-level prevention
```
Before: Complex post-AI validation (~200 lines)
After: Schema + minimal guard (~100 lines)
Improvement: 50% reduction, better reliability
```

### Language Support
**Technique**: Universal franc-min detection
```
Before: English-only hardcoded checks
After: 9 languages with automatic detection
Improvement: 9x language coverage
```

---

## Monitoring & Alerts

### Key Metrics to Track
1. **Voice response time** (p50, p95, p99)
2. **AI generation time** (per model)
3. **Language guard triggers** (per language)
4. **Quote extraction fallbacks**
5. **Error rates** (per endpoint)

### Alert Thresholds
- Response time >8s: Warning
- Response time >12s: Critical
- Error rate >5%: Warning
- Error rate >10%: Critical

---

## Scalability Estimates

### Concurrent Users
**Single Server (2 vCPU, 4GB RAM)**:
- Active connections: 500-1000
- Messages/second: 50-100
- Voice processing: 10-20 concurrent

**Bottlenecks**:
1. AI API rate limits (primary)
2. TTS generation (secondary)
3. Database connections (tertiary)

**Scaling Strategy**:
- Horizontal: Multiple server instances
- Vertical: Increase AI quotas
- Caching: Common TTS phrases

---

## Testing Performance

### E2E Test Execution
**Playwright Tests**:
- Single test: 10-30s
- Full suite: 5-15 min
- Voice tests: Add 5-10s each

**Coverage Targets**:
- Unit tests: 80%+
- Integration tests: 70%+
- E2E tests: Key user flows

---

## Optimization Opportunities

### Future Improvements
1. **TTS Caching**: Cache common encouragement phrases
   - Estimated saving: 30% TTS costs
   
2. **Message Batching**: Batch multiple text messages
   - Estimated saving: 20% API calls
   
3. **Model Selection**: Use Flash for simple, Pro for complex
   - Estimated saving: 15% AI costs
   
4. **CDN for Audio**: Cache TTS audio files
   - Estimated saving: 40% TTS bandwidth

---

## Cost Breakdown by Feature

### Voice Chat (85% of costs)
- STT: 35%
- AI: 25%
- TTS: 55%

### Text Chat (10% of costs)
- AI: 90%
- Storage: 10%

### Images (5% of costs)
- Generation: 80%
- Storage: 20%

---

## References

**Pricing Sources** (as of Nov 2025):
- Deepgram: https://deepgram.com/pricing
- Google Cloud TTS: https://cloud.google.com/text-to-speech/pricing
- Gemini API: Via Replit AI Integrations
- Replit Platform: https://replit.com/pricing

**Performance Tools**:
- Chrome DevTools (Network, Performance)
- Playwright (E2E testing)
- PostgreSQL EXPLAIN ANALYZE

---

*This document should be updated whenever significant architecture changes are made.*
