import { useEffect } from "react";
import { useLocation } from "wouter";

export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    // Try to find the scrollable container first
    const scrollableContainer = document.querySelector('.overflow-y-auto');
    if (scrollableContainer) {
      scrollableContainer.scrollTo(0, 0);
    }
    // Also reset window scroll just in case
    window.scrollTo(0, 0);
  }, [location]);

  return null;
}
