// config.ts
// Configuration management for Shadow UI
// By: NathanGr33n

import Store from 'electron-store';
import * as os from 'os';

// Type definitions for configuration
export interface WindowConfig {
  width: number;
  height: number;
  backgroundColor: string;
}

export interface TerminalConfig {
  defaultCols: number;
  defaultRows: number;
  fontSize: number;
  shell: string | null;
}

export interface UIConfig {
  zoomLevel: number;
}

export interface MonitoringConfig {
  pollInterval: number;
  maxRetries: number;
  enableBatteryMonitoring: boolean;
  enableTemperatureMonitoring: boolean;
  // Adaptive polling settings
  adaptivePolling: boolean;
  slowPollWhenMinimized: boolean;
  minimizedPollInterval: number;
  // User-configurable metrics
  enabledMetrics: {
    cpu: boolean;
    memory: boolean;
    network: boolean;
    disk: boolean;
    battery: boolean;
    temperature: boolean;
  };
}

export type LogLevel = 'error' | 'warn' | 'info';

export interface SecurityConfig {
  allowExternalRequests: boolean;
  enableLogging: boolean;
  logLevel: LogLevel;
}

export interface ThemeConfig {
  current: string;
  customCssPath: string | null;
}

export interface ShellConfig {
  // Master switch: when true, main.js uses kiosk window + shell UI.
  // Also controllable via `--shell` CLI flag or SHADOW_UI_SHELL=1 env var.
  enabled: boolean;
  // Whether the watchdog should restart the app on crash.
  launchOnStartup: boolean;
  // Panic hotkey used to spawn explorer.exe as a recovery fallback.
  // Electron accelerator format (https://www.electronjs.org/docs/latest/api/accelerator).
  panicHotkey: string;
  // Max restarts allowed inside the sliding window before falling back.
  watchdogRetries: number;
  // Sliding window duration (ms) used to count retries.
  watchdogWindowMs: number;
  // If the watchdog exceeds its retry budget, spawn explorer.exe instead of exiting.
  fallbackToExplorer: boolean;
  // Cache TTL for the Start Menu enumeration, in milliseconds.
  startMenuCacheMs: number;
}

export interface AppConfig {
  window: WindowConfig;
  terminal: TerminalConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
  theme: ThemeConfig;
  ui: UIConfig;
  shell: ShellConfig;
}

// Configuration schema with validation
const schema = {
  window: {
    type: 'object',
    properties: {
      width: { type: 'number', minimum: 800, maximum: 4000, default: 1400 },
      height: { type: 'number', minimum: 600, maximum: 3000, default: 900 },
      backgroundColor: { type: 'string', default: '#0b0f14' },
    },
  },
  terminal: {
    type: 'object',
    properties: {
      defaultCols: { type: 'number', minimum: 40, maximum: 500, default: 120 },
      defaultRows: { type: 'number', minimum: 20, maximum: 200, default: 32 },
      fontSize: { type: 'number', minimum: 8, maximum: 24, default: 14 },
      shell: { type: ['string', 'null'], default: null },
    },
  },
  monitoring: {
    type: 'object',
    properties: {
      pollInterval: { type: 'number', minimum: 500, maximum: 10000, default: 1000 },
      maxRetries: { type: 'number', minimum: 1, maximum: 10, default: 3 },
      enableBatteryMonitoring: { type: 'boolean', default: true },
      enableTemperatureMonitoring: { type: 'boolean', default: true },
      adaptivePolling: { type: 'boolean', default: true },
      slowPollWhenMinimized: { type: 'boolean', default: true },
      minimizedPollInterval: { type: 'number', minimum: 2000, maximum: 30000, default: 5000 },
      enabledMetrics: {
        type: 'object',
        properties: {
          cpu: { type: 'boolean', default: true },
          memory: { type: 'boolean', default: true },
          network: { type: 'boolean', default: true },
          disk: { type: 'boolean', default: true },
          battery: { type: 'boolean', default: true },
          temperature: { type: 'boolean', default: true },
        },
      },
    },
  },
  security: {
    type: 'object',
    properties: {
      allowExternalRequests: { type: 'boolean', default: false },
      enableLogging: { type: 'boolean', default: true },
      logLevel: { type: 'string', enum: ['error', 'warn', 'info'], default: 'info' },
    },
  },
  theme: {
    type: 'object',
    properties: {
      current: { type: 'string', default: 'shadow' },
      customCssPath: { type: ['string', 'null'], default: null },
    },
  },
  ui: {
    type: 'object',
    properties: {
      zoomLevel: { type: 'number', minimum: 0.5, maximum: 2.0, default: 1.0 },
    },
  },
  shell: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: false },
      launchOnStartup: { type: 'boolean', default: true },
      panicHotkey: { type: 'string', default: 'Control+Alt+Shift+E' },
      watchdogRetries: { type: 'number', minimum: 0, maximum: 100, default: 5 },
      watchdogWindowMs: { type: 'number', minimum: 1000, maximum: 3600000, default: 60000 },
      fallbackToExplorer: { type: 'boolean', default: true },
      startMenuCacheMs: { type: 'number', minimum: 0, maximum: 3600000, default: 30000 },
    },
  },
};

// Default configuration
const defaults: AppConfig = {
  window: {
    width: 1400,
    height: 900,
    backgroundColor: '#0b0f14',
  },
  terminal: {
    defaultCols: 120,
    defaultRows: 32,
    fontSize: 14,
    shell: process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash',
  },
  monitoring: {
    pollInterval: 1000,
    maxRetries: 3,
    enableBatteryMonitoring: true,
    enableTemperatureMonitoring: true,
    adaptivePolling: true,
    slowPollWhenMinimized: true,
    minimizedPollInterval: 5000,
    enabledMetrics: {
      cpu: true,
      memory: true,
      network: true,
      disk: true,
      battery: true,
      temperature: true,
    },
  },
  security: {
    allowExternalRequests: false,
    enableLogging: true,
    logLevel: 'info',
  },
  theme: {
    current: 'shadow',
    customCssPath: null,
  },
  ui: {
    zoomLevel: 1.0,
  },
  shell: {
    enabled: false,
    launchOnStartup: true,
    panicHotkey: 'Control+Alt+Shift+E',
    watchdogRetries: 5,
    watchdogWindowMs: 60000,
    fallbackToExplorer: true,
    startMenuCacheMs: 30000,
  },
};

class Config {
  private store: Store<AppConfig>;

  constructor() {
    this.store = new Store<AppConfig>({
      schema: schema as any,
      defaults,
      name: 'shadow-ui-config',
      cwd: os.homedir(),
    });
  }

  get<K extends keyof AppConfig>(key: K, defaultValue?: AppConfig[K]): AppConfig[K];
  get(key: string, defaultValue: any = null): any {
    try {
      return this.store.get(key as any, defaultValue);
    } catch (error) {
      console.error('Config get error:', error);
      return defaultValue;
    }
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): boolean;
  set(key: string, value: any): boolean {
    try {
      this.store.set(key as any, value);
      return true;
    } catch (error) {
      console.error('Config set error:', error);
      return false;
    }
  }

  reset(): boolean {
    try {
      this.store.clear();
      this.store.store = { ...defaults };
      return true;
    } catch (error) {
      console.error('Config reset error:', error);
      return false;
    }
  }

  getWindowConfig(): WindowConfig {
    return this.get('window', defaults.window);
  }

  getTerminalConfig(): TerminalConfig {
    return this.get('terminal', defaults.terminal);
  }

  getMonitoringConfig(): MonitoringConfig {
    return this.get('monitoring', defaults.monitoring);
  }

  getSecurityConfig(): SecurityConfig {
    return this.get('security', defaults.security);
  }

  getThemeConfig(): ThemeConfig {
    return this.get('theme', defaults.theme);
  }

  getUIConfig(): UIConfig {
    return this.get('ui', defaults.ui);
  }

  getShellConfig(): ShellConfig {
    return this.get('shell', defaults.shell);
  }

  // Validate and sanitize configuration values
  validateAndSanitize(key: string, value: any): number | string | boolean | false {
    const keyParts = key.split('.');
    const schemaSection = (schema as any)[keyParts[0]];

    if (!schemaSection || !schemaSection.properties) {
      return false;
    }

    const propertySchema = schemaSection.properties[keyParts[1]];
    if (!propertySchema) {
      return false;
    }

    // Type validation
    if (propertySchema.type === 'number') {
      const num = Number(value);
      if (isNaN(num)) {
        return false;
      }
      if (propertySchema.minimum !== undefined && num < propertySchema.minimum) {
        return false;
      }
      if (propertySchema.maximum !== undefined && num > propertySchema.maximum) {
        return false;
      }
      return num;
    }

    if (propertySchema.type === 'boolean') {
      return Boolean(value);
    }

    if (propertySchema.type === 'string') {
      const str = String(value);
      if (propertySchema.enum && !propertySchema.enum.includes(str)) {
        return false;
      }
      return str;
    }

    return false;
  }
}

export default new Config();
