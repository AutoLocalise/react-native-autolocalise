import {
  TranslationConfig,
  TranslationMap,
  TranslationRequest,
  TranslationResponse,
} from "../types";
import { getStorageAdapter } from "../storage";

export class TranslationService {
  private config: TranslationConfig;
  private cache: TranslationMap = {};
  private storage = getStorageAdapter();
  private pendingTranslations: Set<string> = new Set();
  private translatedTexts: Set<string> = new Set();
  private batchTimeout: NodeJS.Timeout | null = null;
  private cacheKey = "";

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
    console.log("getCachedTranslation hashkey:", hashkey, text);
    return this.cache[this.config.targetLocale]?.[hashkey] || null;
  }

  private async fetchTranslations(texts: string[]): Promise<void> {
    const request: TranslationRequest = {
      texts: texts.reduce((acc, text) => {
        const hashkey = this.generateHash(text);
        acc[hashkey] = text;
        return acc;
      }, {} as { [key: string]: string }),
      from: this.config.sourceLocale,
      to: this.config.targetLocale,
    };
    console.log("fetchTranslations Request:", request);

    try {
      // const response = await fetch("https://civnjmlycaujxgcjzzyh.supabase.co/functions/v1/translate", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //     Authorization: `Bearer ${this.config.apiKey}`,
      //   },
      //   body: JSON.stringify(request),
      // });

      // const data: TranslationResponse = await response.json();
      const data: TranslationResponse = {
        translations: {
          "-506736440": "感受实时翻译",
        },
      };

      // Update cache with new translations
      this.cache[this.config.targetLocale] = {
        ...this.cache[this.config.targetLocale],
        ...data.translations,
      };

      // Notify listeners of new translations
      if (this.onTranslationsUpdated) {
        this.onTranslationsUpdated(this.cache[this.config.targetLocale] || {});
      }

      // Save to persistent storage
      await this.storage.setItem(
        this.cacheKey,
        JSON.stringify({
          timestamp: Date.now(),
          data: this.cache[this.config.targetLocale],
        })
      );
      const translationsStorage = await this.storage.getItem(this.cacheKey);
      console.log("Translations storage set:", translationsStorage);
    } catch (error) {
      console.error("Translation fetch error:", error);
      throw error;
    }
  }

  private scheduleBatchTranslation(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(async () => {
      const textsToTranslate = Array.from(this.pendingTranslations);
      this.pendingTranslations.clear();

      if (textsToTranslate.length > 0) {
        await this.fetchTranslations(textsToTranslate);
      }
    }, 100); // Batch translations every 100ms
  }

  public async init(): Promise<void> {
    try {
      // Try to load from storage first
      const cachedData = await this.storage.getItem(this.cacheKey);
      if (cachedData) {
        const { timestamp, data } = JSON.parse(cachedData);
        const age = (Date.now() - timestamp) / (1000 * 60 * 60); // Age in hours

        if (age < this.config.cacheTTL!) {
          this.cache[this.config.targetLocale] = data;
          console.log("Loaded translations from cache:", data);
          return;
        }
      }

      // If no valid cache, fetch from API
      const response = await fetch(
        "https://civnjmlycaujxgcjzzyh.supabase.co/functions/v1/translations-v1",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiKey: this.config.apiKey,
            targetLocale: this.config.targetLocale,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch translations: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Translations init fetched:", data);
      this.cache[this.config.targetLocale] = data;

      // Save to storage
      await this.storage.setItem(
        this.cacheKey,
        JSON.stringify({
          timestamp: Date.now(),
          data,
        })
      );
    } catch (error) {
      console.error("Translation initialization error:", error);
      throw error;
    }
  }

  public async translate(text: string): Promise<string> {
    if (!text) return text;

    // Check cache first
    const cachedTranslation = this.getCachedTranslation(text);
    if (cachedTranslation) {
      return cachedTranslation;
    }

    // Only request translation if we haven't tried before
    if (!this.translatedTexts.has(text)) {
      this.translatedTexts.add(text);
      this.pendingTranslations.add(text);
      this.scheduleBatchTranslation();
    }

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
