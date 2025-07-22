/**
 * Device Tracking System for Shelly 3EM
 * Associates power events (peaks/valleys) with specific devices
 * Uses local algorithms with optional AI enhancement
 * Enhanced with consumption pattern recognition and event duration tracking
 */

class DeviceTracker {
    constructor() {
        this.eventHistory = [];
        this.learningData = [];
        this.confidenceThreshold = 0.7;
        this.timeWindowMs = 5000; // 5 seconds window for event correlation
        
        // Enhanced tracking for consumption patterns
        this.deviceEvents = []; // Stores complete device events with start/stop times
        this.pendingEvents = new Map(); // Tracks ongoing events by device
        this.consumptionPatterns = new Map(); // Stores learned consumption patterns
        
        // Initialize configuration manager
        this.configManager = null;
        
        // Load appliances data once at initialization instead of repeated API calls
        this.appliancesData = {};
        this.appliancesLoaded = false;
        
        this.initializeConfigManager();
    }

    /**
     * Initialize the configuration manager and load appliances data
     */
    async initializeConfigManager() {
        try {
            if (typeof ConfigManager !== 'undefined') {
                this.configManager = new ConfigManager();
                await this.configManager.initialize();
                
                // Load tracking data from the config manager
                const trackingData = this.configManager.getTrackingData();
                this.learningData = trackingData.learningData || [];
                this.eventHistory = trackingData.eventHistory || [];
                this.deviceEvents = trackingData.deviceEvents || [];
                
                // Convert consumption patterns from array to Map
                if (trackingData.consumptionPatterns && Array.isArray(trackingData.consumptionPatterns)) {
                    this.consumptionPatterns = new Map(trackingData.consumptionPatterns);
                }
                
                console.log('DeviceTracker initialized with file-based configuration');
            } else {
                throw new Error('ConfigManager not available');
            }
        } catch (error) {
            console.error('Error initializing ConfigManager, falling back to localStorage:', error);
            // Fallback to old localStorage method
            this.loadTrackingData();
        }
        
        // Removed: migrateToUnifiedEvents (no longer needed)
        // await this.migrateToUnifiedEvents();
        
        // Load appliances data once at initialization
        await this.loadAppliancesData();
    }

    /**
     * Load appliances data once at initialization
     */
    async loadAppliancesData() {
        try {
            const response = await fetch('/api/get-appliances');
            if (response.ok) {
                const data = await response.json();
                this.appliancesData = data.appliances || {};
                this.appliancesLoaded = true;
                console.log(`DeviceTracker: Loaded ${Object.keys(this.appliancesData).length} appliances for device recognition`);
            } else {
                console.warn('DeviceTracker: Failed to load appliances data, device recognition will use fallback patterns');
                this.appliancesData = {};
                this.appliancesLoaded = false;
            }
        } catch (error) {
            console.error('DeviceTracker: Error loading appliances data:', error);
            this.appliancesData = {};
            this.appliancesLoaded = false;
        }
    }

    /**
     * Refresh appliances data (call this when device types are added/removed)
     */
    async refreshAppliancesData() {
        console.log('DeviceTracker: Refreshing appliances data...');
        await this.loadAppliancesData();
    }

    /**
     * Analyze a power event and suggest possible devices
     * @param {Object} event - Power event data
     * @param {string} event.type - 'peak', 'valley', or 'start'
     * @param {string} event.phase - 'A', 'B', or 'C'
     * @param {number} event.powerDelta - Change in power (watts)
     * @param {number} event.timestamp - Event timestamp
     * @param {Object} event.readings - Full sensor readings at event time
     * @param {number} event.currentPower - Current power level after event
     * @returns {Array} Suggested devices with confidence scores
     */
    async analyzeEvent(event) {
        const suggestions = [];
        const config = this.getEnvironmentConfig();
        
        if (!config || !config.devices) {
            return suggestions;
        }

        // Filter devices by phase
        const phaseDevices = config.devices.filter(device => device.phase === event.phase);
        
        // Enhanced pattern analysis
        const patternSuggestions = this.analyzeConsumptionPattern(event, phaseDevices);
        suggestions.push(...patternSuggestions);
        
        // Local algorithm analysis (now async)
        const localSuggestions = await this.localAlgorithmAnalysis(event, phaseDevices);
        suggestions.push(...localSuggestions);

        // Add historical pattern matching
        const historicalSuggestions = this.patternMatchingAnalysis(event, phaseDevices);
        suggestions.push(...historicalSuggestions);

        // Sort by confidence and remove duplicates
        const uniqueSuggestions = this.consolidateSuggestions(suggestions);
        
        return uniqueSuggestions.slice(0, 5); // Top 5 suggestions
    }

    /**
     * Analyze consumption patterns to identify device behavior
     * Recognizes: turn-on (positive slope), stabilization, turn-off (negative slope)
     */
    analyzeConsumptionPattern(event, phaseDevices) {
        const suggestions = [];
        const powerDelta = event.powerDelta;
        const currentPower = event.currentPower || 0;
        
        // Determine event pattern type
        let patternType = 'unknown';
        let eventPhase = 'unknown';
        
        if (powerDelta > 50) { // Significant power increase
            patternType = 'turn_on';
            eventPhase = 'start';
        } else if (powerDelta < -50) { // Significant power decrease
            patternType = 'turn_off';
            eventPhase = 'end';
        } else if (Math.abs(powerDelta) < 20 && currentPower > 100) { // Stable consumption
            patternType = 'stabilization';
            eventPhase = 'middle';
        }

        // Analyze against known device patterns
        phaseDevices.forEach(device => {
            const devicePattern = this.getDeviceConsumptionPattern(device);
            const confidence = this.matchConsumptionPattern(event, device, devicePattern, patternType);
            
            if (confidence > 0.3) {
                suggestions.push({
                    device: device,
                    confidence: confidence,
                    reasoning: [`Consumption pattern match: ${patternType} (${confidence.toFixed(2)})`],
                    algorithm: 'pattern_enhanced',
                    patternType: patternType,
                    eventPhase: eventPhase
                });
            }
        });

        return suggestions;
    }

    /**
     * Get or create consumption pattern for a device
     */
    getDeviceConsumptionPattern(device) {
        const deviceId = device.id;
        
        if (!this.consumptionPatterns.has(deviceId)) {
            // Initialize with default pattern based on device type
            const defaultPattern = this.getDefaultConsumptionPattern(device.type);
            this.consumptionPatterns.set(deviceId, defaultPattern);
        }
        
        return this.consumptionPatterns.get(deviceId);
    }

    /**
     * Get default consumption pattern based on device type, enhanced with CSV data
     */
    async getDefaultConsumptionPatternFromCSV(deviceType) {
        try {
            // Use pre-loaded appliances data instead of making API calls
            const appliances = this.appliancesData;
            
            // Try to find exact match first
            let expectedConsumption = appliances[deviceType];
            
            // If no exact match, try to find similar device types
            if (!expectedConsumption) {
                const deviceTypeLower = deviceType.toLowerCase();
                const similarKeys = Object.keys(appliances).filter(key => 
                    key.toLowerCase().includes(deviceTypeLower) || 
                    deviceTypeLower.includes(key.toLowerCase())
                );
                
                if (similarKeys.length > 0) {
                    expectedConsumption = appliances[similarKeys[0]];
                }
            }
            
            if (expectedConsumption) {
                // Create pattern based on CSV data
                return {
                    turnOnDuration: this.getTypicalTurnOnDuration(deviceType),
                    stabilizationDuration: this.getTypicalStabilizationDuration(deviceType),
                    turnOffDuration: this.getTypicalTurnOffDuration(deviceType),
                    peakPower: expectedConsumption,
                    averagePower: Math.round(expectedConsumption * 0.8), // 80% of peak
                    standbyPower: this.getTypicalStandbyPower(deviceType),
                    powerFactorRange: this.getTypicalPowerFactorRange(deviceType)
                };
            }
        } catch (error) {
            console.error('Error getting consumption pattern from CSV:', error);
        }
        
        // Fallback to hardcoded patterns
        return this.getDefaultConsumptionPattern(deviceType);
    }

    /**
     * Get typical turn-on duration for device type
     */
    getTypicalTurnOnDuration(deviceType) {
        const durations = {
            'computer': 30000,
            'split': 60000,
            'forno microonde': 5000,
            'microwave oven': 5000,
            'cucina a induzione': 10000,
            'lampada da tavolo': 1000,
            'luce a soffitto': 1000,
            'stampante': 15000,
            'printer (inkjet)': 10000,
            'printer (laser)': 15000,
            'television': 3000,
            'refrigerator': 5000,
            'dishwasher': 10000,
            'clothes washer': 15000,
            'clothes dryer': 20000
        };
        return durations[deviceType.toLowerCase()] || 10000; // Default 10 seconds
    }

    /**
     * Get typical stabilization duration for device type
     */
    getTypicalStabilizationDuration(deviceType) {
        const durations = {
            'computer': 3600000, // 1 hour
            'split': 7200000, // 2 hours
            'forno microonde': 300000, // 5 minutes
            'microwave oven': 300000,
            'cucina a induzione': 1800000, // 30 minutes
            'lampada da tavolo': 14400000, // 4 hours
            'luce a soffitto': 18000000, // 5 hours
            'stampante': 600000, // 10 minutes
            'printer (inkjet)': 600000,
            'printer (laser)': 600000,
            'television': 10800000, // 3 hours
            'refrigerator': 86400000, // 24 hours (continuous)
            'dishwasher': 3600000, // 1 hour
            'clothes washer': 2700000, // 45 minutes
            'clothes dryer': 3600000 // 1 hour
        };
        return durations[deviceType.toLowerCase()] || 1800000; // Default 30 minutes
    }

    /**
     * Get typical turn-off duration for device type
     */
    getTypicalTurnOffDuration(deviceType) {
        const durations = {
            'computer': 10000,
            'split': 30000,
            'forno microonde': 2000,
            'microwave oven': 2000,
            'cucina a induzione': 5000,
            'lampada da tavolo': 1000,
            'luce a soffitto': 1000,
            'stampante': 10000,
            'printer (inkjet)': 5000,
            'printer (laser)': 10000,
            'television': 2000,
            'refrigerator': 5000,
            'dishwasher': 5000,
            'clothes washer': 10000,
            'clothes dryer': 15000
        };
        return durations[deviceType.toLowerCase()] || 5000; // Default 5 seconds
    }

    /**
     * Get typical standby power for device type
     */
    getTypicalStandbyPower(deviceType) {
        const standbyPowers = {
            'computer': 5,
            'split': 10,
            'forno microonde': 2,
            'microwave oven': 2,
            'cucina a induzione': 0,
            'lampada da tavolo': 0,
            'luce a soffitto': 0,
            'stampante': 5,
            'printer (inkjet)': 3,
            'printer (laser)': 5,
            'television': 1,
            'refrigerator': 0, // Always on
            'dishwasher': 1,
            'clothes washer': 1,
            'clothes dryer': 1
        };
        return standbyPowers[deviceType.toLowerCase()] || 2; // Default 2W
    }

    /**
     * Get typical power factor range for device type
     */
    getTypicalPowerFactorRange(deviceType) {
        const powerFactors = {
            'computer': [0.6, 0.9],
            'split': [0.8, 0.95],
            'forno microonde': [0.9, 1.0],
            'microwave oven': [0.9, 1.0],
            'cucina a induzione': [0.95, 1.0],
            'lampada da tavolo': [0.5, 1.0],
            'luce a soffitto': [0.5, 1.0],
            'stampante': [0.6, 0.8],
            'printer (inkjet)': [0.6, 0.8],
            'printer (laser)': [0.6, 0.8],
            'television': [0.7, 0.9],
            'refrigerator': [0.8, 0.95],
            'dishwasher': [0.8, 0.95],
            'clothes washer': [0.8, 0.95],
            'clothes dryer': [0.8, 0.95]
        };
        return powerFactors[deviceType.toLowerCase()] || [0.7, 0.9]; // Default range
    }

    /**
     * Get default consumption pattern based on device type
     */
    getDefaultConsumptionPattern(deviceType) {
        const patterns = {
            'computer': {
                turnOnDuration: 30000, // 30 seconds
                stabilizationDuration: 3600000, // 1 hour typical
                turnOffDuration: 10000, // 10 seconds
                peakPower: 300,
                averagePower: 150,
                standbyPower: 5,
                powerFactorRange: [0.6, 0.9]
            },
            'split': {
                turnOnDuration: 60000, // 1 minute
                stabilizationDuration: 7200000, // 2 hours typical
                turnOffDuration: 30000, // 30 seconds
                peakPower: 2000,
                averagePower: 1500,
                standbyPower: 10,
                powerFactorRange: [0.8, 0.95]
            },
            'forno microonde': {
                turnOnDuration: 5000, // 5 seconds
                stabilizationDuration: 300000, // 5 minutes typical
                turnOffDuration: 2000, // 2 seconds
                peakPower: 1200,
                averagePower: 1000,
                standbyPower: 2,
                powerFactorRange: [0.9, 1.0]
            },
            'cucina a induzione': {
                turnOnDuration: 10000, // 10 seconds
                stabilizationDuration: 1800000, // 30 minutes typical
                turnOffDuration: 5000, // 5 seconds
                peakPower: 3000,
                averagePower: 2000,
                standbyPower: 0,
                powerFactorRange: [0.95, 1.0]
            },
            'lampada da tavolo': {
                turnOnDuration: 1000, // 1 second
                stabilizationDuration: 14400000, // 4 hours typical
                turnOffDuration: 1000, // 1 second
                peakPower: 60,
                averagePower: 50,
                standbyPower: 0,
                powerFactorRange: [0.5, 1.0]
            },
            'luce a soffitto': {
                turnOnDuration: 1000, // 1 second
                stabilizationDuration: 18000000, // 5 hours typical
                turnOffDuration: 1000, // 1 second
                peakPower: 100,
                averagePower: 80,
                standbyPower: 0,
                powerFactorRange: [0.5, 1.0]
            },
            'stampante': {
                turnOnDuration: 15000, // 15 seconds
                stabilizationDuration: 600000, // 10 minutes typical
                turnOffDuration: 10000, // 10 seconds
                peakPower: 200,
                averagePower: 50,
                standbyPower: 5,
                powerFactorRange: [0.6, 0.8]
            }
        };

        return patterns[deviceType] || patterns['computer']; // Default to computer pattern
    }

    /**
     * Match event against device consumption pattern
     */
    matchConsumptionPattern(event, device, pattern, patternType) {
        let confidence = 0;
        const powerDelta = Math.abs(event.powerDelta);
        
        switch (patternType) {
            case 'turn_on':
                // Check if power delta matches expected turn-on behavior
                const turnOnPowerRange = [pattern.averagePower * 0.7, pattern.peakPower * 1.2];
                if (powerDelta >= turnOnPowerRange[0] && powerDelta <= turnOnPowerRange[1]) {
                    confidence = 0.8;
                } else if (powerDelta >= turnOnPowerRange[0] * 0.5 && powerDelta <= turnOnPowerRange[1] * 1.5) {
                    confidence = 0.5;
                }
                break;
                
            case 'turn_off':
                // Check if power delta matches expected turn-off behavior
                const turnOffPowerRange = [pattern.averagePower * 0.7, pattern.peakPower * 1.2];
                if (powerDelta >= turnOffPowerRange[0] && powerDelta <= turnOffPowerRange[1]) {
                    confidence = 0.8;
                } else if (powerDelta >= turnOffPowerRange[0] * 0.5 && powerDelta <= turnOffPowerRange[1] * 1.5) {
                    confidence = 0.5;
                }
                break;
                
            case 'stabilization':
                // Check if current power level matches expected average consumption
                const currentPower = event.currentPower || 0;
                const avgPowerRange = [pattern.averagePower * 0.8, pattern.averagePower * 1.2];
                if (currentPower >= avgPowerRange[0] && currentPower <= avgPowerRange[1]) {
                    confidence = 0.6;
                } else if (currentPower >= avgPowerRange[0] * 0.6 && currentPower <= avgPowerRange[1] * 1.4) {
                    confidence = 0.3;
                }
                break;
        }
        
        return confidence;
    }

    /**
     * Record a complete device event with start/stop times and duration
     */
    recordDeviceEvent(deviceId, startEvent, endEvent = null, eventType = 'usage') {
        const deviceEvent = {
            id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
            deviceId: deviceId,
            eventType: eventType, // 'usage', 'standby', 'peak', 'manual_start'
            startTime: startEvent.timestamp,
            endTime: endEvent ? endEvent.timestamp : null,
            duration: endEvent ? (endEvent.timestamp - startEvent.timestamp) : null,
            phase: startEvent.phase,
            startPowerDelta: startEvent.powerDelta,
            endPowerDelta: endEvent ? endEvent.powerDelta : null,
            peakPower: this.calculatePeakPower(startEvent, endEvent),
            averagePower: this.calculateAveragePower(startEvent, endEvent),
            totalConsumption: this.calculateTotalConsumption(startEvent, endEvent),
            confidence: 1.0,
            source: eventType === 'manual_start' ? 'manual_start' : 'manual',
            startReadings: startEvent.readings,
            endReadings: endEvent ? endEvent.readings : null,
            patternAnalysis: {
                turnOnDuration: endEvent ? Math.min(30000, endEvent.timestamp - startEvent.timestamp) : null,
                stabilizationDetected: this.detectStabilization(startEvent, endEvent),
                powerEfficiency: this.calculatePowerEfficiency(startEvent, endEvent)
            }
        };

        this.deviceEvents.push(deviceEvent);
        this.saveTrackingData();
        
        // Update consumption pattern learning
        this.updateConsumptionPattern(deviceId, deviceEvent);
        
        return deviceEvent;
    }

    /**
     * Calculate peak power during event
     */
    calculatePeakPower(startEvent, endEvent) {
        if (!endEvent) return Math.abs(startEvent.powerDelta);
        
        // For now, use the larger power delta as peak
        return Math.max(Math.abs(startEvent.powerDelta), Math.abs(endEvent.powerDelta));
    }

    /**
     * Calculate average power during event
     */
    calculateAveragePower(startEvent, endEvent) {
        if (!endEvent) return Math.abs(startEvent.powerDelta);
        
        // Simple average of start and end power deltas
        return (Math.abs(startEvent.powerDelta) + Math.abs(endEvent.powerDelta)) / 2;
    }

    /**
     * Calculate total energy consumption during event
     */
    calculateTotalConsumption(startEvent, endEvent) {
        if (!endEvent) return 0;
        
        const duration = endEvent.timestamp - startEvent.timestamp; // milliseconds
        const durationHours = duration / (1000 * 60 * 60); // convert to hours
        const averagePower = this.calculateAveragePower(startEvent, endEvent);
        
        return averagePower * durationHours; // Wh (Watt-hours)
    }

    /**
     * Detect if stabilization occurred during event
     */
    detectStabilization(startEvent, endEvent) {
        if (!endEvent) return false;
        
        const duration = endEvent.timestamp - startEvent.timestamp;
        const powerDifference = Math.abs(Math.abs(startEvent.powerDelta) - Math.abs(endEvent.powerDelta));
        
        // Consider stabilization if event lasted more than 5 minutes and power difference is small
        return duration > 300000 && powerDifference < 50;
    }

    /**
     * Calculate power efficiency metrics
     */
    calculatePowerEfficiency(startEvent, endEvent) {
        if (!startEvent.readings || !endEvent?.readings) return null;
        
        const startPF = startEvent.readings[`pf_${startEvent.phase.toLowerCase()}`] || 0;
        const endPF = endEvent?.readings[`pf_${endEvent.phase.toLowerCase()}`] || startPF;
        
        return {
            averagePowerFactor: (startPF + endPF) / 2,
            powerFactorStability: Math.abs(startPF - endPF) < 0.1
        };
    }

    /**
     * Update consumption pattern based on recorded event
     */
    updateConsumptionPattern(deviceId, deviceEvent) {
        const pattern = this.getDeviceConsumptionPattern({ id: deviceId });
        
        if (deviceEvent.duration) {
            // Update pattern with actual observed values
            pattern.observedDurations = pattern.observedDurations || [];
            pattern.observedDurations.push(deviceEvent.duration);
            
            // Keep only last 10 observations
            if (pattern.observedDurations.length > 10) {
                pattern.observedDurations = pattern.observedDurations.slice(-10);
            }
            
            // Update average duration
            pattern.averageDuration = pattern.observedDurations.reduce((a, b) => a + b, 0) / pattern.observedDurations.length;
        }
        
        if (deviceEvent.averagePower) {
            pattern.observedAveragePowers = pattern.observedAveragePowers || [];
            pattern.observedAveragePowers.push(deviceEvent.averagePower);
            
            if (pattern.observedAveragePowers.length > 10) {
                pattern.observedAveragePowers = pattern.observedAveragePowers.slice(-10);
            }
            
            pattern.learnedAveragePower = pattern.observedAveragePowers.reduce((a, b) => a + b, 0) / pattern.observedAveragePowers.length;
        }
        
        this.consumptionPatterns.set(deviceId, pattern);
        this.saveTrackingData();
    }

    /**
     * Get consumption statistics for analysis page
     */
    getConsumptionAnalysis(timeRange = null) {
        const now = Date.now();
        const timeRanges = {
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000
        };
        
        const rangeMs = timeRange ? timeRanges[timeRange] : null;
        const cutoffTime = rangeMs ? now - rangeMs : 0;
        
        // Filter events by time range
        const filteredEvents = this.deviceEvents.filter(event => 
            event.startTime >= cutoffTime && event.totalConsumption > 0
        );
        
        // Group by device
        const deviceStats = {};
        const config = this.getEnvironmentConfig();
        const devices = config?.devices || [];
        
        // Initialize all devices
        devices.forEach(device => {
            deviceStats[device.id] = {
                device: device,
                eventCount: 0,
                totalConsumption: 0,
                totalDuration: 0,
                averageDuration: 0,
                averagePower: 0,
                events: []
            };
        });
        
        // Aggregate statistics
        filteredEvents.forEach(event => {
            if (deviceStats[event.deviceId]) {
                const stats = deviceStats[event.deviceId];
                stats.eventCount++;
                stats.totalConsumption += event.totalConsumption || 0;
                stats.totalDuration += event.duration || 0;
                stats.events.push(event);
            }
        });
        
        // Calculate averages
        Object.values(deviceStats).forEach(stats => {
            if (stats.eventCount > 0) {
                stats.averageDuration = stats.totalDuration / stats.eventCount;
                stats.averagePower = stats.totalConsumption / (stats.totalDuration / (1000 * 60 * 60)); // Average watts
            }
        });
        
        return {
            timeRange: timeRange || 'all',
            totalEvents: filteredEvents.length,
            totalConsumption: Object.values(deviceStats).reduce((sum, stats) => sum + stats.totalConsumption, 0),
            deviceStats: deviceStats,
            events: filteredEvents
        };
    }

    /**
     * Local algorithm for device recognition
     */
    async localAlgorithmAnalysis(event, phaseDevices) {
        const suggestions = [];
        const powerDelta = Math.abs(event.powerDelta);
        
        for (const device of phaseDevices) {
            let confidence = 0;
            let reasoning = [];

            // Power magnitude matching
            const expectedPower = (event.type === 'peak' || event.type === 'start') ? device.peakPower : device.averagePower;
            const powerDiff = Math.abs(powerDelta - expectedPower);
            const powerRatio = Math.min(powerDelta, expectedPower) / Math.max(powerDelta, expectedPower);
            
            if (powerRatio > 0.8) {
                confidence += 0.4;
                reasoning.push(`Power match: ${powerDelta.toFixed(1)}W vs expected ${expectedPower}W`);
            } else if (powerRatio > 0.6) {
                confidence += 0.2;
                reasoning.push(`Partial power match: ${powerDelta.toFixed(1)}W vs expected ${expectedPower}W`);
            }

            // Device type patterns using CSV data
            const typeConfidence = await this.getDeviceTypeConfidenceFromCSV(device.type, event);
            confidence += typeConfidence.score;
            if (typeConfidence.reasoning) {
                reasoning.push(typeConfidence.reasoning);
            }

            // Time-based patterns (if we have historical data)
            const timeConfidence = this.getTimeBasedConfidence(device, event);
            confidence += timeConfidence.score;
            if (timeConfidence.reasoning) {
                reasoning.push(timeConfidence.reasoning);
            }

            // Recent activity correlation
            const recentConfidence = this.getRecentActivityConfidence(device, event);
            confidence += recentConfidence.score;
            if (recentConfidence.reasoning) {
                reasoning.push(recentConfidence.reasoning);
            }

            if (confidence > 0.1) { // Minimum threshold
                suggestions.push({
                    device: device,
                    confidence: Math.min(confidence, 1.0),
                    reasoning: reasoning,
                    algorithm: 'local'
                });
            }
        }

        return suggestions;
    }

    /**
     * Pattern matching based on historical associations
     */
    patternMatchingAnalysis(event, phaseDevices) {
        const suggestions = [];
        const historicalMatches = this.findHistoricalMatches(event);
        
        historicalMatches.forEach(match => {
            const device = phaseDevices.find(d => d.id === match.deviceId);
            if (device) {
                suggestions.push({
                    device: device,
                    confidence: match.confidence,
                    reasoning: [`Historical pattern match (${match.occurrences} similar events)`],
                    algorithm: 'pattern'
                });
            }
        });

        return suggestions;
    }

    /**
     * Get device type specific confidence adjustments using CSV data
     */
    async getDeviceTypeConfidenceFromCSV(deviceType, event) {
        try {
            // Use pre-loaded appliances data instead of making API calls
            const appliances = this.appliancesData;
            
            // Try to find exact match first
            let expectedConsumption = appliances[deviceType];
            let matchType = 'exact';
            
            // If no exact match, try to find similar device types
            if (!expectedConsumption) {
                const deviceTypeLower = deviceType.toLowerCase();
                const similarKeys = Object.keys(appliances).filter(key => 
                    key.toLowerCase().includes(deviceTypeLower) || 
                    deviceTypeLower.includes(key.toLowerCase())
                );
                
                if (similarKeys.length > 0) {
                    expectedConsumption = appliances[similarKeys[0]];
                    matchType = 'similar';
                }
            }
            
            if (!expectedConsumption) {
                // Fallback to hardcoded patterns
                return this.getDeviceTypeConfidence(deviceType, event);
            }
            
            const powerDelta = Math.abs(event.powerDelta);
            let score = 0;
            let reasoning = null;
            
            // Calculate confidence based on how close the power delta is to expected consumption
            const tolerance = expectedConsumption * 0.3; // 30% tolerance
            const difference = Math.abs(powerDelta - expectedConsumption);
            
            if (difference <= tolerance * 0.5) {
                score = 0.4; // High confidence for very close match
                reasoning = `${matchType} match from CSV data (${expectedConsumption}W expected, ${powerDelta}W observed)`;
            } else if (difference <= tolerance) {
                score = 0.2; // Medium confidence for close match
                reasoning = `${matchType} match from CSV data with tolerance (${expectedConsumption}W expected, ${powerDelta}W observed)`;
            } else if (difference <= tolerance * 2) {
                score = 0.1; // Low confidence for distant match
                reasoning = `Weak ${matchType} match from CSV data (${expectedConsumption}W expected, ${powerDelta}W observed)`;
            }
            
            return { score, reasoning };
            
        } catch (error) {
            console.error('Error getting device type confidence from CSV:', error);
            // Fallback to hardcoded patterns
            return this.getDeviceTypeConfidence(deviceType, event);
        }
    }

    /**
     * Get device type specific confidence adjustments
     */
    getDeviceTypeConfidence(deviceType, event) {
        const typePatterns = {
            'computer': {
                peakRange: [100, 500],
                valleyRange: [50, 300],
                typicalDelta: 200,
                powerFactor: [0.6, 0.9]
            },
            'split': {
                peakRange: [800, 3000],
                valleyRange: [800, 3000],
                typicalDelta: 1500,
                powerFactor: [0.8, 0.95]
            },
            'forno microonde': {
                peakRange: [800, 1500],
                valleyRange: [800, 1500],
                typicalDelta: 1000,
                powerFactor: [0.9, 1.0]
            },
            'cucina a induzione': {
                peakRange: [1000, 3500],
                valleyRange: [1000, 3500],
                typicalDelta: 2000,
                powerFactor: [0.95, 1.0]
            },
            'lampada da tavolo': {
                peakRange: [5, 100],
                valleyRange: [5, 100],
                typicalDelta: 25,
                powerFactor: [0.5, 1.0]
            },
            'luce a soffitto': {
                peakRange: [10, 200],
                valleyRange: [10, 200],
                typicalDelta: 50,
                powerFactor: [0.5, 1.0]
            },
            'stampante': {
                peakRange: [20, 300],
                valleyRange: [5, 50],
                typicalDelta: 100,
                powerFactor: [0.6, 0.8]
            }
        };

        const pattern = typePatterns[deviceType] || typePatterns['dispositivo generico'];
        if (!pattern) {
            return { score: 0, reasoning: null };
        }

        const powerDelta = Math.abs(event.powerDelta);
        const range = (event.type === 'peak' || event.type === 'start') ? pattern.peakRange : pattern.valleyRange;
        
        let score = 0;
        let reasoning = null;

        if (powerDelta >= range[0] && powerDelta <= range[1]) {
            score = 0.3;
            reasoning = `${deviceType} typical power range`;
        } else if (powerDelta >= range[0] * 0.7 && powerDelta <= range[1] * 1.3) {
            score = 0.1;
            reasoning = `${deviceType} extended power range`;
        }

        return { score, reasoning };
    }

    /**
     * Time-based confidence (usage patterns)
     */
    getTimeBasedConfidence(device, event) {
        const hour = new Date(event.timestamp).getHours();
        const dayOfWeek = new Date(event.timestamp).getDay();
        
        // Device type time patterns
        const timePatterns = {
            'computer': { workHours: [8, 22], weekdays: true },
            'split': { hotHours: [10, 16, 20, 23], seasonal: true },
            'forno microonde': { mealTimes: [7, 9, 12, 14, 19, 21] },
            'cucina a induzione': { mealTimes: [7, 9, 12, 14, 19, 21] },
            'lampada da tavolo': { eveningHours: [18, 23] },
            'luce a soffitto': { activeHours: [6, 23] }
        };

        const pattern = timePatterns[device.type];
        if (!pattern) return { score: 0, reasoning: null };

        let score = 0;
        let reasoning = null;

        if (pattern.workHours && hour >= pattern.workHours[0] && hour <= pattern.workHours[1]) {
            score += 0.1;
            reasoning = 'Work hours usage pattern';
        }

        if (pattern.mealTimes && pattern.mealTimes.some(mealHour => Math.abs(hour - mealHour) <= 1)) {
            score += 0.15;
            reasoning = 'Meal time usage pattern';
        }

        if (pattern.eveningHours && hour >= pattern.eveningHours[0] && hour <= pattern.eveningHours[1]) {
            score += 0.1;
            reasoning = 'Evening usage pattern';
        }

        return { score, reasoning };
    }

    /**
     * Recent activity correlation
     */
    getRecentActivityConfidence(device, event) {
        const recentEvents = this.eventHistory.filter(e => 
            e.timestamp > event.timestamp - this.timeWindowMs &&
            e.timestamp < event.timestamp &&
            e.phase === event.phase
        );

        if (recentEvents.length === 0) {
            return { score: 0, reasoning: null };
        }

        // Look for complementary events (peak/start followed by valley or vice versa)
        const complementaryType = (event.type === 'peak' || event.type === 'start') ? 'valley' : 'peak';
        const complementaryEvent = recentEvents.find(e => e.type === complementaryType);

        if (complementaryEvent) {
            const timeDiff = event.timestamp - complementaryEvent.timestamp;
            if (timeDiff < 2000) { // Within 2 seconds
                return { 
                    score: 0.2, 
                    reasoning: `Complementary ${complementaryType} event ${(timeDiff/1000).toFixed(1)}s ago` 
                };
            }
        }

        return { score: 0, reasoning: null };
    }

    /**
     * Find historical matches for similar events
     */
    findHistoricalMatches(event) {
        const matches = [];
        const powerTolerance = 50; // 50W tolerance
        
        // Removed: deviceAssociations is no longer used
        
        return matches.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Consolidate and rank suggestions
     */
    consolidateSuggestions(suggestions) {
        const deviceMap = new Map();
        
        suggestions.forEach(suggestion => {
            const deviceId = suggestion.device.id;
            if (deviceMap.has(deviceId)) {
                const existing = deviceMap.get(deviceId);
                existing.confidence = Math.max(existing.confidence, suggestion.confidence);
                existing.reasoning.push(...suggestion.reasoning);
                existing.algorithms = existing.algorithms || [];
                existing.algorithms.push(suggestion.algorithm);
            } else {
                deviceMap.set(deviceId, {
                    ...suggestion,
                    algorithms: [suggestion.algorithm]
                });
            }
        });

        return Array.from(deviceMap.values())
            .sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Remove device association for a specific event
     * @param {Object} event - Power event data
     * @param {number} event.timestamp - Event timestamp
     * @param {string} event.phase - Phase (A, B, or C)
     * @param {string} event.type - Event type (peak, valley, or start)
     * @returns {boolean} True if association was removed, false if not found
     */
    removeDeviceAssociation(event) {
        const timeWindow = 5000; // 5 seconds window
        
        // Find the association to remove
        const associationIndex = this.deviceEvents.findIndex(assoc => {
            return Math.abs(assoc.timestamp - event.timestamp) <= timeWindow &&
                   assoc.phase === event.phase &&
                   (assoc.type === event.type || assoc.type === 'start');
        });
        
        if (associationIndex === -1) {
            console.log('No device association found to remove');
            return false;
        }
        
        const removedAssociation = this.deviceEvents[associationIndex];
        console.log('Removing device association:', removedAssociation);
        
        // Remove the association
        this.deviceEvents.splice(associationIndex, 1);
        
        // Also remove from learning data
        const learningDataIndex = this.learningData.findIndex(data => 
            Math.abs(data.timestamp - event.timestamp) <= timeWindow &&
            data.phase === event.phase &&
            (data.type === event.type || data.type === 'start')
        );
        
        if (learningDataIndex !== -1) {
            this.learningData.splice(learningDataIndex, 1);
        }
        
        // Save the updated data
        this.saveTrackingData();
        
        return true;
    }

    /**
     * Remove all device associations for the same unified event
     * @param {Object} event - Power event data
     * @param {number} event.timestamp - Event timestamp
     * @param {string} event.phase - Phase (A, B, or C)
     * @param {string} event.type - Event type (peak, valley, or start)
     * @returns {number} Number of associations removed
     */
    removeAllEventAssociations(event) {
        // Debug: print the event and all deviceEvents with normalized values
        const eventType = event.type ? event.type.toLowerCase() : '';
        const eventTimestamp = typeof event.timestamp === 'string' ? Date.parse(event.timestamp) : event.timestamp;
        console.log('[DEBUG] Attempting to remove association for event:', {
            timestamp: eventTimestamp,
            phase: event.phase,
            type: eventType,
            powerDelta: event.powerDelta
        });
        console.log('[DEBUG] Current deviceEvents:');
        this.deviceEvents.forEach((assoc, idx) => {
            const assocType = assoc.type ? assoc.type.toLowerCase() : '';
            const assocTimestamp = typeof assoc.timestamp === 'string' ? Date.parse(assoc.timestamp) : assoc.timestamp;
            console.log(`  [${idx}]`, {
                timestamp: assocTimestamp,
                phase: assoc.phase,
                type: assocType,
                deviceId: assoc.deviceId,
                eventId: assoc.eventId
            });
        });
        // Restore eventInfo
        const eventInfo = this.getEventInfoForPoint(event);
        let associationsToRemove = [];
        if (eventInfo.eventId) {
            // Remove by unified event ID (preferred method)
            console.log(`Removing all associations for unified event ${eventInfo.eventId}`);
            associationsToRemove = this.deviceEvents.filter(assoc => assoc.eventId === eventInfo.eventId);
            if (associationsToRemove.length > 0) {
                this.deviceEvents = this.deviceEvents.filter(assoc => assoc.eventId !== eventInfo.eventId);
                this.learningData = this.learningData.filter(data => data.eventId !== eventInfo.eventId);
                this.deviceEvents = this.deviceEvents.filter(devEvent => devEvent.id !== eventInfo.eventId);
                console.log(`Removed ${associationsToRemove.length} associations by event ID ${eventInfo.eventId}`);
            }
        }
        // Fallback: remove by timestamp/device ID if no event ID linking worked
        if (associationsToRemove.length === 0 && eventInfo.deviceId) {
            console.log(`Fallback: Removing associations by device ID and timestamp for ${eventInfo.deviceId}`);
            const timeWindow = 30000; // 30 seconds window
            const eventTimestamp = typeof event.timestamp === 'string' ? Date.parse(event.timestamp) : event.timestamp;
            associationsToRemove = this.deviceEvents.filter(assoc => {
                const assocTimestamp = typeof assoc.timestamp === 'string' ? Date.parse(assoc.timestamp) : assoc.timestamp;
                return Math.abs(assocTimestamp - eventTimestamp) <= timeWindow &&
                       assoc.phase === event.phase &&
                       assoc.deviceId === eventInfo.deviceId;
            });
            if (associationsToRemove.length > 0) {
                this.deviceEvents = this.deviceEvents.filter(assoc => {
                    const assocTimestamp = typeof assoc.timestamp === 'string' ? Date.parse(assoc.timestamp) : assoc.timestamp;
                    return !(Math.abs(assocTimestamp - eventTimestamp) <= timeWindow &&
                             assoc.phase === event.phase &&
                             assoc.deviceId === eventInfo.deviceId);
                });
                this.learningData = this.learningData.filter(data => {
                    const dataTimestamp = typeof data.timestamp === 'string' ? Date.parse(data.timestamp) : data.timestamp;
                    return !(Math.abs(dataTimestamp - eventTimestamp) <= timeWindow &&
                             data.phase === event.phase &&
                             data.deviceId === eventInfo.deviceId);
                });
                this.removeDeviceEventsForEvent(event, eventInfo.deviceId);
            }
        }
        // Extra fallback: remove by timestamp, phase, and type if nothing else found
        if (associationsToRemove.length === 0) {
            const timeWindow = 5000;
            const eventType = event.type ? event.type.toLowerCase() : '';
            const eventTimestamp = typeof event.timestamp === 'string' ? Date.parse(event.timestamp) : event.timestamp;
            associationsToRemove = this.deviceEvents.filter(assoc => {
                const assocType = assoc.type ? assoc.type.toLowerCase() : '';
                const assocTimestamp = typeof assoc.timestamp === 'string' ? Date.parse(assoc.timestamp) : assoc.timestamp;
                return Math.abs(assocTimestamp - eventTimestamp) <= timeWindow &&
                       assoc.phase === event.phase &&
                       assocType === eventType;
            });
            if (associationsToRemove.length > 0) {
                this.deviceEvents = this.deviceEvents.filter(assoc => {
                    const assocType = assoc.type ? assoc.type.toLowerCase() : '';
                    const assocTimestamp = typeof assoc.timestamp === 'string' ? Date.parse(assoc.timestamp) : assoc.timestamp;
                    return !(Math.abs(assocTimestamp - eventTimestamp) <= timeWindow &&
                             assoc.phase === event.phase &&
                             assocType === eventType);
                });
                this.learningData = this.learningData.filter(data => {
                    const dataType = data.type ? data.type.toLowerCase() : '';
                    const dataTimestamp = typeof data.timestamp === 'string' ? Date.parse(data.timestamp) : data.timestamp;
                    return !(Math.abs(dataTimestamp - eventTimestamp) <= timeWindow &&
                             data.phase === event.phase &&
                             dataType === eventType);
                });
                console.log(`Extra fallback: removed ${associationsToRemove.length} associations by timestamp, phase, and type.`);
            }
        }
        if (associationsToRemove.length === 0) {
            console.log('No associations found to remove');
            return 0;
        }
        console.log(`Found ${associationsToRemove.length} associations to remove:`, associationsToRemove);
        this.saveTrackingData();
        console.log(`Successfully removed ${associationsToRemove.length} associations`);
        return associationsToRemove.length;
    }

    /**
     * Get event and device information for a specific point
     */
    getEventInfoForPoint(event) {
        const timeWindow = 5000; // 5 seconds for exact match
        const eventType = event.type ? event.type.toLowerCase() : '';
        const eventTimestamp = typeof event.timestamp === 'string' ? Date.parse(event.timestamp) : event.timestamp;
        
        console.log('Looking for event info for event:', {
            timestamp: new Date(eventTimestamp).toLocaleTimeString(),
            phase: event.phase,
            type: eventType,
            powerDelta: event.powerDelta
        });
        
        console.log('Available associations:', this.deviceEvents.length);
        this.deviceEvents.forEach((assoc, index) => {
            const assocType = assoc.type ? assoc.type.toLowerCase() : '';
            const assocTimestamp = typeof assoc.timestamp === 'string' ? Date.parse(assoc.timestamp) : assoc.timestamp;
            const timeDiff = Math.abs(assocTimestamp - eventTimestamp);
            console.log(`Association ${index + 1}:`, {
                timestamp: new Date(assocTimestamp).toLocaleTimeString(),
                phase: assoc.phase,
                type: assocType,
                deviceId: assoc.deviceId,
                eventId: assoc.eventId,
                timeDiff: timeDiff,
                withinWindow: timeDiff <= timeWindow,
                phaseMatch: assoc.phase === event.phase,
                typeMatch: assocType === eventType
            });
        });
        
        // First, look for exact timestamp/phase/type match (case-insensitive)
        const exactMatch = this.deviceEvents.find(assoc => {
            const assocType = assoc.type ? assoc.type.toLowerCase() : '';
            const assocTimestamp = typeof assoc.timestamp === 'string' ? Date.parse(assoc.timestamp) : assoc.timestamp;
            const timeMatch = Math.abs(assocTimestamp - eventTimestamp) <= timeWindow;
            const phaseMatch = assoc.phase === event.phase;
            const typeMatch = assocType === eventType || (eventType === 'start' && assocType === 'peak');
            return timeMatch && phaseMatch && typeMatch;
        });
        
        if (exactMatch) {
            console.log('Found exact match:', {
                eventId: exactMatch.eventId,
                deviceId: exactMatch.deviceId,
                association: exactMatch
            });
            return {
                eventId: exactMatch.eventId,
                deviceId: exactMatch.deviceId,
                association: exactMatch
            };
        }
        
        // Fallback: look for any association at this timestamp/phase (ignore type mismatch)
        const timePhaseMatch = this.deviceEvents.find(assoc => {
            const assocTimestamp = typeof assoc.timestamp === 'string' ? Date.parse(assoc.timestamp) : assoc.timestamp;
            const timeMatch = Math.abs(assocTimestamp - eventTimestamp) <= timeWindow;
            const phaseMatch = assoc.phase === event.phase;
            return timeMatch && phaseMatch;
        });
        
        if (timePhaseMatch) {
            console.log('Found time/phase match:', {
                eventId: timePhaseMatch.eventId,
                deviceId: timePhaseMatch.deviceId,
                association: timePhaseMatch
            });
            return {
                eventId: timePhaseMatch.eventId,
                deviceId: timePhaseMatch.deviceId,
                association: timePhaseMatch
            };
        }
        
        console.log('No event info found - no associations match criteria');
        return { eventId: null, deviceId: null, association: null };
    }

    /**
     * Remove all associations for a specific event ID, type, and node
     */
    removeByEventId(eventId, type, timestamp, phase, deviceId) {
        console.log(`Removing association for event ID: ${eventId}, type: ${type}, timestamp: ${timestamp}, phase: ${phase}, deviceId: ${deviceId}`);
        const beforeCount = this.deviceEvents.length;
        this.deviceEvents = this.deviceEvents.filter(assoc => {
            return !(
                assoc.eventId === eventId &&
                assoc.type === type &&
                assoc.timestamp === timestamp &&
                assoc.phase === phase &&
                assoc.deviceId === deviceId
            );
        });
        this.saveTrackingData();
        const afterCount = this.deviceEvents.length;
        return beforeCount - afterCount;
    }

    /**
     * Remove association by association ID (fallback method)
     */
    removeByAssociationId(associationId) {
        console.log(`Removing association with ID: ${associationId}`);
        const beforeCount = this.deviceEvents.length;
        this.deviceEvents = this.deviceEvents.filter(assoc => assoc.id !== associationId);
        this.saveTrackingData();
        const afterCount = this.deviceEvents.length;
        return beforeCount - afterCount;
    }
    
    /**
     * Remove device events that create Event Role values for a specific event
     * @param {Object} event - Power event data
     * @param {string} deviceId - Device ID to remove events for
     */
    removeDeviceEventsForEvent(event, deviceId) {
        console.log('Removing device events for event:', event, 'deviceId:', deviceId);
        
        const timeWindow = 30000; // 30 seconds window
        const eventTimestamp = event.timestamp;
        const eventPhase = event.phase;
        
        // Find device events that overlap with this event's time window
        const matchingEvents = this.deviceEvents.filter(deviceEvent => {
            const timeOverlap = Math.abs(deviceEvent.startTime - eventTimestamp) <= timeWindow ||
                               Math.abs(deviceEvent.endTime - eventTimestamp) <= timeWindow;
            const phaseMatch = deviceEvent.phase === eventPhase;
            const deviceMatch = deviceEvent.deviceId === deviceId;
            
            return timeOverlap && phaseMatch && deviceMatch;
        });
        
        console.log(`Found ${matchingEvents.length} device events to remove:`, matchingEvents);
        
        // Remove matching device events
        matchingEvents.forEach(deviceEvent => {
            const index = this.deviceEvents.indexOf(deviceEvent);
            if (index > -1) {
                this.deviceEvents.splice(index, 1);
                console.log(`Removed device event: ${deviceEvent.deviceId} at ${new Date(deviceEvent.startTime).toLocaleTimeString()}`);
            }
        });
    }

    /**
     * Get device ID for a specific event
     * @param {Object} event - Power event data
     * @returns {string|null} Device ID or null if not found
     */
    getDeviceIdForEvent(event) {
        const timeWindow = 5000; // 5 seconds window
        
        console.log('Looking for device ID for event:', {
            timestamp: new Date(event.timestamp).toLocaleTimeString(),
            phase: event.phase,
            type: event.type,
            powerDelta: event.powerDelta
        });
        
        console.log('Available associations (showing only those with matching timestamp):');
        const matchingTimeAssociations = this.deviceEvents.filter(assoc => 
            Math.abs(assoc.timestamp - event.timestamp) <= 5000
        );
        matchingTimeAssociations.forEach((assoc, index) => {
            console.log(`Association ${index + 1}:`, {
                timestamp: new Date(assoc.timestamp).toLocaleTimeString(),
                phase: assoc.phase,
                type: assoc.type,
                deviceId: assoc.deviceId,
                powerDelta: assoc.powerDelta
            });
        });
        
        const association = this.deviceEvents.find(assoc => {
            const timeMatch = Math.abs(assoc.timestamp - event.timestamp) <= timeWindow;
            const phaseMatch = assoc.phase === event.phase;
            const typeMatch = assoc.type === event.type || event.type === 'start';
            
            // Only log detailed info for associations that match time and phase
            if (timeMatch && phaseMatch) {
                console.log('Checking association (time and phase match):', {
                    assocTimestamp: new Date(assoc.timestamp).toLocaleTimeString(),
                    eventTimestamp: new Date(event.timestamp).toLocaleTimeString(),
                    timeDiff: Math.abs(assoc.timestamp - event.timestamp),
                    timeMatch,
                    phaseMatch,
                    typeMatch,
                    assocPhase: assoc.phase,
                    eventPhase: event.phase,
                    assocType: assoc.type,
                    eventType: event.type,
                    assocPowerDelta: assoc.powerDelta,
                    eventPowerDelta: event.powerDelta,
                    typeComparison: `${assoc.type} === ${event.type} || ${event.type} === 'start'`
                });
            }
            
            return timeMatch && phaseMatch && typeMatch;
        });
        
        if (association) {
            console.log('Found matching association:', association);
            return association.deviceId;
        } else {
            console.log('No matching association found');
            return null;
        }
    }

    /**
     * Remove all device associations for a specific device
     * @param {string} deviceId - Device ID to remove associations for
     * @returns {number} Number of associations removed
     */
    removeAllDeviceAssociations(deviceId) {
        const initialCount = this.deviceEvents.length;
        
        // Remove all associations for this device
        this.deviceEvents = this.deviceEvents.filter(assoc => assoc.deviceId !== deviceId);
        
        // Also remove from learning data
        this.learningData = this.learningData.filter(data => data.deviceId !== deviceId);
        
        const removedCount = initialCount - this.deviceEvents.length;
        
        if (removedCount > 0) {
            console.log(`Removed ${removedCount} device associations for device ${deviceId}`);
            this.saveTrackingData();
        }
        
        return removedCount;
    }

    /**
     * Extract features for AI training
     */
    extractFeatures(event) {
        const readings = event.readings;
        const hour = new Date(event.timestamp).getHours();
        const dayOfWeek = new Date(event.timestamp).getDay();
        
        return {
            powerDelta: event.powerDelta,
            phase: event.phase,
            type: event.type,
            voltage: readings[`voltage_${event.phase.toLowerCase()}`],
            current: readings[`current_${event.phase.toLowerCase()}`],
            powerFactor: readings[`pf_${event.phase.toLowerCase()}`],
            hour: hour,
            dayOfWeek: dayOfWeek,
            isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
            timeOfDay: this.getTimeOfDay(hour)
        };
    }

    /**
     * Get time of day category
     */
    getTimeOfDay(hour) {
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        if (hour >= 18 && hour < 22) return 'evening';
        return 'night';
    }

    /**
     * AI-enhanced analysis (placeholder for future implementation)
     */
    async aiEnhancedAnalysis(event, phaseDevices) {
        // This would integrate with an AI model
        // For now, return empty array
        return [];
    }

    /**
     * Train AI model with accumulated data
     */
    async trainAIModel() {
        if (this.learningData.length < 50) {
            console.log('Insufficient data for AI training. Need at least 50 associations.');
            return false;
        }

        // Placeholder for AI training implementation
        // Could use TensorFlow.js, send to cloud API, etc.
        console.log(`Training AI model with ${this.learningData.length} data points...`);
        
        // For now, just return success
        return true;
    }

    /**
     * Get device associations
     */
    getAssociations() {
        return this.deviceEvents;
    }

    /**
     * Get environment configuration
     */
    getEnvironmentConfig() {
        try {
            if (this.configManager) {
                return this.configManager.getConfig();
            } else {
                // Fallback to localStorage
                const config = localStorage.getItem('shellyEnvironmentConfig');
                return config ? JSON.parse(config) : null;
            }
        } catch (error) {
            console.error('Error loading environment config:', error);
            return null;
        }
    }

    /**
     * Load tracking data from localStorage
     */
    loadTrackingData() {
        try {
            const associations = localStorage.getItem('deviceAssociations');
            if (associations) {
                this.deviceEvents = JSON.parse(associations);
            }

            const learningData = localStorage.getItem('learningData');
            if (learningData) {
                this.learningData = JSON.parse(learningData);
            }

            const eventHistory = localStorage.getItem('eventHistory');
            if (eventHistory) {
                this.eventHistory = JSON.parse(eventHistory);
            }

            // Load enhanced tracking data
            const deviceEvents = localStorage.getItem('deviceEvents');
            if (deviceEvents) {
                this.deviceEvents = JSON.parse(deviceEvents);
            }

            const consumptionPatterns = localStorage.getItem('consumptionPatterns');
            if (consumptionPatterns) {
                this.consumptionPatterns = new Map(JSON.parse(consumptionPatterns));
            }
        } catch (error) {
            console.error('Error loading tracking data:', error);
        }
    }

    /**
     * Save tracking data to file or localStorage
     */
    async saveTrackingData() {
        try {
            const trackingData = {
                deviceAssociations: this.deviceEvents,
                learningData: this.learningData,
                eventHistory: this.eventHistory,
                deviceEvents: this.deviceEvents,
                consumptionPatterns: Array.from(this.consumptionPatterns.entries())
            };

            if (this.configManager) {
                await this.configManager.updateTrackingData(trackingData);
            } else {
                // Fallback to localStorage
                localStorage.setItem('deviceAssociations', JSON.stringify(this.deviceEvents));
                localStorage.setItem('learningData', JSON.stringify(this.learningData));
                localStorage.setItem('eventHistory', JSON.stringify(this.eventHistory));
                localStorage.setItem('deviceEvents', JSON.stringify(this.deviceEvents));
                localStorage.setItem('consumptionPatterns', JSON.stringify(Array.from(this.consumptionPatterns.entries())));
            }
        } catch (error) {
            console.error('Error saving tracking data:', error);
        }
    }

    /**
     * Add event to history
     */
    addEventToHistory(event) {
        this.eventHistory.push(event);
        
        // Keep only last 1000 events to prevent memory issues
        if (this.eventHistory.length > 1000) {
            this.eventHistory = this.eventHistory.slice(-1000);
        }
        
        this.saveTrackingData();
    }

    /**
     * Get statistics about device associations
     */
    getTrackingStats() {
        const stats = {
            totalAssociations: this.deviceEvents.length,
            manualAssociations: this.deviceEvents.filter(a => a.source === 'manual').length,
            autoAssociations: this.deviceEvents.filter(a => a.source === 'auto').length,
            deviceBreakdown: {},
            phaseBreakdown: { A: 0, B: 0, C: 0 },
            typeBreakdown: { peak: 0, valley: 0 }
        };

        this.deviceEvents.forEach(association => {
            // Device breakdown
            if (!stats.deviceBreakdown[association.deviceId]) {
                stats.deviceBreakdown[association.deviceId] = 0;
            }
            stats.deviceBreakdown[association.deviceId]++;

            // Phase breakdown
            stats.phaseBreakdown[association.phase]++;

            // Type breakdown
            stats.typeBreakdown[association.type]++;
        });

        return stats;
    }

    /**
     * Export tracking data for backup
     */
    exportTrackingData() {
        const exportData = {
            deviceAssociations: this.deviceEvents,
            learningData: this.learningData,
            eventHistory: this.eventHistory.slice(-100), // Last 100 events only
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Import tracking data from backup
     */
    importTrackingData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (data.deviceAssociations) {
                this.deviceEvents = data.deviceAssociations;
            }
            
            if (data.learningData) {
                this.learningData = data.learningData;
            }
            
            if (data.eventHistory) {
                this.eventHistory = data.eventHistory;
            }
            
            this.saveTrackingData();
            return true;
        } catch (error) {
            console.error('Error importing tracking data:', error);
            return false;
        }
    }

    /**
     * Clear all tracking data while preserving configuration
     * This removes event history, device associations, and learning data
     * but keeps the environment configuration (devices, rooms, etc.)
     */
    async clearTrackingData() {
        try {
            // Clear in-memory data
            this.eventHistory = [];
            this.deviceEvents = [];
            this.learningData = [];
            this.consumptionPatterns.clear();
            
            if (this.configManager) {
                await this.configManager.clearTrackingData();
            } else {
                // Fallback: Remove from localStorage (but keep configuration)
                localStorage.removeItem('deviceAssociations');
                localStorage.removeItem('learningData');
                localStorage.removeItem('eventHistory');
                localStorage.removeItem('deviceEvents');
                localStorage.removeItem('consumptionPatterns');
            }
            
            console.log('All tracking data cleared successfully');
            return true;
        } catch (error) {
            console.error('Error clearing tracking data:', error);
            return false;
        }
    }

    // Utility: Clear all device and event associations (for debugging/reset)
    clearAllAssociations() {
        this.deviceEvents = [];
        this.learningData = [];
        this.saveTrackingData();
        console.log('[INFO] All device and event associations have been cleared.');
    }

    // Node type classification for realtime data
    classifyNodeType(data, currentIndex) {
        if (data.length < 3 || currentIndex === 0 || currentIndex === data.length - 1) {
            return 'normal'; // Edge cases are always normal
        }
        
        const prevValue = data[currentIndex - 1].y;
        const currentValue = data[currentIndex].y;
        const nextValue = data[currentIndex + 1].y;
        
        // Apply the classification rules:
        // 1) node value = previous node and next node value >= node value --> node is normal
        if (currentValue === prevValue && nextValue >= currentValue) {
            return 'normal';
        }
        
        // 2) node value = previous node and next node value < node value --> node is peak
        if (currentValue === prevValue && nextValue < currentValue) {
            return 'peak';
        }
        
        // 3) node value < previous node and next node value <= node value --> node is normal
        if (currentValue < prevValue && nextValue <= currentValue) {
            return 'normal';
        }
        
        // 4) node value < previous node and next node value > node value --> node is valley
        if (currentValue < prevValue && nextValue > currentValue) {
            return 'valley';
        }
        
        // 5) node value >= previous node and next node value >= node value --> node is normal
        if (currentValue >= prevValue && nextValue >= currentValue) {
            return 'normal';
        }
        
        // 6) node value >= previous node and next node value < node value --> node is peak
        if (currentValue >= prevValue && nextValue < currentValue) {
            return 'peak';
        }
        
        // Default fallback
        return 'normal';
    }
    
    // Process new data point with node type classification
    processNewDataPoint(newDataPoint, phase) {
        // Initially mark as normal
        newDataPoint.nodeType = 'normal';
        
        // Get recent data points for this phase
        const recentData = this.getRecentDataPoints(phase, 3); // Get last 3 points
        
        if (recentData.length >= 3) {
            // Re-evaluate the previous point now that we have a next point
            const prevIndex = recentData.length - 2;
            const prevNodeType = this.classifyNodeType(recentData, prevIndex);
            
            // Update the previous point's node type if it changed
            if (recentData[prevIndex].nodeType !== prevNodeType) {
                recentData[prevIndex].nodeType = prevNodeType;
                console.log(`Node type updated: ${recentData[prevIndex].timestamp} -> ${prevNodeType}`);
            }
        }
        
        // Store the new data point
        this.storeDataPoint(newDataPoint, phase);
        
        return newDataPoint;
    }
    
    // Get recent data points for a specific phase
    getRecentDataPoints(phase, count = 10) {
        // This would need to be implemented based on your data storage structure
        // For now, returning a placeholder
        return [];
    }
    
    // Store data point with node type classification
    storeDataPoint(dataPoint, phase) {
        // This would store the data point with its node type classification
        // Implementation depends on your data storage structure
        console.log(`Storing data point for phase ${phase}: ${dataPoint.nodeType} at ${dataPoint.timestamp}`);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeviceTracker;
} else {
    window.DeviceTracker = DeviceTracker;
} 