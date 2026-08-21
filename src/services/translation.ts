import {
  AccessTokenError,
  StorageAdapter,
  TranslationConfig,
  TranslationMap,
  TranslationRequest,
  TranslationResponse,
  TranslationCacheData,
} from "../types";
import { getStorageAdapter } from "../storage";
import { VERSION } from "../version";
import {
  API_BASE_URL,
  CACHE_REFRESH_TTL_MS,
  CLIENT_BATCH_DEBOUNCE_MS,
  MAX_RETRY_ATTEMPTS,
  TOKEN_EXPIRY_SAFETY_BUFFER_MS,
} from "../constants";
import { validateAuthConfig } from "../utils/validation";

type AuthCredentials = { apiKey: string } | { accessToken: string };

type PendingRequest = {
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

export class TranslationService {
  private config: TranslationConfig;
  private cache: TranslationMap = {};
  private storage: StorageAdapter | null = null;
  private pendingTranslations: Map<string, boolean> = new Map();
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private cacheKey = "";
  private lastRefreshTime: number | null = null;
  public isInitialized = false;

  private currentAccessToken: string | null = null;
  private tokenExpiryTime: number | null = null;
  private isTokenRefreshing = false;
  private pendingRequests: PendingRequest[] = [];
  private refreshPromise: Promise<void> | null = null;
  private initPromise: Promise<void> | null = null;

  public isTranslationPending(text: string): boolean {
    return this.pendingTranslations.has(text);
  }

  private onTranslationsUpdated:
    | ((translations: { [key: string]: string }) => void)
    | null = null;

  private apiBaseUrl: string;

  constructor(config: TranslationConfig) {
    validateAuthConfig(config);
    this.config = config;
    this.apiBaseUrl = config.apiBaseUrl ?? API_BASE_URL;
    this.cacheKey = `autolocalise_${this.config.targetLocale}`;
  }

  private usesAccessToken(): boolean {
    return typeof this.config.getAccessToken === "function";
  }

  private isTokenExpired(): boolean {
    if (!this.currentAccessToken || this.tokenExpiryTime === null) {
      return true;
    }
    return (
      Date.now() >= this.tokenExpiryTime - TOKEN_EXPIRY_SAFETY_BUFFER_MS
    );
  }

  private async fetchAccessToken(): Promise<void> {
    if (!this.config.getAccessToken) {
      throw new AccessTokenError("getAccessToken is not configured");
    }

    try {
      const response = await this.config.getAccessToken();

      if (
        !response?.accessToken ||
        typeof response.accessToken !== "string"
      ) {
        throw new AccessTokenError(
          "Invalid access token response: missing accessToken"
        );
      }

      const { expiresAt } = response;
      if (expiresAt === undefined || expiresAt === null) {
        throw new AccessTokenError(
          "Invalid access token response: missing expiresAt"
        );
      }

      const expiryTime =
        typeof expiresAt === "string"
          ? new Date(expiresAt).getTime()
          : expiresAt;

      if (Number.isNaN(expiryTime)) {
        throw new AccessTokenError(
          "Invalid access token response: invalid expiresAt"
        );
      }

      this.currentAccessToken = response.accessToken;
      this.tokenExpiryTime = expiryTime;
    } catch (error) {
      if (error instanceof AccessTokenError) {
        throw error;
      }
      throw new AccessTokenError("Failed to fetch access token", error);
    }
  }

  private processPendingRequests(): void {
    const queue = [...this.pendingRequests];
    this.pendingRequests = [];
    queue.forEach(({ execute, resolve, reject }) => {
      execute().then(resolve).catch((error) => {
        console.error("Queued request failed:", error);
        reject(error);
      });
    });
  }

  private rejectPendingRequests(error: unknown): void {
    const queue = [...this.pendingRequests];
    this.pendingRequests = [];
    queue.forEach(({ reject }) => reject(error));
  }

  private async refreshToken(): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isTokenRefreshing = true;
    this.refreshPromise = this.fetchAccessToken()
      .then(() => {
        this.processPendingRequests();
      })
      .catch((error) => {
        const tokenError =
          error instanceof AccessTokenError
            ? error
            : new AccessTokenError("Failed to refresh access token", error);
        this.rejectPendingRequests(tokenError);
        throw tokenError;
      })
      .finally(() => {
        this.isTokenRefreshing = false;
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.usesAccessToken() || !this.isTokenExpired()) {
      return;
    }

    await this.refreshToken();
  }

  private getAuthCredentials(): AuthCredentials | null {
    if (this.config.apiKey) {
      return { apiKey: this.config.apiKey };
    }

    if (!this.currentAccessToken) {
      return null;
    }

    return { accessToken: this.currentAccessToken };
  }

  private isTokenExpiredError(status: number, body: unknown): boolean {
    if (status !== 401 && status !== 403) {
      return false;
    }

    if (typeof body !== "object" || body === null) {
      return false;
    }

    const errorBody = body as { error?: string; code?: string };
    return (
      errorBody.error === "token_expired" ||
      errorBody.code === "token_expired"
    );
  }

  private invalidateToken(): void {
    this.currentAccessToken = null;
    this.tokenExpiryTime = null;
  }

  private queueApiRequest<T>(
    endpoint: string,
    requestBody: object,
    retryCount: number
  ): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({
        execute: () => this.apiRequest<T>(endpoint, requestBody, retryCount),
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });
  }

  private async apiRequest<T>(
    endpoint: string,
    requestBody: object,
    retryCount = 0
  ): Promise<T | null> {
    if (this.usesAccessToken()) {
      if (this.isTokenExpired()) {
        if (this.isTokenRefreshing) {
          return this.queueApiRequest<T>(endpoint, requestBody, retryCount);
        }

        try {
          await this.refreshToken();
        } catch (error) {
          console.error("Access token refresh failed:", error);
          return null;
        }
      }
    }

    const auth = this.getAuthCredentials();
    if (!auth) {
      console.error("Failed to get authentication credentials");
      return null;
    }

    const body = { ...requestBody, ...auth };

    try {
      const response = await fetch(`${this.apiBaseUrl}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      let responseBody: unknown = null;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = null;
      }

      if (this.isTokenExpiredError(response.status, responseBody)) {
        if (retryCount >= MAX_RETRY_ATTEMPTS) {
          console.error("Token expired: max retry attempts exceeded");
          return null;
        }

        this.invalidateToken();

        if (this.isTokenRefreshing) {
          return this.queueApiRequest<T>(
            endpoint,
            requestBody,
            retryCount + 1
          );
        }

        try {
          await this.refreshToken();
        } catch (error) {
          console.error("Access token refresh failed after expiry:", error);
          return null;
        }

        return this.apiRequest<T>(endpoint, requestBody, retryCount + 1);
      }

      if (!response.ok) {
        console.error(
          `Failed calling ${endpoint}: ${response.status} ${response.statusText}`
        );
        return null;
      }

      return responseBody as T;
    } catch (error) {
      console.error(`Failed calling ${endpoint}:`, error);
      return null;
    }
  }

  public generateHash(text: string): string {
    // TODO: Use SHA-256 or cryptographic hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  public getCachedTranslation(text: string): string | null {
    const hashkey = this.generateHash(text);
    return this.cache[this.config.targetLocale]?.[hashkey] || null;
  }

  private persistCache(): Promise<void> {
    if (!this.storage) {
      return Promise.resolve();
    }

    return this.storage.setItem(
      this.cacheKey,
      JSON.stringify({
        timestamp: Date.now(),
        lastRefreshTime: this.lastRefreshTime,
        data: this.cache[this.config.targetLocale] || {},
      })
    );
  }

  private parseCacheData(cachedData: string): TranslationCacheData | null {
    try {
      const parsed: unknown = JSON.parse(cachedData);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }

      const record = parsed as Record<string, unknown>;
      const data = record.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return null;
      }

      const translations = data as Record<string, unknown>;
      for (const value of Object.values(translations)) {
        if (typeof value !== "string") {
          return null;
        }
      }

      return {
        timestamp: typeof record.timestamp === "number" ? record.timestamp : 0,
        lastRefreshTime:
          typeof record.lastRefreshTime === "number"
            ? record.lastRefreshTime
            : null,
        data: translations as TranslationMap[string],
      };
    } catch {
      return null;
    }
  }

  private lastRefreshTimeForRequest(): number | null {
    if (
      this.lastRefreshTime === null ||
      Date.now() - this.lastRefreshTime >= CACHE_REFRESH_TTL_MS
    ) {
      return null;
    }
    return this.lastRefreshTime;
  }

  private scheduleBatchTranslation(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(async () => {
      const allTexts: {
        hashkey: string;
        text: string;
        persist: boolean;
      }[] = [];

      this.pendingTranslations.forEach((persist, text) => {
        allTexts.push({ hashkey: this.generateHash(text), text, persist });
      });
      this.pendingTranslations.clear();

      if (allTexts.length > 0) {
        const request: TranslationRequest = {
          texts: allTexts,
          sourceLocale: this.config.sourceLocale,
          targetLocale: this.config.targetLocale,
          version: `rn-v${VERSION}`,
        };

        const data = await this.apiRequest<TranslationResponse>(
          "v1/translate",
          request
        );

        if (!data) {
          return;
        }

        this.cache[this.config.targetLocale] = {
          ...this.cache[this.config.targetLocale],
          ...data,
        };

        if (this.onTranslationsUpdated) {
          this.onTranslationsUpdated(
            this.cache[this.config.targetLocale] || {}
          );
        }

        await this.persistCache();
      }
    }, CLIENT_BATCH_DEBOUNCE_MS);
  }

  public async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.performInit();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async performInit(): Promise<void> {
    try {
      this.storage = await getStorageAdapter();
      const cachedData = await this.storage.getItem(this.cacheKey);
      const parsedCache = cachedData ? this.parseCacheData(cachedData) : null;

      if (parsedCache) {
        this.cache[this.config.targetLocale] = parsedCache.data;
        this.lastRefreshTime = parsedCache.lastRefreshTime;
      }
    } catch (error) {
      console.error("Translation cache load error:", error);
    }

    if (this.usesAccessToken()) {
      try {
        await this.ensureValidToken();
      } catch (error) {
        console.error("Token fetch failed during init:", error);
      }
    }

    try {
      const requestBody = {
        targetLocale: this.config.targetLocale,
        lastRefreshTime: this.lastRefreshTimeForRequest(),
      };

      const data = await this.apiRequest<TranslationResponse>(
        "v1/translations",
        requestBody
      );

      if (data) {
        this.cache[this.config.targetLocale] = {
          ...this.cache[this.config.targetLocale],
          ...data,
        };

        this.lastRefreshTime = Date.now();
        await this.persistCache();
      }
    } catch (error) {
      console.error("Translation initialization error:", error);
    }

    this.isInitialized = true;
  }

  public translate(text: string, persist: boolean = true): string {
    if (!text || !this.isInitialized) return text;

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return text;
    }

    const cachedTranslation = this.getCachedTranslation(text);
    if (cachedTranslation) {
      return cachedTranslation;
    }

    this.pendingTranslations.set(text, persist);
    this.scheduleBatchTranslation();

    return text;
  }

  public onUpdate(
    callback: (translations: { [key: string]: string }) => void
  ): void {
    this.onTranslationsUpdated = callback;
    if (this.cache[this.config.targetLocale]) {
      callback(this.cache[this.config.targetLocale]);
    }
  }
}
