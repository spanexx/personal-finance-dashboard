import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { CurrencyPipe, DecimalPipe, DatePipe } from '@angular/common'; // Import pipes + DatePipe

import { routes } from './app.routes';
import { reducers } from './store/reducers';
import { effects } from './store/effects';
import { httpInterceptorProviders } from './core/interceptors';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withPreloading(PreloadAllModules)
    ),
    provideAnimations(),
    provideHttpClient(withInterceptorsFromDi()),
    // HTTP Interceptors
    ...httpInterceptorProviders,
    provideStore(reducers),
    provideEffects(effects),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      trace: false,
      traceLimit: 75,
      connectInZone: true
    }),
    // Provide CurrencyPipe and DecimalPipe for CurrencyService
    CurrencyPipe,
    DecimalPipe,
    DatePipe, // Provide DatePipe for DateService
  ]
};
