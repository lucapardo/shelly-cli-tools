#!/usr/bin/env node

/**
 * Windows-optimized Data Collector for Shelly 3EM devices
 * Handles process management and error recovery better on Windows
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Command } from 'commander';

// Get current directory for Windows compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');
const STATUS_FILE = join(DATA_DIR, 'collector-status.json');
const LOG_FILE = join(DATA_DIR, 'collector.log');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

// Windows-specific improvements
const isWindows = process.platform === 'win32';

// Debug log for module loading
console.log(`🔧 Windows Data Collector loaded - Platform: ${process.platform}, Windows: ${isWindows}`);

class WindowsDataCollector {
    constructor(options = {}) {
        this.shellyIP = options.shelly;
        this.outputFile = options.output || join(DATA_DIR, 'readings.csv');
        this.intervalMs = parseInt(options.interval) || 1000;
        this.maxRetries = parseInt(options.maxRetries) || 5;
        this.retryDelayMs = parseInt(options.retryDelay) || 5000;
        this.device = null;
        this.isRunning = false;
        this.readingCount = 0;
        this.consecutiveErrors = 0;
        this.startTime = null;
        this.lastSuccessfulReading = null;
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        
        console.log(logMessage);
        
        // Append to log file for Windows debugging
        try {
            appendFileSync(LOG_FILE, logMessage + '\n');
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
            lastUpdate: new Date().toISOString(),
            platform: process.platform,
            isWindows: isWindows
        };

        try {
            writeFileSync(STATUS_FILE, JSON.stringify(statusData, null, 2));
        } catch (error) {
            this.log(`Failed to update status file: ${error.message}`, 'error');
        }
    }

    async testConnection() {
        try {
            this.log(`Testing connection to Shelly device at ${this.shellyIP}...`);
            
            // Simple HTTP test first
            const response = await fetch(`http://${this.shellyIP}/shelly`, {
                signal: AbortSignal.timeout(5000),
                headers: {
                    'User-Agent': 'Shelly-Data-Collector/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.log(`Device found: ${data.type || 'Unknown'} (${data.mac || 'No MAC'})`);
            return true;

        } catch (error) {
            this.log(`Connection test failed: ${error.message}`, 'error');
            return false;
        }
    }

    async readSensorData() {
        try {
            // Use direct HTTP call for better Windows compatibility
            const response = await fetch(`http://${this.shellyIP}/rpc/EM.GetStatus?id=0`, {
                signal: AbortSignal.timeout(10000),
                headers: {
                    'User-Agent': 'Shelly-Data-Collector/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Process the reading data
            const timestamp = Math.floor(Date.now() / 1000);
            const csvLine = [
                'DEVICE_ID', // Placeholder for device ID
                timestamp,
                this.readingCount,
                data.a_voltage || 0,
                data.b_voltage || 0,
                data.c_voltage || 0,
                data.a_current || 0,
                data.b_current || 0,
                data.c_current || 0,
                '', // Empty field
                data.a_act_power || 0,
                data.b_act_power || 0,
                data.c_act_power || 0,
                data.a_aprt_power || 0,
                data.b_aprt_power || 0,
                data.c_aprt_power || 0,
                data.a_pf || 0,
                data.b_pf || 0,
                data.c_pf || 0
            ].join(',');

            // Write to CSV file
            appendFileSync(this.outputFile, csvLine + '\n');

            this.readingCount++;
            this.lastSuccessfulReading = new Date().toISOString();
            this.consecutiveErrors = 0;

            // Log every 60 readings (1 minute at 1-second intervals)
            if (this.readingCount % 60 === 0) {
                this.log(`Reading ${this.readingCount}: Power A=${data.a_act_power}W, B=${data.b_act_power}W, C=${data.c_act_power}W`);
            }

            return data;

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

        this.log(`Starting Windows-optimized data collection from ${this.shellyIP}`);
        this.log(`Output file: ${this.outputFile}`);
        this.log(`Interval: ${this.intervalMs}ms`);
        this.log(`Platform: ${process.platform} (Windows: ${isWindows})`);
        this.updateStatus('starting');

        // Test connection first
        const connectionOk = await this.testConnection();
        if (!connectionOk) {
            this.log('Initial connection test failed. Continuing anyway...', 'warn');
        }

        // Write CSV header if file doesn't exist
        if (!existsSync(this.outputFile)) {
            const header = 'device_id,timestamp,reading_id,a_voltage,b_voltage,c_voltage,a_current,b_current,c_current,empty,a_act_power,b_act_power,c_act_power,a_aprt_power,b_aprt_power,c_aprt_power,a_pf,b_pf,c_pf';
            writeFileSync(this.outputFile, header + '\n');
        }

        try {
            this.log('Data collection started successfully');
            this.updateStatus('running');

            // Main collection loop with Windows-friendly error handling
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
            lastUpdate: null,
            platform: process.platform,
            isWindows: isWindows
        };
    }
}

// CLI interface
async function runCollector(options) {
    if (!options.shelly) {
        console.error('Error: Shelly IP address is required for data collection');
        console.log('Use "node windows-data-collector.js status" to check current status');
        process.exit(1);
    }

    const collector = new WindowsDataCollector(options);
    
    // Handle Windows process termination signals
    const gracefulShutdown = (signal) => {
        console.log(`\nReceived ${signal}. Shutting down gracefully...`);
        collector.stop(`Received ${signal}`);
        setTimeout(() => {
            process.exit(0);
        }, 2000);
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    
    if (isWindows) {
        process.on('SIGHUP', gracefulShutdown);
        // Handle Windows-specific signals
        process.on('SIGBREAK', gracefulShutdown);
    }

    await collector.start();
}

// Command line interface
const cli = new Command('windows-data-collector');

cli
    .description('Windows-optimized data collector for Shelly 3EM devices')
    .option('--shelly <ip>', 'Shelly device IP address')
    .option('-o, --output <file>', 'Output file path', join(DATA_DIR, 'readings.csv'))
    .option('-i, --interval <ms>', 'Reading interval in milliseconds', '1000')
    .option('--max-retries <count>', 'Maximum consecutive errors before stopping', '5')
    .option('--retry-delay <ms>', 'Delay between retries in milliseconds', '5000')
    .action(async (options) => {
        try {
            console.log('📊 Starting Windows data collector with options:', options);
            await runCollector(options);
        } catch (error) {
            console.error('❌ Windows Data Collector failed:', error.message);
            console.error('Stack trace:', error.stack);
            process.exit(1);
        }
    });

// Status command
cli
    .command('status')
    .description('Show current data collection status')
    .action(() => {
        const status = WindowsDataCollector.getStatus();
        console.log('Windows Data Collection Status:');
        console.log(JSON.stringify(status, null, 2));
    });

// Test command
cli
    .command('test <ip>')
    .description('Test connection to Shelly device')
    .action(async (ip) => {
        const collector = new WindowsDataCollector({ shelly: ip });
        const result = await collector.testConnection();
        process.exit(result ? 0 : 1);
    });

// Export for use by server
export { WindowsDataCollector };

// Run CLI if called directly - Windows-compatible check
if (import.meta.url === `file://${__filename}` || process.argv[1] === __filename) {
    console.log('🪟 Windows Data Collector starting...');
    cli.parse();
}