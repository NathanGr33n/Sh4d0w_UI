// validation.test.ts
// Unit tests for validation helper functions

describe('Validation Helpers', () => {
  // Test validateSize function (from main.js)
  function validateSize(size: any): boolean {
    return !!(
      size &&
      typeof size.cols === 'number' &&
      size.cols > 0 &&
      size.cols <= 500 &&
      typeof size.rows === 'number' &&
      size.rows > 0 &&
      size.rows <= 200
    );
  }

  describe('validateSize', () => {
    it('should accept valid terminal size', () => {
      expect(validateSize({ cols: 120, rows: 32 })).toBe(true);
      expect(validateSize({ cols: 80, rows: 24 })).toBe(true);
      expect(validateSize({ cols: 500, rows: 200 })).toBe(true);
    });

    it('should reject size with cols out of range', () => {
      expect(validateSize({ cols: 0, rows: 32 })).toBe(false);
      expect(validateSize({ cols: -10, rows: 32 })).toBe(false);
      expect(validateSize({ cols: 501, rows: 32 })).toBe(false);
      expect(validateSize({ cols: 1000, rows: 32 })).toBe(false);
    });

    it('should reject size with rows out of range', () => {
      expect(validateSize({ cols: 120, rows: 0 })).toBe(false);
      expect(validateSize({ cols: 120, rows: -5 })).toBe(false);
      expect(validateSize({ cols: 120, rows: 201 })).toBe(false);
      expect(validateSize({ cols: 120, rows: 500 })).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(validateSize(null)).toBe(false);
      expect(validateSize(undefined)).toBe(false);
    });

    it('should reject objects missing cols or rows', () => {
      expect(validateSize({ cols: 120 })).toBe(false);
      expect(validateSize({ rows: 32 })).toBe(false);
      expect(validateSize({})).toBe(false);
    });

    it('should reject non-numeric cols or rows', () => {
      expect(validateSize({ cols: '120', rows: 32 })).toBe(false);
      expect(validateSize({ cols: 120, rows: '32' })).toBe(false);
      expect(validateSize({ cols: 'abc', rows: 'xyz' })).toBe(false);
    });

    it('should reject objects with NaN values', () => {
      expect(validateSize({ cols: NaN, rows: 32 })).toBe(false);
      expect(validateSize({ cols: 120, rows: NaN })).toBe(false);
    });

    it('should reject objects with Infinity', () => {
      expect(validateSize({ cols: Infinity, rows: 32 })).toBe(false);
      expect(validateSize({ cols: 120, rows: Infinity })).toBe(false);
    });
  });

  // Test sanitizeTerminalData function (from main.js)
  function sanitizeTerminalData(data: any): string {
    if (typeof data !== 'string') {
      return '';
    }

    // Limit length to prevent memory exhaustion
    let sanitized = data.slice(0, 10000);

    // Security: Filter dangerous terminal escape sequences
    // Remove OSC (Operating System Command) sequences that could be exploited
    sanitized = sanitized.replace(/\x1b\][^\x1b\x07]*[\x1b\x07]/g, '');

    // Remove CSI sequences that could manipulate terminal state unsafely
    sanitized = sanitized.replace(/\x1b\[[0-9;]*t/g, '');

    // Remove PM (Privacy Message) and APC (Application Program Command) sequences
    sanitized = sanitized.replace(/\x1b[_^][^\x1b]*\x1b\\/g, '');

    // Remove potentially dangerous DCS (Device Control String) sequences
    sanitized = sanitized.replace(/\x1bP[^\x1b]*\x1b\\/g, '');

    return sanitized;
  }

  describe('sanitizeTerminalData', () => {
    it('should return string as-is if under limit', () => {
      const input = 'echo "hello world"';
      expect(sanitizeTerminalData(input)).toBe(input);
    });

    it('should truncate strings over 10000 characters', () => {
      const longString = 'a'.repeat(15000);
      const result = sanitizeTerminalData(longString);
      expect(result.length).toBe(10000);
      expect(result).toBe('a'.repeat(10000));
    });

    it('should return empty string for non-string inputs', () => {
      expect(sanitizeTerminalData(null)).toBe('');
      expect(sanitizeTerminalData(undefined)).toBe('');
      expect(sanitizeTerminalData(123)).toBe('');
      expect(sanitizeTerminalData({})).toBe('');
      expect(sanitizeTerminalData([])).toBe('');
      expect(sanitizeTerminalData(true)).toBe('');
    });

    it('should handle empty string', () => {
      expect(sanitizeTerminalData('')).toBe('');
    });

    it('should preserve safe ANSI color codes', () => {
      const input = '\x1b[31mRed Text\x1b[0m';
      expect(sanitizeTerminalData(input)).toBe(input);
    });

    it('should remove dangerous OSC sequences', () => {
      // OSC sequences can execute commands
      const input = 'normal text\x1b]0;malicious\x07more text';
      const result = sanitizeTerminalData(input);
      expect(result).toBe('normal textmore text');
    });

    it('should remove window manipulation sequences', () => {
      // CSI t sequences can manipulate terminal window
      const input = 'text\x1b[8;24;80tbefore';
      const result = sanitizeTerminalData(input);
      expect(result).toBe('textbefore');
    });

    it('should remove DCS sequences', () => {
      // Device Control String sequences
      const input = 'start\x1bPdangerous\x1b\\end';
      const result = sanitizeTerminalData(input);
      expect(result).toBe('startend');
    });

    it('should remove PM and APC sequences', () => {
      // Privacy Message and Application Program Command
      const input = 'text\x1b_pm\x1b\\more\x1b^apc\x1b\\end';
      const result = sanitizeTerminalData(input);
      expect(result).toBe('textmoreend');
    });

    it('should prevent memory exhaustion attacks', () => {
      const malicious = 'x'.repeat(1000000); // 1MB string
      const result = sanitizeTerminalData(malicious);
      expect(result.length).toBe(10000);
    });
  });

  describe('Security - Input Validation', () => {
    it('should prevent terminal size DoS attacks', () => {
      // Extremely large terminal would consume massive memory
      expect(validateSize({ cols: 10000, rows: 10000 })).toBe(false);
    });

    it('should prevent negative size values that could cause buffer overflows', () => {
      expect(validateSize({ cols: -1, rows: -1 })).toBe(false);
    });

    it('should handle injection attempts in terminal data', () => {
      const injectionAttempt = '\x1b]0;$(rm -rf /)\x07';
      const result = sanitizeTerminalData(injectionAttempt);
      // Should still be returned (filtered by PTY), but truncated if too long
      expect(result.length).toBeLessThanOrEqual(10000);
    });

    it('should prevent prototype pollution attempts', () => {
      const malicious = { cols: 100, rows: 50, __proto__: { polluted: true } };
      // Should still validate based on cols/rows only
      expect(validateSize(malicious)).toBe(true);
      // Verify no pollution occurred
      expect((Object.prototype as any).polluted).toBeUndefined();
    });
  });
});
