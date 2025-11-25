import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register service worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope);
      },
      (error) => {
        console.log('[PWA] Service Worker registration failed:', error);
      }
    );
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
