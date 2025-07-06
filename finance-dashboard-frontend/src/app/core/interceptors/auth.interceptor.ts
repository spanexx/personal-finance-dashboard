import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { TokenService } from '../services/token.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private tokenService: TokenService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    const accessToken = this.tokenService.getAccessToken();

    if (accessToken) {
      const cloned = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${accessToken}`),
      });
      return next.handle(cloned);
    }

    return next.handle(req);
  }
}
