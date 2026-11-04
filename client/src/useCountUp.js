import { useEffect, useRef, useState } from 'react';
// Eases a number from its old value to its new one, so changes feel alive. Skipped for people who prefer reduced motion.
export function useCountUp(value, ms = 450) {
  const [v, setV] = useState(value), from = useRef(value);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(value); from.current = value; return; }
    const start = performance.now(), a = from.current; let raf;
    const tick = t => {
      const p = Math.min(1, (t - start) / ms), cur = a + (value - a) * (1 - Math.pow(1 - p, 3));
      setV(cur); from.current = cur; if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}
