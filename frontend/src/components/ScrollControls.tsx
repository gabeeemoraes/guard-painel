import { useEffect } from "react";

export function ScrollControls() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "PageUp" && event.key !== "PageDown") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=\"true\"]")) return;

      event.preventDefault();
      const amount = Math.max(420, Math.round(window.innerHeight * 0.88));
      window.scrollBy({ top: event.key === "PageDown" ? amount : -amount, behavior: "smooth" });
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
