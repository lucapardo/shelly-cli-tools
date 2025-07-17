# Enhanced Data Collection System

## Overview

The Shelly CLI Tools now features an enhanced, independent data collection system that runs continuously in the background, separate from the web interface. This ensures reliable data capture even when the web browser is closed.

## Key Features

### 🔄 Independent Background Process
- Data collection runs as a separate Node.js process
- Continues running even when web browser is closed
- Automatic process management via the web interface

### 🛡️ Robust Error Handling
- Automatic retry on connection failures
- Configurable retry limits and delays
- Graceful degradation and recovery

### 📊 Enhanced Monitoring
- Real-time status updates
- Detailed logging with timestamps
- Reading count and uptime tracking
- Error tracking and reporting

### 💾 Persistent Data Storage
- Organized data directory structure
- Status file for process monitoring
- Comprehensive logging to files
- CSV output for readings

## Usage

### Via Web Interface (Recommended)

1. **Start Collection**: Click "Start Data Collection" in the dashboard
2. **Monitor Status**: View real-time status with reading count, uptime, and last reading time
3. **Stop Collection**: Click "Stop Data Collection" to gracefully shutdown

### Via Command Line

```bash
# Start data collection
node bin/data-collector.js --shelly 192.168.1.100

# Check status
node bin/data-collector.js status

# Stop collection (if running in background)
node bin/data-collector.js stop
```

### Command Line Options

```bash
--shelly <ip>           # Required: Shelly device IP address
--output <file>         # Output CSV file (default: data/readings.csv)
--interval <ms>         # Reading interval in milliseconds (default: 1000)
--max-retries <count>   # Max consecutive errors before stopping (default: 5)
--retry-delay <ms>      # Delay between retries (default: 5000)
```

## File Structure

```
data/
├── readings.csv           # Main data file with sensor readings
├── collector-status.json  # Current status of data collection
└── collector.log          # Detailed logs with timestamps
```

## Status Information

The enhanced status display shows:
- **Connection Status**: Active/Stopped/Error
- **Reading Count**: Total readings collected
- **Uptime**: How long collection has been running
- **Last Reading**: Timestamp of most recent successful reading
- **Error Count**: Number of recent consecutive errors

## Benefits Over Previous System

### ✅ Reliability
- **Before**: Required web page to stay open
- **After**: Runs independently in background

### ✅ Error Recovery
- **Before**: Single failure could stop collection
- **After**: Automatic retry with configurable limits

### ✅ Monitoring
- **Before**: Limited status information
- **After**: Comprehensive real-time status and logging

### ✅ Process Management
- **Before**: Manual process handling
- **After**: Graceful start/stop with proper cleanup

## Technical Details

### Process Architecture
1. **Web Server** (`server.js`) - Manages the data collection process
2. **Data Collector** (`bin/data-collector.js`) - Independent collection process
3. **Web Interface** (`graphs.html`) - Control and monitoring UI

### Communication
- Web interface communicates with server via REST API
- Server spawns and manages data collector process
- Status shared via JSON files for real-time updates

### Error Handling
- Connection timeouts with automatic retry
- Graceful shutdown on SIGINT/SIGTERM
- Comprehensive error logging
- Maximum retry limits to prevent infinite loops

## Migration from Old System

The new system is **backward compatible**. Existing CSV files and configurations will continue to work. The enhanced collector simply provides better reliability and monitoring.

### What Changed
- `bin/continuous_read.js` → `bin/data-collector.js` (enhanced version)
- Added status monitoring and logging
- Improved error handling and recovery
- Enhanced web interface status display

### What Stayed the Same
- CSV file format and location
- Web interface controls
- Device configuration system
- Chart and analysis features

## Troubleshooting

### Data Collection Won't Start
1. Check device IP address is correct
2. Ensure Shelly device is accessible on network
3. Check server logs for error messages
4. Verify `data/` directory exists and is writable

### Collection Stops Unexpectedly
1. Check `data/collector.log` for error details
2. Verify network connectivity to Shelly device
3. Check if maximum retry limit was reached
4. Restart collection from web interface

### Status Not Updating
1. Refresh the web page
2. Check if `data/collector-status.json` exists
3. Verify server is running and accessible
4. Check browser console for JavaScript errors

## Advanced Usage

### Running as System Service
For production deployments, consider running the data collector as a system service:

```bash
# Example systemd service file
[Unit]
Description=Shelly Data Collector
After=network.target

[Service]
Type=simple
User=shelly
WorkingDirectory=/path/to/shelly-cli-tools
ExecStart=/usr/bin/node bin/data-collector.js --shelly 192.168.1.100
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Custom Output Processing
The collector outputs standard CSV format that can be processed by external tools:

```bash
# Real-time monitoring
tail -f data/readings.csv

# Data analysis with standard tools
awk -F',' '{print $3}' data/readings.csv | tail -100  # Last 100 power readings
``` 