export interface TranslationConfig {
  apiKey: string;
  sourceLocale: string;
  targetLocale: string;
  cacheTTL?: number; // Time in hours for cache validity
}

export interface TranslationMap {
  [locale: string]: {
    [key: string]: string;
  };
}

export interface TranslationRequest {
  texts: { [hashkey: string]: string };
  from: string;
  to: string;
}

export interface TranslationResponse {
  translations: {
    [hashkey: string]: string;
  };
}

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface TranslationContextType {
  translate: (text: string) => string;
  loading: boolean;
  error: Error | null;
}
