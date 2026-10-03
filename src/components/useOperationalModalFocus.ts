import { useEffect, useRef, type RefObject } from 'react';

export function useOperationalModalFocus(open: boolean, ref: RefObject<HTMLDivElement>, onClose?: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prior = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    if (!panel) return;
    panel.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeRef.current) { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]')).filter(item => !item.hidden);
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); panel.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) { event.preventDefault(); first.focus(); }
    };
    panel.addEventListener('keydown', keyboard);
    return () => { panel.removeEventListener('keydown', keyboard); if (prior?.isConnected) prior.focus(); };
  }, [open, ref]);
}
