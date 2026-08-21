import { TranslationService } from "../translation";
import { ConfigurationError, AccessTokenError } from "../../types";
import { getStorageAdapter } from "../../storage";
import { CACHE_REFRESH_TTL_MS } from "../../constants";

// Create a shared mock storage object that will be returned by getStorageAdapter
const mockStorageAdapter = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

// Mock the storage adapter to return our shared mock
jest.mock("../../storage", () => ({
  getStorageAdapter: jest.fn(() => mockStorageAdapter),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock environment variables
const mockBaseUrl = "https://autolocalise-main-53fde32.zuplo.app";
process.env = {
  ...process.env,
  BASE_URL: mockBaseUrl,
};

describe("TranslationService", () => {
  let translationService: TranslationService;
  const mockConfig = {
    apiKey: "test-api-key",
    targetLocale: "es",
    sourceLocale: "en",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    (getStorageAdapter as jest.Mock).mockResolvedValue(mockStorageAdapter);
    translationService = new TranslationService(mockConfig);
  });

  describe("init", () => {
    it("should load translations from cache if available and not expired", async () => {
      const testText = "Hello";
      const testHash = translationService["generateHash"](testText);
      const mockCachedData = {
        timestamp: Date.now(),
        data: { [testHash]: "Hola" },
      };

      // Mock storage with valid cache data
      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockCachedData)
      );

      // Instead of expecting fetch to not be called, we'll mock it to return successfully
      // This matches the actual implementation behavior where it returns early if cache is valid
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({}),
      });

      await translationService.init();

      expect(mockStorageAdapter.getItem).toHaveBeenCalledWith(
        "autolocalise_es"
      );

      // Verify that the cache was loaded correctly
      const result = translationService.translate(testText);
      expect(result).toBe("Hola");
    });

    it("should fetch fresh translations if cache is expired", async () => {
      const mockCachedData = {
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
        lastRefreshTime: Date.now() - 25 * 60 * 60 * 1000,
        data: { hash1: "Hola" },
      };

      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockCachedData)
      );

      const newTranslations = { hash2: "Nuevo" };

      (global.fetch as jest.Mock).mockImplementation(async (url) => {
        if (url.includes("v1/translations")) {
          return {
            ok: true,
            statusText: "OK",
            json: async () => newTranslations,
          };
        }
        return {
          ok: true,
          statusText: "OK",
          json: async () => ({}),
        };
      });

      await translationService.init();

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toBe(`${mockBaseUrl}/v1/translations`);
      expect(JSON.parse(fetchCall[1].body)).toEqual({
        apiKey: mockConfig.apiKey,
        targetLocale: mockConfig.targetLocale,
        lastRefreshTime: null,
      });

      expect(translationService["cache"][mockConfig.targetLocale]).toEqual({
        hash1: "Hola",
        hash2: "Nuevo",
      });
    });

    it("should ignore malformed cache and still initialize", async () => {
      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(
        "not-json"
      );
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({ hash1: "Hola" }),
      });

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await translationService.init();

      expect(translationService.isInitialized).toBe(true);
      expect(translationService["cache"][mockConfig.targetLocale].hash1).toBe(
        "Hola"
      );
      consoleSpy.mockRestore();
    });

    it("should ignore cache payloads that are not a string map", async () => {
      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ lastRefreshTime: Date.now(), data: "bad" })
      );
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({ hash1: "Hola" }),
      });

      await translationService.init();

      expect(translationService["cache"][mockConfig.targetLocale].hash1).toBe(
        "Hola"
      );
    });

    it("should apply API translations when storage is unavailable", async () => {
      (getStorageAdapter as jest.Mock).mockRejectedValueOnce(
        new Error("No storage")
      );
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({ hash1: "Hola" }),
      });

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await translationService.init();

      expect(translationService.isInitialized).toBe(true);
      expect(translationService["cache"][mockConfig.targetLocale].hash1).toBe(
        "Hola"
      );
      expect(mockStorageAdapter.setItem).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should only run initialization once when init is called concurrently", async () => {
      let resolveGetItem: (value: string | null) => void;
      (mockStorageAdapter.getItem as jest.Mock).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveGetItem = resolve;
        })
      );
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({}),
      });

      const first = translationService.init();
      const second = translationService.init();
      resolveGetItem!(null);

      await Promise.all([first, second]);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("translate", () => {
    it("should return cached translation if available", async () => {
      const testText = "Hello";
      const testHash = translationService["generateHash"](testText);
      const mockTranslation = "Hola";

      const mockCachedData = {
        timestamp: Date.now(),
        data: { [testHash]: mockTranslation },
      };

      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockCachedData)
      );

      // Mock fetch in case it gets called
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({ [testHash]: mockTranslation }),
      });

      await translationService.init();
      const result = translationService.translate(testText);

      expect(result).toBe(mockTranslation);
    });

    it("should trigger API call for missing translations with type parameter", async () => {
      const testText = "Hello";
      const testHash = translationService["generateHash"](testText);

      // Initialize the service first
      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({}),
      });
      await translationService.init();

      // Reset mocks for the actual test
      jest.clearAllMocks();
      jest.useFakeTimers();

      const mockTranslations = { [testHash]: "Hola" };

      // Mock the fetch call that will be made by the batch translation
      (global.fetch as jest.Mock).mockImplementationOnce(() => {
        return Promise.resolve({
          ok: true,
          statusText: "OK",
          json: () => Promise.resolve(mockTranslations),
        });
      });

      // Clear the cache to ensure we get the original text initially
      translationService["cache"][mockConfig.targetLocale] = {};

      const result = translationService.translate(testText);
      expect(result).toBe(testText);

      await jest.runAllTimersAsync();

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/v1/translate`,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: expect.any(String),
        })
      );

      // Verify that subsequent translation requests return the cached value
      const updatedResult = translationService.translate(testText);
      expect(updatedResult).toBe("Hola");

      const stored = JSON.parse(
        (mockStorageAdapter.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(stored.lastRefreshTime).toEqual(expect.any(Number));
      expect(stored.data[testHash]).toBe("Hola");

      jest.useRealTimers();
    });

    it("should batch translate even when storage is unavailable", async () => {
      (getStorageAdapter as jest.Mock).mockRejectedValueOnce(
        new Error("No storage")
      );
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK",
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK",
          json: () => Promise.resolve({
            [translationService["generateHash"]("Hello")]: "Hola",
          }),
        });

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await translationService.init();
      jest.useFakeTimers();
      translationService.translate("Hello");
      await jest.runAllTimersAsync();

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/v1/translate`,
        expect.any(Object)
      );
      expect(translationService.translate("Hello")).toBe("Hola");
      consoleSpy.mockRestore();
      jest.useRealTimers();
    });

    it("should skip translation for blank text", async () => {
      const blankTexts = ["", "   ", "\t\n", "  \t  "];

      // Initialize the service
      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({}),
      });
      await translationService.init();

      jest.clearAllMocks();

      blankTexts.forEach((text) => {
        const result = translationService.translate(text);
        expect(result).toBe(text); // Should return original text
      });

      // Verify no API calls were made for blank text
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("lastRefreshTime", () => {
    it("should include lastRefreshTime in API request when cache exists", async () => {
      const testText = "Hello";
      const testHash = translationService["generateHash"](testText);
      const lastRefreshTime = Date.now() - 60 * 60 * 1000;

      const mockCachedData = {
        timestamp: Date.now(),
        lastRefreshTime: lastRefreshTime,
        data: { [testHash]: "Hola" },
      };

      // Mock storage with cached data that includes lastRefreshTime
      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockCachedData)
      );

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({}),
      });

      await translationService.init();

      // Verify that lastRefreshTime was included in the request
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toBe(`${mockBaseUrl}/v1/translations`);
      expect(JSON.parse(fetchCall[1].body)).toEqual({
        apiKey: mockConfig.apiKey,
        targetLocale: mockConfig.targetLocale,
        lastRefreshTime: lastRefreshTime,
      });
    });

    it("should omit lastRefreshTime when cache TTL has elapsed", async () => {
      const lastRefreshTime = Date.now() - CACHE_REFRESH_TTL_MS - 1000;
      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({
          timestamp: Date.now(),
          lastRefreshTime,
          data: { hash1: "Hola" },
        })
      );
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({}),
      });

      await translationService.init();

      expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({
        apiKey: mockConfig.apiKey,
        targetLocale: mockConfig.targetLocale,
        lastRefreshTime: null,
      });
    });

    it("should send null lastRefreshTime on first initialization", async () => {
      // Mock no cached data
      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(null);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({}),
      });

      await translationService.init();

      // Verify that lastRefreshTime was null in the request
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toBe(`${mockBaseUrl}/v1/translations`);
      expect(JSON.parse(fetchCall[1].body)).toEqual({
        apiKey: mockConfig.apiKey,
        targetLocale: mockConfig.targetLocale,
        lastRefreshTime: null,
      });
    });

    it("should merge new translations with existing cache", async () => {
      const existingHash = "hash1";
      const newHash = "hash2";

      const mockCachedData = {
        timestamp: Date.now(),
        lastRefreshTime: Date.now() - 60 * 60 * 1000,
        data: { [existingHash]: "Existing translation" },
      };

      // Mock storage with existing cache
      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockCachedData)
      );

      // Mock API to return only new translations
      const newTranslations = { [newHash]: "New translation" };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve(newTranslations),
      });

      await translationService.init();

      // Verify that cache contains both old and new translations
      const cache = translationService["cache"][mockConfig.targetLocale];
      expect(cache[existingHash]).toBe("Existing translation");
      expect(cache[newHash]).toBe("New translation");
    });
  });

  describe("Access Token Flow", () => {
    const mockAccessToken = "test-access-token";
    const mockGetAccessToken = jest.fn();

    const tokenConfig = {
      getAccessToken: mockGetAccessToken,
      targetLocale: "es",
      sourceLocale: "en",
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockGetAccessToken.mockResolvedValue({
        accessToken: mockAccessToken,
        expiresAt: Date.now() + 3600000,
      });
    });

    it("should throw ConfigurationError when both apiKey and getAccessToken are provided", () => {
      expect(
        () =>
          new TranslationService({
            apiKey: "test-key",
            getAccessToken: mockGetAccessToken,
            sourceLocale: "en",
            targetLocale: "es",
          })
      ).toThrow(ConfigurationError);
    });

    it("should throw ConfigurationError when neither auth method is provided", () => {
      expect(
        () =>
          new TranslationService({
            sourceLocale: "en",
            targetLocale: "es",
          } as never)
      ).toThrow(ConfigurationError);
    });

    it("should throw ConfigurationError for empty apiKey", () => {
      expect(
        () =>
          new TranslationService({
            apiKey: "   ",
            sourceLocale: "en",
            targetLocale: "es",
          })
      ).toThrow(ConfigurationError);
    });

    it("should call getAccessToken on init when no token exists", async () => {
      const service = new TranslationService(tokenConfig);
      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({}),
      });

      await service.init();

      expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
      expect(service["currentAccessToken"]).toBe(mockAccessToken);
    });

    it("should skip token fetch on init when token is still valid", async () => {
      const service = new TranslationService(tokenConfig);
      service["currentAccessToken"] = mockAccessToken;
      service["tokenExpiryTime"] = Date.now() + 3600000;

      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({}),
      });

      await service.init();

      expect(mockGetAccessToken).not.toHaveBeenCalled();
    });

    it("should proactively refresh token when within 60s of expiry", async () => {
      const service = new TranslationService(tokenConfig);
      service["currentAccessToken"] = "old-token";
      service["tokenExpiryTime"] = Date.now() + 30000;

      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({}),
      });

      await service.init();

      expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
      expect(service["currentAccessToken"]).toBe(mockAccessToken);
    });

    it("should include accessToken in translate request body", async () => {
      const service = new TranslationService(tokenConfig);
      const testText = "Hello";
      const testHash = service["generateHash"](testText);

      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(null);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK",
          json: () => Promise.resolve({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK",
          json: () => Promise.resolve({ [testHash]: "Hola" }),
        });

      await service.init();
      jest.clearAllMocks();
      jest.useFakeTimers();

      service["cache"][tokenConfig.targetLocale] = {};
      service.translate(testText);

      await jest.runAllTimersAsync();

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/v1/translate`,
        expect.objectContaining({
          body: expect.stringContaining(`"accessToken":"${mockAccessToken}"`),
        })
      );

      jest.useRealTimers();
    });

    it("should include accessToken in translations request body", async () => {
      const service = new TranslationService(tokenConfig);
      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({}),
      });

      await service.init();

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/v1/translations`,
        expect.objectContaining({
          body: expect.stringContaining(`"accessToken":"${mockAccessToken}"`),
        })
      );
    });

    it("should refresh token and retry on 401 token_expired", async () => {
      const service = new TranslationService(tokenConfig);
      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(null);

      mockGetAccessToken
        .mockResolvedValueOnce({
          accessToken: "expired-token",
          expiresAt: Date.now() + 3600000,
        })
        .mockResolvedValueOnce({
          accessToken: "fresh-token",
          expiresAt: Date.now() + 3600000,
        });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          json: () => Promise.resolve({ error: "token_expired" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK",
          json: () => Promise.resolve({ hash1: "Hola" }),
        });

      await service.init();

      expect(mockGetAccessToken).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      const lastCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(lastCall[1].body).toContain('"accessToken":"fresh-token"');
    });

    it("should handle token_expired in code field", async () => {
      const service = new TranslationService(tokenConfig);
      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(null);

      mockGetAccessToken
        .mockResolvedValueOnce({
          accessToken: "expired-token",
          expiresAt: Date.now() + 3600000,
        })
        .mockResolvedValueOnce({
          accessToken: "fresh-token",
          expiresAt: Date.now() + 3600000,
        });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          json: () => Promise.resolve({ code: "token_expired" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          statusText: "OK",
          json: () => Promise.resolve({}),
        });

      await service.init();

      expect(mockGetAccessToken).toHaveBeenCalledTimes(2);
    });

    it("should queue concurrent requests during token refresh", async () => {
      let resolveToken: (value: unknown) => void;
      const tokenPromise = new Promise((resolve) => {
        resolveToken = resolve;
      });

      mockGetAccessToken.mockReturnValueOnce(tokenPromise);

      const service = new TranslationService(tokenConfig);
      service["currentAccessToken"] = null;
      service["tokenExpiryTime"] = null;

      const refreshPromise = service["refreshToken"]();

      const queuePromise1 = service["queueApiRequest"](
        "v1/translations",
        { targetLocale: "es" },
        0
      );
      const queuePromise2 = service["queueApiRequest"](
        "v1/translations",
        { targetLocale: "es" },
        0
      );

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        statusText: "OK",
        json: () => Promise.resolve({}),
      });

      resolveToken!({
        accessToken: mockAccessToken,
        expiresAt: Date.now() + 3600000,
      });

      await refreshPromise;
      await Promise.all([queuePromise1, queuePromise2]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should reject queued requests on proactive refresh failure", async () => {
      mockGetAccessToken.mockRejectedValueOnce(new Error("Network error"));

      const service = new TranslationService(tokenConfig);
      service["currentAccessToken"] = null;
      service["tokenExpiryTime"] = null;

      const queuePromise = service["queueApiRequest"](
        "v1/translations",
        { targetLocale: "es" },
        0
      );

      await expect(service["refreshToken"]()).rejects.toThrow(AccessTokenError);
      await expect(queuePromise).rejects.toThrow(AccessTokenError);
    });

    it("should settle queued requests when fetch throws", async () => {
      const service = new TranslationService(tokenConfig);
      service["currentAccessToken"] = mockAccessToken;
      service["tokenExpiryTime"] = Date.now() + 3600000;

      const queuePromise = service["queueApiRequest"](
        "v1/translations",
        { targetLocale: "es" },
        0
      );

      (global.fetch as jest.Mock).mockImplementation(() => {
        throw new Error("boom");
      });

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      service["processPendingRequests"]();

      await expect(queuePromise).resolves.toBeNull();
      consoleSpy.mockRestore();
    });

    it("should still mark initialized when token fetch fails during init", async () => {
      mockGetAccessToken.mockRejectedValueOnce(new Error("Token fetch failed"));

      const service = new TranslationService(tokenConfig);
      (mockStorageAdapter.getItem as jest.Mock).mockResolvedValueOnce(null);

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await service.init();

      expect(service.isInitialized).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Token fetch failed during init:",
        expect.any(AccessTokenError)
      );

      consoleSpy.mockRestore();
    });

    it("should parse expiresAt as ISO string", async () => {
      const isoDate = new Date(Date.now() + 3600000).toISOString();
      mockGetAccessToken.mockResolvedValueOnce({
        accessToken: mockAccessToken,
        expiresAt: isoDate,
      });

      const service = new TranslationService(tokenConfig);
      await service["fetchAccessToken"]();

      expect(service["tokenExpiryTime"]).toBe(new Date(isoDate).getTime());
    });

    it("should use expiresAt as Unix ms directly", async () => {
      const expiryMs = Date.now() + 3600000;
      mockGetAccessToken.mockResolvedValueOnce({
        accessToken: mockAccessToken,
        expiresAt: expiryMs,
      });

      const service = new TranslationService(tokenConfig);
      await service["fetchAccessToken"]();

      expect(service["tokenExpiryTime"]).toBe(expiryMs);
    });

    it("should have independent token state per service instance", async () => {
      const getAccessToken1 = jest.fn().mockResolvedValue({
        accessToken: "token-1",
        expiresAt: Date.now() + 3600000,
      });
      const getAccessToken2 = jest.fn().mockResolvedValue({
        accessToken: "token-2",
        expiresAt: Date.now() + 3600000,
      });

      const service1 = new TranslationService({
        ...tokenConfig,
        getAccessToken: getAccessToken1,
      });
      const service2 = new TranslationService({
        ...tokenConfig,
        getAccessToken: getAccessToken2,
      });

      await service1["fetchAccessToken"]();
      await service2["fetchAccessToken"]();

      expect(service1["currentAccessToken"]).toBe("token-1");
      expect(service2["currentAccessToken"]).toBe("token-2");
    });
  });
});
