import { StorageAdapter } from "../types";

// localStorage adapter for web environments
const localStorageAdapter: StorageAdapter = {
  getItem: (key: string): Promise<string | null> => {
    return Promise.resolve(localStorage.getItem(key));
  },
  setItem: (key: string, value: string): Promise<void> => {
    localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    localStorage.removeItem(key);
    return Promise.resolve();
  },
};

export async function getStorageAdapter(): Promise<StorageAdapter> {
  // Try to use AsyncStorage for native platforms
  try {
    const AsyncStorage = await import(
      "@react-native-async-storage/async-storage"
    ).catch(() => null);
    if (AsyncStorage?.default) {
      return AsyncStorage.default;
    }
  } catch {
    // Fall through to localStorage
  }

  // Fall back to localStorage for web environments
  if (typeof window !== "undefined" && window.localStorage) {
    return localStorageAdapter;
  }

  throw new Error(
    "No storage adapter available. Please ensure you are running in a browser or native environment."
  );
}
