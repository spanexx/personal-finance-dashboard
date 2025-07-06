module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],
  testTimeout: 120000, // Match backend timeout
  collectCoverage: true,
  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!src/app/**/*.spec.ts',
    '!src/app/**/*.module.ts',
    '!src/app/**/index.ts',
    '!src/main.ts',
    '!src/polyfills.ts',
    '!src/environments/**',
    // Exclude model files from coverage as they are typically interfaces/data structures
    '!src/app/shared/models/**/*.ts',
    // Exclude standalone component configuration files if they are simple wrappers
    '!src/app/app.config.ts',
    '!src/app/app.routes.ts',
    // Exclude NgRx state, actions, selectors if they are primarily declarations
    '!src/app/store/**/*.state.ts',
    '!src/app/store/**/*.actions.ts',
    '!src/app/store/**/*.selectors.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@shared/(.*)$': '<rootDir>/src/app/shared/$1',
    '^@core/(.*)$': '<rootDir>/src/app/core/$1',
    '^@env/(.*)$': '<rootDir>/src/environments/$1'
  },
  // Add transformIgnorePatterns if not already present by preset to handle ESM libraries
  transformIgnorePatterns: [
     'node_modules/(?!.*\\.mjs$|@angular|@ngrx|rxjs)'
  ]
};
