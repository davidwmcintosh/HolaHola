import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// TEMPORARILY DISABLED - Service worker causing severe caching issues
// Will re-enable after cache issues are resolved
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Unregister any existing service workers
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        registration.unregister().then(() => {
          console.log('[PWA] Service Worker unregistered');
        });
      }
    });
    
    // Clear all caches
    caches.keys().then((names) => {
      for (let name of names) {
        caches.delete(name);
      }
      console.log('[PWA] All caches cleared');
    });
  });
}
