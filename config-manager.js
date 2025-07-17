/**
 * Configuration Manager for Shelly 3EM Device Tracking
 * Uses file-based storage for persistent configuration across browser sessions
 */

class ConfigManager {
    constructor() {
        this.configFile = 'shelly-environment-config.json';
        this.trackingDataFile = 'shelly-tracking-data.json';
        this.config = {
            rooms: [],
            devices: [],
            deviceTypes: [
                'computer',
                'cucina a induzione',
                'dispositivo generico',
                'forno microonde',
                'lampada da tavolo',
                'luce a soffitto',
                'split',
                'stampante'
            ]
        };
        this.trackingData = {
            deviceAssociations: [],
            learningData: [],
            eventHistory: [],
            deviceEvents: [],
            consumptionPatterns: []
        };
    }

    /**
     * Load configuration from file
     */
    async loadConfig() {
        try {
            const response = await fetch('/api/load-config');
            if (response.ok) {
                const data = await response.json();
                this.config = {
                    rooms: data.rooms || [],
                    devices: data.devices || [],
                    deviceTypes: data.deviceTypes || this.config.deviceTypes
                };
                console.log('Configuration loaded from file successfully');
                return true;
            } else if (response.status === 404) {
                console.log('Configuration file not found, using defaults');
                await this.saveConfig(); // Create default config file
                return true;
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
            // Try to load from localStorage as fallback
            return this.loadConfigFromLocalStorage();
        }
    }

    /**
     * Save configuration to file
     */
    async saveConfig() {
        try {
            const configData = {
                ...this.config,
                lastUpdated: new Date().toISOString(),
                version: '1.0'
            };

            const response = await fetch('/api/save-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: this.configFile,
                    data: configData
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.log('Configuration saved to file successfully');
            return true;
        } catch (error) {
            console.error('Error saving configuration:', error);
            // Fallback to localStorage
            this.saveConfigToLocalStorage();
            return false;
        }
    }

    /**
     * Load tracking data from file
     */
    async loadTrackingData() {
        try {
            const response = await fetch('/api/load-tracking');
            if (response.ok) {
                const data = await response.json();
                this.trackingData = {
                    deviceAssociations: data.deviceAssociations || [],
                    learningData: data.learningData || [],
                    eventHistory: data.eventHistory || [],
                    deviceEvents: data.deviceEvents || [],
                    consumptionPatterns: data.consumptionPatterns || []
                };
                console.log('Tracking data loaded from file successfully');
                return true;
            } else if (response.status === 404) {
                console.log('Tracking data file not found, using defaults');
                await this.saveTrackingData(); // Create default tracking file
                return true;
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error loading tracking data:', error);
            // Try to load from localStorage as fallback
            return this.loadTrackingDataFromLocalStorage();
        }
    }

    /**
     * Save tracking data to file
     */
    async saveTrackingData() {
        try {
            const trackingData = {
                ...this.trackingData,
                lastUpdated: new Date().toISOString(),
                version: '1.0'
            };

            const response = await fetch('/api/save-tracking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: this.trackingDataFile,
                    data: trackingData
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            console.log('Tracking data saved to file successfully');
            return true;
        } catch (error) {
            console.error('Error saving tracking data:', error);
            // Fallback to localStorage
            this.saveTrackingDataToLocalStorage();
            return false;
        }
    }

    /**
     * Fallback: Load configuration from localStorage
     */
    loadConfigFromLocalStorage() {
        try {
            const savedConfig = localStorage.getItem('shellyEnvironmentConfig');
            if (savedConfig) {
                const data = JSON.parse(savedConfig);
                this.config = {
                    rooms: data.rooms || [],
                    devices: data.devices || [],
                    deviceTypes: data.deviceTypes || this.config.deviceTypes
                };
                console.log('Configuration loaded from localStorage (fallback)');
                return true;
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
        return false;
    }

    /**
     * Fallback: Save configuration to localStorage
     */
    saveConfigToLocalStorage() {
        try {
            localStorage.setItem('shellyEnvironmentConfig', JSON.stringify(this.config));
            console.log('Configuration saved to localStorage (fallback)');
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    /**
     * Fallback: Load tracking data from localStorage
     */
    loadTrackingDataFromLocalStorage() {
        try {
            const keys = ['deviceAssociations', 'learningData', 'eventHistory', 'deviceEvents', 'consumptionPatterns'];
            let loaded = false;

            keys.forEach(key => {
                const data = localStorage.getItem(key);
                if (data) {
                    this.trackingData[key] = JSON.parse(data);
                    loaded = true;
                }
            });

            if (loaded) {
                console.log('Tracking data loaded from localStorage (fallback)');
                return true;
            }
        } catch (error) {
            console.error('Error loading tracking data from localStorage:', error);
        }
        return false;
    }

    /**
     * Fallback: Save tracking data to localStorage
     */
    saveTrackingDataToLocalStorage() {
        try {
            Object.keys(this.trackingData).forEach(key => {
                localStorage.setItem(key, JSON.stringify(this.trackingData[key]));
            });
            console.log('Tracking data saved to localStorage (fallback)');
        } catch (error) {
            console.error('Error saving tracking data to localStorage:', error);
        }
    }

    /**
     * Export configuration as downloadable file
     */
    exportConfig() {
        const configData = {
            ...this.config,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shelly-environment-config-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return true;
    }

    /**
     * Import configuration from file
     */
    async importConfig(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedConfig = JSON.parse(e.target.result);
                    
                    // Validate imported config
                    if (!importedConfig.rooms || !importedConfig.devices || !importedConfig.deviceTypes) {
                        throw new Error('Invalid configuration file format');
                    }

                    this.config = {
                        rooms: importedConfig.rooms || [],
                        devices: importedConfig.devices || [],
                        deviceTypes: importedConfig.deviceTypes || this.config.deviceTypes
                    };

                    // Ensure device types are sorted
                    this.config.deviceTypes.sort();

                    await this.saveConfig();
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsText(file);
        });
    }

    /**
     * Clear all tracking data while preserving configuration
     */
    async clearTrackingData() {
        this.trackingData = {
            deviceAssociations: [],
            learningData: [],
            eventHistory: [],
            deviceEvents: [],
            consumptionPatterns: []
        };

        await this.saveTrackingData();
        
        // Also clear localStorage fallback
        const keys = ['deviceAssociations', 'learningData', 'eventHistory', 'deviceEvents', 'consumptionPatterns'];
        keys.forEach(key => localStorage.removeItem(key));

        console.log('All tracking data cleared successfully');
        return true;
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return this.config;
    }

    /**
     * Get current tracking data
     */
    getTrackingData() {
        return this.trackingData;
    }

    /**
     * Update configuration
     */
    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        return await this.saveConfig();
    }

    /**
     * Update tracking data
     */
    async updateTrackingData(newTrackingData) {
        this.trackingData = { ...this.trackingData, ...newTrackingData };
        return await this.saveTrackingData();
    }

    /**
     * Initialize the configuration manager
     */
    async initialize() {
        console.log('Initializing ConfigManager...');
        
        // Load configuration and tracking data
        await this.loadConfig();
        await this.loadTrackingData();
        
        // Try to load device types from CSV
        const csvLoaded = await this.loadDeviceTypesFromCSV();
        if (csvLoaded) {
            // Save the updated configuration with CSV device types
            await this.saveConfig();
        }
        
        console.log('ConfigManager initialized successfully');
        return true;
    }

    /**
     * Load device types from CSV file
     */
    async loadDeviceTypesFromCSV() {
        try {
            const response = await fetch('/api/get-device-types');
            if (response.ok) {
                const data = await response.json();
                this.config.deviceTypes = data.deviceTypes;
                console.log(`Loaded ${data.deviceTypes.length} device types from CSV`);
                return true;
            } else {
                console.warn('Failed to load device types from CSV, using defaults');
                return false;
            }
        } catch (error) {
            console.error('Error loading device types from CSV:', error);
            return false;
        }
    }

    /**
     * Get appliances consumption data
     */
    async getAppliancesData() {
        try {
            const response = await fetch('/api/get-appliances');
            if (response.ok) {
                const data = await response.json();
                return data.appliances;
            } else {
                console.warn('Failed to load appliances data from CSV');
                return {};
            }
        } catch (error) {
            console.error('Error loading appliances data:', error);
            return {};
        }
    }

    /**
     * Get suggested consumption for a device type
     */
    async getSuggestedConsumption(deviceType) {
        try {
            const response = await fetch('/api/get-suggested-consumption', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ deviceType })
            });
            
            if (response.ok) {
                const data = await response.json();
                return data;
            } else {
                console.warn(`Failed to get suggested consumption for ${deviceType}`);
                return { suggestedConsumption: null, available: false };
            }
        } catch (error) {
            console.error('Error getting suggested consumption:', error);
            return { suggestedConsumption: null, available: false };
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigManager;
} else {
    window.ConfigManager = ConfigManager;
} 