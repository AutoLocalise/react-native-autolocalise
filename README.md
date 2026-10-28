# AutoLocalise React Native/Expo SDK

This is SDK for [AutoLocalise](https://www.autolocalise.com).

A lightweight, efficient auto-translation SDK for React Native and Expo applications. This SDK provides seamless integration for automatic content translation with support for offline mode.

You don't need to prepare any translation files. Provide an API key or an access token and the SDK handles the rest. Get your API key from the [dashboard](https://dashboard.autolocalise.com).

## Features

- React Native, Expo, and Expo Web support
- API key or access token authentication, with auto-refresh for tokens
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

Wrap your app with `TranslationProvider` and pass a `config` with **one** auth method (see [Authentication](#authentication)).

Define `config` outside your component (or memoize it). A new `getAccessToken` function on every render recreates the SDK and refetches the token.

```typescript
import { TranslationProvider } from "react-native-autolocalise";

const config = {
  getAccessToken: async () => {
    const res = await fetch("https://your-api.com/autolocalise-token");
    if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
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

See [Authentication](#authentication) for the server route and the API key option.

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

`t()` returns the original text until the translation arrives, then your component re-renders with it.

Pass `false` as the second argument (`t(text, false)`) to skip saving a string to the [dashboard](https://dashboard.autolocalise.com). Use this for dynamic content.

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

t("Welcome, {{1}}!").replace("{{1}}", name);
```

Replace the placeholder after translating, so the name is never sent for translation. Each `.replace` call replaces the first match only.

## API Reference

### TranslationConfig

| Property         | Type                                        | Required    | Description                                 |
| ---------------- | ------------------------------------------- | ----------- | ------------------------------------------- |
| `getAccessToken` | `() => Promise<AccessTokenResponse>`        | Yes\*       | Fetch a short-lived token from your backend. Called on init and when the token expires. |
| `apiKey`         | `string`                                    | Yes\*       | API key sent with translation requests. |
| `sourceLocale`   | `string`                                    | Yes         | Source language code                        |
| `targetLocale`   | `string`                                    | Yes         | Target language code                        |

\* Provide exactly one of `apiKey` or `getAccessToken`. Providing both or neither throws a `ConfigurationError` when the provider renders.

`AccessTokenResponse` is `{ accessToken: string, expiresAt: number | string }`. `expiresAt` is a Unix timestamp in milliseconds or an ISO 8601 string.

When `sourceLocale` equals `targetLocale`, no translation requests are sent.

### useAutoTranslate

| Property  | Type                                          | Description                                   |
| --------- | --------------------------------------------- | --------------------------------------------- |
| `t`       | `(text: string, persist?: boolean) => string` | Translate a string                            |
| `loading` | `boolean`                                     | `true` while initial translations are loading |
| `error`   | `Error \| null`                               | Unexpected initialization error. Network and token failures are logged to the console and untranslated text is shown. |

## Authentication

Choose one method.

- **Access token (recommended):** your server holds the API key and exchanges it for a short-lived token. The API key never ships in your app. The SDK refreshes the token automatically.
- **API key:** simpler, but the key is bundled in your app and can be extracted.

### Access token

Keep the key in server environment variables.

```bash
# .env — server only, never in the app
AUTOLOCALISE_API_KEY=your-api-key
AUTOLOCALISE_TOKEN_URL=https://<your-project>.supabase.co/functions/v1/auth-token
```

Create a server route (for example `GET /autolocalise-token`) that returns the result of this function:

```typescript
export async function getAccessToken() {
  const res = await fetch(process.env.AUTOLOCALISE_TOKEN_URL!, {
    method: "POST",
    headers: { "x-api-key": process.env.AUTOLOCALISE_API_KEY! },
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  return res.json(); // { accessToken, expiresAt }
}
```

The app only calls your route, as in the [setup example](#1-initialize-the-sdk). The SDK stores the token in memory, refreshes it before expiry, and retries once if a translation request returns `token_expired`.

### API key

Pass the key in config when your app calls AutoLocalise directly:

```typescript
const config = {
  apiKey: "your-api-key",
  sourceLocale: "en",
  targetLocale: "es",
};
```

## Locale Format

Use BCP 47 language codes with a hyphen, optionally with a region or script: `en`, `fil`, `zh-CN`, `pt-BR`, `es-419`, `bs-Cyrl`.

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

// Native values look like "en_US". Use a hyphen: "en-US".
const targetLocale = locale?.replace("_", "-");
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
