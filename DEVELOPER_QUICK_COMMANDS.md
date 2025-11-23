# Developer Quick Commands

Quick reference for developer testing commands. Copy and paste these into the database tool as needed.

---

## Model Switching

### Switch to Gemini 2.5 Pro (Pro Quality - Best)
```sql
UPDATE users SET developer_model = 'gemini-2.5-pro' WHERE id = '49847136';
```

### Switch to Gemini 2.5 Flash (Free/Basic - Faster)
```sql
UPDATE users SET developer_model = 'gemini-2.5-flash' WHERE id = '49847136';
```

### Reset to Default (Tier-Based)
```sql
UPDATE users SET developer_model = NULL WHERE id = '49847136';
```

---

## Check Current Settings

### View All Settings
```sql
SELECT id, email, first_name, role, subscription_tier, developer_model, monthly_message_count, monthly_message_limit 
FROM users 
WHERE id = '49847136';
```

### Quick Status Check
```sql
SELECT role, subscription_tier, developer_model FROM users WHERE id = '49847136';
```

---

## Voice Usage Management

### Reset Voice Message Counter
```sql
UPDATE users SET monthly_message_count = 0 WHERE id = '49847136';
```

### Check Voice Usage
```sql
SELECT monthly_message_count, monthly_message_limit FROM users WHERE id = '49847136';
```

---

## Tier Testing

### Simulate Free Tier
```sql
UPDATE users SET subscription_tier = 'free', developer_model = 'gemini-2.5-flash' WHERE id = '49847136';
```

### Simulate Basic Tier
```sql
UPDATE users SET subscription_tier = 'basic', developer_model = 'gemini-2.5-flash' WHERE id = '49847136';
```

### Simulate Pro Tier
```sql
UPDATE users SET subscription_tier = 'pro', developer_model = 'gemini-2.5-pro' WHERE id = '49847136';
```

### Reset to Developer Mode
```sql
UPDATE users SET subscription_tier = 'free', role = 'developer', developer_model = 'gemini-2.5-pro' WHERE id = '49847136';
```

---

## Model Comparison Testing

### Expected Log Output

**When using Gemini 2.5 Pro:**
```
[DEVELOPER MODE] Using override model: gemini-2.5-pro (role: developer)
[CHAT] Using model gemini-2.5-pro for tier: free, voiceMode: true
```

**When using Gemini 2.5 Flash:**
```
[DEVELOPER MODE] Using override model: gemini-2.5-flash (role: developer)
[CHAT] Using model gemini-2.5-flash for tier: free, voiceMode: true
```

### Quality Differences to Test:
- **Gemini 2.5 Pro**: Better at nuanced explanations, cultural context, complex grammar, 2M token context window
- **Gemini 2.5 Flash**: Faster responses, 33% lower cost, 1M token context window, still very capable

---

## Developer Privileges

As a developer, you have:
- ✅ Unlimited voice messages (no monthly limit)
- ✅ Voice usage counter doesn't increment
- ✅ Can override AI model selection
- ✅ Can test all subscription tiers

---

## Notes

- Your user ID: `49847136`
- Changes take effect immediately (no restart needed)
- Developer mode bypasses all tier restrictions
- Log output confirms active model and settings
