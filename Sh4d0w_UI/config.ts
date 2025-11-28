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

export interface MonitoringConfig {
  pollInterval: number;
  maxRetries: number;
  enableBatteryMonitoring: boolean;
  enableTemperatureMonitoring: boolean;
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

export interface AppConfig {
  window: WindowConfig;
  terminal: TerminalConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
  theme: ThemeConfig;
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
