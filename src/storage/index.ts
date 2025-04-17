interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export function getStorageAdapter(): StorageAdapter {
  // Check if we're in React Native/Expo environment
  const isReactNative =
    typeof global !== "undefined" &&
    typeof require === "function" &&
    !!(
      require.resolve("react-native") ||
      require.resolve("@react-native-async-storage/async-storage")
    );

  if (isReactNative) {
    // Dynamic imports for React Native/Expo
    let storage: StorageAdapter | null = null;

    // Try Expo SecureStore first
    try {
      const ExpoSecureStore = require("expo-secure-store");
      if (ExpoSecureStore) {
        return {
          getItem: ExpoSecureStore.getItemAsync,
          setItem: ExpoSecureStore.setItemAsync,
          removeItem: ExpoSecureStore.deleteItemAsync,
        };
      }
    } catch (e) {
      // Expo SecureStore not available, try AsyncStorage
    }

    // Try React Native AsyncStorage
    try {
      const AsyncStorage =
        require("@react-native-async-storage/async-storage").default;
      if (AsyncStorage) {
        return AsyncStorage;
      }
    } catch (e) {
      // AsyncStorage not available
    }

    throw new Error(
      "No storage adapter available. Please install either expo-secure-store or @react-native-async-storage/async-storage"
    );
  }

  // Web environment - use localStorage with Promise wrapper
  if (typeof window !== "undefined" && window.localStorage) {
    return {
      getItem: async (key: string) => {
        try {
          return localStorage.getItem(key);
        } catch (e) {
          console.error("localStorage.getItem failed:", e);
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          localStorage.setItem(key, value);
        } catch (e) {
          console.error("localStorage.setItem failed:", e);
          throw e;
        }
      },
      removeItem: async (key: string) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.error("localStorage.removeItem failed:", e);
          throw e;
        }
      },
    };
  }

  throw new Error("No storage adapter available for this environment");
}
