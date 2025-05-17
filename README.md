# AutoLocalise React Native/Expo SDK

This is SDK for [AutoLocalise](https://www.autolocalise.com).

A lightweight, efficient auto-translation SDK for React Native and Expo applications. This SDK provides seamless integration for automatic content translation with support for offline mode.

You don't need to prepare any translation files, just provide your API key and the SDK will handle the rest.

## Features

- 🌐 React Native and Expo support
- 🚀 Automatic string translation
- 🎯 Dynamic parameter interpolation
- 🔍 Persist translation tracking
- 🔌 Offline mode support
- 🎨 Nested text formatting support
- ⚙️ Configurable cache TTL
- ⚡️ Lightweight and efficient

## Installation

```bash
npm install react-native-autolocalise @react-native-async-storage/async-storage
# or
yarn add react-native-autolocalise @react-native-async-storage/async-storage
```

## Usage

### 1. Initialize the SDK

```typescript
import { TranslationProvider } from "react-native-autolocalise";

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

**Basic usage:**

```typescript
import { useAutoTranslate } from "react-native-autolocalise";

const MyComponent = () => {
  const { t, loading, error } = useAutoTranslate();

  return (
    <div>
      <h1>{t("Welcome to our app!", false)}</h1>
      <p>{t("This text will be automatically translated")}</p>
      <p style={{ color: "black" }}>
        welcome
        <p style={{ color: "read" }}> to </p>our app
      </p>
    </div>
  );
};
```

**Use with nested text formatting:**

```typescript
import { useAutoTranslate, FormattedText } from "react-native-autolocalise";

const MyComponent = () => {
  const { t } = useAutoTranslate();

  return (
    <FormattedText>
      <Text>
        Hello, we <Text style={{ color: "red" }}>want</Text> you to be{" "}
        <Text style={{ fontWeight: "bold" }}>happy</Text>!
      </Text>
    </FormattedText>
  );
};
```

**Use with params:**

```typescript
import { useAutoTranslate } from "react-native-autolocalise";

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
Refer: https://docs.expo.dev/versions/latest/sdk/localization/

```typescript
import * as Localization from "expo-localization";

// Get the device locale
const locale = Localization.getLocales()[0]?.languageCode;
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
- `loading`: Boolean indicating initialization of static translations
- `error`: Error object if translation loading failed

### Persist for Editing

The 'persist' means the string will be persisted so that you can review and edit in the [dashboard](https://dashboard.autolocalise.com), default is true, if the content is dynamic or you don't want to see in the dashboard, pass 'false'.

```typescript
import { useAutoTranslate } from "react-native-autolocalise";
const MyComponent = () => {
  const { t } = useAutoTranslate();
  return (
    <div>
      <h1>{t("Welcome to our app!", false)}</h1>
    </div>
  );
};
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
