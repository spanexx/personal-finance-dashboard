import { createReducer, on } from '@ngrx/store';
import * as AuthActions from '../actions/auth.actions';
import { AuthState, initialAuthState } from '../state/auth.state';

export const authReducer = createReducer(
  initialAuthState,
  on(AuthActions.register, AuthActions.login, AuthActions.refreshToken, AuthActions.getProfile, AuthActions.getSessions, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(AuthActions.registerSuccess, (state, { user, tokens, emailVerificationSent }) => ({
    ...state,
    user,
    tokens: tokens ?? null, // Defensive: never undefined
    loading: false,
    error: null,
    emailVerificationSent
  })),
  on(AuthActions.loginSuccess, (state, { user, tokens }) => ({
    ...state,
    user,
    tokens: tokens ?? null, // Defensive: never undefined
    loading: false,
    error: null
  })),
  on(AuthActions.logoutSuccess, () => initialAuthState),
  on(AuthActions.refreshTokenSuccess, (state, { tokens }) => ({
    ...state,
    tokens: tokens ?? null, // Defensive: never undefined
    loading: false,
    error: null
  })),
  on(AuthActions.getProfileSuccess, (state, { user }) => ({
    ...state,
    user,
    loading: false,
    error: null
  })),
  on(AuthActions.getSessionsSuccess, (state, { sessions }) => ({
    ...state,
    sessions,
    loading: false,
    error: null
  })),
  on(AuthActions.revokeSessionSuccess, (state, { sessionId }) => ({
    ...state,
    sessions: state.sessions.filter(s => s.sessionId !== sessionId),
    loading: false,
    error: null
  })),
  on(AuthActions.registerFailure, AuthActions.loginFailure, AuthActions.logoutFailure, AuthActions.refreshTokenFailure, AuthActions.getProfileFailure, AuthActions.getSessionsFailure, AuthActions.revokeSessionFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  on(AuthActions.resendEmailVerificationSuccess, (state) => ({
    ...state,
    emailVerificationSent: true,
    loading: false,
    error: null
  })),
  on(AuthActions.forgotPasswordSuccess, (state) => ({
    ...state,
    passwordResetSent: true,
    loading: false,
    error: null
  })),
  on(AuthActions.resetPasswordSuccess, (state) => ({
    ...state,
    loading: false,
    error: null
  })),
  on(AuthActions.authRestoreSession, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(AuthActions.authRestoreSessionSuccess, (state, { user, tokens }) => ({
    ...state,
    user,
    tokens: tokens ?? null,
    loading: false,
    error: null
  })),
  on(AuthActions.authRestoreSessionFailure, (state) => ({
    ...initialAuthState
  }))
);
