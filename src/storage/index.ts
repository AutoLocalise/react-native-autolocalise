import { StorageAdapter } from "../types";

export async function getStorageAdapter(): Promise<StorageAdapter> {
  try {
    const AsyncStorage = await import(
      "@react-native-async-storage/async-storage"
    ).catch(() => null);
    if (AsyncStorage?.default) {
      return AsyncStorage.default;
    }

    // If AsyncStorage is not available, throw an error
    throw new Error(
      "No storage adapter available. Please install @react-native-async-storage/async-storage"
    );
  } catch (e) {
    throw new Error(
      "No storage adapter available. Please install @react-native-async-storage/async-storage"
    );
  }
}
