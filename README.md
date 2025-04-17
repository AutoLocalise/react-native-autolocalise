# React AutoLocalise

This is SDK for [AutoLocalise](<[AutoLocalise](https://www.autolocalise.com)>).

A lightweight, efficient auto-translation SDK for React, React Native, and Expo applications. This SDK provides seamless integration for automatic content translation and support offline mode.

You don't need to prepare any translation files, just provide your API key and the SDK will handle the rest.

## Features

- 🌐 Cross-platform support (React Web, React Native, Expo)
- 🚀 Automatic string detection and translation
- 💾 Built-in caching with localStorage/AsyncStorage
- 🔄 Efficient batch translation processing
- ⚡️ Tree-shakeable and side-effect free
- 📦 TypeScript support

## Installation

```bash
npm install react-autolocalise
# or
yarn add react-autolocalise
```

## Usage

### 1. Initialize the SDK

<!-- TODO the locale format -->

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

## How to get the locale

### React

### React Native / Expo

## API Reference

### TranslationProvider Props

| Prop   | Type              | Description                                      |
| ------ | ----------------- | ------------------------------------------------ |
| config | TranslationConfig | Configuration object for the translation service |

### TranslationConfig

| Property     | Type   | Required | Description                                                          |
| ------------ | ------ | -------- | -------------------------------------------------------------------- |
| apiKey       | string | Yes      | Your API key for the translation service                             |
| sourceLocale | string | Yes      | (Optional), Target locale for translations, will auto detect if omit |
| sourceLocale | string | Yes      | Fallback locale when translations are unavailable                    |
| cacheTTL     | number | No       | Cache validity period in hours (default: 24)                         |

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
  )
}

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
```
