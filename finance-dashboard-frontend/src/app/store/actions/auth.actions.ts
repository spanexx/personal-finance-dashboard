import { createAction, props } from '@ngrx/store';
import { AuthUser, AuthTokens } from '../state/auth.state';

// Register
export const register = createAction('[Auth] Register', props<{ email: string; password: string; firstName: string; lastName: string; username: string }>());
export const registerSuccess = createAction('[Auth] Register Success', props<{ user: AuthUser; tokens: AuthTokens; emailVerificationSent: boolean }>());
export const registerFailure = createAction('[Auth] Register Failure', props<{ error: string }>());

// Login
export const login = createAction('[Auth] Login', props<{ email: string; password: string }>());
export const loginSuccess = createAction('[Auth] Login Success', props<{ user: AuthUser; tokens: AuthTokens }>());
export const loginFailure = createAction('[Auth] Login Failure', props<{ error: string }>());

// Logout
export const logout = createAction('[Auth] Logout');
export const logoutSuccess = createAction('[Auth] Logout Success');
export const logoutFailure = createAction('[Auth] Logout Failure', props<{ error: string }>());

// Refresh Token
export const refreshToken = createAction('[Auth] Refresh Token', props<{ refreshToken: string }>());
export const refreshTokenSuccess = createAction('[Auth] Refresh Token Success', props<{ tokens: AuthTokens }>());
export const refreshTokenFailure = createAction('[Auth] Refresh Token Failure', props<{ error: string }>());

// Email Verification
export const resendEmailVerification = createAction('[Auth] Resend Email Verification', props<{ email: string }>());
export const resendEmailVerificationSuccess = createAction('[Auth] Resend Email Verification Success');
export const resendEmailVerificationFailure = createAction('[Auth] Resend Email Verification Failure', props<{ error: string }>());

// Password Reset
export const forgotPassword = createAction('[Auth] Forgot Password', props<{ email: string }>());
export const forgotPasswordSuccess = createAction('[Auth] Forgot Password Success');
export const forgotPasswordFailure = createAction('[Auth] Forgot Password Failure', props<{ error: string }>());

export const resetPassword = createAction('[Auth] Reset Password', props<{ token: string; newPassword: string }>());
export const resetPasswordSuccess = createAction('[Auth] Reset Password Success');
export const resetPasswordFailure = createAction('[Auth] Reset Password Failure', props<{ error: string }>());

// Get Profile
export const getProfile = createAction('[Auth] Get Profile');
export const getProfileSuccess = createAction('[Auth] Get Profile Success', props<{ user: AuthUser }>());
export const getProfileFailure = createAction('[Auth] Get Profile Failure', props<{ error: string }>());

// Get Sessions
export const getSessions = createAction('[Auth] Get Sessions');
export const getSessionsSuccess = createAction('[Auth] Get Sessions Success', props<{ sessions: any[] }>());
export const getSessionsFailure = createAction('[Auth] Get Sessions Failure', props<{ error: string }>());

// Revoke Session
export const revokeSession = createAction('[Auth] Revoke Session', props<{ sessionId: string }>());
export const revokeSessionSuccess = createAction('[Auth] Revoke Session Success', props<{ sessionId: string }>());
export const revokeSessionFailure = createAction('[Auth] Revoke Session Failure', props<{ error: string }>());

// Restore Session
export const authRestoreSession = createAction('[Auth] Restore Session');
export const authRestoreSessionSuccess = createAction('[Auth] Restore Session Success', props<{ user: AuthUser; tokens: AuthTokens }>());
export const authRestoreSessionFailure = createAction('[Auth] Restore Session Failure');
