import { Injectable } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';

/**
 * @Injectable
 * Service for formatting currency values.
 * This service wraps Angular's `CurrencyPipe` to provide a consistent way
 * to format numbers as currency strings throughout the application.
 * It allows setting default currency, locale, and display preferences.
 */
@Injectable({
  providedIn: 'root'
})
export class CurrencyService {

  /** Default currency code (e.g., 'USD', 'EUR'). Can be updated via `setUserPreferences`. */
  private defaultCurrencyCode = 'USD';
  /** Default locale (e.g., 'en-US', 'de-DE'). Can be updated via `setUserPreferences`. */
  private defaultLocale = 'en-US';
  /** Default display format for currency ('symbol', 'code', 'symbol-narrow'). Can be updated via `setUserPreferences`. */
  private defaultDisplay: 'code' | 'symbol' | 'symbol-narrow' | string | boolean = 'symbol';

  constructor(
    private currencyPipe: CurrencyPipe,
    private decimalPipe: DecimalPipe // For formatting numbers that aren't strictly currency
  ) { }

  /**
   * Formats a numeric value as a currency string.
   * @param value The number to format.
   * @param currencyCode The currency code (e.g., 'USD', 'EUR'). Defaults to 'USD'.
   * @param display The currency display format. Defaults to 'symbol'.
   *    Can be 'code', 'symbol', 'symbol-narrow', string (custom symbol), or boolean (true for symbol, false for no symbol).
   * @param digitsInfo The format string for the number part. Defaults to Angular's default for the locale.
   *    Format: '{minIntegerDigits}.{minFractionDigits}-{maxFractionDigits}'.
   * @param locale The locale to use for formatting. Defaults to 'en-US'.
   * @returns The formatted currency string, or null if the value is null or undefined.
   */
  format(
    value: number | null | undefined,
    currencyCode: string = this.defaultCurrencyCode,
    display: 'code' | 'symbol' | 'symbol-narrow' | string | boolean = this.defaultDisplay,
    digitsInfo?: string,
    locale: string = this.defaultLocale
  ): string | null {
    if (value == null) { // Handles both null and undefined
      return null;
    }
    try {
      return this.currencyPipe.transform(value, currencyCode, display, digitsInfo, locale);
    } catch (error) {
      console.error(`CurrencyService: Error formatting currency for value ${value}, code ${currencyCode}, locale ${locale}:`, error);
      // Fallback to simple number formatting if currency formatting fails for some reason
      return this.decimalPipe.transform(value, digitsInfo, locale);
    }
  }

  /**
   * Gets the currency symbol for a given currency code and locale.
   * @param currencyCode The currency code (e.g., 'USD', 'EUR').
   * @param format The format for the symbol ('wide' or 'narrow'). Defaults to 'wide'.
   * @param locale The locale to use. Defaults to 'en-US'.
   * @returns The currency symbol.
   */
  // Note: Accessing getCurrencySymbol directly would require importing `getCurrencySymbol` from `@angular/common`.
  // CurrencyPipe handles symbol display internally based on locale and display options.

  /**
   * Updates the default currency and locale preferences for the service.
   * This method would typically be called when user preferences are loaded or changed.
   * @param currencyCode The new default currency code (e.g., 'EUR').
   * @param locale The new default locale (e.g., 'de-DE').
   * @param display Optional new default display format for the currency.
   */
  setUserPreferences(
    currencyCode: string,
    locale: string,
    display?: 'code' | 'symbol' | 'symbol-narrow' | string | boolean
  ): void {
    this.defaultCurrencyCode = currencyCode;
    this.defaultLocale = locale;
    if (display !== undefined) { // Check for undefined to allow boolean false
      this.defaultDisplay = display;
    }
  }
}
