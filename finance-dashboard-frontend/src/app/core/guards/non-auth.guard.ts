import { Injectable } from '@angular/core';
import { 
  CanActivate, 
  CanActivateChild, 
  Router, 
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
export class NonAuthGuard implements CanActivate, CanActivateChild {
  constructor(
    private store: Store<AppState>,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkNonAuth();
  }

  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.canActivate(childRoute, state);
  }

  private checkNonAuth(): Observable<boolean> {
    return this.store.select(selectIsAuthenticated).pipe(
      take(1),
      map(isAuthenticated => {
        if (!isAuthenticated) {
          return true;
        }

        // If user is already authenticated, redirect to dashboard
        this.router.navigate(['/dashboard']);
        return false;
      })
    );
  }
}
