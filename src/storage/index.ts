// import AsyncStorage from "@react-native-async-storage/async-storage";

interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export async function getStorageAdapter(): Promise<StorageAdapter> {
  try {
    const AsyncStorage = await import(
      "@react-native-async-storage/async-storage"
    ).catch(() => null);
    if (AsyncStorage?.default) {
      return AsyncStorage.default;
    }
  } catch (e) {
    throw new Error(
      "No storage adapter available. Please install @react-native-async-storage/async-storage"
    );
  }
}
