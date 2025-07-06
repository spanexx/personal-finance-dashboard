import 'jest-preset-angular/setup-jest';

// Simple LocalStorage Mock for tests
class LocalStorageMock {
  private store: { [key: string]: string } = {};
  getItem(key: string): string | null { return this.store[key] || null; }
  setItem(key: string, value: string): void { this.store[key] = value.toString(); }
  removeItem(key: string): void { delete this.store[key]; }
  clear(): void { this.store = {}; }
  get length(): number { return Object.keys(this.store).length; }
  key(index: number): string | null { return Object.keys(this.store)[index] || null; }
}

Object.defineProperty(window, 'localStorage', { value: new LocalStorageMock(), writable: true });
Object.defineProperty(window, 'sessionStorage', { value: new LocalStorageMock(), writable: true }); // Can use the same mock

Object.defineProperty(window, 'CSS', { value: null });

Object.defineProperty(document, 'doctype', {
  value: '<!DOCTYPE html>'
});

Object.defineProperty(window, 'getComputedStyle', {
  value: () => {
    return {
      display: 'none',
      appearance: ['-webkit-appearance']
    };
  }
});

/**
* ISSUE: https://github.com/angular/material2/issues/7101
* Workaround for JSDOM missing getBoundingClientRect on SVGElement
*/
if (typeof SVGElement !== 'undefined' && SVGElement.prototype.getBoundingClientRect === undefined) {
  Object.defineProperty(SVGElement.prototype, 'getBoundingClientRect', {
    value: () => {
      return {
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
      };
    },
  });
}


// Mock for ResizeObserver
if (typeof ResizeObserver === 'undefined') {
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
}

// Mock for IntersectionObserver
if (typeof IntersectionObserver === 'undefined') {
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
    takeRecords: () => []
  }));
}

// Mock for window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Suppress console.error and console.warn during tests to keep output clean
// You can comment these out if you need to see these logs during debugging.
// global.console = {
//   ...global.console,
//   error: jest.fn(),
//   warn: jest.fn(),
//   info: jest.fn(), // Optional: if you want to suppress info logs too
//   debug: jest.fn(), // Optional: if you want to suppress debug logs
// };
