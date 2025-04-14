import { StorageAdapter } from "../types";

// Web storage adapter using localStorage
export class WebStorageAdapter implements StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}

// React Native storage adapter using AsyncStorage
export class NativeStorageAdapter implements StorageAdapter {
  private AsyncStorage: any;

  constructor() {
    // Dynamic import to prevent bundling issues
    this.AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
  }

  async getItem(key: string): Promise<string | null> {
    return this.AsyncStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.AsyncStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    await this.AsyncStorage.removeItem(key);
  }
}

// Factory function to get the appropriate storage adapter
export function getStorageAdapter(): StorageAdapter {
  if (typeof window !== "undefined" && window.localStorage) {
    return new WebStorageAdapter();
  }
  return new NativeStorageAdapter();
}
