import { Injectable } from '@angular/core';
import { DatePipe } from '@angular/common';

/**
 * @Injectable
 * Service for formatting and manipulating dates.
 * This service wraps Angular's `DatePipe` for formatting and provides
 * utility methods for common date operations.
 * It allows setting a default locale for formatting.
 */
@Injectable({
  providedIn: 'root'
})
export class DateService {

  /** Default locale (e.g., 'en-US', 'de-DE'). Can be updated via `setUserPreferences`. */
  private defaultLocale = 'en-US';

  constructor(private datePipe: DatePipe) { }

  /**
   * Formats a date value to a string based on the given format and locale.
   * @param value The date to format (Date, string, or number).
   * @param format Predefined format string (e.g., 'shortDate', 'medium', 'yyyy-MM-dd') or custom format. Defaults to 'shortDate'.
   * @param locale The locale to use for formatting. Defaults to 'en-US'.
   * @param timezone Specify the time zone of the date. Defaults to the user's local time zone.
   * @returns The formatted date string, or null if the value is invalid.
   */
  format(
    value: Date | string | number | null | undefined,
    format: string = 'shortDate',
    locale: string = this.defaultLocale,
    timezone?: string
  ): string | null {
    if (value == null) { // Handles both null and undefined
      return null;
    }
    try {
      return this.datePipe.transform(value, format, timezone, locale);
    } catch (error) {
      console.error(`DateService: Error formatting date for value ${value}, format ${format}, locale ${locale}:`, error);
      // Fallback or rethrow, depending on desired error handling
      return String(value); // Simple string conversion as a basic fallback
    }
  }

  // Common specific format helpers
  /**
   * Formats a date to a standard 'MM/dd/yyyy' string.
   * @param value The date to format.
   * @param locale Optional locale to use. Defaults to service's default locale.
   * @returns Formatted date string or null.
   */
  toStandardDate(value: Date | string | number | null | undefined, locale: string = this.defaultLocale): string | null {
    return this.format(value, 'MM/dd/yyyy', locale);
  }

  /**
   * Formats a date to a readable 'MMM d, y' string (e.g., "Jan 1, 2023").
   * @param value The date to format.
   * @param locale Optional locale to use. Defaults to service's default locale.
   * @returns Formatted date string or null.
   */
  toReadableDate(value: Date | string | number | null | undefined, locale: string = this.defaultLocale): string | null {
    return this.format(value, 'MMM d, y', locale);
  }

  /**
   * Converts a date to its full ISO 8601 string representation (YYYY-MM-DDTHH:mm:ss.sssZ).
   * @param value The date to convert.
   * @returns ISO date-time string or null if input is invalid.
   */
  toIsoDateTime(value: Date | string | number | null | undefined): string | null {
    if (value == null) return null;
    try {
      const date = (value instanceof Date) ? value : new Date(value);
      if (isNaN(date.getTime())) throw new Error('Invalid date value for ISO conversion');
      return date.toISOString();
    } catch (error) {
      console.error(`DateService: Error converting to ISO string for value ${value}:`, error);
      return null;
    }
  }

  /**
   * Converts a date to its ISO 8601 date part string representation (YYYY-MM-DD).
   * @param value The date to convert.
   * @returns ISO date string (YYYY-MM-DD) or null if input is invalid.
   */
  toIsoDate(value: Date | string | number | null | undefined): string | null {
    if (value == null) return null;
    try {
      const date = (value instanceof Date) ? value : new Date(value);
      if (isNaN(date.getTime())) throw new Error('Invalid date value for ISO date conversion');
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error(`DateService: Error converting to ISO date string for value ${value}:`, error);
      return null;
    }
  }


  // Date Manipulation Methods
  /**
   * Adds a specified number of days to a date.
   * @param date The original date.
   * @param days The number of days to add (can be negative).
   * @returns A new Date object with the days added.
   */
  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Adds a specified number of months to a date.
   * Handles month-end adjustments (e.g., Jan 31 + 1 month = Feb 28/29).
   * @param date The original date.
   * @param months The number of months to add (can be negative).
   * @returns A new Date object with the months added.
   */
  addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    const originalDay = date.getDate();
    result.setMonth(result.getMonth() + months);
    // If the new month doesn't have the original day (e.g. Jan 31 -> Feb),
    // setDate will roll over. To prevent this and cap at month end:
    if (result.getDate() !== originalDay) {
      result.setDate(0); // Sets to the last day of the previous month (which is the target month)
    }
    return result;
  }

  /**
   * Gets the first day of the month for a given date.
   * @param date The date.
   * @returns A new Date object representing the start of the month (time set to 00:00:00).
   */
  getStartOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  /**
   * Gets the last day of the month for a given date.
   * @param date The date.
   * @returns A new Date object representing the end of the month (time set to 00:00:00, effectively end of day is implied).
   */
  getEndOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  /**
   * Gets the number of days in a specific month and year.
   * @param year The full year.
   * @param month The month (0-indexed, e.g., 0 for January).
   * @returns The number of days in the specified month.
   */
  getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  /**
   * Calculates the difference in whole days between two dates.
   * @param dateLeft The first date.
   * @param dateRight The second date.
   * @returns The number of full days between dateLeft and dateRight (positive if dateRight is later).
   */
  getDaysDifference(dateLeft: Date, dateRight: Date): number {
    const utc1 = Date.UTC(dateLeft.getFullYear(), dateLeft.getMonth(), dateLeft.getDate());
    const utc2 = Date.UTC(dateRight.getFullYear(), dateRight.getMonth(), dateRight.getDate());
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    return Math.floor((utc2 - utc1) / MS_PER_DAY);
  }

  /**
   * Updates the default locale preference for the service.
   * @param locale The new default locale string (e.g., 'fr-FR').
   */
  setUserPreferences(locale: string): void {
    this.defaultLocale = locale;
  }

  /**
   * Parses a date string into a Date object.
   * @param dateString The string to parse.
   * @param formatHint Optional hint for the format if known (not directly used by new Date() but good for context).
   * @returns Date object or null if parsing fails.
   */
  parseDate(dateString: string | null | undefined, formatHint?: string): Date | null {
    if (dateString == null) {
      return null;
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn(`DateService: Failed to parse date string "${dateString}" (format hint: ${formatHint})`);
      return null;
    }
    return date;
  }
}
