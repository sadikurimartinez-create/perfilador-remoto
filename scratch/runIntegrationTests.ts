import { runIntegrationContractTests } from "../src/utils/intelligenceIntegrationContract/tests/intelligenceContext.test";

// Ejecutar pruebas unitarias de integración (IIC)
try {
  runIntegrationContractTests();
  process.exit(0);
} catch (error) {
  console.error("❌ ERROR CRÍTICO AL EJECUTAR PRUEBAS UNITARIAS DE INTEGRACIÓN:", error);
  process.exit(1);
}
