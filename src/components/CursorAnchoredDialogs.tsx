"use client";

import { useEffect } from "react";

const DIALOG_SELECTOR =
  ".cursor-anchored-dialog, [role='dialog'], dialog[open], [aria-modal='true']";
const EDGE_MARGIN = 16;
const CURSOR_GAP = 12;

type Point = { x: number; y: number };

function createsFixedContainingBlock(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return (
    style.transform !== "none" ||
    style.perspective !== "none" ||
    style.filter !== "none" ||
    style.backdropFilter !== "none" ||
    style.contain.includes("paint") ||
    style.contain.includes("layout") ||
    style.contain.includes("strict") ||
    style.contentVisibility === "auto" ||
    style.willChange.includes("transform") ||
    style.willChange.includes("filter")
  );
}

function fixedContainingBlock(dialog: HTMLElement) {
  let ancestor = dialog.parentElement;
  while (ancestor && ancestor !== document.documentElement) {
    if (createsFixedContainingBlock(ancestor)) return ancestor;
    ancestor = ancestor.parentElement;
  }
  return null;
}

/**
 * Keeps modal dialogs close to the action that opened them. The listener runs
 * in the capture phase, so the pointer is recorded before React mounts a modal.
 */
export function CursorAnchoredDialogs() {
  useEffect(() => {
    let pointer: Point = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const observedDialogs = new WeakSet<HTMLElement>();
    const scheduledFrames = new WeakMap<HTMLElement, number>();

    const positionDialog = (dialog: HTMLElement) => {
      const scheduledFrame = scheduledFrames.get(dialog);
      if (scheduledFrame) cancelAnimationFrame(scheduledFrame);

      const frame = requestAnimationFrame(() => {
        if (!dialog.isConnected) return;

        const rect = dialog.getBoundingClientRect();
        const visualViewport = window.visualViewport;
        const viewportLeft = visualViewport?.offsetLeft ?? 0;
        const viewportTop = visualViewport?.offsetTop ?? 0;
        const viewportWidth = visualViewport?.width ?? window.innerWidth;
        const viewportHeight = visualViewport?.height ?? window.innerHeight;
        const minLeft = viewportLeft + EDGE_MARGIN;
        const minTop = viewportTop + EDGE_MARGIN;
        const maxLeft = Math.max(minLeft, viewportLeft + viewportWidth - rect.width - EDGE_MARGIN);
        const maxTop = Math.max(minTop, viewportTop + viewportHeight - rect.height - EDGE_MARGIN);

        const preferredLeft =
          pointer.x + CURSOR_GAP + rect.width <= viewportLeft + viewportWidth - EDGE_MARGIN
            ? pointer.x + CURSOR_GAP
            : pointer.x - CURSOR_GAP - rect.width;
        const preferredTop =
          pointer.y + CURSOR_GAP + rect.height <= viewportTop + viewportHeight - EDGE_MARGIN
            ? pointer.y + CURSOR_GAP
            : pointer.y - CURSOR_GAP - rect.height;

        const viewportTargetLeft = Math.min(maxLeft, Math.max(minLeft, preferredLeft));
        const viewportTargetTop = Math.min(maxTop, Math.max(minTop, preferredTop));
        const containingBlock = fixedContainingBlock(dialog);
        const containingRect = containingBlock?.getBoundingClientRect();
        const originLeft = containingRect
          ? containingRect.left + (containingBlock?.clientLeft ?? 0)
          : 0;
        const originTop = containingRect
          ? containingRect.top + (containingBlock?.clientTop ?? 0)
          : 0;

        // A transformed/filtered ancestor changes what `position: fixed` is
        // relative to. Convert viewport coordinates back to that local space.
        dialog.style.left = `${viewportTargetLeft - originLeft}px`;
        dialog.style.top = `${viewportTargetTop - originTop}px`;
        scheduledFrames.delete(dialog);
      });
      scheduledFrames.set(dialog, frame);
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
    document.addEventListener("scroll", repositionDialogs, true);
    window.addEventListener("resize", repositionDialogs);
    window.visualViewport?.addEventListener("resize", repositionDialogs);
    window.visualViewport?.addEventListener("scroll", repositionDialogs);
    observer.observe(document.body, { childList: true, subtree: true });
    positionNewDialogs();

    return () => {
      document.removeEventListener("pointerdown", rememberPointer, true);
      document.removeEventListener("pointermove", rememberPointer, true);
      document.removeEventListener("scroll", repositionDialogs, true);
      window.removeEventListener("resize", repositionDialogs);
      window.visualViewport?.removeEventListener("resize", repositionDialogs);
      window.visualViewport?.removeEventListener("scroll", repositionDialogs);
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  return null;
}
