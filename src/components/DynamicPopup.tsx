import React, { ReactNode, useRef, useEffect, useState } from 'react';

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
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !anchorPosition) return;

    const handlePositioning = () => {
      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;
      const popup = popupRef.current;

      const w = popup ? popup.offsetWidth : 320;
      const h = popup ? popup.offsetHeight : 240;

      const pos = PopupPositionManager.calculate(
        anchorPosition.x,
        anchorPosition.y,
        w,
        h,
        winWidth,
        winHeight,
        preferredPlacement
      );

      setCoords({ x: pos.x, y: pos.y });
    };

    // Run immediately and after a brief microtask to allow rendering layout dimensions
    handlePositioning();
    const timer = setTimeout(handlePositioning, 20);

    window.addEventListener('resize', handlePositioning);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handlePositioning);
    };
  }, [open, anchorPosition, preferredPlacement]);

  if (!open || !anchorPosition) return null;

  return (
    <>
      {/* Backdrop for click outside */}
      <div 
        className="fixed inset-0 z-40 bg-black/10 transition-opacity" 
        onClick={onClose}
      />
      <div
        ref={popupRef}
        style={{
          position: 'fixed',
          top: `${coords.y}px`,
          left: `${coords.x}px`,
        }}
        className={`z-50 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-4 text-slate-100 max-w-sm sm:max-w-md w-80 sm:w-96 transition-all duration-150 ${className}`}
      >
        {children}
      </div>
    </>
  );
};
