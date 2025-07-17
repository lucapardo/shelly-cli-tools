# Environment Setup - Shelly 3EM Configuration

## Overview

The Environment Setup system allows you to configure and manage the physical environment monitored by your Shelly Pro 3EM device. This includes defining rooms/locations and associating electrical devices with specific phases of your three-phase electrical system.

## Features

### 🏠 Room Management
- **Add Rooms**: Create locations/rooms in your environment (e.g., Living Room, Kitchen, Office)
- **Edit Rooms**: Rename existing rooms
- **Delete Rooms**: Remove rooms (with automatic device cleanup)
- **Automatic Sorting**: Rooms are automatically sorted alphabetically

### 🔌 Device Management
- **Add Devices**: Register electrical devices with detailed specifications
- **Edit Devices**: Modify device information
- **Delete Devices**: Remove devices from the system
- **Phase Assignment**: Associate devices with electrical phases (A, B, or C)
- **Power Specifications**: Define peak and average power consumption

### 🏷️ Device Type Management
- **Predefined Types**: Comes with common device types (alphabetically sorted):
  - computer
  - cucina a induzione (induction cooktop)
  - dispositivo generico (generic device)
  - forno microonde (microwave oven)
  - lampada da tavolo (table lamp)
  - luce a soffitto (ceiling light)
  - split (air conditioning)
  - stampante (printer)
- **Custom Types**: Add your own device types
- **Type Validation**: Prevents deletion of types currently in use

### 💾 Configuration Management
- **Local Storage**: Configuration saved in browser localStorage
- **Export/Import**: Backup and restore configurations as JSON files
- **Configuration Summary**: Real-time overview of your setup

## Device Configuration Fields

When adding or editing a device, you'll specify:

| Field | Description | Required |
|-------|-------------|----------|
| **Device Name** | Unique identifier for the device | Yes |
| **Room** | Location where the device is installed | Yes |
| **Device Type** | Category of the device | Yes |
| **Electrical Phase** | Which phase (A, B, or C) the device is connected to | Yes |
| **Peak Power (W)** | Maximum power consumption in watts | Yes |
| **Average Power (W)** | Typical power consumption in watts | Yes |
| **Notes** | Additional information about the device | No |

## Phase Color Coding

The system uses color-coded indicators for electrical phases:
- **Phase A**: 🟠 Orange (`#f39c12`)
- **Phase B**: 🔴 Red (`#ff6b6b`)
- **Phase C**: 🔵 Teal (`#4ecdc4`)

These colors match the dashboard charts for easy visual correlation.

## Usage Workflow

### Initial Setup
1. **Access Settings**: Click "⚙️ Environment Setup" from the dashboard
2. **Add Rooms**: Start by creating rooms/locations in your environment
3. **Add Devices**: Register each electrical device with its specifications
4. **Assign Phases**: Ensure devices are correctly assigned to their electrical phases

### Ongoing Management
1. **Monitor Configuration**: Use the configuration summary to track your setup
2. **Update Devices**: Edit device specifications as needed
3. **Backup Configuration**: Regularly export your configuration for backup
4. **Add New Devices**: Register new devices as they're installed

## Data Structure

### Room Object
```json
{
  "id": "1640995200000",
  "name": "Living Room",
  "createdAt": "2023-12-31T12:00:00.000Z"
}
```

### Device Object
```json
{
  "id": "1640995200001",
  "name": "Main Computer",
  "roomId": "1640995200000",
  "type": "computer",
  "phase": "A",
  "peakPower": 450.0,
  "averagePower": 200.0,
  "notes": "Gaming workstation with dual monitors",
  "createdAt": "2023-12-31T12:00:00.000Z",
  "updatedAt": "2023-12-31T12:30:00.000Z"
}
```

### Configuration Structure
```json
{
  "rooms": [...],
  "devices": [...],
  "deviceTypes": [...],
  "exportedAt": "2023-12-31T12:00:00.000Z",
  "version": "1.0"
}
```

## Integration with Dashboard

The Environment Setup integrates with the main dashboard to:
- **Correlate Events**: Associate power spikes/drops with specific devices
- **Phase Analysis**: Understand load distribution across phases
- **Device Identification**: Help identify which devices cause specific patterns
- **Capacity Planning**: Monitor total load vs. device specifications

## Best Practices

### Room Organization
- Use descriptive room names (e.g., "Master Bedroom" vs. "Room 1")
- Consider functional areas (e.g., "Kitchen", "Home Office", "Workshop")
- Group related spaces logically

### Device Registration
- **Accurate Power Ratings**: Use manufacturer specifications when available
- **Realistic Estimates**: For unknown devices, measure actual consumption
- **Detailed Notes**: Include model numbers, installation dates, or special characteristics
- **Phase Verification**: Ensure devices are assigned to the correct electrical phase

### Configuration Management
- **Regular Backups**: Export configuration monthly or after major changes
- **Version Control**: Keep dated backup files
- **Documentation**: Maintain notes about significant changes

## Troubleshooting

### Common Issues

**Room Deletion Blocked**
- *Issue*: Cannot delete room with devices
- *Solution*: Either move devices to another room or confirm deletion of all devices

**Device Type Removal Blocked**
- *Issue*: Cannot remove device type in use
- *Solution*: Change device types for all devices using that type first

**Configuration Import Failed**
- *Issue*: Invalid JSON format
- *Solution*: Ensure exported file is valid JSON and contains required fields

**Missing Rooms in Device Form**
- *Issue*: No rooms available when adding device
- *Solution*: Create at least one room before adding devices

### Data Recovery

If configuration is lost:
1. Check browser localStorage for `shellyEnvironmentConfig`
2. Restore from exported JSON backup
3. Manually recreate configuration if no backup exists

## Future Enhancements

Planned improvements include:
- **Database Integration**: Move from localStorage to persistent database
- **Device Templates**: Pre-configured device profiles for common appliances
- **Load Balancing**: Recommendations for optimal phase distribution
- **Historical Analysis**: Track device usage patterns over time
- **Smart Detection**: Automatic device identification from power signatures

## File Structure

```
├── settings.html              # Environment Setup interface
├── graphs.html               # Main dashboard (with navigation link)
├── ENVIRONMENT_SETUP_README.md # This documentation
└── server.js                 # Backend server (existing)
```

## Browser Compatibility

The Environment Setup system requires:
- Modern browser with localStorage support
- JavaScript enabled
- File API support for import/export functionality

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Security Considerations

- Configuration data is stored locally in browser
- No sensitive information is transmitted
- Export files contain device specifications only
- Consider data privacy when sharing configuration files

---

For technical support or feature requests, refer to the main project documentation or contact the development team. 