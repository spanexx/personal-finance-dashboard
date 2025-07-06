import { Injectable } from '@angular/core';
import { AbstractControl, ValidatorFn, FormGroup, ValidationErrors } from '@angular/forms';

/**
 * @Injectable
 * Provides a collection of custom validator functions for use with Angular Reactive Forms.
 * All validator methods are static and return a `ValidatorFn`.
 */
@Injectable({
  providedIn: 'root'
})
export class ValidationService {

  constructor() { }

  /**
   * Validates password strength.
   * Checks for minimum length, and presence of uppercase, lowercase, numeric, and special characters.
   * @returns A `ValidatorFn` that returns an error object `{ passwordStrength: { message: string, details: object } }` if validation fails, otherwise `null`.
   * The `details` object contains boolean flags for each requirement: `length`, `uppercase`, `lowercase`, `numeric`, `special`.
   */
  static passwordStrengthValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) {
        return null; // Don't validate empty values, let `required` validator handle it
      }

      const hasUpperCase = /[A-Z]+/.test(value);
      const hasLowerCase = /[a-z]+/.test(value);
      const hasNumeric = /[0-9]+/.test(value);
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(value);
      const minLength = 8;

      const passwordValid =
        hasUpperCase &&
        hasLowerCase &&
        hasNumeric &&
        hasSpecial &&
        value.length >= minLength;

      if (!passwordValid) {
        let message = 'Password is not strong enough. It must contain at least:';
        if (value.length < minLength) message += ` ${minLength} characters,`;
        if (!hasUpperCase) message += ' one uppercase letter,';
        if (!hasLowerCase) message += ' one lowercase letter,';
        if (!hasNumeric) message += ' one number,';
        if (!hasSpecial) message += ' one special character,';
        // Remove trailing comma and add a period.
        message = message.replace(/,$/, '.');

        return {
          passwordStrength: {
            message: message,
            details: {
              length: value.length >= minLength,
              uppercase: hasUpperCase,
              lowercase: hasLowerCase,
              numeric: hasNumeric,
              special: hasSpecial
            }
          }
        };
      }
      return null;
    };
  }

  /**
   * Validates that two password fields in a form group match.
   * This validator should be applied to the `FormGroup`.
   * @param passwordControlName The name of the primary password control.
   * @param confirmPasswordControlName The name of the confirmation password control.
   * @returns A `ValidatorFn`. If passwords don't match, it sets an error `{ passwordsMismatch: true }`
   * on the confirm password control and returns `{ passwordsMismatchGlobal: true }` on the form group.
   * Returns `null` if passwords match or if the confirm password field is pristine or empty.
   */
  static matchPasswordValidator(passwordControlName: string, confirmPasswordControlName: string): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      if (!(formGroup instanceof FormGroup)) {
        console.error('matchPasswordValidator must be applied to a FormGroup.');
        return null;
      }
      const passwordControl = formGroup.get(passwordControlName);
      const confirmPasswordControl = formGroup.get(confirmPasswordControlName);

      if (!passwordControl || !confirmPasswordControl) {
        console.error(`Form controls '${passwordControlName}' or '${confirmPasswordControlName}' not found.`);
        return null;
      }

      // If confirm password hasn't been touched yet or is empty, don't show the error.
      // This prevents showing the error before the user has a chance to type in the confirm password field.
      if (confirmPasswordControl.pristine || !confirmPasswordControl.value) {
        return null;
      }

      if (passwordControl.value !== confirmPasswordControl.value) {
        confirmPasswordControl.setErrors({ passwordsMismatch: true });
        return { passwordsMismatchGlobal: true }; // Error on the group for global display if needed
      } else {
        // If passwords match and the error was previously set, clear it.
        if (confirmPasswordControl.hasError('passwordsMismatch')) {
            const currentErrors = { ...confirmPasswordControl.errors };
            delete currentErrors['passwordsMismatch'];
            confirmPasswordControl.setErrors(Object.keys(currentErrors).length > 0 ? currentErrors : null);
        }
        return null;
      }
    };
  }

  /**
   * Validates that a number is positive (greater than 0).
   * Allows empty values, which should be handled by a `required` validator if needed.
   * @returns A `ValidatorFn` that returns an error object `{ positiveNumber: { message: string } }` if validation fails, otherwise `null`.
   */
  static positiveNumberValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (value == null || value === '') {
        return null;
      }
      const isNumber = !isNaN(parseFloat(value)) && isFinite(value);
      if (!isNumber || Number(value) <= 0) { // Ensure conversion to number for comparison
        return { positiveNumber: { message: 'Value must be a positive number.' } };
      }
      return null;
    };
  }

  /**
   * Validates that a number has no more than two decimal places.
   * Allows empty values.
   * @returns A `ValidatorFn` that returns an error object `{ maxTwoDecimalPlaces: { message: string } }` if validation fails, otherwise `null`.
   */
  static maxTwoDecimalPlacesValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (value == null || value === '') {
        return null;
      }
      const stringValue = String(value);
      const decimalPart = stringValue.split('.')[1];
      if (decimalPart && decimalPart.length > 2) {
        return { maxTwoDecimalPlaces: { message: 'No more than two decimal places allowed.'} };
      }
      return null;
    };
  }

  /**
   * Validates that a date is not in the future. Compares date part only (ignores time).
   * Allows empty values.
   * @returns A `ValidatorFn` that returns an error object `{ dateInFuture: { message: string } }` if validation fails, otherwise `null`.
   */
  static dateNotInFutureValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) {
        return null;
      }
      const selectedDate = new Date(value);
      if (isNaN(selectedDate.getTime())) { // Check if date is valid
        return { invalidDate: { message: 'Invalid date format.' } };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0,0,0,0);

      if (selectedDate > today) {
        return { dateInFuture: { message: 'Date cannot be in the future.' } };
      }
      return null;
    };
  }

  /**
   * Validates that a birth date corresponds to an age greater than or equal to a minimum age.
   * Allows empty values.
   * @param minAge The minimum required age.
   * @returns A `ValidatorFn` that returns an error object `{ minAge: { message: string, requiredAge: number, actualAge: number } }`
   * or `{ invalidDate: { message: string } }` if validation fails, otherwise `null`.
   */
  static minAgeValidator(minAge: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) {
        return null;
      }
      const birthDate = new Date(value);
      if (isNaN(birthDate.getTime())) {
        return { invalidDate: { message: 'Invalid date format.' } };
      }

      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < minAge) {
        return {
          minAge: {
            message: `Must be at least ${minAge} years old.`,
            requiredAge: minAge,
            actualAge: age
          }
        };
      }
      return null;
    };
  }
}
