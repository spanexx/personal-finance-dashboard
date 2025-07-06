import { Injectable } from '@angular/core';
import { 
  CanActivate, 
  CanActivateChild, 
  CanLoad, 
  Route, 
  Router, 
  UrlSegment, 
  ActivatedRouteSnapshot, 
  RouterStateSnapshot 
} from '@angular/router';
import { Observable, map, take } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from '../../store/state/app.state';
import { selectIsAuthenticated } from '../../store/selectors/auth.selectors';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild, CanLoad {
  constructor(
    private store: Store<AppState>,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkAuth(state.url);
  }

  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.canActivate(childRoute, state);
  }

  canLoad(
    route: Route,
    segments: UrlSegment[]
  ): Observable<boolean> {
    const url = segments.map(segment => segment.path).join('/');
    return this.checkAuth(url);
  }

  private checkAuth(url: string): Observable<boolean> {
    return this.store.select(selectIsAuthenticated).pipe(
      take(1),
      map(isAuthenticated => {
        if (isAuthenticated) {
          return true;
        }

        // Store the attempted URL for redirecting after login
        this.router.navigate(['/auth/login'], { 
          queryParams: { returnUrl: url } 
        });
        return false;
      })
    );
  }
}
