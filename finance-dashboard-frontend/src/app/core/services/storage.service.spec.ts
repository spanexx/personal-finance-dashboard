import { TestBed } from '@angular/core/testing';
import { StorageService, LOCAL_STORAGE, SESSION_STORAGE } from './storage.service';

// Mock Storage implementation
class MockStorage implements Storage {
  private store: { [key: string]: string } = {};
  public length: number = 0;

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    if (typeof value !== 'string') {
      // Real localStorage stringifies, so mimic that for testing if objects are passed by mistake
      value = String(value);
    }
    this.store[key] = value;
    this.length = Object.keys(this.store).length;
  }

  removeItem(key: string): void {
    delete this.store[key];
    this.length = Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
    this.length = 0;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

describe('StorageService', () => {
  let service: StorageService;
  let localStorageMock: Storage;
  let sessionStorageMock: Storage;
  const prefix = 'pfd_'; // Match the prefix in the service

  beforeEach(() => {
    localStorageMock = new MockStorage();
    sessionStorageMock = new MockStorage();

    TestBed.configureTestingModule({
      providers: [
        StorageService,
        { provide: LOCAL_STORAGE, useValue: localStorageMock },
        { provide: SESSION_STORAGE, useValue: sessionStorageMock }
      ]
    });
    service = TestBed.inject(StorageService);

    // Clear mocks before each test
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // Local Storage Tests
  describe('LocalStorage', () => {
    it('localSetItem should stringify and store an object with prefix', () => {
      const testKey = 'testObject';
      const testValue = { name: 'John', age: 30 };
      service.localSetItem(testKey, testValue);
      expect(localStorageMock.getItem(prefix + testKey)).toBe(JSON.stringify(testValue));
    });

    it('localGetItem should retrieve and parse an object with prefix', () => {
      const testKey = 'testObjectGet';
      const testValue = { name: 'Jane', age: 25 };
      localStorageMock.setItem(prefix + testKey, JSON.stringify(testValue)); // Setup mock directly

      const result = service.localGetItem<{ name: string; age: number }>(testKey);
      expect(result).toEqual(testValue);
    });

    it('localGetItem should return null for non-existent key', () => {
      expect(service.localGetItem('nonExistentKey')).toBeNull();
    });

    it('localGetItem should return null and log error for invalid JSON', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const testKey = 'invalidJson';
      localStorageMock.setItem(prefix + testKey, 'this is not json');

      expect(service.localGetItem(testKey)).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('localRemoveItem should remove an item with prefix', () => {
      const testKey = 'removeItem';
      localStorageMock.setItem(prefix + testKey, '"test"');
      service.localRemoveItem(testKey);
      expect(localStorageMock.getItem(prefix + testKey)).toBeNull();
    });

    it('localClear should remove only prefixed items', () => {
      localStorageMock.setItem(prefix + 'item1', '"data1"');
      localStorageMock.setItem('otherItem', '"otherData"');
      localStorageMock.setItem(prefix + 'item2', '"data2"');

      service.localClear();

      expect(localStorageMock.getItem(prefix + 'item1')).toBeNull();
      expect(localStorageMock.getItem(prefix + 'item2')).toBeNull();
      expect(localStorageMock.getItem('otherItem')).toBe('"otherData"'); // Non-prefixed item should remain
    });
  });

  // Session Storage Tests
  describe('SessionStorage', () => {
    it('sessionSetItem should stringify and store an object with prefix', () => {
      const testKey = 'sessionObject';
      const testValue = { id: '123', status: 'active' };
      service.sessionSetItem(testKey, testValue);
      expect(sessionStorageMock.getItem(prefix + testKey)).toBe(JSON.stringify(testValue));
    });

    it('sessionGetItem should retrieve and parse an object with prefix', () => {
      const testKey = 'sessionObjectGet';
      const testValue = { id: '456', status: 'inactive' };
      sessionStorageMock.setItem(prefix + testKey, JSON.stringify(testValue));

      const result = service.sessionGetItem<{ id: string; status: string }>(testKey);
      expect(result).toEqual(testValue);
    });

    it('sessionGetItem should return null for non-existent key', () => {
      expect(service.sessionGetItem('nonExistentKeySession')).toBeNull();
    });

    it('sessionGetItem should return null and log error for invalid JSON', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const testKey = 'invalidJsonSession';
      sessionStorageMock.setItem(prefix + testKey, '{ not json');

      expect(service.sessionGetItem(testKey)).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('sessionRemoveItem should remove an item with prefix', () => {
      const testKey = 'removeItemSession';
      sessionStorageMock.setItem(prefix + testKey, '"sessionTest"');
      service.sessionRemoveItem(testKey);
      expect(sessionStorageMock.getItem(prefix + testKey)).toBeNull();
    });

    it('sessionClear should remove only prefixed items', () => {
      sessionStorageMock.setItem(prefix + 'sessionItem1', '"s_data1"');
      sessionStorageMock.setItem('otherSessionItem', '"s_otherData"');
      sessionStorageMock.setItem(prefix + 'sessionItem2', '"s_data2"');

      service.sessionClear();

      expect(sessionStorageMock.getItem(prefix + 'sessionItem1')).toBeNull();
      expect(sessionStorageMock.getItem(prefix + 'sessionItem2')).toBeNull();
      expect(sessionStorageMock.getItem('otherSessionItem')).toBe('"s_otherData"');
    });
  });

  describe('isLocalStorageAvailable', () => {
    it('should return true if localStorage is available and working', () => {
      // Default mock is working
      expect(service.isLocalStorageAvailable()).toBe(true);
    });

    it('should return false if localStorage.setItem throws an error', () => {
      jest.spyOn(localStorageMock, 'setItem').mockImplementationOnce(() => {
        throw new Error('Storage disabled');
      });
      expect(service.isLocalStorageAvailable()).toBe(false);
    });
  });

  describe('isSessionStorageAvailable', () => {
    it('should return true if sessionStorage is available and working', () => {
      expect(service.isSessionStorageAvailable()).toBe(true);
    });

    it('should return false if sessionStorage.setItem throws an error', () => {
      jest.spyOn(sessionStorageMock, 'setItem').mockImplementationOnce(() => {
        throw new Error('Storage disabled');
      });
      expect(service.isSessionStorageAvailable()).toBe(false);
    });
  });
});
