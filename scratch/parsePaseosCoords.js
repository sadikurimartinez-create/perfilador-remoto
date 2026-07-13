const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'paseos_project_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('Project keys:', Object.keys(data));
console.log('Latitude:', data.lat);
console.log('Longitude:', data.lng);
console.log('Center:', data.center);
console.log('Analysis Radius:', data.analysisRadius);
console.log('Has raw incidents:', data.historicalIncidents ? data.historicalIncidents.length : 0);
console.log('Has coordinates array:', data.coordinates ? data.coordinates.length : 0);

if (data.coordinates) {
  console.log('First 5 coordinates:', data.coordinates.slice(0, 5));
}
if (data.center) {
  console.log('Center detail:', data.center);
}
// Let's search inside the entire object for any lat/lng fields
function searchLatLng(obj, pathStr = '') {
  if (!obj || typeof obj !== 'object') return;
  if (obj.lat !== undefined || obj.latitude !== undefined) {
    console.log(`Found lat at path: ${pathStr}`, obj.lat ?? obj.latitude, obj.lng ?? obj.longitude);
  }
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      searchLatLng(obj[k], pathStr ? `${pathStr}.${k}` : k);
    }
  }
}
searchLatLng(data);
