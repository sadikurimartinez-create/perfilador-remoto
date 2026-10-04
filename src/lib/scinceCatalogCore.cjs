const {createHash} = require('node:crypto');
const catalog = require('../data/scince/inegi-cpv2020-catalog.json');
const NORMALIZATION_VERSION = 'SCINCE_TYPED_NORMALIZATION_V1';
const legacyCodes = Object.freeze({populationTotal:'POBTOT',housingTotal:'VIVTOT',inhabitedPrivateHousing:'VIVPAR_HAB',uninhabitedPrivateHousing:'VIVPAR_DES'});
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
const fingerprint = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const catalogFingerprint = fingerprint(catalog);
function available(variable,level) { return variable.availableLevels==='AMBAS' || variable.availableLevels===level; }
function parseTypedValue(raw,variable,level) {
  const rawValue = raw == null ? null : String(raw);
  const result=(valueStatus,typedValue=null,nullReason=valueStatus)=>({rawValue,typedValue,valueStatus,nullReason});
  if (!available(variable,level)) return result('NOT_AVAILABLE',null,'VARIABLE_NOT_PUBLISHED_AT_LEVEL');
  if (rawValue===null || rawValue.trim()==='') return result('MISSING');
  const token=rawValue.trim();
  if (token==='*') return result('SUPPRESSED',null,'INEGI_CONFIDENTIALITY');
  if (token==='N/D') return result('NOT_AVAILABLE',null,'INEGI_NOT_COLLECTED');
  if (['N/A','NA','NO APLICA'].includes(token.toUpperCase())) return result('NOT_APPLICABLE');
  if (['IDENTIFIER','CATEGORICAL'].includes(variable.statisticalType)) return result('VALUE',token,null);
  if (variable.statisticalType==='UNKNOWN') return result('INVALID_SOURCE_VALUE',null,'UNACCREDITED_STATISTICAL_TYPE');
  // Official COUNT cells sometimes encode a true zero as 0.00. Fractional people remain invalid.
  const pattern=variable.statisticalType==='COUNT'?/^\d+(?:\.0+)?$/:/^\d+(?:\.\d+)?$/;
  const value=Number(token);
  if (!pattern.test(token) || !Number.isFinite(value) || value<0 || value>999999999 ||
      variable.statisticalType==='COUNT' && !Number.isSafeInteger(value) || variable.statisticalType==='PERCENTAGE' && value>100)
    return result('INVALID_SOURCE_VALUE',null,'STRICT_NUMERIC_PARSE_FAILED');
  return result(value===0?'ZERO':'VALUE',value,null);
}
function normalizeRow(row,level,sourceRowKey,variables=catalog.variables) {
  return variables.map(variable=>({variableCode:variable.variableCode,geographicLevel:level,sourceRowKey,
    ...parseTypedValue(row[variable.variableCode],variable,level)}));
}
function validateHeader(header) {
  const names=header.map(x=>String(x).trim());
  if (new Set(names).size!==names.length || names.length!==catalog.variables.length ||
      catalog.variables.some(v=>!names.includes(v.variableCode))) throw new Error('SCINCE_CATALOG_SCHEMA_DRIFT');
  return names;
}
function legacyCounts(row,level) {
  return Object.fromEntries(Object.entries(legacyCodes).map(([name,code])=>[name,
    parseTypedValue(row[code],catalog.variables.find(v=>v.variableCode===code),level).typedValue]));
}
module.exports={catalog,NORMALIZATION_VERSION,legacyCodes,catalogFingerprint,fingerprint,available,parseTypedValue,normalizeRow,validateHeader,legacyCounts};
