"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Sparkle } from "lucide-react";

export function AmbientMotion() {
  const [artReady, setArtReady] = useState(false);

  useEffect(() => {
    // Keep decorative artwork off the first-paint critical path.
    const requestIdle = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(callback, 1200));
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = requestIdle(() => setArtReady(true), { timeout: 1800 });
    return () => cancelIdle(handle);
  }, []);

  return (
    <>
      <div className="ambient-art" aria-hidden="true">
        {artReady && <img src="/art-crossing-paths.webp" alt="" loading="lazy" fetchPriority="low" decoding="async" />}
      </div>
      <div className="floating-sparkles" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <Sparkle
            key={i}
            size={i % 3 === 0 ? 17 : 11}
            style={{
              left: `${(i * 37 + 5) % 100}%`,
              "--duration": `${19 + (i % 7) * 3}s`,
              "--delay": `${-i * 3.7}s`,
              "--sway": `${i % 2 ? 80 : -70}px`,
            } as CSSProperties}
          />
        ))}
      </div>
    </>
  );
}
