const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'paseos_project_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('Project properties and types:');
for (const k in data) {
  const val = data[k];
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    console.log(`- ${k}: Object with keys: [${Object.keys(val).join(', ')}]`);
  } else if (Array.isArray(val)) {
    console.log(`- ${k}: Array with length: ${val.length}`);
  } else {
    console.log(`- ${k}: ${typeof val} = ${val}`);
  }
}
