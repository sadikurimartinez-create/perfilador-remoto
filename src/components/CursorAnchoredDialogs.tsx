"use client";

import { useEffect } from "react";

const DIALOG_SELECTOR = ".cursor-anchored-dialog";
const EDGE_MARGIN = 16;
const CURSOR_GAP = 12;

/**
 * Keeps modal dialogs close to the action that opened them. The listener runs
 * in the capture phase, so the pointer is recorded before React mounts a modal.
 */
export function CursorAnchoredDialogs() {
  useEffect(() => {
    let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const observedDialogs = new WeakSet<HTMLElement>();

    const positionDialog = (dialog: HTMLElement) => {
      requestAnimationFrame(() => {
        const rect = dialog.getBoundingClientRect();
        const maxLeft = Math.max(EDGE_MARGIN, window.innerWidth - rect.width - EDGE_MARGIN);
        const maxTop = Math.max(EDGE_MARGIN, window.innerHeight - rect.height - EDGE_MARGIN);

        const preferredLeft =
          pointer.x + CURSOR_GAP + rect.width <= window.innerWidth - EDGE_MARGIN
            ? pointer.x + CURSOR_GAP
            : pointer.x - CURSOR_GAP - rect.width;
        const preferredTop =
          pointer.y + CURSOR_GAP + rect.height <= window.innerHeight - EDGE_MARGIN
            ? pointer.y + CURSOR_GAP
            : pointer.y - CURSOR_GAP - rect.height;

        dialog.style.left = `${Math.min(maxLeft, Math.max(EDGE_MARGIN, preferredLeft))}px`;
        dialog.style.top = `${Math.min(maxTop, Math.max(EDGE_MARGIN, preferredTop))}px`;
      });
    };

    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach(({ target }) => positionDialog(target as HTMLElement));
    });

    const registerDialog = (dialog: HTMLElement) => {
      positionDialog(dialog);
      if (!observedDialogs.has(dialog)) {
        observedDialogs.add(dialog);
        resizeObserver.observe(dialog);
      }
    };

    const positionNewDialogs = (root: ParentNode = document) => {
      root.querySelectorAll<HTMLElement>(DIALOG_SELECTOR).forEach(registerDialog);
    };

    const rememberPointer = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
    };
    const repositionDialogs = () => positionNewDialogs();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach(({ addedNodes }) => {
        addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches(DIALOG_SELECTOR)) registerDialog(node);
          positionNewDialogs(node);
        });
      });
    });

    document.addEventListener("pointerdown", rememberPointer, true);
    document.addEventListener("pointermove", rememberPointer, { capture: true, passive: true });
    window.addEventListener("resize", repositionDialogs);
    observer.observe(document.body, { childList: true, subtree: true });
    positionNewDialogs();

    return () => {
      document.removeEventListener("pointerdown", rememberPointer, true);
      document.removeEventListener("pointermove", rememberPointer, true);
      window.removeEventListener("resize", repositionDialogs);
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  return null;
}
