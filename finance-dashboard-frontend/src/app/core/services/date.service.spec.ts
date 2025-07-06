import { TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { DateService } from './date.service';

describe('DateService', () => {
  let service: DateService;
  let datePipeSpy: jest.Mocked<DatePipe>;

  beforeEach(() => {
    const dPipeSpy = {
      transform: jest.fn()
    } as unknown as jest.Mocked<DatePipe>;

    TestBed.configureTestingModule({
      providers: [
        DateService,
        { provide: DatePipe, useValue: dPipeSpy }
      ]
    });
    service = TestBed.inject(DateService);
    datePipeSpy = TestBed.inject(DatePipe) as jest.Mocked<DatePipe>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('format', () => {
    const testDate = new Date(2023, 0, 15); // Jan 15, 2023

    it('should call DatePipe.transform with correct parameters', () => {
      datePipeSpy.transform.mockReturnValue('1/15/23');
      service.format(testDate, 'shortDate', 'en-US', 'UTC');
      expect(datePipeSpy.transform).toHaveBeenCalledWith(testDate, 'shortDate', 'UTC', 'en-US');
    });

    it('should use default format and locale if not provided', () => {
      datePipeSpy.transform.mockReturnValue('1/15/23');
      service.format(testDate);
      expect(datePipeSpy.transform).toHaveBeenCalledWith(testDate, 'shortDate', undefined, 'en-US');
    });

    it('should return null if value is null or undefined', () => {
      expect(service.format(null)).toBeNull();
      expect(service.format(undefined)).toBeNull();
      expect(datePipeSpy.transform).not.toHaveBeenCalled();
    });

    it('should return stringified value if DatePipe throws error', () => {
      datePipeSpy.transform.mockImplementation(() => {
        throw new Error('DatePipe error');
      });
      const result = service.format(testDate);
      expect(result).toBe(String(testDate));
    });
  });

  describe('toStandardDate', () => {
    it('should format date as MM/dd/yyyy', () => {
      const testDate = new Date(2023, 0, 5); // Jan 5, 2023
      datePipeSpy.transform.mockReturnValue('01/05/2023');
      expect(service.toStandardDate(testDate)).toBe('01/05/2023');
      expect(datePipeSpy.transform).toHaveBeenCalledWith(testDate, 'MM/dd/yyyy', undefined, 'en-US');
    });
  });

  describe('toReadableDate', () => {
    it('should format date as MMM d, y', () => {
      const testDate = new Date(2023, 0, 5);
      datePipeSpy.transform.mockReturnValue('Jan 5, 2023');
      expect(service.toReadableDate(testDate)).toBe('Jan 5, 2023');
      expect(datePipeSpy.transform).toHaveBeenCalledWith(testDate, 'MMM d, y', undefined, 'en-US');
    });
  });

  describe('toIsoDateTime', () => {
    it('should return ISO string for a Date object', () => {
      const date = new Date(2023, 0, 15, 10, 30, 0);
      expect(service.toIsoDateTime(date)).toBe(date.toISOString());
    });
    it('should return ISO string for a valid date string', () => {
      const dateStr = '2023-01-15T10:30:00.000Z';
      expect(service.toIsoDateTime(dateStr)).toBe(new Date(dateStr).toISOString());
    });
    it('should return null for an invalid date string', () => {
      expect(service.toIsoDateTime('invalid-date')).toBeNull();
    });
    it('should return null for null input', () => {
      expect(service.toIsoDateTime(null)).toBeNull();
    });
  });

  describe('toIsoDate', () => {
    it('should return YYYY-MM-DD for a Date object', () => {
      const date = new Date(2023, 0, 15, 10, 30, 0); // Jan 15, 2023
      expect(service.toIsoDate(date)).toBe('2023-01-15');
    });
     it('should return YYYY-MM-DD for a valid date string', () => {
      const dateStr = '2023-01-15T10:30:00.000Z';
      expect(service.toIsoDate(dateStr)).toBe('2023-01-15');
    });
    it('should return null for an invalid date string', () => {
      expect(service.toIsoDate('invalid-date')).toBeNull();
    });
  });


  // Manipulation Methods
  describe('addDays', () => {
    it('should add specified number of days', () => {
      const date = new Date(2023, 0, 15);
      const newDate = service.addDays(date, 5);
      expect(newDate.getDate()).toBe(20);
    });
  });

  describe('addMonths', () => {
    it('should add specified number of months', () => {
      const date = new Date(2023, 0, 15);
      const newDate = service.addMonths(date, 2);
      expect(newDate.getMonth()).toBe(2); // March
      expect(newDate.getDate()).toBe(15);
    });
     it('should handle month end correctly when adding months', () => {
      const date = new Date(2023, 0, 31); // Jan 31
      const newDate = service.addMonths(date, 1); // Add 1 month (Feb)
      // Expected: Feb 28, 2023 (since Feb doesn't have 31 days)
      expect(newDate.getFullYear()).toBe(2023);
      expect(newDate.getMonth()).toBe(1); // February
      expect(newDate.getDate()).toBe(28);
    });
  });

  describe('getStartOfMonth', () => {
    it('should return the first day of the month', () => {
      const date = new Date(2023, 0, 15);
      const startOfMonth = service.getStartOfMonth(date);
      expect(startOfMonth.getFullYear()).toBe(2023);
      expect(startOfMonth.getMonth()).toBe(0); // January
      expect(startOfMonth.getDate()).toBe(1);
    });
  });

  describe('getEndOfMonth', () => {
    it('should return the last day of the month', () => {
      const date = new Date(2023, 0, 15); // Jan 15
      const endOfMonth = service.getEndOfMonth(date);
      expect(endOfMonth.getFullYear()).toBe(2023);
      expect(endOfMonth.getMonth()).toBe(0); // January
      expect(endOfMonth.getDate()).toBe(31);

      const febDate = new Date(2023, 1, 10); // Feb 10
      const endOfFeb = service.getEndOfMonth(febDate);
      expect(endOfFeb.getDate()).toBe(28); // Non-leap year
    });
  });

  describe('getDaysInMonth', () => {
    it('should return correct number of days for a month', () => {
      expect(service.getDaysInMonth(2023, 0)).toBe(31); // Jan 2023
      expect(service.getDaysInMonth(2023, 1)).toBe(28); // Feb 2023
      expect(service.getDaysInMonth(2024, 1)).toBe(29); // Feb 2024 (leap)
    });
  });

  describe('getDaysDifference', () => {
    it('should return the difference in days between two dates', () => {
      const date1 = new Date(2023, 0, 15);
      const date2 = new Date(2023, 0, 20);
      expect(service.getDaysDifference(date1, date2)).toBe(5);
      expect(service.getDaysDifference(date2, date1)).toBe(-5);
    });
  });

  describe('parseDate', () => {
    it('should parse a valid date string', () => {
      const dateStr = '2023-01-15T10:00:00Z';
      const expectedDate = new Date(dateStr);
      expect(service.parseDate(dateStr)?.getTime()).toBe(expectedDate.getTime());
    });

    it('should parse a YYYY-MM-DD string', () => {
      const dateStr = '2023-03-25';
      const result = service.parseDate(dateStr);
      expect(result).not.toBeNull();
      expect(result?.getFullYear()).toBe(2023);
      expect(result?.getMonth()).toBe(2); // Month is 0-indexed
      expect(result?.getDate()).toBe(25);
    });

    it('should return null for an invalid date string', () => {
      expect(service.parseDate('not a date')).toBeNull();
    });

    it('should return null for null or undefined input', () => {
      expect(service.parseDate(null)).toBeNull();
      expect(service.parseDate(undefined)).toBeNull();
    });
  });

  describe('setUserPreferences', () => {
    it('should update default locale', () => {
      service.setUserPreferences('fr-FR');
      const testDate = new Date(2023, 0, 5);
      datePipeSpy.transform.mockReturnValue('05/01/2023'); // French format
      service.format(testDate, 'shortDate');
      expect(datePipeSpy.transform).toHaveBeenCalledWith(testDate, 'shortDate', undefined, 'fr-FR');
    });
  });
});
