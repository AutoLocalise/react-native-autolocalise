# React AutoLocalise

A lightweight, efficient auto-translation SDK for React, React Native, and Expo applications. This SDK provides seamless integration for automatic content translation with built-in caching support.

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

```typescript
import { TranslationProvider } from "react-autolocalise";

const App = () => {
  const config = {
    apiKey: "your-api-key",
    locale: "fr",
    fallbackLocale: "en",
    projectId: "your-project-id",
    cacheTTL: 24, // Cache validity in hours (optional, defaults to 24)
  };

  return (
    <TranslationProvider config={config}>
      <YourApp />
    </TranslationProvider>
  );
};
```

### 2. Use the Translation Hook

```typescript
import { useAutoTranslate } from "react-autolocalise";

const MyComponent = () => {
  const { t, loading, error } = useAutoTranslate();

  if (loading) return <div>Loading translations...</div>;
  if (error) return <div>Error loading translations</div>;

  return (
    <div>
      <h1>{t("Welcome to our app!")}</h1>
      <p>{t("This text will be automatically translated")}</p>
    </div>
  );
};
```

### 3. Non-React Usage

```typescript
import autoTranslate from "react-autolocalise";

autoTranslate.init({
  apiKey: "your-api-key",
  locale: "fr",
  fallbackLocale: "en",
  projectId: "your-project-id",
});
```

## API Reference

### TranslationProvider Props

| Prop   | Type              | Description                                      |
| ------ | ----------------- | ------------------------------------------------ |
| config | TranslationConfig | Configuration object for the translation service |

### TranslationConfig

| Property       | Type   | Required | Description                                       |
| -------------- | ------ | -------- | ------------------------------------------------- |
| apiKey         | string | Yes      | Your API key for the translation service          |
| locale         | string | Yes      | Target locale for translations                    |
| fallbackLocale | string | Yes      | Fallback locale when translations are unavailable |
| projectId      | string | Yes      | Your project identifier                           |
| cacheTTL       | number | No       | Cache validity period in hours (default: 24)      |

### useAutoTranslate Hook

Returns an object with:

- `t`: Translation function
- `loading`: Boolean indicating if translations are loading
- `error`: Error object if translation loading failed

## Cache Structure

The SDK uses a two-level caching strategy:

1. In-memory cache for fast access
2. Persistent storage (localStorage/AsyncStorage) for offline support

Cache format:

```json
{
  "fr": {
    "hashedKey1": "Bonjour",
    "hashedKey2": "Au revoir"
  }
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
