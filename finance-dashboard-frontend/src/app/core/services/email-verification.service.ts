import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, timer, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface EmailVerificationStatus {
  isVerified: boolean;
  email: string;
  verificationSent: boolean;
  lastSentAt?: string;
  canResend: boolean;
  nextResendAt?: string;
  cooldownRemaining?: number;
}

export interface VerificationResult {
  success: boolean;
  message: string;
  user?: any;
}

@Injectable({
  providedIn: 'root'
})
export class EmailVerificationService {
  private apiUrl = environment.apiUrl;
  private readonly RESEND_COOLDOWN = 60000; // 60 seconds

  // Email verification status subject
  private verificationStatusSubject = new BehaviorSubject<EmailVerificationStatus | null>(null);
  public verificationStatus$ = this.verificationStatusSubject.asObservable();

  // Resend cooldown timer
  private cooldownSubject = new BehaviorSubject<number>(0);
  public cooldown$ = this.cooldownSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Send email verification
   */
  sendVerificationEmail(email?: string): Observable<{ success: boolean; message: string }> {
    const payload = email ? { email } : {};
    
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/email-verification/send`, payload)
      .pipe(
        map(response => {
          if (response.success) {
            this.updateVerificationStatus({
              isVerified: false,
              email: email || '',
              verificationSent: true,
              lastSentAt: new Date().toISOString(),
              canResend: false,
              nextResendAt: new Date(Date.now() + this.RESEND_COOLDOWN).toISOString()
            });
            this.startCooldownTimer();
          }
          return response;
        }),
        catchError(error => {
          console.error('Error sending verification email:', error);
          throw error;
        })
      );
  }

  /**
   * Verify email with token
   */
  verifyEmail(token: string): Observable<VerificationResult> {
    return this.http.post<VerificationResult>(`${this.apiUrl}/email-verification/verify`, { token })
      .pipe(
        map(response => {
          if (response.success) {
            this.updateVerificationStatus({
              isVerified: true,
              email: response.user?.email || '',
              verificationSent: false,
              canResend: false
            });
          }
          return response;
        }),
        catchError(error => {
          console.error('Error verifying email:', error);
          throw error;
        })
      );
  }

  /**
   * Get current verification status
   */  getVerificationStatus(email?: string): Observable<EmailVerificationStatus> {
    const params = email ? { email } : undefined;
    
    return this.http.get<EmailVerificationStatus>(`${this.apiUrl}/email-verification/status`, { params })
      .pipe(
        map(status => {
          this.verificationStatusSubject.next(status);
          return status;
        }),
        catchError(error => {
          console.error('Error getting verification status:', error);
          // Return default status on error
          const defaultStatus: EmailVerificationStatus = {
            isVerified: false,
            email: email || '',
            verificationSent: false,
            canResend: true
          };
          this.verificationStatusSubject.next(defaultStatus);
          return of(defaultStatus);
        })
      );
  }

  /**
   * Resend verification email
   */
  resendVerificationEmail(email?: string): Observable<{ success: boolean; message: string }> {
    return this.sendVerificationEmail(email);
  }

  /**
   * Update verification status
   */
  private updateVerificationStatus(status: Partial<EmailVerificationStatus>): void {
    const currentStatus = this.verificationStatusSubject.value;
    const updatedStatus = { ...currentStatus, ...status } as EmailVerificationStatus;
    this.verificationStatusSubject.next(updatedStatus);
  }

  /**
   * Start cooldown timer for resend functionality
   */
  private startCooldownTimer(): void {
    let remainingTime = this.RESEND_COOLDOWN / 1000; // Convert to seconds
    
    const cooldownTimer = timer(0, 1000).subscribe(() => {
      if (remainingTime <= 0) {
        this.cooldownSubject.next(0);
        this.updateVerificationStatus({ canResend: true });
        cooldownTimer.unsubscribe();
      } else {
        this.cooldownSubject.next(remainingTime);
        this.updateVerificationStatus({
          canResend: false,
          cooldownRemaining: remainingTime
        });
        remainingTime--;
      }
    });
  }

  /**
   * Check if user can resend verification email
   */
  canResendVerification(): boolean {
    const status = this.verificationStatusSubject.value;
    return status?.canResend ?? true;
  }

  /**
   * Clear verification status
   */
  clearVerificationStatus(): void {
    this.verificationStatusSubject.next(null);
    this.cooldownSubject.next(0);
  }

  /**
   * Mark email as verified (for use after successful verification)
   */
  markEmailAsVerified(email: string): void {
    this.updateVerificationStatus({
      isVerified: true,
      email,
      verificationSent: false,
      canResend: false
    });
  }

  /**
   * Get remaining cooldown time in seconds
   */
  getCooldownRemaining(): number {
    return this.cooldownSubject.value;
  }
}
