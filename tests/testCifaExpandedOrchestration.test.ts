const mockSearchNewsApi = jest.fn();
const mockSearchGdeltDocuments = jest.fn();
const mockSearchGdeltContext = jest.fn();
const mockSearchGdeltGeo = jest.fn();
const mockSearchBluesky = jest.fn();
const mockSearchFediverse = jest.fn();
const mockSearchOfficialCeipolSources = jest.fn();
const mockRunMultiSourceCorrelation = jest.fn();

jest.mock("../src/utils/cifaExpandedProviders", () => ({
  searchNewsApi: mockSearchNewsApi,
  searchGdeltDocuments: mockSearchGdeltDocuments,
  searchGdeltContext: mockSearchGdeltContext,
  searchGdeltGeo: mockSearchGdeltGeo,
  searchBluesky: mockSearchBluesky,
  searchFediverse: mockSearchFediverse,
  searchOfficialCeipolSources: mockSearchOfficialCeipolSources,
  getProviderCollectionMetadata: (value: any) => value?.providerMetadata,
  getProviderCollectionStatus: (value: any, count: number) => value?.acquisitionStatus ?? (count > 0 ? "ACQUIRED" : "NO_DATA"),
}));

jest.mock("../src/utils/osintProviders", () => ({ searchSerpAPI: jest.fn(), searchYouTubeOSINT: jest.fn() }));
jest.mock("../src/utils/socialProviders", () => ({
  analyzeStreetViewWithGemini: jest.fn(), buscarEnWebOSINT: jest.fn(), searchReddit: jest.fn(),
  searchTelegram: jest.fn(), searchX: jest.fn(),
}));
jest.mock("../src/utils/urbanProviders", () => ({
  getOverpassSourceReference: () => "https://overpass.example", searchGooglePlaces: jest.fn(), searchOverpass: jest.fn(),
}));
jest.mock("../src/modules/drive-ingestion/drive-ingestion.engine", () => ({
  DriveIngestionEngine: { getIngestedIntelligence: jest.fn() },
}));
jest.mock("../src/utils/mcmCorrelation", () => ({ runMultiSourceCorrelation: mockRunMultiSourceCorrelation }));
jest.mock("../src/utils/imfoService", () => ({
  autoDiscoverSource: jest.fn().mockResolvedValue(undefined),
  logLearningAction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../src/lib/osintSources", () => ({ getRegionalRSSFeeds: jest.fn().mockReturnValue([]) }));
jest.mock("../src/lib/osintActions", () => ({ getDenueData: jest.fn() }));

import { runUnifiedCifaScan } from "../src/utils/cifaEngine";

function providerItems(items: any[], status?: string) {
  return Object.assign(items, {
    acquisitionStatus: status,
    providerMetadata: {
      originalQuery: "Aguascalientes operativo OR robo",
      providerQuery: "Aguascalientes operativo robo",
      requestedLimit: 20,
      returnedCount: items.length,
      truncated: false,
    },
  });
}

describe("CIFA expanded multisource orchestration", () => {
  const originalNewsToken = process.env.NEWS_API_TOKEN;

  beforeEach(() => {
    process.env.NEWS_API_TOKEN = "test-news-token";
    jest.clearAllMocks();
    const commonArticle = {
      title: "Operativo oficial",
      sourceUrl: "https://media.example/article?utm_source=provider",
      publishedAt: "2026-09-20T10:00:00Z",
      providerQuery: "Aguascalientes operativo robo",
    };
    mockSearchNewsApi.mockResolvedValue(providerItems([{ ...commonArticle, sourceName: "NewsAPI" }]));
    mockSearchGdeltDocuments.mockResolvedValue(providerItems([{ ...commonArticle, sourceName: "GDELT" }]));
    mockSearchGdeltContext.mockResolvedValue(providerItems([]));
    mockSearchGdeltGeo.mockResolvedValue(providerItems([{
      id: "geo", title: "Aguascalientes", locationName: "Aguascalientes",
      locationRole: "MENTIONED_LOCATION", eventLocation: null,
      geometry: { type: "Point", coordinates: [-102.29, 21.88] },
      sourceName: "GDELT GEO", sourceUrl: null, publishedAt: null,
      providerQuery: "Aguascalientes operativo OR robo",
    }]));
    mockSearchBluesky.mockResolvedValue(providerItems([{
      id: "at://post", text: "Operativo observado", sourceName: "Bluesky",
      sourceUrl: "https://bsky.app/profile/a/post/1", publishedAt: null,
      providerQuery: "Aguascalientes operativo robo",
    }]));
    mockSearchFediverse.mockResolvedValue(providerItems([{
      id: "mastodon-1", text: "Reporte federado", sourceName: "Instancia",
      sourceUrl: "https://instance.example/@a/1", publishedAt: null,
      providerQuery: "Aguascalientes operativo robo",
    }], "PARTIAL"));
    mockSearchOfficialCeipolSources.mockResolvedValue(providerItems([{
      ...commonArticle, sourceName: "Gobierno de Aguascalientes",
      sourceUrl: "https://media.example/article",
    }]));
    mockRunMultiSourceCorrelation.mockResolvedValue({
      correlatedEntities: [], updatedHypothesis: null, chronology: [],
      graphData: { nodes: [], links: [] }, deduplicatedCount: 0, success: true,
    });
  });

  afterAll(() => {
    if (originalNewsToken === undefined) delete process.env.NEWS_API_TOKEN;
    else process.env.NEWS_API_TOKEN = originalNewsToken;
  });

  test("executes the seven governed families, deduplicates media and preserves PARTIAL metrics", async () => {
    const result = await runUnifiedCifaScan(
      { id: "project", locationName: "Aguascalientes" },
      ["news_api", "gdelt_doc", "gdelt_context", "gdelt_geo", "bluesky", "fediverse", "official_ceipol"],
      "Aguascalientes operativo OR robo"
    );

    expect(result.sourceResults.map((item) => [item.sourceKey, item.acquisitionStatus])).toEqual([
      ["news_api", "ACQUIRED"],
      ["gdelt_doc", "ACQUIRED"],
      ["gdelt_context", "NO_DATA"],
      ["gdelt_geo", "ACQUIRED"],
      ["bluesky", "ACQUIRED"],
      ["fediverse", "PARTIAL"],
      ["official_ceipol", "ACQUIRED"],
    ]);
    expect(result).toMatchObject({
      success: true,
      institutionalUse: "PARTIAL_PRODUCTIVE",
      deduplication: { inputCount: 3, outputCount: 1, duplicatesCollapsed: 2 },
      coveragePanel: {
        sourcesRequested: 7, sourcesApplicable: 7, sourcesConfigured: 7,
        sourcesExecuted: 7, sourcesResponded: 7, sourcesWithData: 6,
        sourcesNoData: 1, sourcesPartial: 1, resultsAcquired: 6,
      },
    });
    expect(result.rawResults.deduplicatedNews[0].sourceObservations).toHaveLength(3);
    expect(result.rawResults.gdeltGeo[0]).toMatchObject({ locationRole: "MENTIONED_LOCATION", eventLocation: null });
    expect(mockRunMultiSourceCorrelation).toHaveBeenCalledWith(expect.objectContaining({
      deduplicatedNews: expect.any(Array), expandedSocial: expect.any(Array), gdeltGeo: expect.any(Array),
    }), expect.any(Object));
    expect(result.sourceResults.every((item) => item.isSimulated === false)).toBe(true);
  });
});
