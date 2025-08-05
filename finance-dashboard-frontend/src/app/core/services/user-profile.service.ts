import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { 
  UserProfile, 
  UserSession, 
  PasswordChangeRequest, 
  PasswordStrengthResult,
  UserSettings 
} from '../../shared/models';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  pagination?: object;
}

export interface ProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface SettingsUpdateRequest {
  currency?: string;
  dateFormat?: string;
  language?: string;
  theme?: 'light' | 'dark' | 'auto';
  notificationPreferences?: {
    email?: boolean;
    push?: boolean;
    budgetAlerts?: boolean;
    goalReminders?: boolean;
    weeklyReports?: boolean;
    monthlyReports?: boolean;
  };
  privacy?: {
    marketingEmails?: boolean;
    analyticsTracking?: boolean;
    dataExportRequested?: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class UserProfileService {
  /**
   * Fetches the profile image filename for a user by ID
   * @param userId - The user's MongoDB ObjectId
   * @returns Observable<{ profileImage: string | null }>
   */
  getProfileImageById(userId: string): Observable<{ profileImage: string | null }> {
    return this.http.get<ApiResponse<{ profileImage: string | null }>>(`${this.baseUrl}/users/profile-image/${userId}`)
      .pipe(
        map(response => {
          // If profileImage exists, construct full URL using baseUrl for static files
          if (response.data && response.data.profileImage) {
            const filename = response.data.profileImage;
            const url = filename.startsWith('http')
              ? filename
              : `${environment.baseUrl}/uploads/profiles/${filename}`;
            return { profileImage: url };
          }
          return { profileImage: null };
        }),
        catchError(this.handleError)
      );
  }
  private readonly baseUrl = `${environment.apiUrl}`;
  private profileSubject = new BehaviorSubject<UserProfile | null>(null);
  private sessionsSubject = new BehaviorSubject<UserSession[]>([]);

  public profile$ = this.profileSubject.asObservable();
  public sessions$ = this.sessionsSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Profile Management
  getProfile(): Observable<UserProfile> {
    return this.http.get<ApiResponse<UserProfile>>(`${this.baseUrl}/auth/profile`)
      .pipe(
        map(response => {
          // Type guard for user property with type assertion
          if (
            response.data &&
            typeof response.data === 'object' &&
            'user' in response.data &&
            (response.data as any).user &&
            (response.data as any).user.profileImage
          ) {
            const user = (response.data as any).user;
            const filename = user.profileImage as string;
            user.profileImage = filename.startsWith('http')
              ? filename
              : `${environment.baseUrl}/uploads/profiles/${filename}`;
            console.log('Service transformed user.profileImage:', user.profileImage);
          } else if (response.data && (response.data as any).profileImage) {
            const filename = (response.data as any).profileImage as string;
            (response.data as any).profileImage = filename.startsWith('http')
              ? filename
              : `${environment.baseUrl}/uploads/profiles/${filename}`;
            console.log('Service transformed profileImage:', (response.data as any).profileImage);
          }
          return response.data;
        }),
        tap(profile => this.profileSubject.next(profile)),
        catchError(this.handleError)
      );
  }

  updateProfile(profileData: ProfileUpdateRequest): Observable<UserProfile> {
    return this.http.put<ApiResponse<UserProfile>>(`${this.baseUrl}/auth/profile`, profileData)
      .pipe(
        map(response => response.data),
        tap(profile => this.profileSubject.next(profile)),
        catchError(this.handleError)
      );
  }

  updateSettings(settings: SettingsUpdateRequest): Observable<UserProfile> {
    return this.http.put<ApiResponse<UserProfile>>(`${this.baseUrl}/auth/profile`, { settings })
      .pipe(
        map(response => response.data),
        tap(profile => this.profileSubject.next(profile)),
        catchError(this.handleError)
      );
  }

  // Profile Image Management
  uploadProfileImage(file: File): Observable<UserProfile> {
    const formData = new FormData();
    formData.append('profileImage', file);

    return this.http.post<ApiResponse<UserProfile>>(`${this.baseUrl}/users/upload-profile-image`, formData)
      .pipe(
        map(response => response.data),
        tap(profile => this.profileSubject.next(profile)),
        catchError(this.handleError)
      );
  }

  deleteProfileImage(): Observable<UserProfile> {
    return this.http.delete<ApiResponse<UserProfile>>(`${this.baseUrl}/users/profile-image`)
      .pipe(
        map(response => response.data),
        tap(profile => this.profileSubject.next(profile)),
        catchError(this.handleError)
      );
  }

  // Password Management
  changePassword(passwordData: PasswordChangeRequest): Observable<{ message: string }> {
    return this.http.put<ApiResponse<{ message: string }>>(`${this.baseUrl}/auth/change-password`, passwordData)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  checkPasswordStrength(password: string): Observable<PasswordStrengthResult> {
    return this.http.post<ApiResponse<PasswordStrengthResult>>(`${this.baseUrl}/auth/password/check-strength`, { password })
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  generatePassword(options?: {
    length?: number;
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSpecialChars?: boolean;
  }): Observable<{ password: string; strength: PasswordStrengthResult }> {
    return this.http.post<ApiResponse<{ password: string; strength: PasswordStrengthResult }>>(`${this.baseUrl}/auth/password/generate`, options || {})
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  // Session Management
  getSessions(): Observable<UserSession[]> {
    return this.http.get<ApiResponse<UserSession[]>>(`${this.baseUrl}/auth/sessions`)
      .pipe(
        map(response => response.data),
        tap(sessions => this.sessionsSubject.next(sessions)),
        catchError(this.handleError)
      );
  }

  revokeSession(sessionId: number): Observable<{ message: string }> {
    return this.http.delete<ApiResponse<{ message: string }>>(`${this.baseUrl}/auth/sessions/${sessionId}`)
      .pipe(
        map(response => response.data),
        tap(() => {
          // Update sessions list after revocation
          this.getSessions().subscribe();
        }),
        catchError(this.handleError)
      );
  }

  logoutAllDevices(): Observable<{ message: string }> {
    return this.http.post<ApiResponse<{ message: string }>>(`${this.baseUrl}/auth/logout-all`, {})
      .pipe(
        map(response => response.data),
        tap(() => this.sessionsSubject.next([])),
        catchError(this.handleError)
      );
  }
  // GDPR Compliance
  exportUserData(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/export-import/export`, {
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
  }

  requestDataExport(request?: any): Observable<{ message: string }> {
    return this.http.post<ApiResponse<{ message: string }>>(`${this.baseUrl}/export-import/request-export`, request || {})
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  deleteAccount(password: string): Observable<{ message: string }> {
    return this.http.delete<ApiResponse<{ message: string }>>(`${this.baseUrl}/auth/delete-account`, {
      body: { password }
    })
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  // Email Verification
  resendEmailVerification(): Observable<{ message: string }> {
    return this.http.post<ApiResponse<{ message: string }>>(`${this.baseUrl}/auth/resend-verification`, {})
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.post<ApiResponse<{ message: string }>>(`${this.baseUrl}/auth/verify-email`, { token })
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  // User Preferences (including notifications)
  getPreferences(): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/users/preferences`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  updatePreferences(preferences: any): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.baseUrl}/users/preferences`, preferences)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  // Helper methods
  validateProfileImage(file: File): { valid: boolean; error?: string } {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];

    if (file.size > maxSize) {
      return { valid: false, error: 'File size must be less than 5MB' };
    }

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Only JPG and PNG files are allowed' };
    }

    return { valid: true };
  }

  getCurrentProfile(): UserProfile | null {
    return this.profileSubject.value;
  }

  getCurrentSessions(): UserSession[] {
    return this.sessionsSubject.value;
  }

  private handleError = (error: any): Observable<never> => {
    console.error('UserProfileService Error:', error);
    throw error;
  };
}
