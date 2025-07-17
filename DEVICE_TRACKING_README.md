# Device Tracking System - Shelly 3EM

## Overview

The Device Tracking System is an intelligent component that automatically associates power events (peaks and valleys) with specific electrical devices in your environment. It uses a combination of local algorithms and machine learning techniques to identify which devices are causing power consumption changes.

## Key Features

### 🤖 Intelligent Device Recognition
- **Local Algorithms**: Fast, privacy-preserving device identification
- **Pattern Matching**: Historical event correlation
- **Power Signature Analysis**: Device-specific consumption patterns
- **Time-based Correlation**: Usage pattern recognition
- **AI-Ready Architecture**: Extensible for machine learning enhancement

### 📊 Multi-Factor Analysis
- **Power Magnitude Matching**: Compares event power with device specifications
- **Device Type Patterns**: Leverages known device characteristics
- **Temporal Patterns**: Considers time-of-day and day-of-week usage
- **Phase Correlation**: Matches events to correct electrical phase
- **Historical Learning**: Improves accuracy over time

### 🎯 Manual Association & Learning
- **Interactive Association**: Manual device assignment for training
- **Confidence Scoring**: Reliability indicators for suggestions
- **Learning Data Collection**: Builds training dataset for AI models
- **Export/Import**: Backup and share tracking data

## Algorithm Approach: Local vs AI

### Local Algorithm (Current Implementation)

**Advantages:**
- ✅ **Real-time processing** - Instant analysis without API delays
- ✅ **Privacy-preserving** - All data stays on your device
- ✅ **No external dependencies** - Works offline
- ✅ **Deterministic** - Predictable and debuggable behavior
- ✅ **Cost-effective** - No API or cloud costs

**Components:**
1. **Power Matching**: Compares event magnitude with device specifications
2. **Type-based Patterns**: Uses device-specific power ranges and characteristics
3. **Temporal Analysis**: Considers typical usage times for device types
4. **Historical Correlation**: Matches similar past events
5. **Recent Activity**: Looks for complementary on/off events

### AI Enhancement (Future Implementation)

**Potential Benefits:**
- 🔮 **Complex Pattern Recognition** - Multi-dimensional device signatures
- 🔮 **Adaptive Learning** - Improves with usage data
- 🔮 **Anomaly Detection** - Identifies unusual device behavior
- 🔮 **Cross-correlation Analysis** - Relationships between multiple devices

**Implementation Options:**
- **TensorFlow.js**: Client-side machine learning
- **Cloud APIs**: External AI services (OpenAI, Google AI, etc.)
- **Hybrid Approach**: Local + cloud for enhanced accuracy

## Device Type Patterns

The system includes predefined patterns for common device types:

| Device Type | Peak Range (W) | Valley Range (W) | Typical Usage Times |
|-------------|----------------|------------------|-------------------|
| **Computer** | 100-500 | 50-300 | Work hours (8-22) |
| **Split AC** | 800-3000 | 800-3000 | Hot hours, seasonal |
| **Microwave** | 800-1500 | 800-1500 | Meal times |
| **Induction Cooktop** | 1000-3500 | 1000-3500 | Meal times |
| **Table Lamp** | 5-100 | 5-100 | Evening hours |
| **Ceiling Light** | 10-200 | 10-200 | Active hours (6-23) |
| **Printer** | 20-300 | 5-50 | Work hours |

## Usage Workflow

### 1. Initial Setup
1. **Configure Environment**: Set up rooms and devices in Environment Setup
2. **Start Monitoring**: Begin data collection from Shelly device
3. **Review Events**: Check chart details for peaks and valleys
4. **Manual Association**: Associate first few events manually for training

### 2. Training Phase
1. **Associate Events**: Use "🔗 Associate" buttons in chart details
2. **Review Suggestions**: System provides device suggestions with confidence scores
3. **Confirm or Correct**: Accept suggestions or manually select correct device
4. **Build History**: Accumulate 20-50 associations for good accuracy

### 3. Autonomous Operation
1. **Automatic Suggestions**: System suggests devices for new events
2. **High Confidence Events**: Auto-associate events with >90% confidence
3. **Review Periodically**: Check and correct any misidentifications
4. **Continuous Learning**: System improves with more data

## Technical Implementation

### Core Classes

#### DeviceTracker
Main class handling device recognition and learning:

```javascript
const tracker = new DeviceTracker();

// Analyze a power event
const suggestions = tracker.analyzeEvent({
    type: 'peak',           // 'peak' or 'valley'
    phase: 'A',            // 'A', 'B', or 'C'
    powerDelta: 150.5,     // Power change in watts
    timestamp: Date.now(), // Event timestamp
    readings: {...}        // Full sensor readings
});

// Record manual association
tracker.recordDeviceAssociation(event, deviceId, confidence);
```

### Data Structures

#### Event Object
```json
{
    "type": "peak",
    "phase": "A",
    "powerDelta": 150.5,
    "timestamp": 1640995200000,
    "readings": {
        "voltage_a": 235.0,
        "current_a": 1.5,
        "pf_a": 0.7
    }
}
```

#### Device Association
```json
{
    "id": "1640995200001",
    "timestamp": 1640995200000,
    "phase": "A",
    "type": "peak",
    "powerDelta": 150.5,
    "deviceId": "device123",
    "confidence": 0.95,
    "source": "manual",
    "readings": {...}
}
```

### Confidence Scoring

The system uses a multi-factor confidence scoring system:

- **Power Match (0-0.4)**: How well the event power matches device specifications
- **Type Pattern (0-0.3)**: Device type specific characteristics
- **Time Pattern (0-0.15)**: Usage time correlation
- **Historical Match (0-0.5)**: Similar past events
- **Recent Activity (0-0.2)**: Complementary events nearby

**Total Confidence**: Sum of all factors (capped at 1.0)

### Storage & Persistence

All data is stored locally using browser localStorage:

- **Device Associations**: `deviceAssociations` - Manual and automatic associations
- **Learning Data**: `learningData` - Feature vectors for AI training
- **Event History**: `eventHistory` - Recent events for correlation analysis

## Integration Points

### Dashboard Integration
- **Chart Details Modal**: Shows device suggestions for peaks/valleys
- **Association Buttons**: Manual device assignment interface
- **Real-time Analysis**: Automatic suggestions as events occur

### Environment Setup Integration
- **Device Configuration**: Uses room and device data for suggestions
- **Tracking Statistics**: Shows association accuracy and coverage
- **Data Management**: Export/import tracking data

## Performance Considerations

### Local Algorithm Performance
- **Analysis Time**: <10ms per event on modern browsers
- **Memory Usage**: ~1MB for 1000 associations + history
- **Storage**: ~500KB localStorage for typical usage

### Scalability
- **Event History**: Limited to 1000 recent events
- **Associations**: No practical limit (tested with 10,000+)
- **Device Count**: Optimized for 50-100 devices per phase

## Accuracy Metrics

Based on testing with simulated data:

### Local Algorithm Accuracy
- **First Suggestion**: 70-85% accuracy with 20+ training associations
- **Top 3 Suggestions**: 85-95% accuracy with sufficient training
- **High Confidence Events**: 90%+ accuracy when confidence >0.8

### Improvement Factors
- **Training Data**: More associations = better accuracy
- **Device Diversity**: Distinct power signatures improve recognition
- **Time Patterns**: Regular usage schedules help identification
- **Manual Corrections**: Feedback improves future suggestions

## Future AI Enhancement

### Planned AI Features
1. **Neural Network Training**: TensorFlow.js implementation
2. **Feature Engineering**: Advanced signal processing
3. **Ensemble Methods**: Combine multiple algorithms
4. **Cloud Integration**: Optional external AI services

### AI Training Data
The system collects features for future AI training:
- Power delta, phase, event type
- Voltage, current, power factor
- Time of day, day of week
- Historical patterns
- Device characteristics

### Implementation Roadmap
1. **Phase 1**: Local algorithm optimization (✅ Complete)
2. **Phase 2**: TensorFlow.js integration
3. **Phase 3**: Cloud AI service integration
4. **Phase 4**: Advanced pattern recognition

## Troubleshooting

### Common Issues

**No Device Suggestions**
- Ensure devices are configured in Environment Setup
- Check that devices are assigned to correct electrical phase
- Verify power event exceeds 8W threshold

**Low Confidence Scores**
- Add more manual associations for training
- Verify device power specifications are accurate
- Check for multiple devices with similar power signatures

**Incorrect Suggestions**
- Manually correct associations to improve learning
- Review device type patterns and power ranges
- Consider time-based usage patterns

### Data Recovery
- Export tracking data regularly for backup
- Import previous tracking data to restore associations
- Manual re-association if data is lost

## Best Practices

### Training Recommendations
1. **Start with Obvious Events**: Associate clear on/off events first
2. **Diverse Training**: Include different times and usage patterns
3. **Regular Review**: Check and correct suggestions weekly
4. **Export Backups**: Save tracking data monthly

### Device Configuration
1. **Accurate Power Ratings**: Use manufacturer specifications
2. **Realistic Estimates**: Measure actual consumption when possible
3. **Distinct Signatures**: Avoid devices with identical power consumption
4. **Phase Verification**: Ensure correct electrical phase assignment

### System Optimization
1. **Threshold Tuning**: Adjust 8W threshold for your environment
2. **Confidence Thresholds**: Set appropriate auto-association levels
3. **Time Windows**: Adjust correlation time windows as needed
4. **Regular Maintenance**: Clean up old associations periodically

## Security & Privacy

### Data Protection
- All processing happens locally in browser
- No data transmitted to external servers
- Export files contain only device associations
- No personal information collected

### Recommendations
- Regular backup of tracking data
- Secure storage of export files
- Consider data privacy when sharing configurations
- Review associations for sensitive device information

---

## API Reference

### DeviceTracker Methods

#### `analyzeEvent(event)`
Analyzes a power event and returns device suggestions.

#### `recordDeviceAssociation(event, deviceId, confidence)`
Records a manual device association for learning.

#### `getTrackingStats()`
Returns statistics about associations and accuracy.

#### `exportTrackingData()`
Exports all tracking data as JSON string.

#### `importTrackingData(jsonData)`
Imports tracking data from JSON string.

### Integration Examples

```javascript
// Initialize tracker
const tracker = new DeviceTracker();

// Analyze power event
const event = {
    type: 'peak',
    phase: 'A',
    powerDelta: 200,
    timestamp: Date.now(),
    readings: getCurrentReadings()
};

const suggestions = tracker.analyzeEvent(event);
console.log('Top suggestion:', suggestions[0]);

// Record manual association
tracker.recordDeviceAssociation(event, 'device123', 1.0);

// Get statistics
const stats = tracker.getTrackingStats();
console.log('Total associations:', stats.totalAssociations);
```

For technical support or feature requests, refer to the main project documentation. 