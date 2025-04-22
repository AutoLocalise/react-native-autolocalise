import AsyncStorage from "@react-native-async-storage/async-storage";

interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export function getStorageAdapter(): StorageAdapter {
  if (!AsyncStorage) {
    throw new Error(
      "No storage adapter available. Please install @react-native-async-storage/async-storage"
    );
  }
  return AsyncStorage;
}
