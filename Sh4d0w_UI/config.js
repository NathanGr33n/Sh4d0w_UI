// config.js
// Configuration management for Shadow UI
// By: NathanGr33n

const Store = require('electron-store');
const os = require('os');

// Configuration schema with validation
const schema = {
  window: {
    type: 'object',
    properties: {
      width: { type: 'number', minimum: 800, maximum: 4000, default: 1400 },
      height: { type: 'number', minimum: 600, maximum: 3000, default: 900 },
      backgroundColor: { type: 'string', default: '#0b0f14' }
    }
  },
  terminal: {
    type: 'object',
    properties: {
      defaultCols: { type: 'number', minimum: 40, maximum: 500, default: 120 },
      defaultRows: { type: 'number', minimum: 20, maximum: 200, default: 32 },
      fontSize: { type: 'number', minimum: 8, maximum: 24, default: 14 },
      shell: { type: 'string', default: null }
    }
  },
  monitoring: {
    type: 'object',
    properties: {
      pollInterval: { type: 'number', minimum: 500, maximum: 10000, default: 1000 },
      maxRetries: { type: 'number', minimum: 1, maximum: 10, default: 3 },
      enableBatteryMonitoring: { type: 'boolean', default: true },
      enableTemperatureMonitoring: { type: 'boolean', default: true }
    }
  },
  security: {
    type: 'object',
    properties: {
      allowExternalRequests: { type: 'boolean', default: false },
      enableLogging: { type: 'boolean', default: true },
      logLevel: { type: 'string', enum: ['error', 'warn', 'info'], default: 'info' }
    }
  },
  theme: {
    type: 'object',
    properties: {
      current: { type: 'string', default: 'shadow' },
      customCssPath: { type: 'string', default: null }
    }
  }
};

// Default configuration
const defaults = {
  window: {
    width: 1400,
    height: 900,
    backgroundColor: '#0b0f14'
  },
  terminal: {
    defaultCols: 120,
    defaultRows: 32,
    fontSize: 14,
    shell: process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash')
  },
  monitoring: {
    pollInterval: 1000,
    maxRetries: 3,
    enableBatteryMonitoring: true,
    enableTemperatureMonitoring: true
  },
  security: {
    allowExternalRequests: false,
    enableLogging: true,
    logLevel: 'info'
  },
  theme: {
    current: 'shadow',
    customCssPath: null
  }
};

class Config {
  constructor() {
    this.store = new Store({
      schema,
      defaults,
      name: 'shadow-ui-config',
      cwd: os.homedir()
    });
  }

  get(key, defaultValue = null) {
    try {
      return this.store.get(key, defaultValue);
    } catch (error) {
      console.error('Config get error:', error);
      return defaultValue;
    }
  }

  set(key, value) {
    try {
      this.store.set(key, value);
      return true;
    } catch (error) {
      console.error('Config set error:', error);
      return false;
    }
  }

  reset() {
    try {
      this.store.clear();
      this.store.store = { ...defaults };
      return true;
    } catch (error) {
      console.error('Config reset error:', error);
      return false;
    }
  }

  getWindowConfig() {
    return this.get('window', defaults.window);
  }

  getTerminalConfig() {
    return this.get('terminal', defaults.terminal);
  }

  getMonitoringConfig() {
    return this.get('monitoring', defaults.monitoring);
  }

  getSecurityConfig() {
    return this.get('security', defaults.security);
  }

  getThemeConfig() {
    return this.get('theme', defaults.theme);
  }

  // Validate and sanitize configuration values
  validateAndSanitize(key, value) {
    const keyParts = key.split('.');
    const schemaSection = schema[keyParts[0]];
    
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
      if (isNaN(num)) return false;
      if (propertySchema.minimum && num < propertySchema.minimum) return false;
      if (propertySchema.maximum && num > propertySchema.maximum) return false;
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

module.exports = new Config();
