import { TestBed } from '@angular/core/testing';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { CurrencyService } from './currency.service';

describe('CurrencyService', () => {
  let service: CurrencyService;
  let currencyPipeSpy: jest.Mocked<CurrencyPipe>;
  let decimalPipeSpy: jest.Mocked<DecimalPipe>;

  beforeEach(() => {
    // Create spies for the pipes
    const cPipeSpy = {
      transform: jest.fn()
    } as unknown as jest.Mocked<CurrencyPipe>;

    const dPipeSpy = {
      transform: jest.fn()
    } as unknown as jest.Mocked<DecimalPipe>;

    TestBed.configureTestingModule({
      providers: [
        CurrencyService,
        { provide: CurrencyPipe, useValue: cPipeSpy },
        { provide: DecimalPipe, useValue: dPipeSpy }
      ]
    });
    service = TestBed.inject(CurrencyService);
    currencyPipeSpy = TestBed.inject(CurrencyPipe) as jest.Mocked<CurrencyPipe>;
    decimalPipeSpy = TestBed.inject(DecimalPipe) as jest.Mocked<DecimalPipe>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('format', () => {
    it('should call CurrencyPipe.transform with correct parameters', () => {
      currencyPipeSpy.transform.mockReturnValue('$100.00');
      service.format(100, 'USD', 'symbol', '1.2-2', 'en-US');
      expect(currencyPipeSpy.transform).toHaveBeenCalledWith(100, 'USD', 'symbol', '1.2-2', 'en-US');
    });

    it('should use default parameters if not provided', () => {
      currencyPipeSpy.transform.mockReturnValue('$50.00');
      service.format(50);
      expect(currencyPipeSpy.transform).toHaveBeenCalledWith(50, 'USD', 'symbol', undefined, 'en-US');
    });

    it('should return null if value is null or undefined', () => {
      expect(service.format(null)).toBeNull();
      expect(service.format(undefined)).toBeNull();
      expect(currencyPipeSpy.transform).not.toHaveBeenCalled();
    });

    it('should handle different currency codes and locales', () => {
      currencyPipeSpy.transform.mockReturnValue('€120,50');
      service.format(120.50, 'EUR', 'symbol', '1.2-2', 'de-DE');
      expect(currencyPipeSpy.transform).toHaveBeenCalledWith(120.50, 'EUR', 'symbol', '1.2-2', 'de-DE');
    });

    it('should return formatted value from CurrencyPipe', () => {
      currencyPipeSpy.transform.mockReturnValue('£75.99');
      const result = service.format(75.99, 'GBP');
      expect(result).toBe('£75.99');
    });

    it('should use DecimalPipe as fallback if CurrencyPipe throws error', () => {
      currencyPipeSpy.transform.mockImplementation(() => {
        throw new Error('CurrencyPipe error');
      });
      decimalPipeSpy.transform.mockReturnValue('150.00'); // DecimalPipe fallback result

      const result = service.format(150, 'XYZ', 'symbol', '1.2-2', 'en-US');
      expect(currencyPipeSpy.transform).toHaveBeenCalledWith(150, 'XYZ', 'symbol', '1.2-2', 'en-US');
      expect(decimalPipeSpy.transform).toHaveBeenCalledWith(150, '1.2-2', 'en-US');
      expect(result).toBe('150.00');
    });
  });

  describe('setUserPreferences', () => {
    it('should update default currencyCode, locale, and display', () => {
      service.setUserPreferences('EUR', 'de-DE', 'code');
      currencyPipeSpy.transform.mockReturnValue('EUR 200.00');
      service.format(200);
      expect(currencyPipeSpy.transform).toHaveBeenCalledWith(200, 'EUR', 'code', undefined, 'de-DE');
    });

    it('should update only currencyCode and locale if display is not provided', () => {
      service.setUserPreferences('GBP', 'en-GB');
      currencyPipeSpy.transform.mockReturnValue('£300.00');
      service.format(300);
      // display should remain the service's default 'symbol'
      expect(currencyPipeSpy.transform).toHaveBeenCalledWith(300, 'GBP', 'symbol', undefined, 'en-GB');
    });
  });
});
