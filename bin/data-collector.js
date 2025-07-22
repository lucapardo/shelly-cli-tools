#!/usr/bin/env node
/**
 * Standalone Data Collector for Shelly 3EM
 * This script runs independently of the web interface and continuously collects data
 * It can be started/stopped via the web interface or run directly from command line
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { Command } from 'commander';
import { Shelly3EM } from '@allterco/shelly/shelly-3em.js';
import { wsTransport } from '@allterco/transport/websocket.js';
import { mapToFile } from '../src/utils.js';
import { measurementFromDeviceEMStatus } from '../src/model.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEBUG = process.env.DEBUG || 'none';
const DATA_DIR = join(__dirname, '..', 'data');
const STATUS_FILE = join(DATA_DIR, 'collector-status.json');
const LOG_FILE = join(DATA_DIR, 'collector.log');

class DataCollector {
    constructor(options = {}) {
        this.shellyIP = options.shelly;
        this.outputFile = options.output || join(DATA_DIR, 'readings.csv');
        this.connectionType = options.connectionType || 'DIRECT';
        // Use 2-second interval for WEB mode to avoid rate limiting, 1-second for DIRECT mode
        const defaultInterval = this.connectionType === 'WEB' ? 2000 : 1000;
        this.intervalMs = parseInt(options.interval) || defaultInterval;
        this.maxRetries = parseInt(options.maxRetries) || 5;
        this.retryDelayMs = parseInt(options.retryDelay) || 5000;
        this.deviceId = options.deviceId;
        this.authKey = options.authKey;
        this.deviceType = options.deviceType || 'trifase'; // Default to trifase for backward compatibility
        
        this.transport = null;
        this.device = null;
        this.isRunning = false;
        this.readingCount = 0;
        this.startTime = null;
        this.lastSuccessfulReading = null;
        this.consecutiveErrors = 0;
        
        // Ensure data directory exists
        if (!existsSync(DATA_DIR)) {
            mkdirSync(DATA_DIR, { recursive: true });
        }
        
        // Setup graceful shutdown
        process.on('SIGINT', () => this.stop('SIGINT received'));
        process.on('SIGTERM', () => this.stop('SIGTERM received'));
        process.on('uncaughtException', (error) => {
            this.log(`Uncaught exception: ${error.message}`, 'error');
            this.stop('Uncaught exception');
        });
    }
    
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        console.log(logMessage);
        
        // Also write to log file
        try {
            writeFileSync(LOG_FILE, logMessage + '\n', { flag: 'a' });
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }
    
    updateStatus(status) {
        const statusData = {
            isRunning: this.isRunning,
            shellyIP: this.shellyIP,
            outputFile: this.outputFile,
            intervalMs: this.intervalMs,
            readingCount: this.readingCount,
            startTime: this.startTime,
            lastSuccessfulReading: this.lastSuccessfulReading,
            consecutiveErrors: this.consecutiveErrors,
            status: status,
            lastUpdate: new Date().toISOString()
        };
        
        try {
            writeFileSync(STATUS_FILE, JSON.stringify(statusData, null, 2));
        } catch (error) {
            this.log(`Failed to update status file: ${error.message}`, 'error');
        }
    }
    
    async connect() {
        if (this.connectionType === 'WEB') {
            this.log(`Using WEB connection mode (cloud API)`);
            this.updateStatus('connected');
            return { mac: this.deviceId };
        }
        try {
            this.log(`Connecting to Shelly 3EM at ${this.shellyIP}...`);
            
            this.transport = new wsTransport();
            this.device = new Shelly3EM(this.transport);
            
            if (DEBUG !== 'none') {
                this.transport.setDebug(DEBUG);
                this.device.setDebug(DEBUG);
            }
            
            await this.transport.connect(this.shellyIP);
            const deviceInfo = await this.device.getInfo();
            
            this.log(`Connected to device: ${deviceInfo.mac} (${deviceInfo.app || 'Unknown'})`);
            this.updateStatus('connected');
            
            return deviceInfo;
        } catch (error) {
            this.log(`Connection failed: ${error.message}`, 'error');
            this.updateStatus('connection_failed');
            throw error;
        }
    }
    
    async disconnect() {
        try {
            if (this.transport) {
                await this.transport.disconnect();
                this.transport = null;
                this.device = null;
                this.log('Disconnected from device');
            }
        } catch (error) {
            this.log(`Disconnect error: ${error.message}`, 'error');
        }
    }
    
    async readSensorData() {
        if (this.connectionType === 'WEB') {
            // Use cloud API
            try {
                const postData = JSON.stringify({
                    ids: [this.deviceId],
                    select: ["status"]
                });
                const url = `https://shelly-174-eu.shelly.cloud/v2/devices/api/get?auth_key=${this.authKey}`;
                const data = await new Promise((resolve, reject) => {
                    const req = https.request(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(postData)
                        }
                    }, (res) => {
                        let raw = '';
                        res.on('data', chunk => raw += chunk);
                        res.on('end', () => {
                            try {
                                // Debug: log the raw response
                                this.log(`[DEBUG] Raw cloud API response: ${raw}`);
                                resolve(JSON.parse(raw));
                            } catch (e) {
                                this.log(`[DEBUG] Failed to parse cloud API response: ${raw}`);
                                reject(new Error('Invalid JSON from cloud API'));
                            }
                        });
                    });
                    req.on('error', reject);
                    req.write(postData);
                    req.end();
                });
                // Debug: log the parsed object
                this.log(`[DEBUG] Parsed cloud API object: ${JSON.stringify(data)}`);
                // Expecting an array with one object
                const resp = Array.isArray(data) ? data[0] : data;
                if (!resp || !resp.status) {
                    this.log(`[DEBUG] Missing status in response: ${JSON.stringify(resp)}`);
                    throw new Error('Invalid response from cloud API');
                }
                
                let em;
                if (this.deviceType === 'monofase') {
                    // Handle monofase format: expect 'emeters' array
                    if (!resp.status['emeters']) {
                        this.log(`[DEBUG] Missing emeters in monofase response: ${JSON.stringify(resp)}`);
                        throw new Error('Invalid response from cloud API - missing emeters for monofase device');
                    }
                    
                    const emeters = resp.status['emeters'];
                    if (!Array.isArray(emeters) || emeters.length < 2) {
                        this.log(`[DEBUG] Invalid emeters array in monofase response: ${JSON.stringify(emeters)}`);
                        throw new Error('Invalid response from cloud API - invalid emeters array');
                    }
                    
                    // Convert monofase format to trifase format
                    // Monofase typically has 2 emeters: [0] is usually empty/low, [1] has the actual data
                    const activeEmeter = emeters[1] || emeters[0]; // Use [1] if available, fallback to [0]
                    
                    em = {
                        // Phase A gets the actual data
                        a_act_power: activeEmeter.power || 0,
                        a_aprt_power: activeEmeter.reactive || 0,
                        a_current: activeEmeter.power && activeEmeter.voltage ? (activeEmeter.power / activeEmeter.voltage) : 0,
                        a_freq: 50, // Default frequency
                        a_pf: activeEmeter.pf || 0,
                        a_voltage: activeEmeter.voltage || 0,
                        
                        // Phases B and C are set to zero for monofase
                        b_act_power: 0,
                        b_aprt_power: 0,
                        b_current: 0,
                        b_freq: 0,
                        b_pf: 0,
                        b_voltage: 0,
                        
                        c_act_power: 0,
                        c_aprt_power: 0,
                        c_current: 0,
                        c_freq: 0,
                        c_pf: 0,
                        c_voltage: 0,
                        
                        // Total values
                        total_act_power: activeEmeter.power || 0,
                        total_aprt_power: activeEmeter.reactive || 0,
                        total_current: activeEmeter.power && activeEmeter.voltage ? (activeEmeter.power / activeEmeter.voltage) : 0,
                        id: 0
                    };
                    
                    this.log(`[DEBUG] Converted monofase to trifase format: ${JSON.stringify(em)}`);
                } else {
                    // Handle trifase format: expect 'em:0'
                    if (!resp.status['em:0']) {
                        this.log(`[DEBUG] Missing em:0 in trifase response: ${JSON.stringify(resp)}`);
                        throw new Error('Invalid response from cloud API - missing em:0 for trifase device');
                    }
                    em = resp.status['em:0'];
                }
                
                // Map to measurement format exactly as in DIRECT mode
                const measurement = measurementFromDeviceEMStatus(em);
                const resultMap = new Map([
                    ['mac', this.deviceId || 'unknown'],
                    ['ts', Math.floor(Date.now() / 1000)],
                    ['reading_id', this.readingCount],
                    ...Object.entries(measurement),
                ]);
                mapToFile(resultMap, this.outputFile);
                this.readingCount++;
                this.lastSuccessfulReading = new Date().toISOString();
                this.consecutiveErrors = 0;
                if (this.readingCount % 60 === 0) {
                    this.log(`Reading ${this.readingCount}: ${this.lastSuccessfulReading}`);
                }
                return measurement;
            } catch (error) {
                this.consecutiveErrors++;
                this.log(`WEB reading error (${this.consecutiveErrors}/${this.maxRetries}): ${error.message}`, 'error');
                if (this.consecutiveErrors >= this.maxRetries) {
                    throw new Error(`Too many consecutive errors (${this.consecutiveErrors}). Stopping collection.`);
                }
                throw error;
            }
        }
        try {
            const status = await this.device.EM.getStatus();
            const measurement = measurementFromDeviceEMStatus(status.response);
            
            const resultMap = new Map([
                ['mac', this.device.info?.mac || 'unknown'],
                ['ts', Math.floor(Date.now() / 1000)],
                ['reading_id', this.readingCount],
                ...Object.entries(measurement),
            ]);
            
            // Write to file
            mapToFile(resultMap, this.outputFile);
            
            this.readingCount++;
            this.lastSuccessfulReading = new Date().toISOString();
            this.consecutiveErrors = 0;
            
            // Log every 60 readings (1 minute at 1-second intervals)
            if (this.readingCount % 60 === 0) {
                this.log(`Reading ${this.readingCount}: ${this.lastSuccessfulReading}`);
            }
            
            return measurement;
        } catch (error) {
            this.consecutiveErrors++;
            this.log(`Reading error (${this.consecutiveErrors}/${this.maxRetries}): ${error.message}`, 'error');
            
            if (this.consecutiveErrors >= this.maxRetries) {
                throw new Error(`Too many consecutive errors (${this.consecutiveErrors}). Stopping collection.`);
            }
            
            throw error;
        }
    }
    
    async start() {
        if (this.isRunning) {
            this.log('Data collection is already running', 'warn');
            return;
        }
        
        this.isRunning = true;
        this.startTime = new Date().toISOString();
        this.readingCount = 0;
        this.consecutiveErrors = 0;
        
        if (this.connectionType === 'WEB') {
            this.log(`Starting data collection from cloud API (Device ID: ${this.deviceId})`);
        } else {
            this.log(`Starting data collection from ${this.shellyIP}`);
        }
        this.log(`Output file: ${this.outputFile}`);
        this.log(`Interval: ${this.intervalMs}ms`);
        this.updateStatus('starting');
        
        try {
            // Connect to device
            await this.connect();
            
            // Write CSV header if file doesn't exist (ensure consistent format)
            if (!existsSync(this.outputFile)) {
                const headerMap = new Map([
                    ['mac', 'device_id'],
                    ['ts', 'timestamp'],
                    ['reading_id', 'reading_id'],
                    ['voltage_a', 'a_voltage'],
                    ['voltage_b', 'b_voltage'],
                    ['voltage_c', 'c_voltage'],
                    ['current_a', 'a_current'],
                    ['current_b', 'b_current'],
                    ['current_c', 'c_current'],
                    ['current_n', 'n_current'],
                    ['apower_a', 'a_act_power'],
                    ['apower_b', 'b_act_power'],
                    ['apower_c', 'c_act_power'],
                    ['aprtpower_a', 'a_aprt_power'],
                    ['aprtpower_b', 'b_aprt_power'],
                    ['aprtpower_c', 'c_aprt_power'],
                    ['angle_a', 'a_angle'],
                    ['angle_b', 'b_angle'],
                    ['angle_c', 'c_angle'],
                    ['pf_a', 'a_pf'],
                    ['pf_b', 'b_pf'],
                    ['pf_c', 'c_pf']
                ]);
                const header = Array.from(headerMap.values()).join(',');
                writeFileSync(this.outputFile, header + '\n');
                this.log('Created CSV file with header (22 fields)');
            }
            
            this.log('Data collection started successfully');
            this.updateStatus('running');
            
            // Main collection loop
            while (this.isRunning) {
                const readingStart = Date.now();
                
                try {
                    await this.readSensorData();
                    this.updateStatus('running');
                } catch (error) {
                    this.updateStatus('error');
                    
                    if (this.consecutiveErrors >= this.maxRetries) {
                        this.log('Maximum retry limit reached. Stopping collection.', 'error');
                        break;
                    }
                    
                    // Wait before retrying
                    this.log(`Waiting ${this.retryDelayMs}ms before retry...`, 'warn');
                    await this.sleep(this.retryDelayMs);
                    continue;
                }
                
                // Wait for the remaining interval time
                const elapsed = Date.now() - readingStart;
                const waitTime = Math.max(0, this.intervalMs - elapsed);
                
                if (waitTime > 0 && this.isRunning) {
                    await this.sleep(waitTime);
                }
            }
            
        } catch (error) {
            this.log(`Data collection failed: ${error.message}`, 'error');
            this.updateStatus('failed');
        } finally {
            await this.disconnect();
            this.isRunning = false;
            
            const duration = this.startTime ? Date.now() - new Date(this.startTime).getTime() : 0;
            this.log(`Data collection stopped. Total readings: ${this.readingCount}, Duration: ${Math.round(duration / 1000)}s`);
            this.updateStatus('stopped');
        }
    }
    
    stop(reason = 'Manual stop') {
        if (!this.isRunning) {
            this.log('Data collection is not running', 'warn');
            return;
        }
        
        this.log(`Stopping data collection: ${reason}`);
        this.isRunning = false;
        this.updateStatus('stopping');
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    static getStatus() {
        try {
            if (existsSync(STATUS_FILE)) {
                const statusData = JSON.parse(readFileSync(STATUS_FILE, 'utf8'));
                return statusData;
            }
        } catch (error) {
            console.error('Failed to read status file:', error.message);
        }
        
        return {
            isRunning: false,
            status: 'unknown',
            lastUpdate: null
        };
    }
}

// CLI interface
async function runCollector(options) {
    const collector = new DataCollector(options);
    await collector.start();
}

// Command line interface
const cli = new Command('data-collector');

cli
    .description('Standalone data collector for Shelly 3EM devices')
    .option('--shelly <ip>', 'Shelly device IP address')
    .option('-o, --output <file>', 'Output file path', join(DATA_DIR, 'readings.csv'))
    .option('-i, --interval <ms>', 'Reading interval in milliseconds', '1000')
    .option('--max-retries <count>', 'Maximum consecutive errors before stopping', '5')
    .option('--retry-delay <ms>', 'Delay between retries in milliseconds', '5000')
    .option('--connection-type <type>', 'Connection type: DIRECT or WEB', 'DIRECT')
    .option('--device-id <id>', 'Device ID for WEB connection')
    .option('--auth-key <key>', 'Auth Key for WEB connection')
    .option('--device-type <type>', 'Device type: trifase or monofase', 'trifase')
    .action((options) => {
        const type = (options.connectionType || 'DIRECT').toUpperCase();
        if (type === 'DIRECT') {
            if (!options.shelly) {
                console.error('Error: Shelly IP address is required for DIRECT data collection');
                process.exit(1);
            }
        } else if (type === 'WEB') {
            if (!options.deviceId || !options.authKey) {
                console.error('Error: Device ID and Auth Key are required for WEB data collection');
                process.exit(1);
            }
        } else {
            console.error('Error: Unknown connection type. Use DIRECT or WEB.');
            process.exit(1);
        }
        runCollector(options);
    });

// Status command
cli
    .command('status')
    .description('Show current data collection status')
    .action(() => {
        const status = DataCollector.getStatus();
        console.log('Data Collection Status:');
        console.log(JSON.stringify(status, null, 2));
    });

// Stop command
cli
    .command('stop')
    .description('Stop running data collection')
    .action(() => {
        const status = DataCollector.getStatus();
        if (status.isRunning) {
            console.log('Sending stop signal to data collector...');
            // This would need to be implemented with process management
            console.log('Note: Use Ctrl+C to stop if running in foreground, or kill the process if running in background');
        } else {
            console.log('No data collection is currently running');
        }
    });

// Export for use by server
export { DataCollector };

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    cli.parse();
} 