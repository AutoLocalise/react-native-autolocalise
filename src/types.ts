export interface AccessTokenResponse {
  accessToken: string;
  expiresAt: number | string;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export class AccessTokenError extends Error {
  constructor(
    message: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "AccessTokenError";
    Object.setPrototypeOf(this, AccessTokenError.prototype);
  }
}

export interface TranslationConfig {
  apiKey?: string;
  getAccessToken?: () => Promise<AccessTokenResponse>;
  sourceLocale: string;
  targetLocale: string;
  /** Override the default AutoLocalise API base URL (e.g. for staging) */
  apiBaseUrl?: string;
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
  }>;
  sourceLocale: string;
  targetLocale: string;
  apiKey?: string;
  accessToken?: string;
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
  translate: (text: string, persist: boolean) => string;
  loading: boolean;
  error: Error | null;
}
