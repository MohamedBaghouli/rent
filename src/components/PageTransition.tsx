import { useEffect, useState } from "react";

/**
 * PageTransition wrapper component that applies entrance animations
 * when a page is mounted. Uses fade-in + slide-in-up for a smooth
 * transition effect.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    setIsVisible(true);
  }, []);

  return (
    <div
      className={`${
        isVisible
          ? "animate-fade-in animate-slide-in-up"
          : "opacity-0 translate-y-4"
      } transition-smooth`}
    >
      {children}
    </div>
  );
}
