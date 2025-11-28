# Testing Guide

Shadow UI now includes comprehensive automated testing with Jest.

## Test Framework

- **Jest**: JavaScript testing framework
- **ts-jest**: TypeScript preprocessor for Jest
- **@types/jest**: TypeScript definitions for Jest

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (useful during development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

Tests are located in the `__tests__/` directory:

```
__tests__/
├── config.test.ts         # Configuration module tests
└── validation.test.ts     # Input validation tests
```

## Test Coverage

Current test suites cover:

### Configuration Module (`config.test.ts`)
- **Configuration Types**: Validates all configuration sections return correct types and values within acceptable ranges
- **Validation and Sanitization**: Tests the `validateAndSanitize` method for proper type conversion and bounds checking
- **Security Tests**: Ensures secure defaults and validates input sanitization against attacks

### Validation Helpers (`validation.test.ts`)
- **Terminal Size Validation**: Tests bounds checking for terminal dimensions
- **Terminal Data Sanitization**: Validates string truncation and type checking
- **Security Tests**: Prevents DoS attacks, buffer overflows, and injection attempts

## Test Results

```
Test Suites: 2 passed, 2 total
Tests:       36 passed, 36 total
```

All tests validate both functionality and security:
- ✅ Type safety and bounds checking
- ✅ Input validation and sanitization
- ✅ DoS prevention (resource exhaustion)
- ✅ Injection attack prevention
- ✅ Buffer overflow protection

## Writing New Tests

When adding new features:

1. Create a new test file in `__tests__/` with `.test.ts` extension
2. Import the module/function to test
3. Use `describe` blocks to group related tests
4. Use `it` or `test` for individual test cases
5. Always include security-focused tests for user inputs

### Example Test Structure

```typescript
describe('MyModule', () => {
  describe('Feature Name', () => {
    it('should handle valid input', () => {
      expect(myFunction(validInput)).toBe(expectedOutput);
    });

    it('should reject invalid input', () => {
      expect(myFunction(invalidInput)).toBe(false);
    });
  });

  describe('Security Tests', () => {
    it('should prevent injection attacks', () => {
      expect(myFunction(maliciousInput)).toBe(false);
    });
  });
});
```

## Coverage Reports

Coverage reports are generated in the `coverage/` directory when running `npm run test:coverage`.

To view the HTML coverage report:
1. Run `npm run test:coverage`
2. Open `coverage/lcov-report/index.html` in a browser

## Continuous Integration

These tests should be run:
- Before committing code
- In CI/CD pipelines
- Before creating releases

## Test Configuration

Jest is configured via `jest.config.js`:
- Uses `ts-jest` preset for TypeScript support
- Targets Node.js environment (for Electron main process)
- Excludes `node_modules`, `dist`, and `renderer` from coverage
- Timeout set to 10 seconds for long-running tests

## Security Testing

All test suites include dedicated security test sections that verify:
- Input validation prevents malicious payloads
- Resource limits prevent DoS attacks
- Type checking prevents type confusion vulnerabilities
- Bounds checking prevents buffer overflows
- Enum validation prevents injection attacks
