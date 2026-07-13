const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'paseos_project_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let hasHora = 0;
let hasHoraUpper = 0;
for (const item of data.incidents) {
  if (item.hora !== undefined) hasHora++;
  if (item.HORA !== undefined) hasHoraUpper++;
}

console.log('Total incidents:', data.incidents.length);
console.log('Incidents with "hora":', hasHora);
console.log('Incidents with "HORA":', hasHoraUpper);
console.log('Keys of sample incident:', Object.keys(data.incidents[0]));
