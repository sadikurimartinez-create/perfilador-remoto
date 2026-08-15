export interface MapLayersState {
  baseMap: boolean;
  rectorGeometry: boolean;
  pois: boolean;
  photos: boolean;
  streetViewManual: boolean;
  streetViewAutomatic: boolean;
  findings: boolean;
  heatmap: boolean;
  streetViewCone: boolean;
}

export const DEFAULT_LAYERS_STATE: MapLayersState = {
  baseMap: true,
  rectorGeometry: true,
  pois: true,
  photos: true,
  streetViewManual: true,
  streetViewAutomatic: true,
  findings: true,
  heatmap: false,
  streetViewCone: false,
};

/**
 * Gestor de visibilidad y control de capas cartográficas del Perfilador Criminal SSPE-CEIPOL.
 * Previene la saturación de elementos mediante filtrado en tiempo real.
 */
export class MapLayerManager {
  private state: MapLayersState;
  private listeners: ((state: MapLayersState) => void)[] = [];

  constructor(initialState: MapLayersState = DEFAULT_LAYERS_STATE) {
    self = this as any; // Para mantener la consistencia
    this.state = { ...initialState };
  }

  getState(): MapLayersState {
    return this.state;
  }

  setLayerVisibility(layer: keyof MapLayersState, visible: boolean) {
    this.state[layer] = visible;
    this.notify();
  }

  toggleLayer(layer: keyof MapLayersState) {
    this.state[layer] = !this.state[layer];
    this.notify();
  }

  subscribe(listener: (state: MapLayersState) => void): () => void {
    this.listeners.push(listener);
    // Retornar función para desuscribirse
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }
}
