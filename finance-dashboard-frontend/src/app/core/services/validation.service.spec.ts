import { TestBed } from '@angular/core/testing';
import { ValidationService } from './validation.service';
import { FormControl, FormGroup, AbstractControl } from '@angular/forms';

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ValidationService]
    });
    service = TestBed.inject(ValidationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('passwordStrengthValidator', () => {
    const validator = ValidationService.passwordStrengthValidator();

    it('should return null for a strong password', () => {
      const control = new FormControl('StrongP@ss1');
      expect(validator(control)).toBeNull();
    });

    it('should return error for password less than 8 characters', () => {
      const control = new FormControl('Str@1');
      expect(validator(control)?.['passwordStrength']).toBeTruthy();
      expect(validator(control)?.['passwordStrength'].details.length).toBe(false);
    });

    it('should return error for password missing uppercase letter', () => {
      const control = new FormControl('strongp@ss1');
      expect(validator(control)?.['passwordStrength']).toBeTruthy();
      expect(validator(control)?.['passwordStrength'].details.uppercase).toBe(false);
    });

    it('should return error for password missing lowercase letter', () => {
      const control = new FormControl('STRONGP@SS1');
      expect(validator(control)?.['passwordStrength']).toBeTruthy();
      expect(validator(control)?.['passwordStrength'].details.lowercase).toBe(false);
    });

    it('should return error for password missing number', () => {
      const control = new FormControl('StrongP@ss');
      expect(validator(control)?.['passwordStrength']).toBeTruthy();
      expect(validator(control)?.['passwordStrength'].details.numeric).toBe(false);
    });

    it('should return error for password missing special character', () => {
      const control = new FormControl('StrongPass1');
      expect(validator(control)?.['passwordStrength']).toBeTruthy();
      expect(validator(control)?.['passwordStrength'].details.special).toBe(false);
    });

    it('should return null for empty value (let required validator handle)', () => {
      const control = new FormControl('');
      expect(validator(control)).toBeNull();
    });
  });

  describe('matchPasswordValidator', () => {
    const validator = ValidationService.matchPasswordValidator('password', 'confirmPassword');
    let formGroup: FormGroup;

    beforeEach(() => {
      formGroup = new FormGroup({
        password: new FormControl('password123'),
        confirmPassword: new FormControl('') // Start with empty confirm password
      });
    });

    it('should return null if confirmPassword is pristine or empty', () => {
        expect(validator(formGroup)).toBeNull();
        expect(formGroup.get('confirmPassword')?.hasError('passwordsMismatch')).toBe(false);
    });

    it('should return error and set error on confirmPassword if passwords do not match and confirmPassword is dirty', () => {
      formGroup.get('confirmPassword')?.setValue('differentPassword');
      formGroup.get('confirmPassword')?.markAsDirty(); // Simulate user input
      expect(validator(formGroup)).toEqual({ passwordsMismatchGlobal: true });
      expect(formGroup.get('confirmPassword')?.hasError('passwordsMismatch')).toBe(true);
    });

    it('should return null and clear error if passwords match and confirmPassword is dirty', () => {
      // First set an error
      formGroup.get('confirmPassword')?.setValue('differentPassword');
      formGroup.get('confirmPassword')?.markAsDirty();
      validator(formGroup); // Run validator to set error
      expect(formGroup.get('confirmPassword')?.hasError('passwordsMismatch')).toBe(true);

      // Then make them match
      formGroup.get('confirmPassword')?.setValue('password123');
      expect(validator(formGroup)).toBeNull();
      expect(formGroup.get('confirmPassword')?.hasError('passwordsMismatch')).toBe(false);
    });
  });

  describe('positiveNumberValidator', () => {
    const validator = ValidationService.positiveNumberValidator();

    it('should return null for a positive number', () => {
      const control = new FormControl(10);
      expect(validator(control)).toBeNull();
    });

    it('should return error for zero', () => {
      const control = new FormControl(0);
      expect(validator(control)?.['positiveNumber']).toBeTruthy();
    });

    it('should return error for a negative number', () => {
      const control = new FormControl(-5);
      expect(validator(control)?.['positiveNumber']).toBeTruthy();
    });

    it('should return null for empty or non-numeric value (let required/pattern handle)', () => {
      expect(validator(new FormControl(''))).toBeNull();
      expect(validator(new FormControl(null))).toBeNull();
      expect(validator(new FormControl('abc'))?.['positiveNumber']).toBeTruthy(); // Should fail if not number
    });
  });

  describe('maxTwoDecimalPlacesValidator', () => {
    const validator = ValidationService.maxTwoDecimalPlacesValidator();

    it('should return null for numbers with two or fewer decimal places', () => {
      expect(validator(new FormControl(10))).toBeNull();
      expect(validator(new FormControl(10.1))).toBeNull();
      expect(validator(new FormControl(10.12))).toBeNull();
    });

    it('should return error for numbers with more than two decimal places', () => {
      expect(validator(new FormControl(10.123))?.['maxTwoDecimalPlaces']).toBeTruthy();
    });

    it('should return null for empty or non-numeric value', () => {
       expect(validator(new FormControl(''))).toBeNull();
       expect(validator(new FormControl(null))).toBeNull();
    });
  });

  describe('dateNotInFutureValidator', () => {
    const validator = ValidationService.dateNotInFutureValidator();

    it('should return null for today\'s date', () => {
      const today = new Date();
      const control = new FormControl(today.toISOString().split('T')[0]); // Format as YYYY-MM-DD
      expect(validator(control)).toBeNull();
    });

    it('should return null for a past date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const control = new FormControl(pastDate.toISOString().split('T')[0]);
      expect(validator(control)).toBeNull();
    });

    it('should return error for a future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const control = new FormControl(futureDate.toISOString().split('T')[0]);
      expect(validator(control)?.['dateInFuture']).toBeTruthy();
    });

    it('should return null for empty value', () => {
      expect(validator(new FormControl(''))).toBeNull();
    });
  });

  describe('minAgeValidator', () => {
    const minAge = 18;
    const validator = ValidationService.minAgeValidator(minAge);

    it('should return null if age is greater than or equal to minAge', () => {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - minAge);
      const control = new FormControl(birthDate.toISOString().split('T')[0]);
      expect(validator(control)).toBeNull();
    });

    it('should return null if age is exactly minAge (birthday today)', () => {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - minAge);
      // Ensure no time part issues by using YYYY-MM-DD
      const control = new FormControl(birthDate.toISOString().split('T')[0]);
      expect(validator(control)).toBeNull();
    });

    it('should return error if age is less than minAge', () => {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - (minAge - 1));
      const control = new FormControl(birthDate.toISOString().split('T')[0]);
      const error = validator(control)?.['minAge'];
      expect(error).toBeTruthy();
      expect(error.requiredAge).toBe(minAge);
      expect(error.actualAge).toBe(minAge - 1);
    });

    it('should return null for empty value', () => {
      expect(validator(new FormControl(''))).toBeNull();
    });

    it('should return invalidDate error for invalid date format', () => {
      const control = new FormControl('not-a-date');
      expect(validator(control)?.['invalidDate']).toBeTruthy();
    });
  });
});
