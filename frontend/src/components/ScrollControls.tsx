import { useEffect } from "react";

const isEditable = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
};

export function ScrollControls() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditable(event.target)) return;
      if (event.key !== "PageDown" && event.key !== "PageUp") return;

      event.preventDefault();
      const amount = Math.max(320, Math.floor(window.innerHeight * 0.82));
      window.scrollBy({ top: event.key === "PageDown" ? amount : -amount, behavior: "smooth" });
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
