/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",

  roots: [
    "<rootDir>/tests",
    "<rootDir>/src"
  ],

  testMatch: [
    "**/*.test.ts"
  ],

  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",

    // Legacy suites executed through tests/run.ts
    "/tests/authHardening\\.test\\.ts$",
    "/tests/reportEngineIICMigration\\.test\\.ts$",
    "/tests/testADR01913Governance\\.test\\.ts$",
    "/tests/testADR01915Geointegrity\\.test\\.ts$",
    "/tests/testADR01917Connectivity\\.test\\.ts$",
    "/tests/testADR01919Fingerprint\\.test\\.ts$",

    "/src/utils/analyticalConsistencyEngine/tests/ace\\.test\\.ts$",
    "/src/utils/analyticalConsistencyEngine/tests/aceGimIntegration\\.test\\.ts$",
    "/src/utils/analyticalConsistencyEngine/tests/reportGimIntegration\\.test\\.ts$",

    "/src/utils/intelligenceIntegrationContract/tests/iic_gim_integration\\.test\\.ts$",
    "/src/utils/intelligenceIntegrationContract/tests/intelligenceContext\\.test\\.ts$",

    "/src/utils/statisticalEvidenceMatrix/tests/sem\\.test\\.ts$",
    "/src/utils/statisticalIntelligenceEngineV2/tests/statisticalEngine\\.test\\.ts$",
    "/src/utils/territorialIntelligenceEngine/tests/territorialEngine\\.test\\.ts$",
    "/src/utils/visualEvidenceEngine/tests/visualEvidence\\.test\\.ts$"
  ],

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  transform: {
    "^.+\\.tsx?$": ["ts-jest", {}],
  },
};
