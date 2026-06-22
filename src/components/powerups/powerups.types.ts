export type PowerUpState = "idle" | "running" | "completed" | "error";
export type ImpactLevel = "bajo" | "medio" | "alto";
export type ComplexityLevel = "Bajo" | "Intermedio" | "Avanzado" | "Complejo";

export interface PowerUpConfig {
  id: string;
  title: string;              // Human operational title
  subtitle: string;           // Visible human description (1 line)
  icon: string;               // Representational visual emoji
  colorTheme: {
    bg: string;
    border: string;
    hoverBorder: string;
    hoverBg: string;
    text: string;
    accentText: string;
    glow: string;
    badge: string;
    accentBg: string;
    bulletDot: string;
  };
  technicalText: string;      // Legacy compatibility technical text
  fileImpact: string;         // Impact on the investigation file
  
  // Multilayer Tooltip Content
  tooltip: {
    visibleHuman: string;      // Level 1: Visible Human (1-2 lines simple)
    expandableOperative: {     // Level 2: AI Process and Data Sources used
      process: string;
      sources: string[];
    };
    collapsedTechnical: {      // Level 3: APIs, models, internal functions
      apis: string[];
      models: string[];
      functions: string[];
    };
  };

  // Execution Preview Content
  preview: {
    summary: string;           // Action summary
    analysisType: string;      // Type of analysis
    estimatedImpact: ImpactLevel;
    dataToProcess: string;     // Types of information processed
  };
}

export interface PowerUpExecutionLog {
  analysisId: string;
  powerUpId: string;
  powerUpTitle: string;
  timestamp: string;
  inputUsed: string;
  outputGenerated: string;
  confidenceScore: number;     // confidence percentage or coefficient (e.g. 0.94)
  sourcesConsulted: string[];  // list of services queried
}
