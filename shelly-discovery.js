/**
 * Shelly Device Discovery for Web Browsers
 * Cross-platform solution for discovering Shelly devices on local network
 */

class ShellyDiscovery {
    constructor() {
        this.discoveredDevices = new Map();
        this.onDeviceFound = null;
        this.onDiscoveryComplete = null;
        this.onDiscoveryProgress = null;
        this.isScanning = false;
        this.scanAbortController = null;
    }

    /**
     * Start device discovery process with user-confirmed IP ranges
     */
    async discoverDevices(confirmedRanges = null) {
        if (this.isScanning) {
            console.log('Discovery already in progress');
            return;
        }

        this.isScanning = true;
        this.scanAbortController = new AbortController();
        this.discoveredDevices.clear();

        try {
            console.log('🔍 Starting Shelly device discovery...');
            
            // Method 1: Try mDNS discovery first (if available)
            await this.tryMDNSDiscovery();
            
            // Method 2: IP range scan with user confirmation
            if (confirmedRanges && confirmedRanges.length > 0) {
                // Use user-confirmed ranges (new format with range objects)
                for (const rangeInfo of confirmedRanges) {
                    if (this.scanAbortController?.signal.aborted) break;
                    console.log(`📡 Scanning user-confirmed range: ${rangeInfo.display}`);
                    await this.scanCustomRange(rangeInfo);
                }
            } else {
                // Fallback to automatic detection
                const baseIP = await this.getLocalIPBase();
                if (baseIP) {
                    console.log(`📡 Scanning detected IP range: ${baseIP}.1-254`);
                    await this.scanIPRange(baseIP);
                } else {
                    console.warn('Could not determine local IP range, trying common ranges');
                    await this.scanCommonRanges();
                }
            }

            console.log(`✅ Discovery complete. Found ${this.discoveredDevices.size} Shelly devices`);
            
        } catch (error) {
            console.error('Discovery error:', error);
        } finally {
            this.isScanning = false;
            this.scanAbortController = null;
            
            if (this.onDiscoveryComplete) {
                this.onDiscoveryComplete(Array.from(this.discoveredDevices.values()));
            }
        }
    }

    /**
     * Get suggested IP ranges for user confirmation
     */
    async getSuggestedRanges() {
        const suggestions = [];
        
        // Try to detect local IP range
        try {
            const localIP = await this.getLocalIPBase();
            if (localIP) {
                suggestions.push({
                    range: localIP,
                    description: `Detected local network (${localIP}.1-254)`,
                    recommended: true
                });
            }
        } catch (e) {
            console.log('Could not detect local IP range');
        }
        
        // Add common ranges
        const commonRanges = [
            { range: '192.168.1', description: 'Common home network (192.168.1.1-254)', recommended: false },
            { range: '192.168.0', description: 'Common router default (192.168.0.1-254)', recommended: false },
            { range: '192.168.2', description: 'Alternative home network (192.168.2.1-254)', recommended: false },
            { range: '10.0.0', description: 'Corporate/large network (10.0.0.1-254)', recommended: false },
            { range: '10.0.1', description: 'Corporate subnet (10.0.1.1-254)', recommended: false }
        ];
        
        // Add common ranges that aren't already suggested
        for (const common of commonRanges) {
            if (!suggestions.find(s => s.range === common.range)) {
                suggestions.push(common);
            }
        }
        
        return suggestions;
    }

    /**
     * Stop ongoing discovery
     */
    stopDiscovery() {
        if (this.scanAbortController) {
            this.scanAbortController.abort();
        }
        this.isScanning = false;
        console.log('🛑 Discovery stopped by user');
    }

    /**
     * Try mDNS discovery (limited browser support)
     */
    async tryMDNSDiscovery() {
        try {
            // This is experimental and may not work in all browsers
            if ('dns' in navigator && 'ServiceDiscovery' in window) {
                console.log('🔍 Attempting mDNS discovery...');
                const mdnsDiscovery = await navigator.dns.ServiceDiscovery();
                const results = await mdnsDiscovery.query({
                    type: '_http._tcp.local',
                    name: '_shelly._tcp.local'
                });
                
                for (const result of results) {
                    await this.processDiscoveredDevice(result.address, result);
                }
            }
        } catch (e) {
            console.log('mDNS discovery not available, using IP scan');
        }
    }

    /**
     * Get local IP base using WebRTC with fallback methods
     */
    async getLocalIPBase() {
        // Method 1: Try WebRTC
        try {
            const webrtcIP = await this.getLocalIPViaWebRTC();
            if (webrtcIP) {
                console.log(`📡 Local IP detected via WebRTC: ${webrtcIP}`);
                return webrtcIP;
            }
        } catch (e) {
            console.warn('WebRTC IP detection failed:', e.message);
        }

        // Method 2: Try to guess from common gateway patterns
        try {
            const guessedIP = await this.guessLocalIPRange();
            if (guessedIP) {
                console.log(`📡 Local IP guessed: ${guessedIP}`);
                return guessedIP;
            }
        } catch (e) {
            console.warn('IP guessing failed:', e);
        }

        console.warn('Could not determine local IP, will scan common ranges');
        return null;
    }

    /**
     * Get local IP using WebRTC
     */
    async getLocalIPViaWebRTC() {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        pc.createDataChannel('');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                pc.close();
                reject(new Error('Timeout getting local IP'));
            }, 10000); // Increased timeout to 10 seconds

            pc.onicecandidate = (ice) => {
                if (ice.candidate) {
                    const candidate = ice.candidate.candidate;
                    const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
                    
                    if (ipMatch) {
                        const localIP = ipMatch[1];
                        // Filter out non-local IPs
                        if (localIP.startsWith('192.168.') || 
                            localIP.startsWith('10.') || 
                            (localIP.startsWith('172.') && 
                             parseInt(localIP.split('.')[1]) >= 16 && 
                             parseInt(localIP.split('.')[1]) <= 31)) {
                            
                            const base = localIP.split('.').slice(0, 3).join('.');
                            clearTimeout(timeout);
                            pc.close();
                            resolve(base);
                        }
                    }
                }
            };
        });
    }

    /**
     * Try to guess local IP range by testing common gateways
     */
    async guessLocalIPRange() {
        const commonGateways = [
            '192.168.1.1',
            '192.168.0.1', 
            '192.168.2.1',
            '10.0.0.1',
            '10.0.1.1',
            '172.16.0.1'
        ];

        for (const gateway of commonGateways) {
            try {
                // Try to reach the gateway with a quick request
                const response = await fetch(`http://${gateway}`, {
                    method: 'HEAD',
                    mode: 'no-cors',
                    signal: AbortSignal.timeout(1000)
                });
                
                // If we get any response (even CORS error), the gateway likely exists
                const base = gateway.split('.').slice(0, 3).join('.');
                return base;
            } catch (e) {
                // Continue to next gateway
                continue;
            }
        }
        
        return null;
    }

    /**
     * Scan common IP ranges if local IP detection fails
     */
    async scanCommonRanges() {
        const commonRanges = [
            '192.168.1',
            '192.168.0',
            '192.168.2',
            '192.168.4',
            '10.0.0',
            '10.0.1',
            '172.16.0'
        ];

        console.log(`🔍 Scanning ${commonRanges.length} common IP ranges...`);
        
        for (const range of commonRanges) {
            if (this.scanAbortController?.signal.aborted) break;
            console.log(`📡 Scanning range: ${range}.1-254`);
            await this.scanIPRange(range);
            
            // Log progress after each range
            console.log(`✅ Completed range ${range}, found ${this.discoveredDevices.size} devices so far`);
        }
    }

    /**
     * Scan custom IP range for Shelly devices
     */
    async scanCustomRange(rangeInfo) {
        console.log(`🔍 Starting scan of ${rangeInfo.display}`);
        const scanPromises = [];
        const batchSize = 10; // Increased batch size since we're only testing one endpoint
        
        const totalIPs = rangeInfo.end - rangeInfo.start + 1;
        let currentIP = 0;
        
        for (let i = rangeInfo.start; i <= rangeInfo.end; i++) {
            if (this.scanAbortController?.signal.aborted) break;
            
            const ip = `${rangeInfo.baseIP}.${i}`;
            scanPromises.push(this.probeShellyDevice(ip));
            currentIP++;
            
            // Process in batches
            if (scanPromises.length >= batchSize || i === rangeInfo.end) {
                console.log(`🔄 Processing batch of ${scanPromises.length} IPs (${rangeInfo.baseIP}.${i-scanPromises.length+1} to ${rangeInfo.baseIP}.${i})`);
                await Promise.allSettled(scanPromises);
                scanPromises.length = 0; // Clear array
                
                // Update progress
                if (this.onDiscoveryProgress) {
                    this.onDiscoveryProgress({
                        current: currentIP,
                        total: totalIPs,
                        range: rangeInfo.display,
                        found: this.discoveredDevices.size
                    });
                }
                
                // Shorter delay since we're only testing one endpoint
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        console.log(`✅ Completed scan of ${rangeInfo.display}, found ${this.discoveredDevices.size} devices`);
    }

    /**
     * Scan IP range for Shelly devices (legacy method for backward compatibility)
     */
    async scanIPRange(baseIP) {
        const rangeInfo = {
            baseIP: baseIP,
            start: 1,
            end: 254,
            display: `${baseIP}.1-254`
        };
        await this.scanCustomRange(rangeInfo);
    }

    /**
     * Probe a single IP for Shelly device using server-side endpoint to bypass CORS
     */
    async probeShellyDevice(ip) {
        if (this.scanAbortController?.signal.aborted) return;
        
        try {
            // Use server-side endpoint to bypass CORS restrictions
            const response = await fetch('/test-ip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ip: ip }),
                signal: AbortSignal.timeout(3000)
            });
            
            if (response.ok) {
                const result = await response.json();
                
                // Check the /shelly endpoint result
                const shellyResult = result.results['/shelly'];
                if (shellyResult && shellyResult.success) {
                    const data = shellyResult.data;
                    
                    // Check if this looks like a Shelly device
                    if (this.isShellyDevice(data, '/shelly')) {
                        const device = await this.enrichDeviceInfo(ip, data, '/shelly');
                        this.discoveredDevices.set(device.mac || ip, device);
                        
                        console.log(`✅ Found Shelly device at ${ip}:`, device.type || device.deviceType || 'Unknown');
                        
                        if (this.onDeviceFound) {
                            this.onDeviceFound(device);
                        }
                        return; // Found device
                    }
                }
            }
        } catch (error) {
            // Ignore timeouts and connection errors for cleaner logs
            if (!error.name?.includes('Abort') && !error.message?.includes('fetch')) {
                console.log(`⚠️ Error probing ${ip}:`, error.message);
            }
        }
    }

    /**
     * Check if response indicates a compatible Shelly device
     */
    isShellyDevice(data, endpoint) {
        if (!data || typeof data !== 'object') return false;

        // Check if it's a Shelly device - be more flexible with detection
        const isShellyDevice = [
            // Direct type indicators
            data.type && data.type.toLowerCase().includes('shelly'),
            data.device && data.device.type && data.device.type.toLowerCase().includes('shelly'),
            data.device_type && data.device_type.toLowerCase().includes('shelly'),
            
            // Firmware/app indicators
            data.fw && data.fw.toLowerCase().includes('shelly'),
            data.app && data.app.toLowerCase().includes('shelly'),
            data.name && data.name.toLowerCase().includes('shelly'),
            
            // MAC address patterns (Shelly devices often have specific patterns)
            data.mac && (data.mac.length === 12 || data.mac.includes(':')),
            
            // Common Shelly endpoints/properties
            data.hasOwnProperty('relays'),
            data.hasOwnProperty('lights'),
            data.hasOwnProperty('emeters'),
            data.hasOwnProperty('meters'),
            
            // Shelly-specific properties
            data.hasOwnProperty('wifi_sta'),
            data.hasOwnProperty('cloud'),
            data.hasOwnProperty('mqtt'),
            
            // If we're hitting /shelly endpoint, it's likely a Shelly device
            endpoint === '/shelly',
            
            // Look for Allterco (Shelly manufacturer) indicators
            data.manufacturer && data.manufacturer.toLowerCase().includes('allterco'),
            
            // Check for common Shelly device models
            data.model && (
                data.model.toLowerCase().includes('shelly') ||
                data.model.toLowerCase().includes('pro') ||
                data.model.toLowerCase().includes('3em') ||
                data.model.toLowerCase().includes('1pm')
            )
        ].some(indicator => indicator);

        // If it's clearly a Shelly device, accept it regardless of power monitoring
        if (isShellyDevice) {
            return true;
        }

        // For non-obvious cases, check if it has power monitoring capabilities
        const hasPowerMonitoring = [
            data.hasOwnProperty('emeters'),
            data.hasOwnProperty('apower_a') || data.hasOwnProperty('apower'),
            data.hasOwnProperty('voltage_a') || data.hasOwnProperty('voltage'),
            data.hasOwnProperty('current_a') || data.hasOwnProperty('current'),
            data.hasOwnProperty('meters'),
            data.hasOwnProperty('power')
        ].some(indicator => indicator);

        return hasPowerMonitoring;
    }

    /**
     * Enrich device information by analyzing the data we already have
     */
    async enrichDeviceInfo(ip, initialData, discoveryEndpoint) {
        const device = {
            ip: ip,
            lastSeen: Date.now(),
            discoveryEndpoint: discoveryEndpoint,
            isCompatible: false,
            powerCapabilities: [],
            ...initialData
        };

        // Analyze the data we already have instead of making more requests
        // Check for power monitoring capabilities based on initial data
        if (initialData.emeters) {
            device.powerCapabilities.push('3-Phase Power Monitoring');
            device.phaseCount = initialData.emeters.length;
        }
        if (initialData.meters) {
            device.powerCapabilities.push('Single Phase Power Monitoring');
        }
        if (initialData.apower || initialData.apower_a) {
            device.powerCapabilities.push('Active Power Monitoring');
        }
        if (initialData.voltage || initialData.voltage_a) {
            device.powerCapabilities.push('Voltage Monitoring');
        }
        if (initialData.current || initialData.current_a) {
            device.powerCapabilities.push('Current Monitoring');
        }
        
        // For Shelly Pro 3EM, we know it has power monitoring capabilities
        if (initialData.app === 'Pro3EM' || initialData.model?.includes('3EM')) {
            device.powerCapabilities.push('3-Phase Power Monitoring');
            device.powerCapabilities.push('Active Power Monitoring');
            device.powerCapabilities.push('Voltage Monitoring');
            device.powerCapabilities.push('Current Monitoring');
        }
        
        // Store some sample readings if available
        if (initialData.emeters) {
            device.sampleReadings = initialData.emeters;
        }

        // Determine compatibility based on capabilities
        device.isCompatible = device.powerCapabilities.length > 0;
        
        // Set display information
        device.displayName = device.name || device.id || `Shelly Device (${ip})`;
        device.deviceType = device.type || device.device_type || initialData.app || 'Unknown Shelly Device';
        device.firmware = device.fw || device.firmware || 'Unknown';
        device.macAddress = device.mac || 'Unknown';
        
        // Add compatibility information to display name
        if (device.isCompatible) {
            device.displayName += ` (✅ Compatible)`;
            device.compatibilityDetails = device.powerCapabilities.join(', ');
        } else {
            device.displayName += ` (❌ Not Compatible)`;
            device.compatibilityDetails = 'Device does not support power monitoring';
        }

        return device;
    }

    /**
     * Get all discovered devices
     */
    getDiscoveredDevices() {
        return Array.from(this.discoveredDevices.values());
    }

    /**
     * Clear discovered devices
     */
    clearDiscoveredDevices() {
        this.discoveredDevices.clear();
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShellyDiscovery;
} else {
    window.ShellyDiscovery = ShellyDiscovery;
} 