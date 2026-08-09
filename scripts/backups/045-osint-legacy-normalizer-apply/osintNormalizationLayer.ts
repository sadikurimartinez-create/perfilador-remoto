

export interface NormalizedOSINTResult {

source:string;

records:number;

confidence:number;

payload:any;

timestamp:string;

}


export function normalizeOSINTResult(
input:any
):NormalizedOSINTResult{


if(
input?.source === "OSINT_LEGACY_ENGINE"
){

return {

source:
"LEGACY",

records:
input.records || 0,

confidence:
60,

payload:
input.payload,

timestamp:
input.timestamp

};

}


if(
input?.providers
){

return {

source:
"ADAPTER",

records:
input.providers.length,

confidence:
Math.round(
input.providers.reduce(
(sum:any,item:any)=>
sum + (item.confidence || 0),
0
) /
Math.max(
input.providers.length,
1
)
),

payload:
input.providers,

timestamp:
input.timestamp

};

}


return {

source:
"UNKNOWN",

records:
0,

confidence:
0,

payload:
input,

timestamp:
new Date().toISOString()

};

}

