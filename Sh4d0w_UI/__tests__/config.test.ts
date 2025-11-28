// config.test.ts
// Unit tests for configuration module

import config from '../config';

describe('Config Module', () => {
  describe('Configuration Types', () => {
    it('should return valid window configuration', () => {
      const windowConfig = config.getWindowConfig();

      expect(windowConfig).toBeDefined();
      expect(typeof windowConfig.width).toBe('number');
      expect(typeof windowConfig.height).toBe('number');
      expect(typeof windowConfig.backgroundColor).toBe('string');

      // Validate ranges
      expect(windowConfig.width).toBeGreaterThanOrEqual(800);
      expect(windowConfig.width).toBeLessThanOrEqual(4000);
      expect(windowConfig.height).toBeGreaterThanOrEqual(600);
      expect(windowConfig.height).toBeLessThanOrEqual(3000);
    });

    it('should return valid terminal configuration', () => {
      const terminalConfig = config.getTerminalConfig();

      expect(terminalConfig).toBeDefined();
      expect(typeof terminalConfig.defaultCols).toBe('number');
      expect(typeof terminalConfig.defaultRows).toBe('number');
      expect(typeof terminalConfig.fontSize).toBe('number');

      // Validate ranges
      expect(terminalConfig.defaultCols).toBeGreaterThanOrEqual(40);
      expect(terminalConfig.defaultCols).toBeLessThanOrEqual(500);
      expect(terminalConfig.defaultRows).toBeGreaterThanOrEqual(20);
      expect(terminalConfig.defaultRows).toBeLessThanOrEqual(200);
      expect(terminalConfig.fontSize).toBeGreaterThanOrEqual(8);
      expect(terminalConfig.fontSize).toBeLessThanOrEqual(24);
    });

    it('should return valid monitoring configuration', () => {
      const monitoringConfig = config.getMonitoringConfig();

      expect(monitoringConfig).toBeDefined();
      expect(typeof monitoringConfig.pollInterval).toBe('number');
      expect(typeof monitoringConfig.maxRetries).toBe('number');
      expect(typeof monitoringConfig.enableBatteryMonitoring).toBe('boolean');
      expect(typeof monitoringConfig.enableTemperatureMonitoring).toBe('boolean');

      // Validate ranges
      expect(monitoringConfig.pollInterval).toBeGreaterThanOrEqual(500);
      expect(monitoringConfig.pollInterval).toBeLessThanOrEqual(10000);
      expect(monitoringConfig.maxRetries).toBeGreaterThanOrEqual(1);
      expect(monitoringConfig.maxRetries).toBeLessThanOrEqual(10);
    });

    it('should return valid security configuration', () => {
      const securityConfig = config.getSecurityConfig();

      expect(securityConfig).toBeDefined();
      expect(typeof securityConfig.allowExternalRequests).toBe('boolean');
      expect(typeof securityConfig.enableLogging).toBe('boolean');
      expect(['error', 'warn', 'info']).toContain(securityConfig.logLevel);
    });

    it('should return valid theme configuration', () => {
      const themeConfig = config.getThemeConfig();

      expect(themeConfig).toBeDefined();
      expect(typeof themeConfig.current).toBe('string');
      expect(
        themeConfig.customCssPath === null || typeof themeConfig.customCssPath === 'string'
      ).toBe(true);
    });
  });

  describe('Validation and Sanitization', () => {
    it('should validate number values within bounds', () => {
      const result = config.validateAndSanitize('window.width', 1200);
      expect(result).toBe(1200);
    });

    it('should reject number values below minimum', () => {
      const result = config.validateAndSanitize('window.width', 500);
      expect(result).toBe(false);
    });

    it('should reject number values above maximum', () => {
      const result = config.validateAndSanitize('window.width', 5000);
      expect(result).toBe(false);
    });

    it('should validate boolean values', () => {
      const result = config.validateAndSanitize('security.enableLogging', true);
      expect(result).toBe(true);
    });

    it('should validate string values in enum', () => {
      const result = config.validateAndSanitize('security.logLevel', 'error');
      expect(result).toBe('error');
    });

    it('should reject string values not in enum', () => {
      const result = config.validateAndSanitize('security.logLevel', 'debug');
      expect(result).toBe(false);
    });

    it('should reject invalid key paths', () => {
      const result = config.validateAndSanitize('invalid.key', 'value');
      expect(result).toBe(false);
    });

    it('should convert string numbers to numbers', () => {
      const result = config.validateAndSanitize('window.width', '1500');
      expect(result).toBe(1500);
      expect(typeof result).toBe('number');
    });

    it('should reject non-numeric strings for number fields', () => {
      const result = config.validateAndSanitize('window.width', 'abc');
      expect(result).toBe(false);
    });
  });

  describe('Security Tests', () => {
    it('should default to secure configuration', () => {
      const securityConfig = config.getSecurityConfig();
      expect(securityConfig.allowExternalRequests).toBe(false);
    });

    it('should enforce strict bounds on poll interval to prevent DoS', () => {
      const tooFast = config.validateAndSanitize('monitoring.pollInterval', 100);
      expect(tooFast).toBe(false);

      const tooSlow = config.validateAndSanitize('monitoring.pollInterval', 20000);
      expect(tooSlow).toBe(false);
    });

    it('should limit terminal size to prevent resource exhaustion', () => {
      const tooBig = config.validateAndSanitize('terminal.defaultCols', 1000);
      expect(tooBig).toBe(false);

      const tooManyRows = config.validateAndSanitize('terminal.defaultRows', 500);
      expect(tooManyRows).toBe(false);
    });

    it('should validate log level enum to prevent injection', () => {
      const malicious = config.validateAndSanitize(
        'security.logLevel',
        '<script>alert("xss")</script>'
      );
      expect(malicious).toBe(false);
    });
  });
});
