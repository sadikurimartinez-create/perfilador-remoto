import { runTerritorialEngineTests } from "../src/utils/territorialIntelligenceEngine/tests/territorialEngine.test";

try {
  runTerritorialEngineTests();
  process.exit(0);
} catch (error) {
  console.error("❌ Error running territorial engine tests:", error);
  process.exit(1);
}
