

export interface OSINTComparisonResult {

legacyCount:number;

adapterCount:number;

difference:number;

status:string;

timestamp:string;

}


export function compareOSINTResults(
legacy:any,
adapter:any
):OSINTComparisonResult{


const legacyCount =
Array.isArray(legacy)
? legacy.length
: 0;


const adapterCount =
Array.isArray(adapter)
? adapter.length
: 0;


return {

legacyCount,

adapterCount,

difference:
adapterCount - legacyCount,

status:
legacyCount === adapterCount
?
"VALIDATED"
:
"VALIDATION_REQUIRED",

timestamp:
new Date().toISOString()

};

}

