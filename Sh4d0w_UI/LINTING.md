# Linting and Formatting Guide

Shadow UI uses ESLint and Prettier to enforce code quality and consistent formatting.

## Tools

- **ESLint**: Linting and code quality enforcement
- **Prettier**: Code formatting
- **@typescript-eslint**: TypeScript-specific linting rules
- **eslint-plugin-prettier**: Integrates Prettier with ESLint

## Quick Start

```bash
# Check for linting issues
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Check code formatting
npm run format:check

# Auto-format code
npm run format
```

## Configuration Files

- `eslint.config.js`: ESLint configuration (modern flat config format)
- `.prettierrc.json`: Prettier formatting rules
- `.prettierignore`: Files to exclude from formatting

## Linting Rules

### Security Rules (Enforced)
- ❌ **no-eval**: Prevents use of `eval()`
- ❌ **no-implied-eval**: Prevents indirect `eval()` via setTimeout/setInterval
- ❌ **no-new-func**: Prevents Function constructor
- ❌ **no-debugger**: No debugger statements in production

### Code Quality Rules
- ✅ **prefer-const**: Use `const` for variables that aren't reassigned
- ✅ **eqeqeq**: Require strict equality (`===` instead of `==`)
- ✅ **curly**: Always use braces for control statements
- ⚠️ **no-console**: Warn on console statements (except warn/error/info)
- ⚠️ **@typescript-eslint/no-explicit-any**: Warn on explicit `any` usage

### TypeScript Rules
- ✅ **@typescript-eslint/no-unused-vars**: Flag unused variables (except those prefixed with `_`)
- ⚠️ **@typescript-eslint/no-explicit-any**: Discourage but allow `any` when necessary

## Prettier Configuration

- **Single quotes** for strings
- **Semicolons** required
- **100 character** line width
- **2 space** indentation
- **Trailing commas** in ES5-compatible locations
- **Auto** line endings (respects OS defaults)

## Ignored Files

The linter automatically ignores:
- `node_modules/`
- `dist/` (compiled output)
- `coverage/` (test coverage reports)
- `*.config.js` (configuration files)
- JavaScript files that aren't part of the TypeScript project

## IDE Integration

### VS Code

Install the following extensions:
- **ESLint** (dbaeumer.vscode-eslint)
- **Prettier** (esbenp.prettier-vscode)

Add to your `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["javascript", "typescript"]
}
```

## Pre-commit Workflow

Before committing code:

1. Run `npm run lint` to check for issues
2. Run `npm run lint:fix` to auto-fix what's possible
3. Run `npm test` to ensure tests still pass
4. Manually fix any remaining warnings

## Security Benefits

ESLint enforces several security-focused rules:

1. **No eval()** - Prevents code injection vulnerabilities
2. **No implied eval** - Prevents indirect code execution
3. **No Function constructor** - Blocks dynamic code execution
4. **Type safety** - TypeScript linting prevents type-related bugs
5. **Unused variable detection** - Reduces attack surface and code complexity

## Common Issues

### "Unexpected any" Warnings

These are acceptable in:
- Configuration type casting where type-safety isn't critical
- Test utilities that need generic typing
- Integration with untyped third-party libraries

To suppress in necessary cases, use:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config: any = ...;
```

### "Unexpected console" Warnings

Console statements are allowed for:
- `console.error()`
- `console.warn()`
- `console.info()`

Use the logger module instead of console.log() in production code.

## Continuous Integration

Linting should be enforced in CI/CD:
```bash
npm run lint
npm run format:check
npm run typecheck
npm test
```

All must pass before merging to main branch.
