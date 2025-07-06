import { Inject, Injectable, InjectionToken } from '@angular/core';

/**
 * Injection token for accessing the browser's `localStorage`.
 * Provides a mock storage if `localStorage` is not available (e.g., in SSR or specific browser settings).
 */
export const LOCAL_STORAGE = new InjectionToken<Storage>('LocalStorage', {
  providedIn: 'root',
  factory: () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    // Provide a mock storage if localStorage is not available
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;
  }
});

/**
 * Injection token for accessing the browser's `sessionStorage`.
 * Provides a mock storage if `sessionStorage` is not available.
 */
export const SESSION_STORAGE = new InjectionToken<Storage>('SessionStorage', {
  providedIn: 'root',
  factory: () => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
    // Provide a mock storage if sessionStorage is not available
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;
  }
});

/**
 * @Injectable
 * Service for interacting with browser's Web Storage APIs (`localStorage` and `sessionStorage`).
 * It handles JSON serialization/deserialization and uses an application-specific prefix for keys
 * to prevent collisions. Includes fallbacks for environments where Web Storage might not be available
 * through the use of `InjectionToken` factories.
 */
@Injectable({
  providedIn: 'root'
})
export class StorageService {
  /** Prefix for all keys stored by this service to avoid naming conflicts. */
  private readonly prefix = 'pfd_'; // Personal Finance Dashboard prefix

  /**
   * Initializes the service with instances of localStorage and sessionStorage,
   * potentially using mock fallbacks if the browser environment doesn't provide them.
   * @param localStorage Injected localStorage object.
   * @param sessionStorage Injected sessionStorage object.
   */
  constructor(
    @Inject(LOCAL_STORAGE) private localStorage: Storage,
    @Inject(SESSION_STORAGE) private sessionStorage: Storage
  ) {}

  // --- Local Storage Methods ---

  /**
   * Saves an item to `localStorage`. The value is JSON-serialized.
   * All keys are automatically prefixed with the application prefix.
   * Catches and logs errors if storage fails (e.g., quota exceeded).
   * @template T The type of the value to store.
   * @param key The key under which to store the value (without the prefix).
   * @param value The value to store.
   */
  localSetItem<T>(key: string, value: T): void {
    try {
      this.localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (e) {
      console.error('Error saving to localStorage', e);
    }
  }

  /**
   * Retrieves an item from `localStorage`. The item is JSON-parsed.
   * All keys are automatically prefixed with the application prefix.
   * Catches and logs errors if parsing fails, returning null.
   * @template T The expected type of the retrieved value.
   * @param key The key of the item to retrieve (without the prefix).
   * @returns The retrieved and parsed value, or `null` if the key is not found or if parsing fails.
   */
  localGetItem<T>(key: string): T | null {
    try {
      const item = this.localStorage.getItem(this.prefix + key);
      if (item === null) {
        return null;
      }
      return JSON.parse(item) as T;
    } catch (e) {
      console.error('Error getting data from localStorage', e);
      return null;
    }
  }

  /**
   * Removes an item from `localStorage`.
   * All keys are automatically prefixed with the application prefix.
   * Catches and logs errors if removal fails.
   * @param key The key of the item to remove (without the prefix).
   */
  localRemoveItem(key: string): void {
    try {
      this.localStorage.removeItem(this.prefix + key);
    } catch (e) {
      console.error('Error removing item from localStorage', e);
    }
  }

  /**
   * Clears only items managed by this service (those with the application prefix) from `localStorage`.
   * This method iterates through keys to safely remove only prefixed items, avoiding accidental
   * deletion of other data.
   * To clear all `localStorage` (including items not set by this service),
   * inject `LOCAL_STORAGE` and call `clear()` on it directly, with caution.
   */
  localClear(): void {
    try {
      for (let i = this.localStorage.length - 1; i >= 0; i--) {
        const key = this.localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          this.localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.error('Error clearing prefixed items from localStorage', e);
    }
  }

  // --- Session Storage Methods ---

  /**
   * Saves an item to `sessionStorage`. The value is JSON-serialized.
   * All keys are automatically prefixed with the application prefix.
   * Catches and logs errors if storage fails.
   * @template T The type of the value to store.
   * @param key The key under which to store the value (without the prefix).
   * @param value The value to store.
   */
  sessionSetItem<T>(key: string, value: T): void {
    try {
      this.sessionStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (e) {
      console.error('Error saving to sessionStorage', e);
    }
  }

  /**
   * Retrieves an item from `sessionStorage`. The item is JSON-parsed.
   * All keys are automatically prefixed with the application prefix.
   * Catches and logs errors if parsing fails, returning null.
   * @template T The expected type of the retrieved value.
   * @param key The key of the item to retrieve (without the prefix).
   * @returns The retrieved and parsed value, or `null` if the key is not found or if parsing fails.
   */
  sessionGetItem<T>(key: string): T | null {
    try {
      const item = this.sessionStorage.getItem(this.prefix + key);
      if (item === null) {
        return null;
      }
      return JSON.parse(item) as T;
    } catch (e) {
      console.error('Error getting data from sessionStorage', e);
      return null;
    }
  }

  /**
   * Removes an item from `sessionStorage`.
   * All keys are automatically prefixed with the application prefix.
   * Catches and logs errors if removal fails.
   * @param key The key of the item to remove (without the prefix).
   */
  sessionRemoveItem(key: string): void {
    try {
      this.sessionStorage.removeItem(this.prefix + key);
    } catch (e) {
      console.error('Error removing item from sessionStorage', e);
    }
  }

  /**
   * Clears only items managed by this service (those with the application prefix) from `sessionStorage`.
   * This method iterates through keys to safely remove only prefixed items.
   * To clear all `sessionStorage` (including items not set by this service),
   * inject `SESSION_STORAGE` and call `clear()` on it directly, with caution.
   */
  sessionClear(): void {
    try {
      for (let i = this.sessionStorage.length - 1; i >= 0; i--) {
        const key = this.sessionStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          this.sessionStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.error('Error clearing prefixed items from sessionStorage', e);
    }
  }

  // --- Availability Checks ---

  /**
   * Checks if `localStorage` is available and functional in the current browser.
   * Note: The service uses injection tokens with factories that provide mock storage
   * if Web Storage is unavailable, so these checks are mostly for informational purposes
   * if direct confirmation of browser support is needed by a component.
   * @returns `true` if `localStorage` is available, `false` otherwise.
   */
  isLocalStorageAvailable(): boolean {
    try {
      const testKey = '__test_local_storage__'; // More specific test key
      this.localStorage.setItem(testKey, testKey);
      this.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Checks if `sessionStorage` is available and functional in the current browser.
   * Similar to `isLocalStorageAvailable`, this is mostly informational due to mock fallbacks.
   * @returns `true` if `sessionStorage` is available, `false` otherwise.
   */
  isSessionStorageAvailable(): boolean {
    try {
      const testKey = '__test_session_storage__'; // More specific test key
      this.sessionStorage.setItem(testKey, testKey);
      this.sessionStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }
}
