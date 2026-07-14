import { runIntegrationContractTests } from "../src/utils/intelligenceIntegrationContract/tests/intelligenceContext.test";

try {
  runIntegrationContractTests();
  process.exit(0);
} catch (error) {
  console.error("❌ ERROR CRÍTICO AL EJECUTAR PRUEBAS DE INTEGRACIÓN (ADR-007.1):", error);
  process.exit(1);
}
