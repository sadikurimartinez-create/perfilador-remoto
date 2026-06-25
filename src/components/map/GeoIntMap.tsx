"use client";

import dynamic from "next/dynamic";

// Dynamically import the inner Leaflet map component with ssr disabled
// to prevent SSR build errors with browser-only globals (window, document)
const GeoIntMapInner = dynamic(() => import("./GeoIntMapInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[450px] bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans space-y-4 border border-slate-800 rounded-lg">
      <div className="relative flex items-center justify-center">
        {/* Sleek, premium glowing ring loader */}
        <div className="w-14 h-14 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
        <div className="absolute w-8 h-8 bg-amber-500/10 rounded-full animate-pulse"></div>
      </div>
      <div className="text-center space-y-1">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-amber-500">
          GEOINT Visual Operation Layer
        </h3>
        <p className="text-[11px] text-slate-400">
          Loading Leaflet Map Engine and Real-Time Signal Stream...
        </p>
      </div>
    </div>
  ),
});

export default function GeoIntMap() {
  return (
    <div className="w-full h-full min-h-[450px] overflow-hidden rounded-lg border border-slate-800">
      <GeoIntMapInner />
    </div>
  );
}
