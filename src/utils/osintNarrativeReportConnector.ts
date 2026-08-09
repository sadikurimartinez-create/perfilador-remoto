

import {
OSINTNarrativeBlock
} from "./osintNarrativeIntelligenceLayer";



export interface OSINTReportChapter {


chapterTitle:string;


executiveSummary:string;


analyticalFindings:Array<string>;


confidenceLevel:string;


operationalConclusion:string;


metadata:{


source:string;


generatedAt:string;


};


}



export function createOSINTReportChapter(
narrative:OSINTNarrativeBlock
):OSINTReportChapter{


return {


chapterTitle:
narrative.title,



executiveSummary:
narrative.executiveNarrative,



analyticalFindings:
narrative.keyFindings,



confidenceLevel:
narrative.confidenceStatement,



operationalConclusion:
narrative.operationalAssessment,



metadata:{


source:
"OSINT_DUAL_EXECUTION_ENGINE_V4",


generatedAt:
new Date().toISOString()


}


};


}

