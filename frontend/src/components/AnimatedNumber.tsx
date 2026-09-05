import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedNumber({
  value,
  format,
  duration = 850,
}: {
  value: number;
  format: (value: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const previous = useRef(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      previous.current = value;
      setDisplay(value);
      return;
    }

    const from = previous.current;
    const started = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const next = from + (value - from) * easeOutCubic(progress);
      setDisplay(next);
      if (progress < 1) raf = requestAnimationFrame(frame);
      else previous.current = value;
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [duration, value]);

  return <>{format(display)}</>;
}
