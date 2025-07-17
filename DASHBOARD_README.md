# Shelly 3EM Readings Dashboard

A real-time web dashboard for monitoring electrical measurements from your Shelly Pro 3EM device.

## Features

- **Real-time Data Visualization**: Interactive line charts showing current and voltage measurements
- **Configurable Refresh Rate**: Set custom intervals (1-300 seconds) for data updates
- **Flexible Time Range**: View data from the last few minutes to 24 hours
- **Interactive Charts**: Hover to see exact values, peaks, and valleys
- **Statistics Display**: Current, average, minimum, and maximum values for each measurement
- **Auto-refresh Control**: Toggle automatic data updates on/off
- **Responsive Design**: Works on desktop and mobile devices

## Dashboard Layout

### Current Charts (Red Theme)
- **Current Phase A**: Real-time current measurements for phase A
- **Current Phase B**: Real-time current measurements for phase B  
- **Current Phase C**: Real-time current measurements for phase C

### Voltage Charts (Teal Theme)
- **Voltage Phase A**: Real-time voltage measurements for phase A
- **Voltage Phase B**: Real-time voltage measurements for phase B
- **Voltage Phase C**: Real-time voltage measurements for phase C

## Quick Start

### 1. Start Data Collection
First, start collecting data from your Shelly device:

```bash
# Start continuous reading (saves to test-readings.csv)
node bin/continuous_read.js --shelly <YOUR_SHELLY_IP> --output test-readings.csv --interval 1000
```

### 2. Start the Dashboard Server
In a new terminal, start the web server:

```bash
# Start the dashboard server
node server.js
```

### 3. Open the Dashboard
Open your web browser and navigate to:
```
http://localhost:3000
```

## Controls

### Refresh Interval
- **Range**: 1-300 seconds
- **Default**: 5 seconds
- **Purpose**: How often the dashboard fetches new data from the CSV file

### Time Range
- **Range**: 0.1-24 hours
- **Default**: 1 hour
- **Purpose**: How much historical data to display on the charts

### Buttons
- **Toggle Auto Refresh**: Enable/disable automatic data updates
- **Refresh Now**: Manually trigger an immediate data update

## Data Format

The dashboard reads data from `test-readings.csv` with the following structure:

```csv
MAC,timestamp,reading_id,voltage_a,voltage_b,voltage_c,current_a,current_b,current_c,current_n,apower_a,apower_b,apower_c,aprtpower_a,aprtpower_b,aprtpower_c,pf_a,pf_b,pf_c
```

Example:
```csv
2CBCBBA658D4,1748248859,3,237.4,0,237.8,1.554,2.733,2.303,,192.8,0,448.2,369.6,0,548.4,0.69,0,0.85
```

## Chart Features

### Interactive Elements
- **Hover Tooltips**: Show exact timestamp and value
- **Zoom**: Use mouse wheel to zoom in/out on time ranges
- **Pan**: Click and drag to pan across time periods

### Statistics Panel
Each chart displays:
- **Current**: Latest reading value
- **Average**: Mean value over the displayed time range
- **Min**: Minimum value in the time range
- **Max**: Maximum value in the time range

### Visual Indicators
- **Current Charts**: Red color scheme with ⚡ icon
- **Voltage Charts**: Teal color scheme with 🔋 icon
- **Status Indicator**: Green (connected) or red (error) status

## Troubleshooting

### Common Issues

1. **"Failed to load data" Error**
   - Ensure `test-readings.csv` exists in the same directory
   - Check that the continuous_read.js script is running
   - Verify the CSV file has data and correct format

2. **Charts Not Updating**
   - Check the refresh interval setting
   - Ensure auto-refresh is enabled
   - Verify the server is running on port 3000

3. **No Data Displayed**
   - Check the time range setting (data might be outside the range)
   - Ensure the CSV file contains recent timestamps
   - Verify data collection is active

### Server Issues

1. **Port 3000 Already in Use**
   ```bash
   # Use a different port
   PORT=3001 node server.js
   ```

2. **File Not Found Errors**
   - Ensure you're running the server from the correct directory
   - Check that `graphs.html` and `test-readings.csv` exist

## Technical Details

### Dependencies
- **Chart.js**: Interactive charting library
- **Chart.js Date Adapter**: Time-based x-axis support
- **Node.js HTTP Server**: Serves the dashboard and CSV data

### Browser Compatibility
- Modern browsers with ES6+ support
- Chrome, Firefox, Safari, Edge (recent versions)

### Performance
- Optimized for datasets up to 24 hours of 1-second interval data
- Efficient chart updates using Chart.js animation controls
- Minimal memory footprint with data filtering

## Customization

### Modify Refresh Intervals
Edit the input constraints in `graphs.html`:
```html
<input type="number" id="refreshInterval" value="5" min="1" max="300">
```

### Change Chart Colors
Modify the color arrays in the JavaScript:
```javascript
const colors = {
    current: ['#ff6b6b', '#ff8e8e', '#ffb3b3'],
    voltage: ['#4ecdc4', '#7dd3d8', '#a8ddd8']
};
```

### Adjust Chart Height
Change the CSS:
```css
.chart-container {
    height: 300px; /* Modify this value */
}
```

## License

This dashboard is part of the Shelly CLI Tools project. See the main LICENSE file for details. 