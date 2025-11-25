import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.linguaflow.app',
  appName: 'LinguaFlow',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#2563eb',
      showSpinner: false,
    },
  },
  ios: {
    // Lock to portrait orientation on iOS
    // This will be applied when running: npx cap add ios
    preferredContentMode: 'mobile',
  },
  android: {
    // Android-specific settings
    // Orientation lock is configured in AndroidManifest.xml after running: npx cap add android
    allowMixedContent: false,
  },
};

export default config;

/*
 * NATIVE BUILD INSTRUCTIONS
 * =========================
 * 
 * To generate native iOS/Android projects with portrait orientation lock:
 * 
 * 1. Build the web app:
 *    npm run build
 * 
 * 2. Generate native projects (requires local machine):
 *    npx cap add ios
 *    npx cap add android
 *    npx cap sync
 * 
 * 3. Configure orientation lock:
 * 
 *    iOS (ios/App/App/Info.plist) - Add or modify:
 *    <key>UISupportedInterfaceOrientations</key>
 *    <array>
 *        <string>UIInterfaceOrientationPortrait</string>
 *    </array>
 *    <key>UISupportedInterfaceOrientations~ipad</key>
 *    <array>
 *        <string>UIInterfaceOrientationPortrait</string>
 *    </array>
 * 
 *    Android (android/app/src/main/AndroidManifest.xml) - Add to <activity>:
 *    android:screenOrientation="portrait"
 * 
 * 4. Open in native IDEs:
 *    npx cap open ios     (requires Mac with Xcode)
 *    npx cap open android (requires Android Studio)
 * 
 * 5. Build and submit to app stores from the native IDE
 */
