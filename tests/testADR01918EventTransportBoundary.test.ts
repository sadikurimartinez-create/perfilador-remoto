import { resolveGeointEventTransport } from "@/services/geoint/logGeointEvent";

describe("ADR-019.18 event transport boundary", () => {
  test("Node runtime uses the server Outbox adapter", () => {
    expect(resolveGeointEventTransport({})).toBe("SERVER_OUTBOX");
  });

  test("an incomplete window object is never treated as a browser", () => {
    expect(resolveGeointEventTransport({ window: {} })).toBe("SERVER_OUTBOX");
  });

  test("a browser with an HTTP origin uses the relative API transport", () => {
    expect(resolveGeointEventTransport({
      window: {
        document: {},
        location: { protocol: "https:" },
        fetch: () => undefined,
      },
    })).toBe("BROWSER_API");
  });
});