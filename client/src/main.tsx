import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Service worker cleanup - only runs once per session to avoid reload loops
if ('serviceWorker' in navigator && !sessionStorage.getItem('sw-cleanup-done')) {
  window.addEventListener('load', () => {
    // Unregister any existing service workers
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        registration.unregister().then(() => {
          console.log('[PWA] Service Worker unregistered');
        });
      }
    });
    
    // Clear only old PWA caches (not Vite dev caches)
    caches.keys().then((names) => {
      const pwaCaches = names.filter(name => !name.includes('vite'));
      for (let name of pwaCaches) {
        caches.delete(name);
      }
      if (pwaCaches.length > 0) {
        console.log('[PWA] Old PWA caches cleared');
      }
    });
    
    // Mark cleanup as done for this session
    sessionStorage.setItem('sw-cleanup-done', 'true');
  });
}
