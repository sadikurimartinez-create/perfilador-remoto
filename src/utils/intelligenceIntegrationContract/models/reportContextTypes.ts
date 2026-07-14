import { IntelligenceIntegrationContext } from "./intelligenceContextTypes";

export interface CEIPOLReportContext {
  intelligenceContext: IntelligenceIntegrationContext;
  chapterId?: string;
  reportMode?: "FULL" | "EXECUTIVE";
  includeOsintAppendix?: boolean;
  sweeps?: any[];
  linkedGangReport?: any;
  osintEngineData?: any;
}
