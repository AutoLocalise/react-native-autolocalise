import {
  StorageAdapter,
  TranslationConfig,
  TranslationMap,
  TranslationRequest,
  TranslationResponse,
  TranslationCacheData,
} from "../types";
import { getStorageAdapter } from "../storage";
import { VERSION } from "../version";
import { API_BASE_URL, CLIENT_BATCH_DEBOUNCE_MS } from "../constants";

export class TranslationService {
  private config: TranslationConfig;
  private cache: TranslationMap = {};
  private storage: StorageAdapter | null = null;
  private pendingTranslations: Map<string, boolean> = new Map();
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private cacheKey = "";
  private lastRefreshTime: number | null = null;
  public isInitialized = false;

  public isTranslationPending(text: string): boolean {
    return this.pendingTranslations.has(text);
  }

  private onTranslationsUpdated:
    | ((translations: { [key: string]: string }) => void)
    | null = null;
  constructor(config: TranslationConfig) {
    this.config = config;
    this.cacheKey = `autolocalise_${this.config.targetLocale}`;
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

  private async baseApi<
    T extends TranslationRequest | { apiKey: string; targetLocale: string }
  >(endpoint: string, requestBody: T): Promise<TranslationResponse> {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed calling ${endpoint}: ${response.statusText}`);
    }

    return response.json();
  }

  private scheduleBatchTranslation(): void {
    if (!this.storage) return;
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
        // Modify API request to include context and version
        const request: TranslationRequest = {
          texts: allTexts,
          sourceLocale: this.config.sourceLocale,
          targetLocale: this.config.targetLocale,
          apiKey: this.config.apiKey,
          version: `rn-v${VERSION}`,
        };

        try {
          const data = await this.baseApi("v1/translate", request);

          this.cache[this.config.targetLocale] = {
            ...this.cache[this.config.targetLocale],
            ...data,
          };

          if (this.onTranslationsUpdated) {
            this.onTranslationsUpdated(
              this.cache[this.config.targetLocale] || {}
            );
          }

          if (this.storage) {
            await this.storage.setItem(
              this.cacheKey,
              JSON.stringify({
                timestamp: Date.now(),
                data: this.cache[this.config.targetLocale],
              })
            );
          }
        } catch (error) {
          console.error("Translation fetch error:", error);
          throw error;
        }
      }
    }, CLIENT_BATCH_DEBOUNCE_MS);
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      this.storage = await getStorageAdapter();
      const cachedData = await this.storage.getItem(this.cacheKey);

      if (cachedData) {
        const parsedCache: TranslationCacheData = JSON.parse(cachedData);
        const { lastRefreshTime, data } = parsedCache;

        // Initialize cache with stored data
        this.cache[this.config.targetLocale] = data;
        this.lastRefreshTime = lastRefreshTime;
      }

      // Fetch fresh translations from API
      const requestBody = {
        apiKey: this.config.apiKey,
        targetLocale: this.config.targetLocale,
        lastRefreshTime: this.lastRefreshTime,
      };

      const data = await this.baseApi("v1/translations", requestBody);

      // Merge new translations with existing cache
      this.cache[this.config.targetLocale] = {
        ...this.cache[this.config.targetLocale],
        ...data,
      };

      // Update lastRefreshTime to current time
      this.lastRefreshTime = Date.now();

      // Store updated cache
      await this.storage.setItem(
        this.cacheKey,
        JSON.stringify({
          timestamp: Date.now(),
          lastRefreshTime: this.lastRefreshTime,
          data: this.cache[this.config.targetLocale],
        })
      );

      this.isInitialized = true;
    } catch (error) {
      console.error("Translation initialization error:", error);
      throw error;
    }
  }

  public translate(text: string, persist: boolean = true): string {
    if (!text || !this.isInitialized) return text;

    // Skip translation for blank text (empty or whitespace only)
    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return text;
    }

    // Check cache first
    const cachedTranslation = this.getCachedTranslation(text);
    if (cachedTranslation) {
      return cachedTranslation;
    }

    this.pendingTranslations.set(text, persist);
    this.scheduleBatchTranslation();

    // Return original text while translation is pending
    return text;
  }

  public onUpdate(
    callback: (translations: { [key: string]: string }) => void
  ): void {
    this.onTranslationsUpdated = callback;
    // Immediately call with current translations if available
    if (this.cache[this.config.targetLocale]) {
      callback(this.cache[this.config.targetLocale]);
    }
  }
}
