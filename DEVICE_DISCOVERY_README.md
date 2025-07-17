# Shelly Device Discovery

This feature allows you to automatically discover Shelly devices on your local network through the web dashboard.

## Features

### 🔍 **Automatic Network Scanning**
- Scans your local network IP range automatically
- Uses WebRTC to detect your local IP range
- Falls back to common IP ranges (192.168.1.x, 192.168.0.x, etc.)
- Batch scanning to prevent browser freezing

### 🌐 **Cross-Platform Compatibility**
- Works in all modern web browsers (Chrome, Firefox, Safari, Edge)
- Compatible with desktop, mobile, and tablet devices
- Works on Mac, Windows, iOS, and Android
- No additional software installation required

### 🎯 **Smart Device Detection**
- Identifies Shelly devices by checking multiple endpoints (`/shelly`, `/status`, `/settings`)
- Filters out non-Shelly devices automatically
- Enriches device information by querying multiple endpoints
- Provides detailed device information (type, firmware, MAC address)

### 📊 **Real-Time Progress**
- Live progress bar showing scan progress
- Real-time device counter
- Current IP range being scanned
- Ability to stop scanning at any time

## How to Use

### 1. **Access Discovery**
- Open the Shelly dashboard (`graphs.html`)
- Click the **🔍 Discover Devices** button in the controls section

### 2. **Start Scanning**
- Click **🔍 Start Discovery** in the modal
- Watch the progress bar as it scans your network
- Discovered devices will appear in real-time

### 3. **Select a Device**
- Review discovered devices with their details
- Click **✅ Use This Device** to select a device
- The device IP will be automatically filled in the main form
- Optionally start data collection immediately

### 4. **Additional Actions**
- **🔧 Test Connection**: Verify device connectivity
- **📋 Details**: View complete device information
- **⏹️ Stop Discovery**: Cancel ongoing scan

## Technical Details

### **Discovery Methods**
1. **WebRTC IP Detection**: Automatically detects your local IP range
2. **IP Range Scanning**: Systematically scans all IPs in the range
3. **Multi-Endpoint Probing**: Tests `/shelly`, `/status`, and `/settings` endpoints
4. **Device Validation**: Confirms devices are actually Shelly products

### **Performance Optimizations**
- **Batch Processing**: Scans 10 IPs simultaneously to balance speed and browser performance
- **Smart Timeouts**: 2-second timeout per device to avoid hanging
- **Progressive Updates**: UI updates every batch for responsive feedback
- **Memory Efficient**: Uses Maps for device storage and cleanup

### **Security Considerations**
- **CORS Handling**: Properly handles cross-origin requests
- **Timeout Protection**: Prevents infinite hanging on unresponsive devices
- **Error Handling**: Graceful handling of network errors and timeouts
- **Local Network Only**: Only scans private IP ranges for security

## Device Information Collected

For each discovered Shelly device, the system collects:

- **Basic Info**: IP address, device name, device type
- **Hardware**: MAC address, firmware version
- **Network**: Last seen timestamp, response endpoints
- **Capabilities**: Available features and services

## Browser Compatibility

### **Fully Supported**
- Chrome 80+ (Desktop & Mobile)
- Firefox 75+ (Desktop & Mobile)
- Safari 13+ (Desktop & Mobile)
- Edge 80+ (Desktop & Mobile)

### **Limitations**
- **mDNS Discovery**: Limited browser support (experimental feature)
- **Local Network Access**: Requires devices to be on same network
- **HTTPS Restrictions**: Some features may be limited on HTTPS sites

## Troubleshooting

### **No Devices Found**
1. Ensure Shelly devices are powered on and connected to WiFi
2. Verify you're on the same network as the devices
3. Check if devices respond to manual IP access
4. Try scanning common IP ranges manually

### **Slow Scanning**
1. Reduce batch size in browser with limited resources
2. Close other browser tabs to free up resources
3. Use wired connection for better network performance

### **Connection Errors**
1. Check browser console for detailed error messages
2. Verify network firewall settings
3. Ensure devices allow HTTP access
4. Try accessing device directly via IP

### **Browser Issues**
1. Clear browser cache and cookies
2. Disable browser extensions that might block requests
3. Try in incognito/private browsing mode
4. Update browser to latest version

## Integration with Dashboard

The discovery feature is fully integrated with the main dashboard:

- **Automatic IP Population**: Selected device IP is automatically filled
- **Seamless Workflow**: Direct transition from discovery to data collection
- **Status Integration**: Discovery status appears in main status bar
- **Error Handling**: Unified error handling with main dashboard

## Future Enhancements

Planned improvements for future versions:

- **Device Grouping**: Group devices by type or location
- **Saved Devices**: Remember previously discovered devices
- **Network Mapping**: Visual network topology
- **Bulk Operations**: Configure multiple devices simultaneously
- **Advanced Filtering**: Filter by device type, firmware, etc.
- **Export/Import**: Save and share device lists

## API Reference

### **ShellyDiscovery Class**

```javascript
const discovery = new ShellyDiscovery();

// Event handlers
discovery.onDeviceFound = (device) => { /* handle device */ };
discovery.onDiscoveryProgress = (progress) => { /* update UI */ };
discovery.onDiscoveryComplete = (devices) => { /* finalize */ };

// Methods
await discovery.discoverDevices();  // Start discovery
discovery.stopDiscovery();          // Stop discovery
discovery.getDiscoveredDevices();   // Get all devices
discovery.clearDiscoveredDevices(); // Clear device list
```

### **Device Object Structure**

```javascript
{
  ip: "192.168.1.51",
  displayName: "Shelly Pro 3EM",
  deviceType: "SHELLY_PRO_3EM",
  firmware: "1.0.0",
  macAddress: "2CBCBBA658D4",
  lastSeen: 1748268000000,
  discoveryEndpoint: "/shelly",
  // ... additional device-specific properties
}
```

This discovery feature makes it incredibly easy to find and connect to Shelly devices without manual IP configuration, providing a seamless user experience across all platforms. 