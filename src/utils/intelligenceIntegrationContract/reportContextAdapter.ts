import { IntelligenceIntegrationContext } from "./models/intelligenceContextTypes";
import { CEIPOLReportContext } from "./models/reportContextTypes";

export class ReportContextAdapter {
  /**
   * Adapta un IntelligenceIntegrationContext unificado al CEIPOLReportContext
   * requerido por el motor editorial y de prompts, sin pérdida de información.
   */
  public static adapt(
    context: IntelligenceIntegrationContext,
    options?: {
      chapterId?: string;
      reportMode?: "FULL" | "EXECUTIVE";
      includeOsintAppendix?: boolean;
      sweeps?: any[];
      linkedGangReport?: any;
      osintEngineData?: any;
    }
  ): CEIPOLReportContext {
    return {
      intelligenceContext: context,
      chapterId: options?.chapterId,
      reportMode: options?.reportMode || "FULL",
      includeOsintAppendix: options?.includeOsintAppendix !== false,
      sweeps: options?.sweeps || [],
      linkedGangReport: options?.linkedGangReport || null,
      osintEngineData: options?.osintEngineData || null
    };
  }
}
