export interface TranslationConfig {
  apiKey: string;
  targetLocale: string;
  sourceLocale: string;
  cacheTTL?: number;
}

export interface TranslationMap {
  [locale: string]: {
    [key: string]: string;
  };
}

export interface TranslationRequest {
  texts: Array<{
    hashkey: string;
    text: string;
    type?: string;
  }>;
  sourceLocale: string;
  targetLocale: string;
  apiKey: string;
}

export interface TranslationResponse {
  [key: string]: string;
}

export interface TranslationContextType {
  translate: (text: string, type?: string) => string;
  loading: boolean;
  error: Error | null;
}