import { TranslationService } from "../translation";
import { getStorageAdapter } from "../../storage";

// Mock the storage adapter
jest.mock("../../storage", () => ({
  getStorageAdapter: jest.fn(() => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
}));

// Mock fetch
global.fetch = jest.fn();

describe("TranslationService", () => {
  let translationService: TranslationService;
  let mockStorage: any;
  const mockConfig = {
    apiKey: "test-api-key",
    targetLocale: "es",
    sourceLocale: "en",
    cacheTTL: 24,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    translationService = new TranslationService(mockConfig);
    mockStorage = getStorageAdapter();
  });

  describe("init", () => {
    it("should load translations from cache if available and not expired", async () => {
      const mockStorage = getStorageAdapter();
      const testText = "Hello";
      const testHash = translationService["generateHash"](testText);
      const mockCachedData = {
        timestamp: Date.now(),
        data: { [testHash]: "Hola" },
      };

      (mockStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockCachedData)
      );

      await translationService.init();

      expect(mockStorage.getItem).toHaveBeenCalledWith("autolocalise_es");
      expect(global.fetch).not.toHaveBeenCalled();

      const result = translationService.translate(testText, "button");
      expect(result).toBe("Hola");
    });

    it("should fetch fresh translations if cache is expired", async () => {
      const mockStorage = getStorageAdapter();
      const mockCachedData = {
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours old
        data: { hash1: "Hola" },
      };

      (mockStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockCachedData)
      );

      const newTranslations = { hash2: "Nuevo" };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve(newTranslations),
      });

      await translationService.init();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://civnjmlycaujxgcjzzyh.supabase.co/functions/v1/translations-s1",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiKey: mockConfig.apiKey,
            targetLocale: mockConfig.targetLocale,
          }),
        })
      );

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        "autolocalise_es",
        expect.stringContaining(JSON.stringify(newTranslations))
      );
    });
  });

  describe("translate", () => {
    it("should return cached translation if available", async () => {
      const mockStorage = getStorageAdapter();
      const testText = "Hello";
      const testHash = translationService["generateHash"](testText);
      const mockTranslation = "Hola";

      const mockCachedData = {
        timestamp: Date.now(),
        data: { [testHash]: mockTranslation },
      };

      (mockStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockCachedData)
      );

      await translationService.init();
      const result = translationService.translate(testText, "button");

      expect(result).toBe(mockTranslation);
    });

    it("should trigger API call for missing translations with type parameter", async () => {
      const testText = "Hello";
      const testHash = translationService["generateHash"](testText);

      jest.useFakeTimers();

      const mockTranslations = { [testHash]: "Hola" };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            translations: mockTranslations,
          }),
      });

      const result = translationService.translate(testText, "button");
      expect(result).toBe(testText); // Initially returns original text

      jest.runAllTimers(); // Trigger the batch translation
      await Promise.resolve(); // Wait for the async operation

      expect(global.fetch).toHaveBeenCalledWith(
        "https://civnjmlycaujxgcjzzyh.supabase.co/functions/v1/translate-s1",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            texts: [{ hashkey: testHash, text: testText, type: "button" }],
            sourceLocale: mockConfig.sourceLocale,
            targetLocale: mockConfig.targetLocale,
            apiKey: mockConfig.apiKey,
          }),
        })
      );

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        "translations_es",
        expect.stringContaining(JSON.stringify(mockTranslations))
      );

      // Verify that subsequent translation requests return the cached value
      const updatedResult = translationService.translate(testText);
      expect(updatedResult).toBe("Hola");
    });
  });
});
