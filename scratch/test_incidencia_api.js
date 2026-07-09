const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const projectRoot = path.join(__dirname, "..");
const incidenciaDir = path.join(projectRoot, "Incidencia Delictiva");

function toFiniteNumber(v) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Center of Mirador de las Culturas (Ags)
const lat = 21.8990;
const lng = -102.2452;

console.log("Analyzing incidenceDir:", incidenciaDir);

try {
  const files = fs.readdirSync(incidenciaDir, { withFileTypes: true });
  const csvFiles = files
    .filter((f) => f.isFile() && f.name.toLowerCase().endsWith(".csv"))
    .map((f) => path.join(incidenciaDir, f.name));

  console.log(`Found ${csvFiles.length} CSV files.`);
  let matches = [];

  for (const filePath of csvFiles) {
    const fileName = path.basename(filePath);
    try {
      const csvText = fs.readFileSync(filePath, "utf8");
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
      });

      const rows = parsed.data || [];
      
      let fileMatches = 0;
      for (const row of rows) {
        const latRow = toFiniteNumber(row.LAT ?? row.lat ?? row.Lat ?? row.latitude ?? row.Latitude);
        const lngRow = toFiniteNumber(row.LONG ?? row.lng ?? row.lng1 ?? row.Long ?? row.LON ?? row.lon ?? row.Lon ?? row.longitude ?? row.Longitude);
        if (latRow == null || lngRow == null) continue;

        const dist = haversineMeters(lat, lng, latRow, lngRow);
        if (dist <= 1000) {
          matches.push({
            delito: row.INCIDENTE ?? row.tipo ?? "Delito",
            dist,
            file: fileName
          });
          fileMatches++;
        }
      }
      if (fileMatches > 0) {
        console.log(`File: ${fileName} -> Matches: ${fileMatches}`);
      }
    } catch (err) {
      console.error(`Error reading/parsing ${fileName}:`, err.message);
    }
  }

  console.log(`Successfully completed! Total matches in 1km: ${matches.length}`);
} catch (e) {
  console.error("General failure:", e.message);
}
