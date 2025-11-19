# API Key Management Strategy
**Last Updated:** November 19, 2025

---

## 🚨 Important Discovery: Newer Model Available!

### Current Models vs. New GA Model

| Model | Status | Release | Improvements |
|-------|--------|---------|--------------|
| **gpt-realtime** ⭐ | ✅ GA (Production) | Aug 2025 | **30% better accuracy**, 20% cost reduction, more natural speech |
| gpt-4o-mini-realtime-preview-2025-09-25 | Preview | Sept 2025 | Current (works well) |
| gpt-4o-realtime-preview-2024-12-17 | Preview/Legacy | Dec 2024 | Being phased out |

**Test Results:** ✅ All three models work with your API key!

**Recommendation:** Upgrade to `gpt-realtime` for:
- 30.5% better accuracy on audio benchmarks
- Better instruction following
- More precise tool calling
- More natural & expressive speech
- **20% cost reduction** vs preview models
- Production-ready (no longer "preview")

---

## 🔑 API Key Expiration & Rotation

### OpenAI API Key Lifecycle

**Good News:** OpenAI API keys **DO NOT expire automatically** for paid accounts!

However, they can become invalid if:
- ❌ Account becomes inactive
- ❌ Key is detected in public GitHub repos (auto-revoked by OpenAI)
- ❌ Suspicious activity detected
- ❌ Payment issues on the account

### Best Practices: Rotation Schedule

**Recommended:** Rotate every **90 days** (3 months) for security

**Why rotate?**
- Reduces blast radius if key is compromised
- Follows security compliance standards
- Prevents long-term exposure risks
- Catches issues before they become critical

---

## 🛡️ Automated Key Health Monitoring

### Strategy 1: Rotation Reminders

Add to `replit.md`:
```markdown
## API Key Rotation Schedule
- **Last Rotated:** November 19, 2025
- **Next Rotation Due:** February 19, 2026 (90 days)
- **Key Owner:** [Your name/team]
```

### Strategy 2: Automated Health Checks

Create a scheduled check (could run monthly):

```typescript
// scripts/check-api-health.ts
import { storage } from './server/storage';

async function checkAPIKeyHealth() {
  const lastCheck = new Date();
  
  // Test basic API access
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${process.env.USER_OPENAI_API_KEY}` }
  });
  
  if (response.status !== 200) {
    console.error('⚠️  API KEY ISSUE DETECTED!');
    // Send alert via email/Slack/etc
  } else {
    console.log('✅ API key healthy');
  }
}
```

### Strategy 3: In-App Monitoring Dashboard

Add an admin endpoint to check key status:

```typescript
// GET /api/admin/api-health
router.get('/admin/api-health', async (req, res) => {
  // Test Realtime API access
  const realtimeTest = await testRealtimeAccess();
  
  return res.json({
    status: realtimeTest.available ? 'healthy' : 'unhealthy',
    lastTested: new Date(),
    model: 'gpt-realtime',
    recommendation: 'Rotate key every 90 days'
  });
});
```

---

## 📋 Rotation Checklist

When rotating USER_OPENAI_API_KEY:

1. **Go to:** https://platform.openai.com/api-keys
2. **Create new key:** Click "Create new secret key"
3. **Copy key:** Save it temporarily (you can only view once!)
4. **Update Replit Secret:**
   - Tools → Secrets
   - Find `USER_OPENAI_API_KEY`
   - Replace value with new key
5. **Restart workflow:** Auto-happens or use restart button
6. **Test:** Run `tsx test-new-model.ts` to verify
7. **Revoke old key:** Return to OpenAI dashboard and delete old key
8. **Update rotation date:** Note in `replit.md` or admin dashboard

---

## 🔒 Security Best Practices

### ✅ DO:
- ✅ Store keys in Replit Secrets (encrypted)
- ✅ Use environment variables (`process.env.USER_OPENAI_API_KEY`)
- ✅ Rotate every 90 days
- ✅ Monitor usage in OpenAI dashboard
- ✅ Use separate keys for dev/staging/production (if applicable)
- ✅ Set up usage alerts in OpenAI dashboard

### ❌ DON'T:
- ❌ Hardcode keys in source code
- ❌ Commit keys to Git (even in `.env` files)
- ❌ Share keys via email/chat
- ❌ Use the same key across multiple projects
- ❌ Expose keys in client-side JavaScript
- ❌ Ignore OpenAI's security emails

---

## 🎯 Immediate Actions

### 1. Update Rotation Schedule
Add to your calendar/task manager:
- **Next rotation:** February 19, 2026
- **Reminder:** 7 days before (Feb 12, 2026)

### 2. Consider Model Upgrade
Upgrade to `gpt-realtime` for better performance and lower costs:
- Update `server/realtime-proxy.ts`
- Test with all subscription tiers
- Deploy and monitor

### 3. Monitor OpenAI Account
- Check usage: https://platform.openai.com/usage
- Set up billing alerts
- Review API key list monthly

---

## 📊 Current Status

**API Key:** `USER_OPENAI_API_KEY`
- **Created:** ~November 19, 2025 (recent)
- **Length:** 164 characters ✅
- **Status:** Active and healthy ✅
- **Next Rotation:** February 19, 2026 (90 days)

**Models Available:**
- ✅ gpt-realtime (newest, recommended)
- ✅ gpt-4o-mini-realtime-preview-2025-09-25 (current)
- ✅ gpt-4o-realtime-preview-2024-12-17 (legacy)

---

## 🔗 Useful Links

- **OpenAI API Keys:** https://platform.openai.com/api-keys
- **Usage Dashboard:** https://platform.openai.com/usage
- **Best Practices:** https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety
- **Realtime API Docs:** https://platform.openai.com/docs/guides/realtime
