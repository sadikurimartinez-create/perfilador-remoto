jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const originalEnv = {
  bearer: process.env.PGP_REDDIT_BEARER_TOKEN,
  bearerAlias: process.env.REDDIT_BEARER_TOKEN,
  userAgent: process.env.PGP_REDDIT_USER_AGENT,
  enabled: process.env.ENABLE_REDDIT,
};

afterAll(() => {
  for (const [name, value] of Object.entries({
    PGP_REDDIT_BEARER_TOKEN: originalEnv.bearer,
    REDDIT_BEARER_TOKEN: originalEnv.bearerAlias,
    PGP_REDDIT_USER_AGENT: originalEnv.userAgent,
    ENABLE_REDDIT: originalEnv.enabled,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

beforeEach(() => {
  jest.restoreAllMocks();
  jest.resetModules();
  delete process.env.PGP_REDDIT_BEARER_TOKEN;
  delete process.env.REDDIT_BEARER_TOKEN;
  delete process.env.PGP_REDDIT_USER_AGENT;
  delete process.env.ENABLE_REDDIT;
});

test("missing Bearer is NOT_CONFIGURED without any public reachability check", async () => {
  const publicFetch = jest.spyOn(global, "fetch").mockImplementation(jest.fn());
  const dynamicAxios = (await import("axios")).default;
  const { RedditProvider } = await import("../src/lib/providers/redditProvider");
  const provider = new RedditProvider();

  const health = await provider.healthCheck();
  expect(health).toMatchObject({ isHealthy: false, authenticationStatus: "unknown", availability: 0 });
  expect(health.details).toContain("not configured");

  const result = await provider.fetchData({ lat: 21.8818, lng: -102.2916, query: "Aguascalientes" });
  expect(result).toMatchObject({
    status: "disabled",
    confidence: 0,
    payload: null,
    metadata: { operationalMode: "NOT_CONFIGURED", acquisitionStatus: "NOT_CONFIGURED" },
  });
  expect(dynamicAxios.get).not.toHaveBeenCalled();
  expect(publicFetch).not.toHaveBeenCalled();
});

test("configured Bearer uses the existing OAuth search for health and acquisition", async () => {
  process.env.REDDIT_BEARER_TOKEN = "test-reddit-bearer";
  process.env.PGP_REDDIT_USER_AGENT = "CEIPOL-Test/1.0";
  const publicFetch = jest.spyOn(global, "fetch").mockImplementation(jest.fn());
  const dynamicAxios = (await import("axios")).default;
  (dynamicAxios.get as jest.Mock).mockResolvedValue({ data: { data: { children: [] } } });
  const { RedditProvider } = await import("../src/lib/providers/redditProvider");
  const provider = new RedditProvider();

  await expect(provider.healthCheck()).resolves.toMatchObject({
    isHealthy: true,
    authenticationStatus: "valid",
    availability: 100,
    recordsCount: 0,
  });
  await expect(provider.fetchData({ lat: 21.8818, lng: -102.2916, query: "Aguascalientes" }))
    .resolves.toMatchObject({ status: "ok" });
  expect(dynamicAxios.get).toHaveBeenCalledTimes(2);
  for (const [url, options] of (dynamicAxios.get as jest.Mock).mock.calls) {
    expect(url).toContain("https://oauth.reddit.com/search?q=");
    expect(options.headers).toMatchObject({
      Authorization: "Bearer test-reddit-bearer",
      "User-Agent": "CEIPOL-Test/1.0",
    });
  }
  expect(publicFetch).not.toHaveBeenCalled();
});

test("rejected OAuth health check does not fall back to public reachability", async () => {
  process.env.PGP_REDDIT_BEARER_TOKEN = "rejected-test-bearer";
  const publicFetch = jest.spyOn(global, "fetch").mockImplementation(jest.fn());
  const dynamicAxios = (await import("axios")).default;
  (dynamicAxios.get as jest.Mock).mockRejectedValue({ response: { status: 401 } });
  const { RedditProvider } = await import("../src/lib/providers/redditProvider");

  await expect(new RedditProvider().healthCheck()).resolves.toMatchObject({
    isHealthy: false,
    authenticationStatus: "invalid",
    availability: 0,
  });
  expect(dynamicAxios.get).toHaveBeenCalledTimes(1);
  expect(publicFetch).not.toHaveBeenCalled();
});
