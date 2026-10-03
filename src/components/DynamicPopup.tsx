import React, { ReactNode, useRef } from "react";
import { createPortal } from "react-dom";
import { useOperationalModalFocus } from "./useOperationalModalFocus";

export interface DynamicPopupProps {
  open: boolean;
  anchorPosition: { x: number; y: number } | null;
  children: ReactNode;
  preferredPlacement?: "auto" | "top" | "bottom" | "left" | "right";
  onClose?: () => void;
  className?: string;
}

export const PopupPositionManager = {
  calculate: (
    x: number,
    y: number,
    w: number,
    h: number,
    winWidth: number,
    winHeight: number,
    preferredPlacement: "auto" | "top" | "bottom" | "left" | "right" = "auto"
  ) => {
    const offset = 18;
    const spaceRight = winWidth - x;
    const spaceBottom = winHeight - y;

    let finalPlacement = preferredPlacement;

    if (finalPlacement === "auto") {
      if (spaceRight < w + offset && x > w + offset) {
        finalPlacement = "left";
      } else if (spaceBottom < h + offset && y > h + offset) {
        finalPlacement = "top";
      } else {
        finalPlacement = "bottom";
      }
    }

    let finalX = x;
    let finalY = y;

    if (finalPlacement === "left") {
      finalX = x - w - offset;
      finalY = y - h / 2;
    } else if (finalPlacement === "right") {
      finalX = x + offset;
      finalY = y - h / 2;
    } else if (finalPlacement === "top") {
      finalX = x - w / 2;
      finalY = y - h - offset;
    } else { // bottom
      finalX = x - w / 2;
      finalY = y + offset;
    }

    // Clamping to screen boundaries
    if (finalX < 12) finalX = 12;
    if (finalX + w > winWidth - 12) finalX = winWidth - w - 12;
    if (finalY < 12) finalY = 12;
    if (finalY + h > winHeight - 12) finalY = winHeight - h - 12;

    return { x: finalX, y: finalY, placement: finalPlacement };
  }
};

export const DynamicPopup: React.FC<DynamicPopupProps> = ({
  open,
  anchorPosition,
  children,
  preferredPlacement = "auto",
  onClose,
  className = ""
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  useOperationalModalFocus(open, popupRef, onClose);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div data-operational-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/60"
      onClick={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div ref={popupRef} role="dialog" aria-modal="true" aria-label="Actuación operativa" tabIndex={-1}
        className={`relative bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-100 w-96 max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto ${className}`}>
        {onClose && <button type="button" aria-label="Cerrar actuación" onClick={onClose} className="absolute top-2 right-2">✕</button>}
        {children}
      </div>
    </div>, document.body);
};
