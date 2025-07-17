# Windows Troubleshooting Guide

## Common Issues and Solutions

### ✅ **RISOLTO** - Entry Point Module Error

**Problema**: Il processo esce immediatamente con "code 0 signal null" dopo ~80ms.

**Causa**: Bug nel controllo `import.meta.url` nel windows-data-collector.js per determinare se il modulo è chiamato direttamente. Il controllo originale non funzionava correttamente su Windows.

**Soluzione**: ✅ **CORRETTO in v2.1+**

Il windows-data-collector.js ora usa un controllo Windows-compatible:
```javascript
if (import.meta.url === `file://${__filename}` || process.argv[1] === __filename) {
    console.log('🪟 Windows Data Collector starting...');
    cli.parse();
}
```

**Test per verificare la correzione**:
```cmd
# Dovrebbe mostrare l'help senza errori
node windows-data-collector.js --help

# Dovrebbe mostrare lo status
node windows-data-collector.js status
```

### 1. Data Collection Process Exits with Code 0

**Problem**: The data collection process starts but immediately exits with "code 0 signal null"

**Possible Causes**:
- Network connectivity issues to Shelly device
- Windows firewall blocking outbound connections
- Node.js permissions issues
- Process management differences on Windows

**Solutions**:

#### A. Check Network Connectivity
```cmd
# Test basic connectivity to your Shelly device
ping 192.168.1.51

# Test HTTP connectivity
curl http://192.168.1.51/shelly
```

#### B. Test Direct Connection
```cmd
# Use the Windows-optimized collector directly
node windows-data-collector.js test 192.168.1.51

# Run with verbose logging
node windows-data-collector.js --shelly 192.168.1.51 --interval 5000
```

#### C. Check Windows Firewall
1. Open Windows Defender Firewall
2. Click "Allow an app through firewall"
3. Add Node.js if not present
4. Or temporarily disable firewall to test

#### D. Run as Administrator
```cmd
# Right-click Command Prompt and "Run as administrator"
cd C:\path\to\shelly-app
node server.js
```

### 2. Port 3000 Already in Use

**Problem**: `EADDRINUSE: address already in use :::3000`

**Solutions**:
```cmd
# Find what's using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID 1234 /F

# Or use a different port
set PORT=3001
node server.js
```

### 3. Permission Denied Errors

**Problem**: Cannot write to log files or data directory

**Solutions**:
```cmd
# Check folder permissions
icacls data
icacls bin

# Grant full control to current user
icacls data /grant %USERNAME%:F /T
icacls bin /grant %USERNAME%:F /T
```

### 4. Node.js Module Errors

**Problem**: `Cannot find module` errors

**Solutions**:
```cmd
# Reinstall dependencies
del package-lock.json
rmdir /s node_modules
npm install

# Clear npm cache
npm cache clean --force
```

### 5. CSV File Issues

**Problem**: Data not being written to CSV or file corruption

**Solutions**:
```cmd
# Check if file is locked
dir data\readings.csv
type data\readings.csv

# Delete and recreate
del data\readings.csv
# Restart data collection
```

## Debug Mode

### Enable Detailed Logging
```cmd
# Set debug environment variable
set DEBUG=shelly:*
node server.js

# Or use the Windows collector directly with verbose output
node windows-data-collector.js --shelly 192.168.1.51 --interval 1000 --max-retries 3
```

### Check Status Files
```cmd
# View collector status
type data\collector-status.json

# View recent logs
type data\collector.log | more
```

## Performance Monitoring

### Resource Usage
```cmd
# Monitor CPU and memory usage
tasklist /fi "imagename eq node.exe"

# Monitor network connections
netstat -an | findstr 192.168.1.51
```

### Data Collection Statistics
```cmd
# Check CSV file size and line count
dir data\readings.csv
find /c /v "" data\readings.csv
```

## Windows-Specific Features

The Windows-optimized collector includes:

1. **Better Process Management**: Handles Windows process signals properly
2. **Enhanced Logging**: Writes detailed logs to `data/collector.log`
3. **Connection Testing**: Built-in network connectivity tests
4. **Error Recovery**: More robust error handling for Windows networking
5. **Status Monitoring**: Detailed status tracking in JSON format

## Testing Steps

1. **Basic Server Test**:
```cmd
node server.js
# Open http://localhost:3000
```

2. **Network Test**:
```cmd
node windows-data-collector.js test 192.168.1.51
```

3. **Manual Data Collection**:
```cmd
node windows-data-collector.js --shelly 192.168.1.51 --interval 5000 --max-retries 3
```

4. **Web Interface Test**:
   - Open http://localhost:3000
   - Click "START DATA COLLECTION"
   - Enter Shelly IP: 192.168.1.51
   - Monitor console output

## Getting Help

If issues persist:

1. **Collect Debug Information**:
```cmd
echo "System Info:" > debug.txt
systeminfo >> debug.txt
echo "Node Version:" >> debug.txt
node --version >> debug.txt
echo "Network Config:" >> debug.txt
ipconfig /all >> debug.txt
echo "Process List:" >> debug.txt
tasklist | findstr node >> debug.txt
```

2. **Export Error Logs**:
```cmd
copy data\collector.log debug-collector.log
copy data\collector-status.json debug-status.json
```

3. **Test Network Path**:
```cmd
tracert 192.168.1.51
telnet 192.168.1.51 80
```

## Alternative Approaches

If the main collector doesn't work:

### 1. Use curl for testing
```cmd
curl -v http://192.168.1.51/rpc/EM.GetStatus?id=0
```

### 2. Manual HTTP requests
```cmd
# PowerShell alternative
powershell -Command "Invoke-RestMethod -Uri 'http://192.168.1.51/shelly'"
```

### 3. Different Node.js version
```cmd
# Check current version
node --version

# Consider upgrading/downgrading if needed
```

This troubleshooting guide should help resolve most Windows-specific issues with the Shelly data collection system. 