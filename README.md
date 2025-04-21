# React AutoLocalise

This is SDK for [AutoLocalise](<[AutoLocalise](https://www.autolocalise.com)>).

A lightweight, efficient auto-translation SDK for React, React Native, and Expo applications. This SDK provides seamless integration for automatic content translation and support offline mode.

You don't need to prepare any translation files, just provide your API key and the SDK will handle the rest.

## Features

- 🌐 Cross-platform support (React Web, React Native, Expo)
- 🚀 Automatic string detection and translation
- 🎯 Dynamic parameter interpolation
- 🔍 Static translation tracking
- 🔌 Offline mode support
- ⚙️ Configurable cache TTL
- ⚡️ Tree-shakeable and side-effect free

## Installation

### React Web

```bash
npm install react-autolocalise
# or
yarn add react-autolocalise
```

### React Native

```bash
npm install react-autolocalise @react-native-async-storage/async-storage
# or
yarn add react-autolocalise @react-native-async-storage/async-storage
```

### Expo

```bash
npm install react-autolocalise expo-secure-store
# or
yarn add react-autolocalise expo-secure-store
```

## Usage

### 1. Initialize the SDK

```typescript
import { TranslationProvider } from "react-autolocalise";

const App = () => {
  const config = {
    apiKey: "your-api-key",
    sourceLocale: "fr",
    targetLocale: "en",
    // cacheTTL: 24, // Cache validity in hours (optional, defaults to 24)
  };

  return (
    <TranslationProvider config={config}>
      <YourApp />
    </TranslationProvider>
  );
};
```

### 2. Use the Translation Hook

Basic usage:

```typescript
import { useAutoTranslate } from "react-autolocalise";

const MyComponent = () => {
  const { t, loading, error } = useAutoTranslate();

  return (
    <div>
      <h1>{t("Welcome to our app!", "static")}</h1>
      <p>{t("This text will be automatically translated")}</p>
    </div>
  );
};
```

Use with params:

```typescript
import { useAutoTranslate } from "react-autolocalise";

const MyComponent = () => {
  const { t } = useAutoTranslate();
  const name = "John";

  return (
    <div>
      <p>
        {t("Welcome, {{1}}!, Nice to meet you. {{2}}.")
          .replace("{{1}}", name)
          .replace("{{2}}", t("Have a great day!"))}
      </p>
    </div>
  );
};
```

## Locale Format

The locale format follows the ISO 639-1 language code standard, optionally combined with an ISO 3166-1 country code:

- Language code only: 'en', 'fr', 'zh', 'ja', etc.
- Language-Region: 'en-US', 'fr-FR', 'zh-CN', 'pt-BR', etc.

## How to get the locale

### React

In React web applications, you can get the user's preferred locale from the browser:

```typescript
// Get the primary locale
const browserLocale = navigator.language; // e.g., 'en-US'

// Get all preferred locales
const preferredLocales = navigator.languages; // e.g., ['en-US', 'en']

// Extract just the language code if needed
const languageCode = browserLocale.split("-")[0]; // e.g., 'en'
```

### React Native

In React Native, you can get the device locale using the Localization API:

```typescript
import * as Localization from "react-native-localization";
// or
import { NativeModules, Platform } from "react-native";

// Using react-native-localization
const deviceLocale = Localization.locale; // e.g., 'en-US'

// Alternative method using native modules
const deviceLanguage =
  Platform.OS === "ios"
    ? NativeModules.SettingsManager.settings.AppleLocale ||
      NativeModules.SettingsManager.settings.AppleLanguages[0]
    : NativeModules.I18nManager.localeIdentifier;
```

### Expo

In Expo, you can use the Localization API from expo-localization:

```typescript
import * as Localization from "expo-localization";

// Get the device locale
const locale = Localization.locale; // e.g., 'en-US'

// Get just the language code
const languageCode = locale.split("-")[0]; // e.g., 'en'

// Get the user's preferred locales
const preferredLocales = Localization.locales; // e.g., ['en-US', 'en']

// Check if the device uses RTL layout
const isRTL = Localization.isRTL;
```

Note: When running Expo in a web browser, it will use the browser's locale settings (navigator.language) automatically.

## API Reference

### TranslationProvider Props

| Prop   | Type              | Description                                      |
| ------ | ----------------- | ------------------------------------------------ |
| config | TranslationConfig | Configuration object for the translation service |

### TranslationConfig

| Property     | Type   | Required | Description                                  |
| ------------ | ------ | -------- | -------------------------------------------- |
| apiKey       | string | Yes      | Your API key for the translation service     |
| sourceLocale | string | Yes      | Source locale for translations               |
| targetLocale | string | Yes      | Target locale for translations               |
| cacheTTL     | number | No       | Cache validity period in hours (default: 24) |

**Tips**: When `sourceLocale` === `targetLocale` no translation requests will be send.

### useAutoTranslate Hook

Returns an object with:

- `t`: Translation function
- `loading`: Boolean indicating initialization of translations
- `error`: Error object if translation loading failed

### Static persist

When you pass the 'static' parameter to the translation function, the translation will be persisted so that you can review and edit in the dashboard, default is non-static, nothing will be persisted.

```typescript
import { useAutoTranslate } from "react-autolocalise";
const MyComponent = () => {
  const { t } = useAutoTranslate();
  return (
    <div>
      <h1>{t("Welcome to our app!", "static")}</h1>
    </div>
  );
};
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
