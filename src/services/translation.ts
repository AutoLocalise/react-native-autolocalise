import {
  StorageAdapter,
  TranslationConfig,
  TranslationMap,
  TranslationRequest,
  TranslationResponse,
} from "../types";
import { getStorageAdapter } from "../storage";

export class TranslationService {
  private config: TranslationConfig;
  private cache: TranslationMap = {};
  private storage: StorageAdapter | null = null;
  private pendingTranslations: Map<string, string | undefined> = new Map();
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private cacheKey = "";
  private baseUrl = "https://autolocalise-main-53fde32.zuplo.app";
  public isInitialized = false;

  public isTranslationPending(text: string): boolean {
    return this.pendingTranslations.has(text);
  }

  private onTranslationsUpdated:
    | ((translations: { [key: string]: string }) => void)
    | null = null;
  constructor(config: TranslationConfig) {
    this.config = {
      ...config,
      cacheTTL: config.cacheTTL || 24, // Default 24 hours
    };
    this.cacheKey = `autolocalise_${this.config.targetLocale}`;
  }

  public generateHash(text: string): string {
    // Simple hash function for demo purposes
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private debounceTime = 1000; // 1 second debounce

  public getCachedTranslation(text: string): string | null {
    const hashkey = this.generateHash(text);
    return this.cache[this.config.targetLocale]?.[hashkey] || null;
  }

  private async baseApi<
    T extends TranslationRequest | { apiKey: string; targetLocale: string }
  >(endpoint: string, requestBody: T): Promise<TranslationResponse> {
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
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
      const allTexts: { hashkey: string; text: string; type?: string }[] = [];

      this.pendingTranslations.forEach((type, text) => {
        allTexts.push({ hashkey: this.generateHash(text), text, type });
      });
      this.pendingTranslations.clear();

      if (allTexts.length > 0) {
        const request: TranslationRequest = {
          texts: allTexts,
          sourceLocale: this.config.sourceLocale,
          targetLocale: this.config.targetLocale,
          apiKey: this.config.apiKey,
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
    }, 100);
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      this.storage = await getStorageAdapter();
      const cachedData = await this.storage.getItem(this.cacheKey);
      if (cachedData) {
        const { timestamp, data } = JSON.parse(cachedData);
        const age = (Date.now() - timestamp) / (1000 * 60 * 60);

        if (age < this.config.cacheTTL!) {
          this.cache[this.config.targetLocale] = data;
          this.isInitialized = true;
          return;
        }
      }

      const requestBody = {
        apiKey: this.config.apiKey,
        targetLocale: this.config.targetLocale,
      };

      const data = await this.baseApi("v1/translations", requestBody);
      this.cache[this.config.targetLocale] = data;

      await this.storage.setItem(
        this.cacheKey,
        JSON.stringify({
          timestamp: Date.now(),
          data,
        })
      );
      this.isInitialized = true;
    } catch (error) {
      console.error("Translation initialization error:", error);
      throw error;
    }
  }

  public translate(text: string, type?: string): string {
    if (!text || !this.isInitialized) return text;

    // Check cache first
    const cachedTranslation = this.getCachedTranslation(text);
    if (cachedTranslation) {
      return cachedTranslation;
    }

    this.pendingTranslations.set(text, type);
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
