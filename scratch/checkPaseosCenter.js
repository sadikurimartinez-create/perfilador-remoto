const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'paseos_project_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('Project keys other than sweeps and incidents:');
for (const k of Object.keys(data)) {
  if (k === 'sweeps' || k === 'incidents') {
    console.log(`- ${k}: [OMITTED Array of ${data[k].length} items]`);
  } else {
    console.log(`- ${k}: (${typeof data[k]}) ${JSON.stringify(data[k], null, 2)}`);
  }
}
