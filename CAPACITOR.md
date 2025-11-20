# PWA & Capacitor Setup Guide

LinguaFlow is now configured as a **Progressive Web App (PWA)** with **Capacitor** support for native iOS and Android apps.

## 🌐 Progressive Web App (PWA)

### Features
- ✅ **Install to Home Screen**: Users can add LinguaFlow to their device home screen
- ✅ **Offline Support**: Service worker caches conversations and vocabulary for offline access
- ✅ **Native App Feel**: Full-screen mode, splash screen, and app icons
- ✅ **Auto-updates**: Service worker automatically updates when new versions are available
- ✅ **Smart Install Prompt**: Shows after 3 seconds, can be dismissed for 7 days

### Testing PWA Locally

1. Build the production version:
   ```bash
   npm run build
   npm start
   ```

2. Open in browser and use DevTools:
   - Chrome: Application tab → Manifest / Service Workers
   - Check "Update on reload" to test service worker updates

3. Install the PWA:
   - Look for the install prompt in the bottom-right corner
   - Or use browser's "Install app" option in the address bar

### PWA Files
- `public/manifest.json` - App metadata, icons, and configuration
- `public/sw.js` - Service worker for offline caching
- `client/src/main.tsx` - Service worker registration
- `client/src/components/PWAInstallPrompt.tsx` - Install prompt UI
- `client/index.html` - PWA meta tags and manifest link

---

## 📱 Capacitor (Native Apps)

Capacitor lets you wrap the web app as native iOS and Android apps.

### Initial Setup

1. **Initialize iOS and Android projects** (run once):
   ```bash
   # iOS (requires macOS with Xcode)
   npx cap add ios
   
   # Android (requires Android Studio)
   npx cap add android
   ```

2. **Build the web app**:
   ```bash
   npm run build
   ```

3. **Sync web assets to native projects**:
   ```bash
   npx cap sync
   ```

### Development Workflow

After making changes to your web app:

```bash
# 1. Build web app
npm run build

# 2. Sync to native projects
npx cap sync

# 3. Open in IDE
npx cap open ios      # Opens Xcode
npx cap open android  # Opens Android Studio
```

### Configuration

Edit `capacitor.config.ts` to customize:
- **appId**: `com.linguaflow.app` (change before publishing)
- **appName**: Display name in app stores
- **Plugins**: Splash screen, push notifications, etc.

### Adding Native Features

Install Capacitor plugins for native capabilities:

```bash
# Push Notifications
npm install @capacitor/push-notifications
npx cap sync

# Camera
npm install @capacitor/camera
npx cap sync

# Geolocation
npm install @capacitor/geolocation
npx cap sync
```

Then import and use in your React components:

```typescript
import { PushNotifications } from '@capacitor/push-notifications';
import { Camera } from '@capacitor/camera';

// Request permissions and use native features
```

---

## 📦 Building for Production

### Web (PWA)
```bash
npm run build
npm start
```
The app will be available with PWA features enabled.

### iOS App Store
1. Open in Xcode: `npx cap open ios`
2. Configure signing & capabilities
3. Archive and upload to App Store Connect

### Google Play Store
1. Open in Android Studio: `npx cap open android`
2. Generate signed APK/Bundle
3. Upload to Google Play Console

---

## 🎨 Customizing App Icons

Replace these files in `public/`:
- `icon-192.png` - 192x192px app icon
- `icon-512.png` - 512x512px app icon  
- `icon-maskable-192.png` - 192x192px maskable icon (safe area for Android)
- `icon-maskable-512.png` - 512x512px maskable icon

**Tip**: Use https://maskable.app/ to create maskable icons that look great on all devices.

---

## 🔄 Live Updates

PWA features automatic updates:
- Service worker checks for new versions on page load
- Shows prompt when update is available
- User can choose to update immediately or continue using cached version

---

## 📊 Testing Checklist

### PWA Testing
- [ ] Install prompt appears after 3 seconds
- [ ] Can install app to home screen
- [ ] Service worker caches static assets
- [ ] Offline mode works (conversations load from cache)
- [ ] Update prompt appears when new version deployed
- [ ] Theme color matches in browser chrome/status bar

### Capacitor Testing
- [ ] iOS build opens in Xcode without errors
- [ ] Android build opens in Android Studio without errors
- [ ] App runs on simulator/emulator
- [ ] Native features work (if added)
- [ ] Deep links configured (if needed)
- [ ] Push notifications work (if implemented)

---

## 🐛 Troubleshooting

**Service worker not registering:**
- Check browser console for errors
- Ensure running on HTTPS or localhost
- Clear browser cache and hard reload

**Capacitor sync fails:**
- Run `npm run build` first
- Check `webDir` in `capacitor.config.ts` matches Vite output
- Delete `ios/`  or `android/` folders and re-run `npx cap add ios/android`

**Install prompt doesn't show:**
- Check console for PWA requirements
- Ensure manifest.json is valid
- Try incognito/private browsing mode
- Some browsers (Safari) don't support beforeinstallprompt

---

## 📚 Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
