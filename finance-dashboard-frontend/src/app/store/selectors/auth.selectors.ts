import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AuthState } from '../state/auth.state';

export const selectAuthState = createFeatureSelector<AuthState>('auth');

export const selectAuthUser = createSelector(selectAuthState, (state) => state.user);
export const selectAuthTokens = createSelector(selectAuthState, (state) => state.tokens);
export const selectAuthLoading = createSelector(selectAuthState, (state) => state.loading);
export const selectAuthError = createSelector(selectAuthState, (state) => state.error);
export const selectEmailVerificationSent = createSelector(selectAuthState, (state) => state.emailVerificationSent);
export const selectPasswordResetSent = createSelector(selectAuthState, (state) => state.passwordResetSent);
export const selectAuthSessions = createSelector(selectAuthState, (state) => state.sessions);
export const selectIsAuthenticated = createSelector(selectAuthTokens, (tokens) => !!tokens?.accessToken);
