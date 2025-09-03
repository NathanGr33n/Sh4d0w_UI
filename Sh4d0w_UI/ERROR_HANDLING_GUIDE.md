# Error Handling & Logging Implementation Guide

This document outlines the comprehensive error handling and logging system implemented in Shadow UI v0.2.0.

## 🚀 Overview

Shadow UI now features enterprise-grade error handling, logging, and debugging capabilities designed to provide:
- **Comprehensive Error Tracking**: Every error is logged with context and stack traces
- **Automatic Recovery**: Smart recovery mechanisms for common failure scenarios
- **Performance Monitoring**: Real-time performance tracking and slow operation detection
- **Debug Tools**: Built-in debugging utilities for development and troubleshooting
- **Crash Protection**: Graceful handling of critical failures with crash reports

## 📁 New Files Added

### Core System Files

1. **`logger.js`** - Advanced logging system with file rotation
2. **`errorHandler.js`** - Comprehensive error handling and performance monitoring
3. **`renderer/errorBoundary.js`** - Client-side error handling and recovery

### Enhanced Existing Files

4. **`main.js`** - Integrated with new logging and error handling systems
5. **`preload.js`** - Enhanced IPC error handling
6. **`renderer/renderer.js`** - Error-safe component initialization
7. **`renderer/index.html`** - Includes error boundary script

## 🔧 System Architecture

### Main Process (Node.js)

```
┌─────────────────────────────────────────────────────────┐
│                    Main Process                         │
├─────────────────────────────────────────────────────────┤
│  Logger Class                                          │
│  • File logging with rotation                         │
│  • Console output                                     │
│  • Structured JSON logging                            │
│  • Performance timing                                 │
├─────────────────────────────────────────────────────────┤
│  ErrorHandler Class                                    │
│  • Global error capturing                             │
│  • Crash report generation                            │
│  • Memory monitoring                                  │
│  • Health checks                                      │
│  • Performance metrics                                │
├─────────────────────────────────────────────────────────┤
│  Enhanced IPC                                         │
│  • Error reporting from renderer                      │
│  • Debug command handling                             │
│  • Safe message passing                               │
└─────────────────────────────────────────────────────────┘
```

### Renderer Process (Browser)

```
┌─────────────────────────────────────────────────────────┐
│                  Renderer Process                      │
├─────────────────────────────────────────────────────────┤
│  RendererErrorHandler Class                           │
│  • JavaScript error capturing                         │
│  • Promise rejection handling                         │
│  • Automatic recovery attempts                        │
│  • Component health monitoring                        │
├─────────────────────────────────────────────────────────┤
│  Debug Panel (Optional)                               │
│  • Real-time error display                            │
│  • Memory usage monitoring                            │
│  • Performance metrics                                │
├─────────────────────────────────────────────────────────┤
│  Safe Component Wrappers                              │
│  • Terminal initialization                            │
│  • Stats rendering                                    │
│  • Clock updates                                      │
└─────────────────────────────────────────────────────────┘
```

## 📝 Logging System Features

### File Logging
- **Location**: `~/.shadow-ui/logs/`
- **Format**: Structured JSON with timestamps
- **Rotation**: Automatic file rotation at 10MB
- **Retention**: Keeps last 5 log files
- **Levels**: Error, Warn, Info, Debug

### Log Structure
```json
{
  "timestamp": "2025-01-03T04:30:00.123Z",
  "level": "INFO",
  "message": "Application started successfully",
  "metadata": { "component": "main" },
  "process": {
    "pid": 12345,
    "platform": "win32",
    "nodeVersion": "v20.10.0"
  },
  "memory": {
    "rss": 45678912,
    "heapUsed": 23456789
  }
}
```

### Performance Tracking
```javascript
// Usage examples
logger.time('operation-label');
// ... perform operation
logger.timeEnd('operation-label'); // Logs duration
```

## ⚠️ Error Handling Features

### Global Error Capture
- **Uncaught Exceptions**: Logged with full stack traces
- **Promise Rejections**: Automatically caught and reported
- **IPC Errors**: Safe communication with fallbacks
- **Component Failures**: Isolated with recovery attempts

### Crash Protection
- **Crash Reports**: Detailed crash analysis saved to `~/.shadow-ui/crashes/`
- **Graceful Shutdown**: Proper cleanup on critical failures
- **Retry Logic**: Smart retry mechanisms with backoff
- **Fault Isolation**: Prevent single component failures from crashing the app

### Memory Monitoring
- **Process Memory**: Tracks heap usage and warns on high usage
- **System Memory**: Monitors overall system memory health
- **Memory Leaks**: Detects and logs potential memory leak patterns

## 🛠️ Recovery Mechanisms

### Automatic Recovery
1. **Terminal Recovery**: Reinitializes broken terminal connections
2. **Stats Recovery**: Restores system monitoring on failure
3. **UI Recovery**: Repairs missing or broken UI components
4. **IPC Recovery**: Handles broken communication channels

### Manual Recovery Tools
```javascript
// Available in browser console (debug mode)
shadowDebug.getErrors()        // View recent errors
shadowDebug.clearErrors()      // Reset error counters
shadowDebug.getSystemInfo()    // System diagnostics
shadowDebug.enableDebug()      // Enable debug panel
shadowDebug.testError()        // Trigger test error
```

## 🔍 Debugging Tools

### Debug Mode Activation
```javascript
// Enable debug mode (persists across sessions)
localStorage.setItem('shadow-ui-debug', 'true');
// Refresh the application

// Or use the debug API
shadowDebug.enableDebug();
```

### Debug Panel Features
- **Real-time Error Count**: Live error tracking
- **Memory Usage**: Current heap usage
- **Recent Errors**: Last 3 errors with timestamps
- **Auto-refresh**: Updates every 5 seconds

### Debug Commands
```javascript
// Main process debug commands (sent via IPC)
window.edx.sendDebugCommand({ type: 'health-check' });
window.edx.sendDebugCommand({ type: 'memory-info' });
window.edx.sendDebugCommand({ type: 'clear-errors' });

// Get debug info
window.edx.getDebugInfo().then(info => console.log(info));
```

## 📊 Performance Monitoring

### Metrics Tracked
- **Operation Timing**: Individual operation performance
- **Error Frequency**: Error rate monitoring
- **Memory Usage**: Process and system memory
- **System Health**: Comprehensive health checks
- **Component Performance**: UI rendering times

### Performance Thresholds
- **Slow Operations**: > 100ms logged as warnings
- **Critical Operations**: > 1000ms logged as errors
- **Memory Warnings**: > 100MB heap usage
- **System Memory**: > 90% system memory usage

## 🚨 Error Types and Handling

### JavaScript Errors
```javascript
// Automatically caught and processed
window.addEventListener('error', errorHandler);
window.addEventListener('unhandledrejection', errorHandler);
```

### IPC Communication Errors
```javascript
// Safe IPC wrappers prevent failures
const safeIpcSend = (channel, data) => {
  try {
    ipcRenderer.send(channel, data);
  } catch (error) {
    console.error(`IPC Error on ${channel}:`, error);
  }
};
```

### System Errors
- **File System**: Logging and crash report file operations
- **Network**: External resource loading failures
- **Process**: Terminal and system monitoring failures

## 📋 Configuration

### Logger Configuration
```javascript
// Controlled via config.js
const logger = new Logger({
  logLevel: 'info',        // error, warn, info, debug
  enableConsole: true,     // Console output
  enableFile: true,        // File logging
  maxFileSize: 10485760,   // 10MB
  maxFiles: 5              // Keep 5 files
});
```

### Error Handler Configuration
```javascript
// Automatic configuration based on system
const errorHandler = new ErrorHandler(logger);
// Includes health monitoring every 30 seconds
```

## 🔒 Security Considerations

### Log Sanitization
- **No Sensitive Data**: Passwords and tokens are filtered
- **Data Limits**: String length limits prevent log bombing
- **File Permissions**: Log files have restricted access

### Error Reporting
- **Local Only**: No external error reporting by default
- **Data Privacy**: Stack traces don't expose user data
- **Configurable**: All logging can be disabled

## 📈 Monitoring Integration

### Health Checks
- **Automatic**: Every 30 seconds in background
- **Manual**: `logger.logSystemHealth()`
- **Metrics**: CPU, Memory, Disk, Network status

### Alerting
- **High Memory**: Warnings when approaching limits
- **Error Rates**: Alerts on high error frequency
- **Performance**: Warnings on slow operations

## 🛡️ Best Practices

### For Developers
1. **Use Safe Wrappers**: Always use `errorHandler.safe()` for risky operations
2. **Add Context**: Include meaningful context in error metadata
3. **Performance Timing**: Use `logger.time()` for performance-critical operations
4. **Error Recovery**: Design components to be recoverable

### For Users
1. **Debug Mode**: Enable when troubleshooting issues
2. **Log Files**: Check `~/.shadow-ui/logs/` for detailed information
3. **Crash Reports**: Share crash reports when reporting bugs
4. **Memory Monitoring**: Watch for high memory usage warnings

## 📚 API Reference

### Logger Methods
```javascript
logger.error(message, metadata)    // Log error
logger.warn(message, metadata)     // Log warning  
logger.info(message, metadata)     // Log info
logger.debug(message, metadata)    // Log debug
logger.time(label)                 // Start timing
logger.timeEnd(label)              // End timing
logger.logSystemHealth()           // System health check
logger.getRecentLogs(count)        // Get recent logs
```

### ErrorHandler Methods
```javascript
errorHandler.handleError(error, context, metadata)  // Handle error
errorHandler.safeAsync(fn, fallback, context)       // Safe async wrapper
errorHandler.safe(fn, fallback, context)            // Safe sync wrapper
errorHandler.trackPerformance(label, duration)      // Track performance
errorHandler.getMetrics()                           // Get error metrics
```

### RendererErrorHandler Methods
```javascript
rendererErrorHandler.safe(fn, fallback, context)           // Safe execution
rendererErrorHandler.safeAsync(fn, fallback, context)      // Safe async
rendererErrorHandler.startTiming(label)                    // Start timer
rendererErrorHandler.endTiming(label)                      // End timer
```

## 🔧 Troubleshooting

### Common Issues

1. **Log Files Not Created**
   - Check filesystem permissions
   - Verify disk space availability
   - Check `~/.shadow-ui/logs/` directory

2. **Debug Panel Not Showing**
   - Verify debug mode is enabled: `localStorage.getItem('shadow-ui-debug')`
   - Check browser console for errors
   - Try `shadowDebug.enableDebug()`

3. **High Memory Usage**
   - Check for error loops in debug panel
   - Clear error log: `shadowDebug.clearErrors()`
   - Restart application

4. **Performance Issues**
   - Enable debug mode to see timing information
   - Check recent performance metrics
   - Look for slow operations in logs

### Log Analysis
```bash
# View recent errors (PowerShell)
Get-Content "$HOME\.shadow-ui\logs\*.log" | ConvertFrom-Json | Where-Object { $_.level -eq "ERROR" } | Select-Object -Last 10

# Check memory usage patterns
Get-Content "$HOME\.shadow-ui\logs\*.log" | ConvertFrom-Json | Where-Object { $_.message -like "*memory*" }
```

## 🚀 Future Enhancements

### Planned Features
1. **Remote Logging**: Optional external log aggregation
2. **Performance Dashboards**: Built-in performance visualization
3. **Automated Recovery**: More sophisticated recovery mechanisms
4. **Error Analytics**: Pattern detection and analysis
5. **Custom Alerts**: User-configurable alert thresholds

---

**Shadow UI** - Now with comprehensive error handling, logging, and debugging capabilities for maximum reliability and debuggability.
