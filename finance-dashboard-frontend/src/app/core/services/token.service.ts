import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly ACCESS_TOKEN_KEY = 'pfd_access_token';
  private readonly REFRESH_TOKEN_KEY = 'pfd_refresh_token';
  private readonly REMEMBER_ME_KEY = 'pfd_remember_me';

  setAccessToken(token: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  setRefreshToken(token: string): void {
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  setRememberMe(value: boolean): void {
    localStorage.setItem(this.REMEMBER_ME_KEY, value ? 'true' : 'false');
  }

  getRememberMe(): boolean {
    return localStorage.getItem(this.REMEMBER_ME_KEY) === 'true';
  }
}
