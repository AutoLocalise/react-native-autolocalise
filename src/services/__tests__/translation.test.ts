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
  const mockConfig = {
    apiKey: "test-api-key",
    locale: "es",
    fallbackLocale: "en",
    projectId: "test-project",
    cacheTTL: 24,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    translationService = new TranslationService(mockConfig);
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

      expect(mockStorage.getItem).toHaveBeenCalledWith("translations_es");
      expect(global.fetch).not.toHaveBeenCalled();

      const result = translationService.translate(testText);
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
        "https://api.example.com/translations?locale=es",
        expect.any(Object)
      );

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        "translations_es",
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
      const result = translationService.translate(testText);

      expect(result).toBe(mockTranslation);
    });

    it("should trigger API call for missing translations", async () => {
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

      const result = translationService.translate(testText);
      expect(result).toBe(testText); // Initially returns original text

      jest.runAllTimers(); // Trigger the batch translation
      await Promise.resolve(); // Wait for the async operation

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/translate",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(testText),
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
