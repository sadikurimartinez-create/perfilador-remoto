import { GeoCell, IRIEngine, IRIWeights, IRICellResult } from "../iriEngine";

export interface FloodEvent {
  id: string;
  location: GeoCell;
  timestamp: string; // ISO date format
  severity_real: number; // 0.0 to 1.0 (real observed ground truth)
  confirmed_sources: string[]; // e.g. ["CONAGUA", "CENAPRED", "NASA", "COPERNICUS", "OSINT"]
  geometry: GeoCell["geometry"];
  impact_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface CalibrationReport {
  accuracy: number; // 1 - MAE
  mean_absolute_error: number;
  precision: number;
  recall: number;
  f1_score: number;
  false_positive_rate: number;
  false_negative_rate: number;
  weight_adjustments: {
    hydrology: number;
    precipitation: number;
    topography: number;
    infrastructure: number;
    population: number;
    landUse: number;
    osint: number;
    satellite: number;
  };
  validation_samples: number;
  calibrated_accuracy: number;
  calibrated_mean_absolute_error: number;
  samples: Array<{
    id: string;
    timestamp: string;
    centroid: [number, number];
    confirmed_sources: string[];
    severity_real: number;
    iri_base: number;
    iri_calibrated: number;
    error_base: number;
    error_calibrated: number;
    impact_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  }>;
}

// --- HISTORICAL GROUND TRUTH DATASET (Aguascalientes) ---
const HISTORICAL_EVENTS_RAW = [
  {
    id: "hist_001",
    lat: 21.8920,
    lng: -102.3190,
    timestamp: "2023-08-15T18:30:00Z",
    severity_real: 0.92,
    confirmed_sources: ["CONAGUA", "CENAPRED", "COPERNICUS", "OSINT"],
    impact_level: "CRITICAL" as const,
  },
  {
    id: "hist_002",
    lat: 21.8815,
    lng: -102.2855,
    timestamp: "2024-07-10T21:00:00Z",
    severity_real: 0.85,
    confirmed_sources: ["CENAPRED", "OSINT"],
    impact_level: "CRITICAL" as const,
  },
  {
    id: "hist_003",
    lat: 21.8902,
    lng: -102.2810,
    timestamp: "2023-09-02T16:45:00Z",
    severity_real: 0.78,
    confirmed_sources: ["CENAPRED", "OSINT", "NASA"],
    impact_level: "HIGH" as const,
  },
  {
    id: "hist_004",
    lat: 21.9215,
    lng: -102.2980,
    timestamp: "2024-06-20T14:15:00Z",
    severity_real: 0.45,
    confirmed_sources: ["OSINT"],
    impact_level: "MEDIUM" as const,
  },
  {
    id: "hist_005",
    lat: 21.8990,
    lng: -102.3210,
    timestamp: "2023-07-22T19:30:00Z",
    severity_real: 0.65,
    confirmed_sources: ["CONAGUA", "COPERNICUS", "OSINT"],
    impact_level: "HIGH" as const,
  },
  {
    id: "hist_006",
    lat: 21.8810,
    lng: -102.2965,
    timestamp: "2023-08-01T22:00:00Z",
    severity_real: 0.30,
    confirmed_sources: ["OSINT"],
    impact_level: "MEDIUM" as const,
  },
  {
    id: "hist_007",
    lat: 21.8480,
    lng: -102.2780,
    timestamp: "2023-09-18T10:00:00Z",
    severity_real: 0.15,
    confirmed_sources: ["NASA"],
    impact_level: "LOW" as const,
  },
  {
    id: "hist_008",
    lat: 21.8150,
    lng: -102.3120,
    timestamp: "2023-10-05T08:00:00Z",
    severity_real: 0.55,
    confirmed_sources: ["CONAGUA", "COPERNICUS"],
    impact_level: "HIGH" as const,
  },
  {
    id: "hist_009",
    lat: 21.8785,
    lng: -102.3015,
    timestamp: "2024-07-15T20:30:00Z",
    severity_real: 0.88,
    confirmed_sources: ["CENAPRED", "OSINT"],
    impact_level: "CRITICAL" as const,
  },
  {
    id: "hist_010",
    lat: 21.8950,
    lng: -102.2680,
    timestamp: "2023-06-12T17:00:00Z",
    severity_real: 0.48,
    confirmed_sources: ["OSINT", "NASA"],
    impact_level: "MEDIUM" as const,
  },
  {
    id: "hist_011",
    lat: 21.9420,
    lng: -102.3480,
    timestamp: "2024-08-01T15:30:00Z",
    severity_real: 0.70,
    confirmed_sources: ["CONAGUA", "CENAPRED"],
    impact_level: "HIGH" as const,
  },
  {
    id: "hist_012",
    lat: 21.8750,
    lng: -102.2450,
    timestamp: "2023-08-25T11:45:00Z",
    severity_real: 0.60,
    confirmed_sources: ["OSINT"],
    impact_level: "HIGH" as const,
  },
  {
    id: "hist_013",
    lat: 21.9050,
    lng: -102.3030,
    timestamp: "2023-09-10T12:00:00Z",
    severity_real: 0.58,
    confirmed_sources: ["NASA", "OSINT"],
    impact_level: "HIGH" as const,
  },
  {
    id: "hist_014",
    lat: 21.8550,
    lng: -102.2580,
    timestamp: "2023-07-30T09:00:00Z",
    severity_real: 0.20,
    confirmed_sources: ["COPERNICUS"],
    impact_level: "LOW" as const,
  },
  {
    id: "hist_015",
    lat: 21.9120,
    lng: -102.2530,
    timestamp: "2024-06-15T18:00:00Z",
    severity_real: 0.38,
    confirmed_sources: ["NASA"],
    impact_level: "MEDIUM" as const,
  },
];

export class IRICalibrationEngine {
  private baseWeights: IRIWeights = {
    hydrology: 0.25,
    precipitation: 0.20,
    topography: 0.15,
    infrastructure: 0.10,
    population: 0.10,
    landUse: 0.05,
    osint: 0.10,
    satellite: 0.05,
  };

  /**
   * Safe weight boundaries for calibration (Wi)
   */
  private weightBounds = {
    hydrology: { min: 0.18, max: 0.32 },
    precipitation: { min: 0.14, max: 0.26 },
    topography: { min: 0.10, max: 0.20 },
    infrastructure: { min: 0.06, max: 0.14 },
    population: { min: 0.06, max: 0.14 },
    landUse: { min: 0.02, max: 0.08 },
    osint: { min: 0.06, max: 0.14 },
    satellite: { min: 0.02, max: 0.08 },
  };

  /**
   * Generates a standard 250m resolution GeoCell centered on a specific lat/lng.
   */
  private buildGeoCellForCoord(id: string, lat: number, lng: number, resolution: number = 250): GeoCell {
    const latSpacing = resolution / 111000;
    const lngSpacing = resolution / (111000 * Math.cos((lat * Math.PI) / 180));

    const minLat = lat - latSpacing / 2;
    const maxLat = lat + latSpacing / 2;
    const minLng = lng - lngSpacing / 2;
    const maxLng = lng + lngSpacing / 2;

    const geometry = {
      type: "Polygon" as const,
      coordinates: [
        [
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat],
        ],
      ],
    };

    return {
      id,
      geometry,
      centroid: [lat, lng],
      resolution,
    };
  }

  /**
   * Retrieves historical flood events matching date range and geographic bbox boundaries.
   */
  public getHistoricalEvents(
    startDate?: string,
    endDate?: string,
    bbox?: [number, number, number, number]
  ): FloodEvent[] {
    let filtered = HISTORICAL_EVENTS_RAW;

    if (startDate) {
      const startMs = new Date(startDate).getTime();
      filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= startMs);
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime();
      filtered = filtered.filter((e) => new Date(e.timestamp).getTime() <= endMs);
    }

    if (bbox && bbox.length === 4) {
      const [minLat, minLng, maxLat, maxLng] = bbox;
      filtered = filtered.filter(
        (e) => e.lat >= minLat && e.lat <= maxLat && e.lng >= minLng && e.lng <= maxLng
      );
    }

    // Map raw historical events to full FloodEvent objects
    return filtered.map((raw) => {
      const cell = this.buildGeoCellForCoord(raw.id, raw.lat, raw.lng);
      return {
        id: raw.id,
        location: cell,
        timestamp: raw.timestamp,
        severity_real: raw.severity_real,
        confirmed_sources: raw.confirmed_sources,
        geometry: cell.geometry,
        impact_level: raw.impact_level,
      };
    });
  }

  /**
   * Compares predicted IRI scores against ground truth to calculate error, precision, confusion matrix,
   * and suggestions for calibrated weights.
   */
  public async runCalibration(
    startDate?: string,
    endDate?: string,
    bbox?: [number, number, number, number]
  ): Promise<CalibrationReport> {
    const events = this.getHistoricalEvents(startDate, endDate, bbox);

    if (events.length === 0) {
      throw new Error("No historical calibration events found within the given criteria.");
    }

    // 1. Compute Base predictions
    const baseEngine = new IRIEngine(this.baseWeights);
    const cellsToEvaluate = events.map((e) => e.location);

    // Calculate grid values using spatial caching
    const baseCellResults = await baseEngine.calculateGridIRI(cellsToEvaluate);

    // Collect base predictions and raw factors for correlation mapping
    const samplesRaw: Array<{
      event: FloodEvent;
      resultBase: IRICellResult;
      error: number;
    }> = [];

    let sumAbsoluteErrorBase = 0;

    // Binary classifications for Precision, Recall, F1, FPR, FNR
    // We treat score >= 0.40 as "Inundated" (Flood Alert)
    const SEVERITY_THRESHOLD = 0.40;
    let tp = 0; // True Positive
    let fp = 0; // False Positive
    let fn = 0; // False Negative
    let tn = 0; // True Negative

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const resultBase = baseCellResults[i];

      // error = predicted - real
      const error = resultBase.iri_score - event.severity_real;
      sumAbsoluteErrorBase += Math.abs(error);

      samplesRaw.push({ event, resultBase, error });

      const actualPositive = event.severity_real >= SEVERITY_THRESHOLD;
      const predictedPositive = resultBase.iri_score >= SEVERITY_THRESHOLD;

      if (actualPositive && predictedPositive) tp++;
      else if (!actualPositive && predictedPositive) fp++;
      else if (actualPositive && !predictedPositive) fn++;
      else tn++;
    }

    const n = events.length;
    const maeBase = sumAbsoluteErrorBase / n;

    // Calculate baseline metrics
    const precision = tp + fp > 0 ? tp / (tp + fp) : 1.0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1.0;
    const f1_score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 1.0;
    const false_positive_rate = fp + tn > 0 ? fp / (fp + tn) : 0.0;
    const false_negative_rate = tp + fn > 0 ? fn / (tp + fn) : 0.0;

    // 2. Perform Dynamic Weight Adjustment Optimization
    // Analyze how each factor relates to predictions under-estimating or over-estimating real severity
    const keys = Object.keys(this.baseWeights) as Array<keyof IRIWeights>;

    // Calculate mean factor values and alignment
    const meanFactors: Record<keyof IRIWeights, number> = {
      hydrology: 0,
      precipitation: 0,
      topography: 0,
      infrastructure: 0,
      population: 0,
      landUse: 0,
      osint: 0,
      satellite: 0,
    };

    samplesRaw.forEach((s) => {
      keys.forEach((key) => {
        meanFactors[key] += s.resultBase.breakdown[key];
      });
    });

    keys.forEach((key) => {
      meanFactors[key] /= n;
    });

    // Analytical Gradient Shift: We calculate delta based on (real - predicted) * (factor - meanFactor)
    const deltas: Record<keyof IRIWeights, number> = {
      hydrology: 0,
      precipitation: 0,
      topography: 0,
      infrastructure: 0,
      population: 0,
      landUse: 0,
      osint: 0,
      satellite: 0,
    };

    samplesRaw.forEach((s) => {
      const globalError = s.event.severity_real - s.resultBase.iri_score; // positive means we under-estimated
      keys.forEach((key) => {
        const factorValue = s.resultBase.breakdown[key];
        deltas[key] += globalError * (factorValue - meanFactors[key]);
      });
    });

    // Adjust weights based on deltas with a moderate learning rate (0.25)
    const learningRate = 0.25;
    const rawCalibratedWeights: Record<keyof IRIWeights, number> = { ...this.baseWeights };

    keys.forEach((key) => {
      const shift = (deltas[key] / n) * learningRate;
      rawCalibratedWeights[key] = Math.max(
        this.weightBounds[key].min,
        Math.min(this.weightBounds[key].max, this.baseWeights[key] + shift)
      );
    });

    // Normalize adjusted weights to sum exactly to 1.00
    const sumCalibrated = keys.reduce((acc, k) => acc + rawCalibratedWeights[k], 0);
    const calibratedWeights: Record<keyof IRIWeights, number> = { ...rawCalibratedWeights };

    keys.forEach((key) => {
      calibratedWeights[key] = parseFloat((rawCalibratedWeights[key] / sumCalibrated).toFixed(4));
    });

    // Handle tiny float rounding discrepancy by absorbing difference in Hydrology (largest weight)
    const currentSum = keys.reduce((acc, k) => acc + calibratedWeights[k], 0);
    if (currentSum !== 1.0) {
      const diff = parseFloat((1.0 - currentSum).toFixed(4));
      calibratedWeights.hydrology = parseFloat((calibratedWeights.hydrology + diff).toFixed(4));
    }

    // Calculate weight_adjustments factors relative to base weights (e.g. 1.05 means +5%)
    const weightAdjustmentsReport: Record<keyof IRIWeights, number> = { ...this.baseWeights };
    keys.forEach((key) => {
      weightAdjustmentsReport[key] = parseFloat(
        (calibratedWeights[key] / this.baseWeights[key]).toFixed(2)
      );
    });

    // 3. Compute Calibrated predictions
    const calibratedEngine = new IRIEngine(calibratedWeights);
    const calibratedCellResults = await calibratedEngine.calculateGridIRI(cellsToEvaluate);

    let sumAbsoluteErrorCalibrated = 0;
    const samplesReport: CalibrationReport["samples"] = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const resultBase = baseCellResults[i];
      const resultCalibrated = calibratedCellResults[i];

      const errorBase = resultBase.iri_score - event.severity_real;
      const errorCalibrated = resultCalibrated.iri_score - event.severity_real;

      sumAbsoluteErrorCalibrated += Math.abs(errorCalibrated);

      samplesReport.push({
        id: event.id,
        timestamp: event.timestamp,
        centroid: event.location.centroid,
        confirmed_sources: event.confirmed_sources,
        severity_real: event.severity_real,
        iri_base: resultBase.iri_score,
        iri_calibrated: resultCalibrated.iri_score,
        error_base: parseFloat(errorBase.toFixed(3)),
        error_calibrated: parseFloat(errorCalibrated.toFixed(3)),
        impact_level: event.impact_level,
      });
    }

    const maeCalibrated = sumAbsoluteErrorCalibrated / n;

    return {
      accuracy: parseFloat((1 - maeBase).toFixed(3)),
      mean_absolute_error: parseFloat(maeBase.toFixed(3)),
      precision: parseFloat(precision.toFixed(3)),
      recall: parseFloat(recall.toFixed(3)),
      f1_score: parseFloat(f1_score.toFixed(3)),
      false_positive_rate: parseFloat(false_positive_rate.toFixed(3)),
      false_negative_rate: parseFloat(false_negative_rate.toFixed(3)),
      weight_adjustments: weightAdjustmentsReport,
      validation_samples: n,
      calibrated_accuracy: parseFloat((1 - maeCalibrated).toFixed(3)),
      calibrated_mean_absolute_error: parseFloat(maeCalibrated.toFixed(3)),
      samples: samplesReport,
    };
  }
}
