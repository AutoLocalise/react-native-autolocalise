# AutoLocalise React Native/Expo SDK

This is SDK for [AutoLocalise](https://www.autolocalise.com).

A lightweight, efficient auto-translation SDK for React Native and Expo applications. This SDK provides seamless integration for automatic content translation with support for offline mode.

You don't need to prepare any translation files — configure authentication and the SDK handles the rest.

## Features

- React Native, Expo, and Expo Web support
- API key or access token authentication
- Automatic string translation with offline caching
- Nested text formatting and parameter interpolation

## Installation

### React Native / Expo (Native)

```bash
npm install react-native-autolocalise @react-native-async-storage/async-storage
```

### Expo Web

```bash
npm install react-native-autolocalise
```

The SDK uses AsyncStorage on native and `localStorage` on web automatically.

## Usage

### 1. Initialize the SDK

Wrap your app with `TranslationProvider`. Use **one** auth method — not both.

**Access token** (recommended for production):

Your backend holds the API key and returns short-lived tokens to the app.

```typescript
import { TranslationProvider } from "react-native-autolocalise";

const config = {
  getAccessToken: async () => {
    const res = await fetch("https://your-api.com/autolocalise-token");
    if (!res.ok) throw new Error("Token fetch failed");
    return res.json(); // { accessToken, expiresAt }
  },
  sourceLocale: "en",
  targetLocale: "es",
};

export default function App() {
  return (
    <TranslationProvider config={config}>
      <YourApp />
    </TranslationProvider>
  );
}
```

**API key** (development only):

```typescript
const config = {
  apiKey: "your-api-key",
  sourceLocale: "en",
  targetLocale: "es",
};

export default function App() {
  return (
    <TranslationProvider config={config}>
      <YourApp />
    </TranslationProvider>
  );
}
```

### 2. Translate text

```typescript
import { View, Text } from "react-native";
import { useAutoTranslate } from "react-native-autolocalise";

const MyComponent = () => {
  const { t, loading, error } = useAutoTranslate();

  return (
    <View>
      <Text>{t("Welcome to our app!")}</Text>
      <Text>{t("Dynamic content", false)}</Text>
    </View>
  );
};
```

Pass `persist: false` as the second argument to skip saving a string to the [dashboard](https://dashboard.autolocalise.com).

### 3. Nested formatting

```typescript
import { Text, View } from "react-native";
import { FormattedText } from "react-native-autolocalise";

const MyComponent = () => (
  <View>
    <FormattedText>
      <Text>
        Hello, we <Text style={{ color: "red" }}>want</Text> you to be{" "}
        <Text style={{ fontWeight: "bold" }}>happy</Text>!
      </Text>
    </FormattedText>
  </View>
);
```

### 4. Parameters

```typescript
const { t } = useAutoTranslate();

t("Welcome, {{1}}!", false).replace("{{1}}", name);
```

## API Reference

### TranslationConfig

| Property         | Type                                        | Required    | Description                                 |
| ---------------- | ------------------------------------------- | ----------- | ------------------------------------------- |
| `getAccessToken` | `() => Promise<{ accessToken, expiresAt }>` | Conditional | Fetch a short-lived token from your backend |
| `apiKey`         | `string`                                    | Conditional | API key (development only)                  |
| `sourceLocale`   | `string`                                    | Yes         | Source language code                        |
| `targetLocale`   | `string`                                    | Yes         | Target language code                        |

When `sourceLocale` equals `targetLocale`, no translation requests are sent.

### useAutoTranslate

| Property  | Type                                          | Description                                   |
| --------- | --------------------------------------------- | --------------------------------------------- |
| `t`       | `(text: string, persist?: boolean) => string` | Translate a string                            |
| `loading` | `boolean`                                     | `true` while initial translations are loading |
| `error`   | `Error \| null`                               | Initialization error, if any                  |

## Locale Format

Use ISO 639-1 language codes, optionally with a region: `en`, `fr`, `zh-CN`, `pt-BR`.

### Getting the device locale

**Expo:**

```bash
npm install expo-localization
```

```typescript
import * as Localization from "expo-localization";

const locale = Localization.getLocales()[0]?.languageTag; // e.g. 'en-US'
```

**React Native:**

```typescript
import { NativeModules, Platform } from "react-native";

const locale =
  Platform.OS === "ios"
    ? NativeModules.SettingsManager.settings.AppleLocale
    : NativeModules.I18nManager.localeIdentifier;
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
