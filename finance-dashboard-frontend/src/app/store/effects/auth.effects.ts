import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import * as AuthActions from '../actions/auth.actions';
import { catchError, map, mergeMap, of, tap } from 'rxjs';
import { AuthenticationService } from '../../core/services/authentication.service';
import { TokenService } from '../../core/services/token.service';

@Injectable()
export class AuthEffects {
  constructor(
    private actions$: Actions,
    private authService: AuthenticationService,
    private tokenService: TokenService
  ) {}

  register$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.register),
      mergeMap(({ email, password, firstName, lastName, username }) =>
        this.authService.register(email, password, firstName, lastName, username).pipe(
          tap((res) => {
            this.tokenService.setAccessToken(res.tokens.accessToken);
            this.tokenService.setRefreshToken(res.tokens.refreshToken);
          }),
          map((res) => AuthActions.registerSuccess({ user: res.user, tokens: res.tokens, emailVerificationSent: res.emailVerificationSent })),
          catchError((error) => of(AuthActions.registerFailure({ error: error.message || 'Registration failed' })))
        )
      )
    )
  );

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      mergeMap(({ email, password }) =>
        this.authService.login(email, password).pipe(
          tap((res) => {
            this.tokenService.setAccessToken(res.tokens.accessToken);
            this.tokenService.setRefreshToken(res.tokens.refreshToken);
          }),
          map((res) => AuthActions.loginSuccess({ user: res.user, tokens: res.tokens })),
          catchError((error) => of(AuthActions.loginFailure({ error: error.message || 'Login failed' })))
        )
      )
    )
  );

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logout),
      mergeMap(() =>
        this.authService.logout().pipe(
          tap(() => this.tokenService.clearTokens()),
          map(() => AuthActions.logoutSuccess()),
          catchError((error) => of(AuthActions.logoutFailure({ error: error.message || 'Logout failed' })))
        )
      )
    )
  );

  refreshToken$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.refreshToken),
      mergeMap(({ refreshToken }) =>
        this.authService.refreshToken(refreshToken).pipe(
          tap((res) => {
            this.tokenService.setAccessToken(res.tokens.accessToken);
            this.tokenService.setRefreshToken(res.tokens.refreshToken);
          }),
          map((res) => AuthActions.refreshTokenSuccess({ tokens: res.tokens })),
          catchError((error) => of(AuthActions.refreshTokenFailure({ error: error.message || 'Token refresh failed' })))
        )
      )
    )
  );

  getProfile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.getProfile),
      mergeMap(() =>
        this.authService.getProfile().pipe(
          map((res) => AuthActions.getProfileSuccess({ user: res.user })),
          catchError((error) => of(AuthActions.getProfileFailure({ error: error.message || 'Profile fetch failed' })))
        )
      )
    )
  );

  forgotPassword$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.forgotPassword),
      mergeMap(({ email }) =>
        this.authService.forgotPassword(email).pipe(
          map(() => AuthActions.forgotPasswordSuccess()),
          catchError((error) => of(AuthActions.forgotPasswordFailure({ error: error.message || 'Password reset request failed' })))
        )
      )
    )
  );

  resetPassword$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.resetPassword),
      mergeMap(({ token, newPassword }) =>
        this.authService.resetPassword(token, newPassword).pipe(
          map(() => AuthActions.resetPasswordSuccess()),
          catchError((error) => of(AuthActions.resetPasswordFailure({ error: error.message || 'Password reset failed' })))
        )
      )
    )
  );

  // Restore session from local storage on app init
  restoreSession$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.authRestoreSession),
      mergeMap(() => {
        const accessToken = this.tokenService.getAccessToken();
        const refreshToken = this.tokenService.getRefreshToken();
        if (accessToken && refreshToken) {
          // Try to get user profile with stored token
          return this.authService.getProfile().pipe(
            map((res) => AuthActions.authRestoreSessionSuccess({ user: res.user, tokens: { accessToken, refreshToken, expiresIn: '', sessionId: undefined } })),
            catchError(() => of(AuthActions.authRestoreSessionFailure()))
          );
        } else {
          return of(AuthActions.authRestoreSessionFailure());
        }
      })
    )
  );

  // Add more effects for email verification, sessions, etc.
}
