describe("ADR-020.20 - OSINT / INEGI authoritative source reconciliation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.INEGI_DENUE_TOKEN = "test-denue-token";
    delete process.env.PGP_TELEGRAM_BOT_TOKEN;
    delete process.env.NEXT_PUBLIC_PGP_TELEGRAM_BOT_TOKEN;
    delete process.env.PGP_X_BEARER_TOKEN;
    delete process.env.NEXT_PUBLIC_PGP_X_BEARER_TOKEN;
    delete process.env.PGP_X_ACCESS_TOKEN;
    delete process.env.NEXT_PUBLIC_PGP_X_ACCESS_TOKEN;
    delete (global as any).fetch;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("TEST 1 DENUE has a single selected authoritative productive acquisition route", async () => {
    const { getSourceFamilyRoutes, selectAuthoritativeRoute } = await import("../src/lib/providers/sourceRegistry");

    const denueRoutes = getSourceFamilyRoutes("DENUE");
    const selected = denueRoutes.filter((route) => route.selectedForProductiveAcquisition);

    expect(selected).toHaveLength(1);
    expect(selectAuthoritativeRoute("DENUE")).toMatchObject({
      routeId: "inegi.denue.search",
      providerId: "inegi",
      action: "denue",
      authoritative: true,
      operationalMode: "AUTHORITATIVE_PRODUCTIVE",
      availability: "AVAILABLE",
    });
  });

  test("TEST 2 DENUE mock or legacy route cannot silently replace real DENUE", async () => {
    delete process.env.INEGI_DENUE_TOKEN;
    const { getSourceFamilyRoutes, selectAuthoritativeRoute } = await import("../src/lib/providers/sourceRegistry");

    const denueRoutes = getSourceFamilyRoutes("DENUE");

    expect(selectAuthoritativeRoute("DENUE")).toBeNull();
    expect(denueRoutes.filter((route) => route.selectedForProductiveAcquisition)).toHaveLength(0);
    expect(denueRoutes.find((route) => route.operationalMode === "CONNECTIVITY_ONLY")?.authoritative).toBe(false);
  });

  test("TEST 3 SCINCE local simulator remains non-authoritative and simulated", async () => {
    const { getSourceFamilyRoutes, selectAuthoritativeRoute } = await import("../src/lib/providers/sourceRegistry");

    const scinceSimulator = getSourceFamilyRoutes("SCINCE").find((route) => route.providerId === "SCINCE_LOCAL_SIMULATOR");

    expect(selectAuthoritativeRoute("SCINCE")).toBeNull();
    expect(scinceSimulator).toMatchObject({
      authoritative: false,
      operationalMode: "SIMULATED",
      selectedForProductiveAcquisition: false,
    });
  });

  test("TEST 4 Gemini synthesis is not an authoritative Telegram observation source", async () => {
    const { getSourceFamilyRoutes, classifyEpistemicSource } = await import("../src/lib/providers/sourceRegistry");

    const geminiRoute = getSourceFamilyRoutes("TELEGRAM").find((route) => route.providerId === "GEMINI");
    const classified = classifyEpistemicSource({
      providerId: "GEMINI",
      sourceType: "TELEGRAM_CONTEXT",
      acquisitionMode: "AI_GENERATED",
    });

    expect(geminiRoute).toMatchObject({
      sourceType: "TELEGRAM_CONTEXT",
      authoritative: false,
      operationalMode: "AI_GENERATED",
      selectedForProductiveAcquisition: false,
    });
    expect(classified?.routeId).toBe("gemini.telegram-context-synthesis");
  });

  test("TEST 5 connectivity healthcheck is never authoritative intelligence", async () => {
    const { classifyEpistemicSource, getSourceFamilyRoutes } = await import("../src/lib/providers/sourceRegistry");

    expect(getSourceFamilyRoutes("OSINT_CONNECTIVITY")[0]).toMatchObject({
      authoritative: false,
      operationalMode: "CONNECTIVITY_ONLY",
    });
    expect(
      classifyEpistemicSource({
        providerId: "CEIPOL_OSINT_CONNECTIVITY",
        sourceType: "CONNECTIVITY_HEALTHCHECK",
        acquisitionMode: "CONNECTIVITY_ONLY",
      })?.authoritative
    ).toBe(false);
  });

  test("TEST 6 social provider without credentials returns NOT_CONFIGURED without observed fallback", async () => {
    const { XProvider } = await import("../src/lib/providers/xProvider");
    (global as any).fetch = jest.fn();

    const result = await new XProvider().fetchData({
      lat: 21.8818,
      lng: -102.2916,
      query: "Aguascalientes",
    });

    expect(result.status).toBe("disabled");
    expect(result.metadata).toMatchObject({
      sourceFamily: "X",
      operationalMode: "NOT_CONFIGURED",
      acquisitionStatus: "NOT_CONFIGURED",
      authoritative: false,
    });
    expect(result.payload).toBeNull();
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  test("TEST 7 productive consumer selection chooses the authoritative DENUE route", async () => {
    const { ApiOrchestrator } = await import("../src/lib/providers/orchestrator");
    const orchestrator = new ApiOrchestrator();

    const route = orchestrator.selectAuthoritativeRoute("DENUE");

    expect(route).toMatchObject({
      providerId: "inegi",
      action: "denue",
      authoritative: true,
      operationalMode: "AUTHORITATIVE_PRODUCTIVE",
    });
    expect(orchestrator.selectAuthoritativeRoute("SCINCE")).toBeNull();
    expect(orchestrator.selectAuthoritativeRoute("TELEGRAM")).toBeNull();
  });

  test("TEST 8 authoritative DENUE failure does not fall back to simulator as real", async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => [],
      text: async () => "",
    });
    const { ApiOrchestrator } = await import("../src/lib/providers/orchestrator");
    const orchestrator = new ApiOrchestrator();

    const result = await orchestrator.executeAuthoritative(
      "DENUE",
      { lat: 21.8818, lng: -102.2916, radio: 350 },
      1000
    );

    expect(result.provider).toBe("inegi");
    expect(result.status).toBe("ok");
    expect(result.payload?.payload?.epistemicIntegrity?.acquisitionStatus).toBe("FAILED");
    expect(result.metadata).toMatchObject({
      sourceFamily: "DENUE",
      routeId: "inegi.denue.search",
      operationalMode: "AUTHORITATIVE_PRODUCTIVE",
      authoritative: true,
    });
    expect(JSON.stringify(result)).not.toContain("SCINCE_LOCAL_SIMULATOR");
  });
});
