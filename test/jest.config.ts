export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: 'test/reports/coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: ['node_modules/(?!(p-all|p-map)/)'],
  reporters: [
    'default',
    [
      'jest-stare',
      {
        resultDir: 'test/reports',
        reportTitle: 'Test Report',
        additionalResultsProcessors: ['jest-junit'],
        coverageLink: 'coverage/lcov-report/index.html',
      },
    ],
  ],
};
