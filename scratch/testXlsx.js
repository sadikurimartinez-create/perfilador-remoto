const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

try {
  const xlsxPath = path.join(__dirname, '..', 'INVENTARIO PANDILLAS.xlsx');
  console.log('Reading from:', xlsxPath);
  const fileBuffer = fs.readFileSync(xlsxPath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  console.log('Sheet Name:', sheetName);
  const sheet = workbook.Sheets[sheetName];
  const rawAoA = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log('Total rows:', rawAoA.length);
  
  console.log('\nRow 0 (Main headers):', rawAoA[0]);
  console.log('\nRow 1 (Sub headers):', rawAoA[1]);
  console.log('\nRow 2 (First data row):', rawAoA[2]);
  console.log('\nRow 3 (Second data row):', rawAoA[3]);

} catch (e) {
  console.error('Error reading XLSX:', e);
}
