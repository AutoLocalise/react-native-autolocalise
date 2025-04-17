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
  private pendingTranslations: Map<string, string | undefined> = new Map();
  private batchTimeout: NodeJS.Timeout | null = null;
  private cacheKey = "";
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
    // console.log("getCachedTranslation hashkey:", hashkey, text);
    return this.cache[this.config.targetLocale]?.[hashkey] || null;
  }

  // We've inlined the fetchTranslations functionality directly in scheduleBatchTranslation
  // to simplify the process and avoid organizing translations by type

  private scheduleBatchTranslation(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(async () => {
      // Collect all texts and their types for batch processing
      const allTexts: { hashkey: string; text: string; type?: string }[] = [];

      // Gather all pending translations
      this.pendingTranslations.forEach((type, text) => {
        allTexts.push({ hashkey: this.generateHash(text), text, type });
      });
      this.pendingTranslations.clear();
      console.log("this.pendingTranslations", allTexts);
      // Process all texts in a single batch, preserving type information in the request
      if (allTexts.length > 0) {
        const request: TranslationRequest = {
          texts: allTexts,
          sourceLocale: this.config.sourceLocale,
          targetLocale: this.config.targetLocale,
          apiKey: this.config.apiKey,
        };
        console.log("fetchTranslations Request:", request);

        try {
          const response = await fetch(
            "https://civnjmlycaujxgcjzzyh.supabase.co/functions/v1/translate-s1",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(request),
            }
          );

          const data: TranslationResponse = await response.json();
          console.log("fetchTranslations Response:", data);

          // Update cache with new translations
          this.cache[this.config.targetLocale] = {
            ...this.cache[this.config.targetLocale],
            ...data,
          };
          console.log(
            "Translations updated:",
            this.cache[this.config.targetLocale]
          );

          // Notify listeners of new translations
          if (this.onTranslationsUpdated) {
            this.onTranslationsUpdated(
              this.cache[this.config.targetLocale] || {}
            );
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
    }, 100); // Batch translations every 100ms
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      // Try to load from storage first
      const cachedData = await this.storage.getItem(this.cacheKey);
      if (cachedData) {
        const { timestamp, data } = JSON.parse(cachedData);
        const age = (Date.now() - timestamp) / (1000 * 60 * 60); // Age in hours

        if (age < this.config.cacheTTL!) {
          this.cache[this.config.targetLocale] = data;
          // console.log("Loaded translations from cache:", data);
          this.isInitialized = true;
          return;
        }
      }

      // If no valid cache, fetch from API
      const response = await fetch(
        "https://civnjmlycaujxgcjzzyh.supabase.co/functions/v1/translations-s1",
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
      console.log("Translations storage set:", data);
      this.isInitialized = true;
    } catch (error) {
      console.error("Translation initialization error:", error);
      throw error;
    }
  }

  public translate(text: string, type?: string): string {
    // console.log("translate text:isInitialized", this.isInitialized);
    if (!text || !this.isInitialized) return text;

    // // Ensure initialization
    // if (!this.isInitialized) {
    //   // await this.init();
    //   return text;
    // }

    // Check cache first
    const cachedTranslation = this.getCachedTranslation(text);
    if (cachedTranslation) {
      return cachedTranslation;
    }

    // Only request translation if we haven't tried before
    // TODO the logic here looks weird, translatedTexts got initial value from storage?
    // if (!this.translatedTexts.has(text)) {
    //   this.translatedTexts.add(text);
    this.pendingTranslations.set(text, type);
    this.scheduleBatchTranslation();
    // }

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
