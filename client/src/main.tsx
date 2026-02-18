import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
    if (registrations.length > 0) {
      console.log(`[PWA] Unregistered ${registrations.length} service worker(s)`);
      caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
    }
  });
}

// Lock screen orientation to portrait mode (for mobile/Capacitor apps)
const lockOrientation = async () => {
  try {
    // Check if Screen Orientation API is available
    if ('orientation' in screen && 'lock' in (screen.orientation as any)) {
      await (screen.orientation as any).lock('portrait-primary');
      console.log('[APP] Screen orientation locked to portrait');
    }
  } catch (error) {
    // Orientation lock not supported or not allowed (common on desktop browsers)
    console.log('[APP] Screen orientation lock not available');
  }
};

// Try to lock orientation on app load
lockOrientation();

createRoot(document.getElementById("root")!).render(<App />);
