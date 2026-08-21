import { ConfigurationError, TranslationConfig } from "../types";

/**
 * Validate locale format (BCP 47 compliant)
 * Accepts formats like: 'en', 'fil', 'zh-TW', 'es-419', 'bs-Cyrl'
 * Supports: 2-3 letter language codes, optional script codes, optional region codes (letters or digits)
 */
export function validateLocale(locale: string): void {
  if (locale === null || locale === undefined || typeof locale !== "string") {
    console.warn("Locale must be a non-empty string");
    return;
  }

  // Trim whitespace
  const trimmedLocale = locale.trim();

  if (trimmedLocale.length === 0) {
    console.warn("Locale cannot be empty or whitespace only");
    return;
  }

  // Check format: language code (2-3 letters) optionally followed by -script (4 letters) or -region (2-3 letters or 3 digits)
  const localeRegex = /^[a-z]{2,3}(-[A-Za-z0-9]{2,3})?(-[A-Za-z]{4})?$/;

  if (!localeRegex.test(trimmedLocale)) {
    console.warn(
      `Invalid locale format: "${locale}". Expected format: "en", "fil", "en-US", "es-419", "bs-Cyrl" (BCP 47 compliant)`
    );
  }
}

/**
 * Validate authentication configuration (throws on invalid config)
 */
export function validateAuthConfig(config: TranslationConfig): void {
  const hasApiKey = config.apiKey !== undefined && config.apiKey !== null;
  const hasGetAccessToken =
    config.getAccessToken !== undefined && config.getAccessToken !== null;

  if (hasApiKey && hasGetAccessToken) {
    throw new ConfigurationError(
      "Provide either apiKey or getAccessToken, not both"
    );
  }

  if (!hasApiKey && !hasGetAccessToken) {
    throw new ConfigurationError(
      "Either apiKey or getAccessToken must be provided"
    );
  }

  if (hasApiKey) {
    if (typeof config.apiKey !== "string" || config.apiKey.trim().length === 0) {
      throw new ConfigurationError("apiKey cannot be empty");
    }
  }

  if (hasGetAccessToken && typeof config.getAccessToken !== "function") {
    throw new ConfigurationError("getAccessToken must be a function");
  }
}

/**
 * Validate translation configuration
 */
export function validateConfig(config: TranslationConfig): void {
  if (config === null || config === undefined) {
    console.warn("Configuration is required");
    return;
  }

  const hasApiKey = config.apiKey !== undefined && config.apiKey !== null;
  const hasGetAccessToken =
    config.getAccessToken !== undefined && config.getAccessToken !== null;

  if (hasApiKey && hasGetAccessToken) {
    console.warn("Provide either apiKey or getAccessToken, not both");
    return;
  }

  if (!hasApiKey && !hasGetAccessToken) {
    console.warn("Either apiKey or getAccessToken must be provided");
    return;
  }

  if (hasApiKey) {
    if (
      config.apiKey === null ||
      config.apiKey === undefined ||
      typeof config.apiKey !== "string"
    ) {
      console.warn("API key must be a non-empty string");
      return;
    }

    const trimmedApiKey = config.apiKey.trim();

    if (trimmedApiKey.length === 0) {
      console.warn("API key cannot be empty or whitespace only");
      return;
    }

    if (trimmedApiKey.length < 8) {
      console.warn("API key appears to be invalid (too short)");
    }
  }

  if (hasGetAccessToken && typeof config.getAccessToken !== "function") {
    console.warn("getAccessToken must be a function");
    return;
  }

  validateLocale(config.sourceLocale);
  validateLocale(config.targetLocale);

  if (config.sourceLocale === config.targetLocale) {
    // This is not an error, but worth noting - translations will be skipped
    console.warn(
      `Source locale and target locale are the same (${config.sourceLocale}). Translations will be skipped.`
    );
  }
}