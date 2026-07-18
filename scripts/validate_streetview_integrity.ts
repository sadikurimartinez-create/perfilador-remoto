import { isValidStreetViewImage } from "../src/utils/streetViewValidator";

function runValidationSuite() {
  console.log("======================================");
  console.log("\nSTREET VIEW PROVIDER GUARD");
  console.log("\nVALIDATION:\n");

  // Caso 1 — Street View válido
  const case1 = {
    id: "sv-val-1",
    url: "https://maps.googleapis.com/cbk?google-streetview-valid-image",
    comentario: "Barrido virtual de barda perimetral"
  };
  const res1 = isValidStreetViewImage(case1);
  console.log("VALID IMAGE:");
  console.log(res1 ? "PASS" : "FAIL");
  console.log("");

  // Caso 2 — Sin imagen
  const case2 = {
    id: "sv-err-2",
    url: null,
    comentario: "Sin imagen disponible"
  };
  const res2 = !isValidStreetViewImage(case2); // Debería ser rechazado (false), por ende !res2 === true (PASS)
  console.log("NO IMAGE:");
  console.log(res2 ? "PASS" : "FAIL");
  console.log("");

  // Caso 3 — Google sin cobertura
  const case3 = {
    id: "sv-err-3",
    url: "https://maps.googleapis.com/cbk?sorry-we-have-no-imagery",
    comentario: "Sorry, we have no imagery here."
  };
  const res3 = !isValidStreetViewImage(case3); // Debería ser rechazado (false), por ende !res3 === true (PASS)
  console.log("ERROR PLACEHOLDER:");
  console.log(res3 ? "PASS" : "FAIL");
  console.log("");

  // Caso 4 — Mapa GIS
  const case4 = {
    id: "sv-err-4",
    url: "https://geoserver.com/gis-map-image/tile",
    comentario: "POI, roads, labels and cartographic data"
  };
  const res4 = !isValidStreetViewImage(case4); // Debería ser rechazado (false), por ende !res4 === true (PASS)
  console.log("GIS MAP:");
  console.log(res4 ? "PASS" : "FAIL");
  console.log("");

  const allPass = res1 && res2 && res3 && res4;
  console.log("\nSTATUS:");
  console.log(allPass ? "GREEN" : "RED");
  console.log("\n======================================");

  if (!allPass) {
    process.exit(1);
  }
}

runValidationSuite();
