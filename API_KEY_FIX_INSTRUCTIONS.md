# URGENT: Fix Voice Chat API Key Issue

## Problem
Your OpenAI API key is still a **project-scoped key** (`sk-proj-*`) which doesn't support the Realtime API.

## Solution (2 simple steps)

### Step 1: Update the Secret in Replit
1. Look at the left sidebar in Replit
2. Click on the **"Secrets"** tab (🔒 lock icon)
3. Find `USER_OPENAI_API_KEY` in the list
4. Click the **"Edit"** button next to it
5. **Replace** the current value with your **new regular OpenAI API key** (starts with `sk-`, NOT `sk-proj-`)
6. Click **"Save"**

### Step 2: Restart the Server
After saving the new secret:
1. The server will automatically restart
2. Wait 10 seconds
3. Refresh your browser page
4. Try voice chat again

## How to Get a Regular API Key (if needed)
1. Go to https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Make sure it's a **User API key** (NOT a project key)
4. Copy the key (it should start with `sk-`, NOT `sk-proj-`)
5. Use this key in Step 1 above

## What's Wrong Currently
- Current key: `sk-proj-...` ❌ (Project key - doesn't work with Realtime API)
- Needed key: `sk-...` ✅ (Regular user key - works with Realtime API)

---

Once you update the secret and the server restarts, voice chat will work immediately!
