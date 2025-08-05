import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthUser, AuthTokens } from '../../store/state/auth.state';
import { UserSession, PasswordStrengthResult } from '../../shared/models';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private apiUrl = `${environment.apiUrl}/auth`;

  constructor(
    private http: HttpClient,
    private tokenService: TokenService
  ) {}

  register(email: string, password: string, firstName: string, lastName: string, username: string): Observable<{ user: AuthUser; tokens: AuthTokens; emailVerificationSent: boolean }> {
    return this.http.post<any>(`${this.apiUrl}/register`, { email, password, firstName, lastName, username }).pipe(
      map(res => ({
        user: res.data.user,
        tokens: {
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          expiresIn: res.data.expiresIn,
          sessionId: res.data.sessionId
        },
        emailVerificationSent: res.data.emailVerificationSent
      }))
    );
  }

  login(email: string, password: string): Observable<{ user: AuthUser; tokens: AuthTokens }> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password }).pipe(
      map(res => {
        // Defensive: If backend does not return tokens, throw an error
        if (!res.data?.accessToken || !res.data?.refreshToken) {
          throw new Error('Login failed: No access or refresh token returned from backend.');
        }
        return {
          user: res.data.user,
          tokens: {
            accessToken: res.data.accessToken,
            refreshToken: res.data.refreshToken,
            expiresIn: res.data.expiresIn,
            sessionId: res.data.sessionId
          }
        };
      })
    );
  }

  logout(refreshToken?: string): Observable<{ message: string }> {
    const body = refreshToken ? { refreshToken } : {};
    return this.http.post<{ message: string }>(`${this.apiUrl}/logout`, body);
  }

  refreshToken(refreshToken: string): Observable<{ tokens: AuthTokens }> {
    return this.http.post<{ tokens: AuthTokens }>(`${this.apiUrl}/refresh`, { refreshToken });
  }

  getProfile(): Observable<{ user: AuthUser }> {
    return this.http.get<{ user: AuthUser }>(`${this.apiUrl}/profile`);
  }

  // Password Reset
  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/password/forgot`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/password/reset`, { token, newPassword });
  }

  // Email Verification
  resendEmailVerification(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/resend-verification`, { email });
  }

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.get<{ message: string }>(`${this.apiUrl}/verify-email/${token}`);
  }

  // Sessions
  getSessions(): Observable<UserSession[]> {
    return this.http.get<{ sessions: UserSession[] }>(`${this.apiUrl}/sessions`).pipe(map(res => res.sessions));
  }

  revokeSession(sessionId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/sessions/${sessionId}`);
  }

  logoutAllDevices(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/logout-all`, {});
  }

  // Password Management
  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/password/change`, { currentPassword, newPassword });
  }

  checkPasswordStrength(password: string): Observable<PasswordStrengthResult> {
    return this.http.post<{ data: PasswordStrengthResult }>(`${this.apiUrl}/password/check-strength`, { password }).pipe(map(res => res.data));
  }

  generatePassword(options?: {
    length?: number;
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSpecialChars?: boolean;
  }): Observable<{ password: string; strength: PasswordStrengthResult }> {
    return this.http.post<{ data: { password: string; strength: PasswordStrengthResult } }>(`${this.apiUrl}/password/generate`, options || {}).pipe(map(res => res.data));
  }

  // --- STUB: Add isAuthenticated$ observable and getToken method for WebSocketService compatibility ---
  public isAuthenticated$: Observable<boolean> = new Observable<boolean>(subscriber => {
    // Always authenticated for stub; replace with real logic as needed
    subscriber.next(true);
    subscriber.complete();
  });

  public getToken(): string {
    // Use TokenService to get the access token
    const token = this.tokenService.getAccessToken();
    return token || '';
  }

  // Helper method to check if user is authenticated
  public isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token && token.length > 10; // Basic validation
  }

  // Add more methods as needed
}
