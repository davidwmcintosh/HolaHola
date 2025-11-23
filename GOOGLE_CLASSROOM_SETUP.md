# Google Classroom Integration Setup Guide

This guide walks you through setting up Google Classroom integration for LinguaFlow. Complete these steps to enable automatic roster sync, assignment sync, and grade passback.

---

## Overview

**What you'll enable:**
- ✅ **Single Sign-On (SSO)**: Teachers and students log in with Google accounts
- ✅ **Auto-Roster Sync**: Student lists automatically import from Google Classroom
- ✅ **Assignment Sync**: Assignments created in Classroom appear in LinguaFlow
- ✅ **Grade Passback**: LinguaFlow scores sync back to Classroom gradebook

**Time Required:** 30-45 minutes (plus 2-4 weeks for Google verification if going public)

---

## Prerequisites

- Google account with access to [Google Cloud Console](https://console.cloud.google.com)
- Admin access to your Google Workspace (for internal apps) OR willingness to go through public OAuth verification

---

## Step 1: Create Google Cloud Project

1. **Navigate to Google Cloud Console**
   - Go to https://console.cloud.google.com
   - Sign in with your Google account

2. **Create New Project**
   - Click the project dropdown (top left, next to "Google Cloud")
   - Click "NEW PROJECT"
   - **Project Name:** `LinguaFlow-Classroom-Integration`
   - **Organization:** Leave as "No organization" (unless you have Google Workspace)
   - Click **CREATE**

3. **Wait for project creation** (takes ~30 seconds)

---

## Step 2: Enable Google Classroom API

1. **Open API Library**
   - In the left sidebar, navigate to: **APIs & Services** → **Library**
   - Or use direct link: https://console.cloud.google.com/apis/library

2. **Search for Classroom API**
   - In the search bar, type: `Google Classroom API`
   - Click on **Google Classroom API** from results

3. **Enable the API**
   - Click the blue **ENABLE** button
   - Wait for confirmation (takes ~10 seconds)

---

## Step 3: Configure OAuth Consent Screen

1. **Navigate to OAuth Consent Screen**
   - Left sidebar: **APIs & Services** → **OAuth consent screen**
   - Or use: https://console.cloud.google.com/apis/credentials/consent

2. **Choose User Type**
   - **Internal** (recommended if you have Google Workspace): Only users in your organization can use it
   - **External**: Anyone with a Google account can use it (requires verification)
   - Click **CREATE**

3. **App Information**
   - **App name:** `LinguaFlow`
   - **User support email:** Your email address
   - **App logo:** (Optional) Upload LinguaFlow logo
   - **Application home page:** `https://linguaflow.replit.app` (or your custom domain)
   - **Application privacy policy link:** Add your privacy policy URL
   - **Application terms of service link:** Add your terms of service URL
   - **Authorized domains:** Add `replit.app` (or your custom domain)
   - Click **SAVE AND CONTINUE**

4. **Add Scopes**
   - Click **ADD OR REMOVE SCOPES**
   - Search and select the following scopes:

   ```
   https://www.googleapis.com/auth/classroom.courses
   https://www.googleapis.com/auth/classroom.rosters
   https://www.googleapis.com/auth/classroom.coursework.students
   https://www.googleapis.com/auth/classroom.profile.emails
   ```

   - Click **UPDATE**
   - Click **SAVE AND CONTINUE**

5. **Test Users** (for External apps only)
   - Add your email address and any test teacher emails
   - Click **SAVE AND CONTINUE**

6. **Summary**
   - Review your settings
   - Click **BACK TO DASHBOARD**

---

## Step 4: Create OAuth 2.0 Credentials

1. **Navigate to Credentials**
   - Left sidebar: **APIs & Services** → **Credentials**
   - Or use: https://console.cloud.google.com/apis/credentials

2. **Create OAuth Client ID**
   - Click **+ CREATE CREDENTIALS** (top of page)
   - Select **OAuth client ID**

3. **Configure OAuth Client**
   - **Application type:** Web application
   - **Name:** `LinguaFlow Web Client`
   
   - **Authorized JavaScript origins:**
     ```
     https://YOUR_REPL_URL.replit.dev
     https://linguaflow.replit.app
     ```
     (Add both your development and production URLs)
   
   - **Authorized redirect URIs:**
     ```
     https://YOUR_REPL_URL.replit.dev/api/auth/google/callback
     https://linguaflow.replit.app/api/auth/google/callback
     ```
   
   - Click **CREATE**

4. **Download Credentials**
   - A popup will show your **Client ID** and **Client Secret**
   - **IMPORTANT:** Copy both values now! You'll need them in Step 5

   Example format:
   ```
   Client ID: 123456789-abcdefg.apps.googleusercontent.com
   Client Secret: GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
   ```

---

## Step 5: Add Credentials to Replit

1. **Open Replit Secrets**
   - In your Replit workspace, click the lock icon (🔒) in the left sidebar
   - Or go to the "Secrets" tab

2. **Add Google OAuth Credentials**
   - Click **New secret**
   
   **Secret 1:**
   - **Key:** `GOOGLE_CLASSROOM_CLIENT_ID`
   - **Value:** Paste your Client ID from Step 4
   
   **Secret 2:**
   - **Key:** `GOOGLE_CLASSROOM_CLIENT_SECRET`
   - **Value:** Paste your Client Secret from Step 4

3. **Save Secrets**
   - Click **Add secret** for each one
   - **Do NOT commit these to Git** - Replit Secrets are automatically secure

---

## Step 6: Test the Integration

Once credentials are added, the LinguaFlow agent will automatically:
1. Set up OAuth routes (`/api/auth/google`, `/api/auth/google/callback`)
2. Implement roster sync endpoints
3. Add assignment sync logic
4. Enable grade passback

**To test:**
1. Restart your Replit app (workflow will auto-restart)
2. Navigate to `/teacher/dashboard`
3. Click "Connect Google Classroom" button
4. Authorize with your Google account
5. Your Classroom classes should appear in LinguaFlow!

---

## Step 7: (Optional) Submit for Verification

**Skip this if:**
- You're using an Internal app (Google Workspace organization only)
- You're okay with the "unverified app" warning for your test users

**Required if:**
- You want to go public and remove the "unverified app" warning
- You need more than 100 users

**Verification Process:**
1. Navigate to: **APIs & Services** → **OAuth consent screen**
2. Click **PUBLISH APP**
3. Click **PREPARE FOR VERIFICATION**
4. Fill out verification questionnaire (why you need each scope, privacy policy, etc.)
5. Submit for review

**Timeline:** 2-4 weeks for Google to review and approve

**Requirements:**
- Privacy policy published
- Terms of service published
- Detailed justification for each scope
- YouTube demo video showing how scopes are used (required for sensitive scopes)

---

## Troubleshooting

### "Error 400: redirect_uri_mismatch"
**Solution:** Double-check your authorized redirect URIs in Step 4 match exactly:
```
https://YOUR_REPL_URL.replit.dev/api/auth/google/callback
```

### "This app isn't verified"
**Solution:** This is normal during development. Click "Advanced" → "Go to LinguaFlow (unsafe)" to proceed. For production, complete Step 7 (verification).

### "Access blocked: This app's request is invalid"
**Solution:** Ensure all required scopes are added in Step 3. Check that:
- `classroom.courses` is included
- `classroom.rosters` is included
- `classroom.coursework.students` is included

### "Invalid client ID or secret"
**Solution:** 
- Verify you copied the full Client ID (ends in `.apps.googleusercontent.com`)
- Verify Client Secret has no extra spaces
- Re-create credentials if needed (Step 4)

---

## Security Best Practices

1. **Never commit credentials to Git**
   - Always use Replit Secrets for sensitive values
   - Add `credentials.json` to `.gitignore` if you download it

2. **Rotate credentials if compromised**
   - Go to Google Cloud Console → Credentials
   - Delete old OAuth client
   - Create new one and update Replit Secrets

3. **Use HTTPS only**
   - Replit provides HTTPS by default
   - Never use `http://` redirect URIs

4. **Request minimum scopes**
   - Only request scopes you actually use
   - Reduces attack surface if credentials leak

---

## Cost

**Google Classroom API:** FREE (no quota limits)
- No charges for roster sync, assignment sync, or grade passback
- Part of Google Workspace for Education (free for schools)

**Google Cloud Project:** FREE tier includes:
- API calls: Unlimited for Classroom API
- OAuth: No charge for authentication

---

## Next Steps

After completing this setup:
1. ✅ Inform the LinguaFlow agent: "Google Classroom credentials are ready"
2. ✅ Agent will build the integration endpoints
3. ✅ Test with your Google Classroom account
4. ✅ Roll out to teachers!

**Questions?** Refer to official Google documentation:
- [Google Classroom API Guide](https://developers.google.com/classroom)
- [OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
- [Scopes Reference](https://developers.google.com/identity/protocols/oauth2/scopes#classroom)

---

**Document Version:** 1.0  
**Last Updated:** November 23, 2025  
**Status:** Ready for user setup
