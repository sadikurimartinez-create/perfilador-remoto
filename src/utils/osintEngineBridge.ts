

import {
executeOSINTAdapter
} from "./osintAdapter";


export async function runOSINTBridge(
project:any
){

// ADR-020.34 C8:
const normalizedQuery =
typeof project?.query === "string" &&
project.query.trim().length > 0
? project.query.trim()
: null;

if (!normalizedQuery) {
throw new Error(
"runOSINTBridge requiere una consulta OSINT explicita; no se permite fabricar una consulta por defecto."
);
}

const normalizedLocation =
typeof project?.locationName === "string" &&
project.locationName.trim().length > 0
? project.locationName.trim()
: null;

const latCandidate = Number(project?.latitude);
const lngCandidate = Number(project?.longitude);

const normalizedLat =
Number.isFinite(latCandidate) &&
latCandidate >= -90 &&
latCandidate <= 90 &&
latCandidate !== 0
? latCandidate
: null;

const normalizedLng =
Number.isFinite(lngCandidate) &&
lngCandidate >= -180 &&
lngCandidate <= 180 &&
lngCandidate !== 0
? lngCandidate
: null;

const hasCompleteGeography =
normalizedLat !== null &&
normalizedLng !== null;

const params = {
location: normalizedLocation,
lat: hasCompleteGeography ? normalizedLat : null,
lng: hasCompleteGeography ? normalizedLng : null,
query: normalizedQuery
};

const adapterResults =
await executeOSINTAdapter(
params
);


return {

engine:
"OSINT_BRIDGE_V1",

location:
params.location,

providers:
adapterResults,

timestamp:
new Date().toISOString()

};

}

