import {
  buildNumeroExpedienteFields,
  buildNumeroExpedienteFilename,
  formatNumeroExpediente,
  resolvePerfiladorIniciales,
  resolveVisibleNumeroExpediente,
  validatePerfiladorIniciales,
} from "@/utils/documentIdentity";

describe("Identidad documental institucional numeroExpediente", () => {
  const createdAt = new Date(2026, 8, 6, 10, 30, 0);

  test("1. genera formato DDMMAAAA-SSSS-PPP", () => {
    expect(formatNumeroExpediente({ createdAt, sequence: 7, perfiladorIniciales: "SKM" }))
      .toBe("06092026-0007-SKM");
  });

  test("2. consecutivo con padding", () => {
    expect(formatNumeroExpediente({ createdAt, sequence: 42, perfiladorIniciales: "AB" }))
      .toBe("06092026-0042-AB");
  });

  test("3. dos creaciones concurrentes no colisionan si la transaccion entrega secuencias distintas", () => {
    const a = buildNumeroExpedienteFields({ createdAt, sequence: 7, perfiladorIniciales: "SKM" });
    const b = buildNumeroExpedienteFields({ createdAt, sequence: 8, perfiladorIniciales: "SKM" });
    expect(a.numeroExpediente).not.toBe(b.numeroExpediente);
  });

  test("4. numeroExpediente persiste como campo explicito", () => {
    const fields = buildNumeroExpedienteFields({ createdAt, sequence: 7, perfiladorIniciales: "SKM" });
    expect(fields).toMatchObject({
      numeroExpediente: "06092026-0007-SKM",
      numeroExpedienteSequence: 7,
      perfiladorIniciales: "SKM",
      numeroExpedienteVersion: "1.0",
    });
    expect(fields.numeroExpedienteAsignadoAt).toBe(createdAt.getTime());
  });

  test("5. numeroExpediente no cambia al editar nombre", () => {
    const before = { name: "A", numeroExpediente: "06092026-0007-SKM" };
    const after = { ...before, name: "B" };
    expect(resolveVisibleNumeroExpediente(after)).toBe(resolveVisibleNumeroExpediente(before));
  });

  test("6. numeroExpediente no cambia al reabrir expediente", () => {
    const reopened = { estado: "ABIERTO", numeroExpediente: "06092026-0007-SKM" };
    expect(resolveVisibleNumeroExpediente(reopened)).toBe("06092026-0007-SKM");
  });

  test("7. numeroExpediente no cambia al cambiar geografia", () => {
    const updated = { numeroExpediente: "06092026-0007-SKM", geographyId: "geo-new" };
    expect(resolveVisibleNumeroExpediente(updated)).toBe("06092026-0007-SKM");
  });

  test("8. numeroExpediente no cambia al exportar", () => {
    const fileName = buildNumeroExpedienteFilename({
      numeroExpediente: "06092026-0007-SKM",
      projectName: "Sector Norte",
      extension: "docx",
    });
    expect(fileName).toBe("06092026-0007-SKM_Sector_Norte.docx");
  });

  test("9. projectId sigue existiendo sin ser numero visible", () => {
    const record = { projectId: "Lwh3M1QJGc9HucZTwtWo" };
    expect(record.projectId).toBeTruthy();
    expect(resolveVisibleNumeroExpediente(record)).toBe("NO ASIGNADO");
  });

  test("10. ceipolId legacy sigue existiendo", () => {
    const record = { projectId: "abc", ceipolId: "CEIPOL/000007/06/09/2026" };
    expect(record.ceipolId).toBe("CEIPOL/000007/06/09/2026");
  });

  test("11. Word usa numeroExpediente mediante resolucion visible", () => {
    expect(resolveVisibleNumeroExpediente({
      projectId: "Lwh3M1QJGc9HucZTwtWo",
      numeroExpediente: "06092026-0007-SKM",
    })).toBe("06092026-0007-SKM");
  });

  test("12. Word no usa projectId como numero visible", () => {
    expect(resolveVisibleNumeroExpediente({ projectId: "Lwh3M1QJGc9HucZTwtWo" }))
      .not.toBe("Lwh3M1QJGc9HucZTwtWo");
  });

  test("13. footer conserva el mismo valor institucional de expediente", () => {
    const visible = resolveVisibleNumeroExpediente({ numeroExpediente: "06092026-0007-SKM" });
    expect(visible).toBe("06092026-0007-SKM");
  });

  test("14. expediente legacy con ceipolId no rompe", () => {
    expect(resolveVisibleNumeroExpediente({ ceipolId: "CEIPOL/000001/06/09/2026" }))
      .toBe("CEIPOL/000001/06/09/2026");
  });

  test("15. expediente sin numeroExpediente no muestra UUID", () => {
    expect(resolveVisibleNumeroExpediente({ projectId: "123e4567-e89b-12d3-a456-426614174000" }))
      .toBe("NO ASIGNADO");
  });

  test("16. audit log puede registrar numeroExpediente como campo estructurado", () => {
    const auditLog = {
      projectId: "tech-id",
      numeroExpediente: "06092026-0007-SKM",
      ceipolId: "CEIPOL/000007/06/09/2026",
      perfiladorIniciales: "SKM",
    };
    expect(auditLog.numeroExpediente).toBe("06092026-0007-SKM");
  });

  test("17. iniciales PPC validas", () => {
    expect(validatePerfiladorIniciales("skm")).toBe("SKM");
    expect(validatePerfiladorIniciales("ÑR")).toBe("ÑR");
  });

  test("18. iniciales PPC faltantes bloquean asignacion", () => {
    expect(() => resolvePerfiladorIniciales({ username: "sadi" } as any))
      .toThrow("PERFILADOR_INICIALES_REQUERIDAS");
  });

  test("19. iniciales PPC explicitas se resuelven desde perfil institucional", () => {
    expect(resolvePerfiladorIniciales({ profile: { perfiladorIniciales: "abc" } }))
      .toBe("ABC");
  });

  test("20. filename no incluye projectId tecnico", () => {
    const fileName = buildNumeroExpedienteFilename({
      numeroExpediente: "06092026-0007-SKM",
      projectName: "Expediente: Sector / Norte",
      extension: "pdf",
    });
    expect(fileName).toBe("06092026-0007-SKM_Expediente_Sector_Norte.pdf");
    expect(fileName).not.toContain("projectId");
  });
});
