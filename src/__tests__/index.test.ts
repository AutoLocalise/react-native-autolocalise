import autoTranslate from "../autoTranslate";

const mockStorageAdapter = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

jest.mock("../storage", () => ({
  getStorageAdapter: jest.fn(() => mockStorageAdapter),
}));

global.fetch = jest.fn();

describe("autoTranslate.init", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockStorageAdapter.getItem as jest.Mock).mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      statusText: "OK",
      json: () => Promise.resolve({}),
    });
  });

  it("returns an initialized service that can translate", async () => {
    const service = await autoTranslate.init({
      apiKey: "test-api-key",
      sourceLocale: "en",
      targetLocale: "es",
    });

    expect(service.isInitialized).toBe(true);
    expect(service.translate("Hello")).toBe("Hello");
  });
});
