"use client";
import { useEffect } from "react";

// Legacy compatibility: center operational panels, never Google Maps InfoWindows.
// Explicit operational modals own their layout, portal, focus and close behavior.
export function CursorAnchoredDialogs() {
  useEffect(() => {
    const center = (root: ParentNode = document) => {
      root.querySelectorAll<HTMLElement>(".cursor-anchored-dialog, [aria-modal='true']").forEach(dialog => {
        if (dialog.closest(".gm-style, [data-operational-modal]")) return;
        Object.assign(dialog.style, { position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)", maxHeight: "calc(100dvh - 2rem)", overflowY: "auto" });
      });
    };
    const observer = new MutationObserver(() => center());
    observer.observe(document.body, { childList: true, subtree: true });
    center();
    return () => observer.disconnect();
  }, []);
  return null;
}
