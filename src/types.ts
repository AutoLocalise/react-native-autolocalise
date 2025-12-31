export interface TranslationConfig {
  apiKey: string;
  sourceLocale: string;
  targetLocale: string;
}

export interface TranslationMap {
  [locale: string]: {
    [key: string]: string;
  };
}

export interface TranslationCacheData {
  timestamp: number;
  lastRefreshTime: number | null;
  data: TranslationMap[string];
}

export interface TranslationRequest {
  texts: Array<{
    hashkey: string;
    text: string;
    persist: boolean;
    reference?: string;
  }>;
  sourceLocale: string;
  targetLocale: string;
  apiKey: string;
  version: string;
  lastRefreshTime?: number | null; // Timestamp of last cache refresh (milliseconds)
}

export interface TranslationResponse {
  [hashkey: string]: string;
}

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface TranslationContextType {
  translate: (text: string, persist: boolean, reference?: string) => string;
  loading: boolean;
  error: Error | null;
}
