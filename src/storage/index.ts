interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export async function getStorageAdapter(): Promise<StorageAdapter> {
  // Check if we're in React Native/Expo environment
  const isReactNative =
    typeof global !== "undefined" &&
    typeof global.navigator?.product === "string" &&
    global.navigator.product === "ReactNative";

  if (isReactNative) {
    // Try Expo SecureStore first
    try {
      const ExpoSecureStore = await import("expo-secure-store").catch(
        () => null
      );
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
      const AsyncStorage = await import(
        "@react-native-async-storage/async-storage"
      ).catch(() => null);
      if (AsyncStorage?.default) {
        return AsyncStorage.default;
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
