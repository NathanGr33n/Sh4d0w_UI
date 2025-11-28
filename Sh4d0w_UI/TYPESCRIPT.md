# TypeScript Integration

Shadow UI now supports TypeScript for improved type safety and developer experience.

## Setup

TypeScript has been added to the project with the following configuration:

### Dependencies
- `typescript`: TypeScript compiler
- `@types/node`: Node.js type definitions
- `@types/electron`: Electron type definitions
- `ts-node`: TypeScript execution environment

### Configuration Files
- `tsconfig.json`: TypeScript compiler configuration with strict mode enabled
- Type definitions are generated in the `dist/` folder

## NPM Scripts

- `npm run build`: Compile TypeScript files to JavaScript
- `npm run typecheck`: Check types without emitting files
- `npm run dev`: Watch mode for TypeScript compilation
- `npm start`: Build and run the application

## Type Safety Features

The project now includes:

1. **Strict type checking** - All TypeScript strict flags enabled
2. **Interface definitions** - Configuration types exported from `config.ts`
3. **Type-safe configuration** - All config methods are fully typed
4. **Source maps** - For easier debugging

## Converted Files

- `config.ts` - Configuration management with full type definitions

### Type Exports

The `config.ts` module exports the following types:

```typescript
export interface WindowConfig
export interface TerminalConfig
export interface MonitoringConfig
export interface SecurityConfig
export interface ThemeConfig
export interface AppConfig
export type LogLevel = 'error' | 'warn' | 'info'
```

## Migration Path

New files should be written in TypeScript (.ts extension). Existing JavaScript files can be gradually migrated as needed. The TypeScript compiler is configured to:

- Allow JavaScript files (`allowJs: true`)
- Not check JavaScript files (`checkJs: false`)
- Generate declaration files for all compiled modules
- Create source maps for debugging

## Security Benefits

TypeScript adds security through:

1. **Type validation** - Prevents type-related bugs at compile time
2. **Null safety** - Strict null checks prevent null/undefined errors
3. **Input validation** - Type guards ensure data integrity
4. **Better IDE support** - Autocomplete and error detection

## Best Practices

When writing TypeScript code:

1. Use explicit types for function parameters and return values
2. Avoid `any` type unless absolutely necessary
3. Use type guards for runtime type checking
4. Export interfaces for public APIs
5. Use enums or union types for constants
