import { Injectable, Inject, Renderer2, RendererFactory2 } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from './storage.service';

/**
 * Enum representing the available application themes.
 * `System` allows deferring to the user's operating system preference.
 */
export enum AppTheme {
  /** Light theme. */
  Light = 'light',
  /** Dark theme. */
  Dark = 'dark',
  /** Use system preference (light or dark). */
  System = 'system'
}

/** Key used to store the selected theme in local storage. */
const THEME_STORAGE_KEY = 'app-theme';
/** CSS class applied to the body for the light theme. */
const LIGHT_THEME_CLASS = 'theme-light';
/** CSS class applied to the body for the dark theme. */
const DARK_THEME_CLASS = 'theme-dark';

/**
 * @Injectable
 * Service responsible for managing application themes (light, dark, system preference).
 * It handles applying the theme to the document body and persisting the user's choice.
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  /** BehaviorSubject holding the user's current theme choice (Light, Dark, or System). */
  private currentThemeSubject: BehaviorSubject<AppTheme>;
  /** Renderer instance for manipulating DOM classes. */
  private renderer: Renderer2;

  /**
   * Initializes the ThemeService.
   * It creates a renderer, retrieves the initial theme from storage (or defaults to System),
   * and sets up the `currentThemeSubject`.
   * @param document The Document object, injected to manipulate body classes.
   * @param storageService Service for persisting the theme choice.
   * @param rendererFactory Factory to create a Renderer2 instance.
   */
  constructor(
    @Inject(DOCUMENT) private document: Document,
    private storageService: StorageService,
    private rendererFactory: RendererFactory2
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    const initialTheme = this.storageService.localGetItem<AppTheme>(THEME_STORAGE_KEY) || AppTheme.System;
    this.currentThemeSubject = new BehaviorSubject<AppTheme>(initialTheme);
    // Note: loadAndApplyTheme() should ideally be called by AppComponent or similar during app init,
    // not directly in constructor to ensure service is fully constructed.
  }

  /**
   * Loads the current theme preference from storage. If 'System' is chosen or no preference
   * is stored, it resolves to the actual system preference (light/dark) and applies it to the body.
   * This method should be called early in the application's lifecycle (e.g., in `AppComponent.ngOnInit`).
   */
  loadAndApplyTheme(): void {
    let theme = this.currentThemeSubject.getValue(); // Get initial or stored theme

    if (theme === AppTheme.System) {
      theme = this.getSystemPreference();
    }
    this.applyThemeToBody(theme); // Apply light/dark directly
    // Update subject if system preference resolved to a concrete theme
    if (this.currentThemeSubject.getValue() === AppTheme.System) {
        this.currentThemeSubject.next(theme);
    }
  }

  /**
   * Sets the desired theme, applies it, and saves it to storage.
   * @param theme The theme to set (Light, Dark, or System).
   */
  setCurrentTheme(theme: AppTheme): void {
    this.storageService.localSetItem(THEME_STORAGE_KEY, theme);

    let themeToApply = theme;
    if (theme === AppTheme.System) {
      themeToApply = this.getSystemPreference();
    }

    this.applyThemeToBody(themeToApply);
    this.currentThemeSubject.next(theme); // Emit the user's choice (Light, Dark, or System)
  }

  /**
   * Gets an observable emitting the user's current theme preference (Light, Dark, or System).
   * This reflects the choice stored, not necessarily the visually applied theme if 'System' is chosen.
   * @returns An Observable of the `AppTheme` representing the user's preference.
   */
  getCurrentThemeChoice(): Observable<AppTheme> {
    return this.currentThemeSubject.asObservable();
  }

  /**
   * Gets an observable emitting the currently *effective* visual theme (Light or Dark).
   * If the user's preference is 'System', this observable will resolve to the actual
   * light or dark theme based on their OS settings. It also listens for system preference changes.
   * @returns An Observable of the effective `AppTheme.Light` or `AppTheme.Dark`.
   */
  getEffectiveTheme(): Observable<AppTheme.Light | AppTheme.Dark> {
    return new Observable(observer => {
      const updateEffectiveTheme = (chosenTheme: AppTheme) => {
        if (chosenTheme === AppTheme.System) {
          observer.next(this.getSystemPreference());
        } else {
          observer.next(chosenTheme as AppTheme.Light | AppTheme.Dark);
        }
      };

      // Initial emission
      updateEffectiveTheme(this.currentThemeSubject.getValue());

      // Subsequent emissions on theme change
      const subscription = this.currentThemeSubject.subscribe(updateEffectiveTheme);

      // Listen for system preference changes if current choice is 'System'
      let mediaQueryList: MediaQueryList | undefined;
      if (this.currentThemeSubject.getValue() === AppTheme.System) {
        mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
        const systemChangeListener = () => updateEffectiveTheme(AppTheme.System);
        mediaQueryList.addEventListener('change', systemChangeListener);
        subscription.add(() => mediaQueryList?.removeEventListener('change', systemChangeListener));
      }

      return subscription; // Unsubscribe logic
    });
  }


  private getSystemPreference(): AppTheme.Light | AppTheme.Dark {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return AppTheme.Dark;
    }
    return AppTheme.Light;
  }

  private applyThemeToBody(themeToApply: AppTheme.Light | AppTheme.Dark): void {
    this.renderer.removeClass(this.document.body, LIGHT_THEME_CLASS);
    this.renderer.removeClass(this.document.body, DARK_THEME_CLASS);

    if (themeToApply === AppTheme.Dark) {
      this.renderer.addClass(this.document.body, DARK_THEME_CLASS);
    } else {
      this.renderer.addClass(this.document.body, LIGHT_THEME_CLASS);
    }
  }

  /**
   * Toggles between light and dark themes.
   * If current theme is 'system', it will toggle based on the resolved system theme
   * and then set the new theme explicitly (not as 'system').
   */
  toggleTheme(): void {
    let currentEffectiveTheme = this.currentThemeSubject.getValue();
    if (currentEffectiveTheme === AppTheme.System) {
        currentEffectiveTheme = this.getSystemPreference();
    }

    const newTheme = currentEffectiveTheme === AppTheme.Dark ? AppTheme.Light : AppTheme.Dark;
    this.setCurrentTheme(newTheme);
  }
}
