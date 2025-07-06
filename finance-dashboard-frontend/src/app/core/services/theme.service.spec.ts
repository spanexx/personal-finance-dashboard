import { TestBed } from '@angular/core/testing';
import { Renderer2, RendererFactory2 } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ThemeService, AppTheme } from './theme.service';
import { StorageService } from './storage.service';

// Mocks
class MockStorageService {
  private store: { [key: string]: string } = {};
  localSetItem = jest.fn((key: string, value: any) => {
    this.store[key] = JSON.stringify(value);
  });
  localGetItem = jest.fn((key: string) => {
    const item = this.store[key];
    return item ? JSON.parse(item) : null;
  });
}

class MockRenderer2 {
  addClass = jest.fn();
  removeClass = jest.fn();
}

describe('ThemeService', () => {
  let service: ThemeService;
  let storageServiceMock: MockStorageService;
  let renderer2Mock: MockRenderer2;
  let documentMock: Document;

  const THEME_STORAGE_KEY = 'app-theme'; // As defined in ThemeService
  const LIGHT_THEME_CLASS = 'theme-light';
  const DARK_THEME_CLASS = 'theme-dark';

  beforeEach(() => {
    storageServiceMock = new MockStorageService();
    renderer2Mock = new MockRenderer2();

    // Mock RendererFactory2
    const rendererFactoryMock = {
      createRenderer: () => renderer2Mock
    } as unknown as RendererFactory2;


    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: StorageService, useValue: storageServiceMock },
        { provide: RendererFactory2, useValue: rendererFactoryMock },
        { provide: DOCUMENT, useValue: document } // Use actual document or a mock if preferred
      ]
    });
    service = TestBed.inject(ThemeService);
    documentMock = TestBed.inject(DOCUMENT);

    // Reset mocks before each test
    storageServiceMock.localSetItem.mockClear();
    storageServiceMock.localGetItem.mockClear();
    renderer2Mock.addClass.mockClear();
    renderer2Mock.removeClass.mockClear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initialization and loadAndApplyTheme', () => {
    it('should load theme from storage if available and apply it', () => {
      storageServiceMock.localGetItem.mockReturnValueOnce(AppTheme.Dark); // Simulate stored theme
      service.loadAndApplyTheme(); // Usually called by constructor or app init

      expect(storageServiceMock.localGetItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
      expect(renderer2Mock.addClass).toHaveBeenCalledWith(documentMock.body, DARK_THEME_CLASS);
      expect(renderer2Mock.removeClass).toHaveBeenCalledWith(documentMock.body, LIGHT_THEME_CLASS);
      service.getCurrentThemeChoice().subscribe(theme => expect(theme).toBe(AppTheme.Dark));
    });

    it('should default to AppTheme.System and apply system preference if no theme in storage', () => {
      storageServiceMock.localGetItem.mockReturnValueOnce(null); // No theme in storage

      // Mock system preference for dark mode
      const matchMediaSpy = jest.spyOn(window, 'matchMedia').mockReturnValue({
        matches: true, media: '(prefers-color-scheme: dark)'
      } as MediaQueryList);

      service.loadAndApplyTheme();

      expect(storageServiceMock.localGetItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
      expect(renderer2Mock.addClass).toHaveBeenCalledWith(documentMock.body, DARK_THEME_CLASS);
      service.getCurrentThemeChoice().subscribe(theme => expect(theme).toBe(AppTheme.Dark)); // Should resolve to Dark

      matchMediaSpy.mockRestore();
    });

    it('should default to AppTheme.System and apply light if system preference is light', () => {
      storageServiceMock.localGetItem.mockReturnValueOnce(null);
      const matchMediaSpy = jest.spyOn(window, 'matchMedia').mockReturnValue({
        matches: false, media: '(prefers-color-scheme: dark)'
      } as MediaQueryList);

      service.loadAndApplyTheme();
      expect(renderer2Mock.addClass).toHaveBeenCalledWith(documentMock.body, LIGHT_THEME_CLASS);
      service.getCurrentThemeChoice().subscribe(theme => expect(theme).toBe(AppTheme.Light));

      matchMediaSpy.mockRestore();
    });
  });

  describe('setCurrentTheme', () => {
    it('should apply light theme and save to storage', () => {
      service.setCurrentTheme(AppTheme.Light);
      expect(storageServiceMock.localSetItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, AppTheme.Light);
      expect(renderer2Mock.addClass).toHaveBeenCalledWith(documentMock.body, LIGHT_THEME_CLASS);
      expect(renderer2Mock.removeClass).toHaveBeenCalledWith(documentMock.body, DARK_THEME_CLASS);
      service.getCurrentThemeChoice().subscribe(theme => expect(theme).toBe(AppTheme.Light));
    });

    it('should apply dark theme and save to storage', () => {
      service.setCurrentTheme(AppTheme.Dark);
      expect(storageServiceMock.localSetItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, AppTheme.Dark);
      expect(renderer2Mock.addClass).toHaveBeenCalledWith(documentMock.body, DARK_THEME_CLASS);
      expect(renderer2Mock.removeClass).toHaveBeenCalledWith(documentMock.body, LIGHT_THEME_CLASS);
      service.getCurrentThemeChoice().subscribe(theme => expect(theme).toBe(AppTheme.Dark));
    });

    it('should apply system theme preference and save "system" to storage', () => {
      const matchMediaSpy = jest.spyOn(window, 'matchMedia').mockReturnValue({
        matches: true, media: '(prefers-color-scheme: dark)' // System prefers dark
      } as MediaQueryList);

      service.setCurrentTheme(AppTheme.System);

      expect(storageServiceMock.localSetItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, AppTheme.System);
      // Applies actual system preference (dark)
      expect(renderer2Mock.addClass).toHaveBeenCalledWith(documentMock.body, DARK_THEME_CLASS);
      service.getCurrentThemeChoice().subscribe(theme => expect(theme).toBe(AppTheme.System)); // Choice is 'system'
      service.getEffectiveTheme().subscribe(theme => expect(theme).toBe(AppTheme.Dark)); // Effective is 'dark'

      matchMediaSpy.mockRestore();
    });
  });

  describe('getEffectiveTheme', () => {
     it('should correctly resolve system preference for effective theme', (done) => {
      const matchMediaSpy = jest.spyOn(window, 'matchMedia').mockReturnValue({
        matches: true, media: '(prefers-color-scheme: dark)' // System prefers dark
      } as MediaQueryList);

      service.setCurrentTheme(AppTheme.System);
      service.getEffectiveTheme().subscribe(effectiveTheme => {
        expect(effectiveTheme).toBe(AppTheme.Dark);
        matchMediaSpy.mockRestore();
        done();
      });
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from light to dark', () => {
      service.setCurrentTheme(AppTheme.Light); // Start with light
      service.toggleTheme();
      service.getEffectiveTheme().subscribe(theme => expect(theme).toBe(AppTheme.Dark));
      service.getCurrentThemeChoice().subscribe(theme => expect(theme).toBe(AppTheme.Dark)); // Explicitly set
    });

    it('should toggle from dark to light', () => {
      service.setCurrentTheme(AppTheme.Dark); // Start with dark
      service.toggleTheme();
      service.getEffectiveTheme().subscribe(theme => expect(theme).toBe(AppTheme.Light));
      service.getCurrentThemeChoice().subscribe(theme => expect(theme).toBe(AppTheme.Light));
    });

    it('should toggle from system (resolved to dark) to light', () => {
      const matchMediaSpy = jest.spyOn(window, 'matchMedia').mockReturnValue({
        matches: true, media: '(prefers-color-scheme: dark)'
      } as MediaQueryList);
      service.setCurrentTheme(AppTheme.System); // Start with system (dark)

      service.toggleTheme(); // Should become light

      service.getEffectiveTheme().subscribe(theme => expect(theme).toBe(AppTheme.Light));
      service.getCurrentThemeChoice().subscribe(theme => expect(theme).toBe(AppTheme.Light)); // Now explicitly light
      matchMediaSpy.mockRestore();
    });
  });
});
