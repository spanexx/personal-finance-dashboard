import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface PasswordStrengthResult {
  score: number; // 0-4 (weak, fair, good, strong, very strong)
  feedback: {
    warning: string;
    suggestions: string[];
  };
  isValid: boolean;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
  };
  strength: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
}

export interface PasswordGeneratorOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeSimilar: boolean;
  excludeAmbiguous: boolean;
}

export interface GeneratedPassword {
  password: string;
  strength: PasswordStrengthResult;
}

export interface EmailVerificationStatus {
  isVerified: boolean;
  email: string;
  verificationSent: boolean;
  lastSentAt?: string;
  canResend: boolean;
  nextResendAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PasswordSecurityService {
  private apiUrl = environment.apiUrl;
  private readonly MIN_PASSWORD_LENGTH = 8;
  
  // Real-time password strength subject
  private passwordStrengthSubject = new BehaviorSubject<PasswordStrengthResult | null>(null);
  public passwordStrength$ = this.passwordStrengthSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Check password strength in real-time
   */
  checkPasswordStrength(password: string): Observable<PasswordStrengthResult> {
    if (!password) {
      const emptyResult: PasswordStrengthResult = {
        score: 0,
        feedback: { warning: '', suggestions: [] },
        isValid: false,
        requirements: {
          minLength: false,
          hasUppercase: false,
          hasLowercase: false,
          hasNumbers: false,
          hasSpecialChars: false
        },
        strength: 'weak'
      };
      this.passwordStrengthSubject.next(emptyResult);
      return of(emptyResult);
    }

    // First check client-side requirements
    const clientResult = this.checkPasswordRequirements(password);
    
    // If using backend API for strength checking
    if (environment.production) {
      return this.http.post<PasswordStrengthResult>(`${this.apiUrl}/auth/password/check-strength`, { password })
        .pipe(
          map(result => {
            this.passwordStrengthSubject.next(result);
            return result;
          }),
          catchError(() => {
            // Fallback to client-side checking
            this.passwordStrengthSubject.next(clientResult);
            return of(clientResult);
          })
        );
    } else {
      // Use client-side checking in development
      this.passwordStrengthSubject.next(clientResult);
      return of(clientResult);
    }
  }

  /**
   * Client-side password requirements checking
   */
  private checkPasswordRequirements(password: string): PasswordStrengthResult {
    const requirements = {
      minLength: password.length >= this.MIN_PASSWORD_LENGTH,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };

    const metRequirements = Object.values(requirements).filter(Boolean).length;
    const score = Math.min(metRequirements, 4);
    
    const strengthMap: Record<number, 'weak' | 'fair' | 'good' | 'strong' | 'very-strong'> = {
      0: 'weak',
      1: 'weak',
      2: 'fair',
      3: 'good',
      4: 'strong'
    };

    // Bonus for very long passwords
    const strength = password.length >= 16 && score >= 4 ? 'very-strong' : strengthMap[score];

    const suggestions: string[] = [];
    let warning = '';

    if (!requirements.minLength) {
      suggestions.push(`Use at least ${this.MIN_PASSWORD_LENGTH} characters`);
    }
    if (!requirements.hasUppercase) {
      suggestions.push('Add uppercase letters (A-Z)');
    }
    if (!requirements.hasLowercase) {
      suggestions.push('Add lowercase letters (a-z)');
    }
    if (!requirements.hasNumbers) {
      suggestions.push('Add numbers (0-9)');
    }
    if (!requirements.hasSpecialChars) {
      suggestions.push('Add special characters (!@#$%^&*)');
    }

    if (score < 3) {
      warning = 'This password is too weak and may be easily guessed.';
    } else if (score === 3) {
      warning = 'This password is good but could be stronger.';
    }

    return {
      score,
      feedback: { warning, suggestions },
      isValid: metRequirements >= 4,
      requirements,
      strength
    };
  }

  /**
   * Generate secure password
   */
  generatePassword(options: PasswordGeneratorOptions): Observable<GeneratedPassword> {
    if (environment.production) {
      return this.http.post<GeneratedPassword>(`${this.apiUrl}/auth/password/generate`, options)
        .pipe(
          catchError(() => {
            // Fallback to client-side generation
            return of(this.generatePasswordClientSide(options));
          })
        );
    } else {
      // Use client-side generation in development
      return of(this.generatePasswordClientSide(options));
    }
  }

  /**
   * Client-side password generation
   */
  private generatePasswordClientSide(options: PasswordGeneratorOptions): GeneratedPassword {
    let charset = '';
    
    if (options.includeLowercase) {
      charset += options.excludeSimilar ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    }
    
    if (options.includeUppercase) {
      charset += options.excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }
    
    if (options.includeNumbers) {
      charset += options.excludeSimilar ? '23456789' : '0123456789';
    }
    
    if (options.includeSymbols) {
      charset += options.excludeAmbiguous ? '!@#$%^&*()_+-=[]{}|;:,.<>?' : '!@#$%^&*()_+-=[]{}|;\':"\\,.<>?/`~';
    }

    let password = '';
    for (let i = 0; i < options.length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    const strength = this.checkPasswordRequirements(password);

    return {
      password,
      strength
    };
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch (err) {
        document.body.removeChild(textArea);
        return false;
      }
    }
  }

  /**
   * Check if password was used recently (password history)
   */
  checkPasswordHistory(password: string): Observable<{ isReused: boolean; message?: string }> {
    return this.http.post<{ isReused: boolean; message?: string }>(`${this.apiUrl}/auth/password/check-history`, { password })
      .pipe(
        catchError(() => of({ isReused: false }))
      );
  }

  /**
   * Clear password strength state
   */
  clearPasswordStrength(): void {
    this.passwordStrengthSubject.next(null);
  }
}
