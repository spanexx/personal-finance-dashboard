export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  role: string;
  isEmailVerified: boolean;
  isActive: boolean;
  isLocked: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  sessionId?: string;
}

export interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  loading: boolean;
  error: string | null;
  emailVerificationSent: boolean;
  passwordResetSent: boolean;
  sessions: any[];
}

export const initialAuthState: AuthState = {
  user: null,
  tokens: null,
  loading: false,
  error: null,
  emailVerificationSent: false,
  passwordResetSent: false,
  sessions: []
};
