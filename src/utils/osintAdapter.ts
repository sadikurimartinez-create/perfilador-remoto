

import { ApiOrchestrator } from "@/lib/providers/orchestrator";

export interface OSINTAdapterResponse {

    source:string;

    status:string;

    data:any;

    confidence:number;

}


export async function executeOSINTAdapter(
    params:any
):Promise<OSINTAdapterResponse[]>{


const orchestrator =
new ApiOrchestrator();


const providers = [

    "telegram",
    "x",
    "facebook",
    "instagram",
    "reddit"

];


const results =
await orchestrator.execute(
    providers,
    params
);


return Object.entries(results)
.map(
([source,response]:any)=>({

    source,

    status:
    response.status,

    data:
    response.payload,

    confidence:
    response.confidence || 0

})
);


}

