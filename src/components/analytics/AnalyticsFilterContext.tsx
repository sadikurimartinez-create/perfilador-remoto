"use client";

import * as React from "react";
import { createContext, useContext, useState, ReactNode } from "react";

export interface AnalyticsFilterState {
  categoriaSeleccionada?: string | null;
  periodoSeleccionado?: string | null;
  capaActiva?: string | null;
  tipoDato?: string | null;
}

interface AnalyticsFilterContextType {
  filterState: AnalyticsFilterState;
  setFilterState: React.Dispatch<React.SetStateAction<AnalyticsFilterState>>;
  resetFilters: () => void;
  setCategoryFilter: (category: string | null) => void;
}

const AnalyticsFilterContext = createContext<AnalyticsFilterContextType | undefined>(undefined);

export function AnalyticsFilterProvider({ children }: { children: ReactNode }) {
  const [filterState, setFilterState] = useState<AnalyticsFilterState>({
    categoriaSeleccionada: null,
    periodoSeleccionado: null,
    capaActiva: null,
    tipoDato: null,
  });

  const resetFilters = () => {
    setFilterState({
      categoriaSeleccionada: null,
      periodoSeleccionado: null,
      capaActiva: null,
      tipoDato: null,
    });
  };

  const setCategoryFilter = (category: string | null) => {
    setFilterState((prev) => ({
      ...prev,
      categoriaSeleccionada: category,
    }));
  };

  return (
    <AnalyticsFilterContext.Provider value={{ filterState, setFilterState, resetFilters, setCategoryFilter }}>
      {children}
    </AnalyticsFilterContext.Provider>
  );
}

export function useAnalyticsFilter() {
  const context = useContext(AnalyticsFilterContext);
  if (!context) {
    throw new Error("useAnalyticsFilter must be used within an AnalyticsFilterProvider");
  }
  return context;
}

export function useOptionalAnalyticsFilter() {
  return useContext(AnalyticsFilterContext);
}
