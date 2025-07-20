#!/usr/bin/env node
import { createServer } from 'http';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;

// Data collection state
let dataCollectionProcess = null;
let currentDeviceIP = null;

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.csv': 'text/csv',
  '.json': 'application/json'
};

// Helper function to read request body
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', reject);
  });
}

// Helper function to parse CSV file
function parseCSV(csvContent, hasHeader = true) {
  const lines = csvContent.trim().split('\n');
  if (hasHeader) {
    lines.shift(); // Remove header
  }
  return lines.map(line => line.trim()).filter(line => line.length > 0);
}

// Helper function to parse appliances CSV
function parseAppliancesCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  lines.shift(); // Remove header
  const appliances = {};
  
  lines.forEach(line => {
    // Handle CSV parsing with proper comma handling
    // Split by comma, but handle quoted fields properly
    const lastCommaIndex = line.lastIndexOf(',');
    if (lastCommaIndex === -1) return; // Skip malformed lines
    
    const name = line.substring(0, lastCommaIndex).trim();
    const consumption = line.substring(lastCommaIndex + 1).trim();
    
    if (name && consumption) {
      appliances[name] = parseInt(consumption);
    }
  });
  
  return appliances;
}

// API handlers
async function handleStartCollection(req, res) {
  try {
    const body = await getRequestBody(req);
    const { deviceIP, connectionType = 'DIRECT', deviceId, authKey, deviceType = 'trifase' } = JSON.parse(body);
    
    if (connectionType === 'DIRECT') {
      if (!deviceIP) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Device IP is required for DIRECT connection' }));
        return;
      }
    } else if (connectionType === 'WEB') {
      if (!deviceId || !authKey) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Device ID and Auth Key are required for WEB connection' }));
        return;
      }
    }
    
    // Stop any existing data collection process
    if (dataCollectionProcess) {
      console.log('Stopping existing data collection process...');
      dataCollectionProcess.kill('SIGTERM');
      dataCollectionProcess = null;
      
      // Wait a moment for the process to stop
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Detect Windows platform and use appropriate collector
    const isWindows = process.platform === 'win32';
    const collectorScript = isWindows ? 'windows-data-collector.js' : 'bin/data-collector.js';
    
    // Start new data collection process using the appropriate collector
    // Use 3-second interval for WEB mode to avoid rate limiting, 1-second for DIRECT mode
    const interval = connectionType === 'WEB' ? '3000' : '1000';
    const args = [
      collectorScript,
      '--output', join(__dirname, 'data', 'readings.csv'),
      '--interval', interval,
      '--max-retries', '10',
      '--retry-delay', '5000',
      '--connection-type', connectionType
    ];
    
    if (connectionType === 'DIRECT') {
      args.push('--shelly', deviceIP);
    } else if (connectionType === 'WEB') {
      args.push('--device-id', deviceId, '--auth-key', authKey, '--device-type', deviceType);
    }
    
    console.log(`Starting data collection with args:`, args);
    
    dataCollectionProcess = spawn('node', args, {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false, // Keep attached so we can manage it
      // Windows-specific options
      ...(isWindows && {
        windowsHide: true,
        shell: false
      }),
      // Add environment variables for debugging
      env: {
        ...process.env,
        DEBUG: 'shelly:*',
        NODE_PATH: join(__dirname, 'node_modules')
      }
    });
    
    currentDeviceIP = deviceIP;
    
    // Enhanced debugging for process lifecycle
    console.log(`📊 Process spawn details:`, {
      platform: process.platform,
      cwd: __dirname,
      script: collectorScript,
      args: args,
      isWindows: isWindows
    });
    
    dataCollectionProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      // Log important messages and also log first few messages for debugging
      if (message.includes('Connected to device') || 
          message.includes('Device found') ||
          message.includes('Data collection started') ||
          message.includes('Data collection stopped') ||
          message.includes('ERROR') ||
          message.includes('WARN') ||
          message.includes('Starting data collection') ||
          message.includes('Connecting to') ||
          (message.includes('Reading') && message.includes('60:'))) { // Log every minute
        console.log(`Data Collector: ${message}`);
      }
    });
    
    dataCollectionProcess.stderr.on('data', (data) => {
      const errorMessage = data.toString().trim();
      console.error(`Data Collector Error: ${errorMessage}`);
      // Log module errors specifically
      if (errorMessage.includes('MODULE_NOT_FOUND') || errorMessage.includes('Cannot find module')) {
        console.error(`🔍 Module resolution issue detected:`, {
          error: errorMessage,
          cwd: __dirname,
          platform: process.platform
        });
      }
    });
    
    let processExited = false;
    // Track process start time
    const processStartTime = Date.now();
    
    dataCollectionProcess.on('close', (code, signal) => {
      if (processExited) return;
      processExited = true;
      
      console.log(`📊 Data collection process lifecycle:`, {
        code: code,
        signal: signal,
        platform: process.platform,
        collector: collectorScript,
        timeAlive: Date.now() - processStartTime
      });
      
      // If process exits immediately (code 0, signal null), there might be a problem
      if (code === 0 && signal === null) {
        const aliveTime = Date.now() - processStartTime;
        console.log(`⚠️  Process exited immediately after ${aliveTime}ms. Analyzing...`);
        
        if (aliveTime < 2000) { // Less than 2 seconds
          console.log('🔧 Trying Windows-optimized collector as fallback...');
          
          // Try with Windows collector as fallback
          const fallbackArgs = [
            'windows-data-collector.js',
            '--shelly', deviceIP,
            '--output', join(__dirname, 'data', 'readings.csv'),
            '--interval', '1000',
            '--max-retries', '10',
            '--retry-delay', '5000'
          ];
          
          console.log(`🔄 Fallback spawn details:`, {
            script: 'windows-data-collector.js',
            args: fallbackArgs,
            cwd: __dirname
          });
          
          dataCollectionProcess = spawn('node', fallbackArgs, {
            cwd: __dirname,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false,
            env: {
              ...process.env,
              DEBUG: 'shelly:*',
              NODE_PATH: join(__dirname, 'node_modules')
            }
          });
          
          dataCollectionProcess.stdout.on('data', (data) => {
            const message = data.toString().trim();
            console.log(`Fallback Collector: ${message}`);
          });
          
          dataCollectionProcess.stderr.on('data', (data) => {
            console.error(`Fallback Collector Error: ${data.toString().trim()}`);
          });
          
          dataCollectionProcess.on('close', (code, signal) => {
            console.log(`📊 Fallback collector final result:`, {
              code: code,
              signal: signal,
              platform: process.platform
            });
            dataCollectionProcess = null;
            currentDeviceIP = null;
          });
          
          return;
        }
      }
      
      dataCollectionProcess = null;
      currentDeviceIP = null;
    });
    
    dataCollectionProcess.on('error', (error) => {
      console.error(`Failed to start data collection process: ${error.message}`);
      dataCollectionProcess = null;
      currentDeviceIP = null;
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      message: `${isWindows ? 'Windows-optimized' : 'Enhanced'} data collection started from ${deviceIP}`,
      collector: isWindows ? 'Windows-optimized' : 'Standard',
      deviceIP: deviceIP,
      outputFile: join(__dirname, 'data', 'readings.csv'),
      features: [
        'Independent background process',
        'Automatic error recovery',
        'Detailed logging',
        'Status monitoring',
        'Graceful shutdown handling',
        ...(isWindows ? ['Windows compatibility optimizations'] : [])
      ]
    }));
    
  } catch (error) {
    console.error('Error starting data collection:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

async function handleStopCollection(req, res) {
  try {
    if (dataCollectionProcess) {
      console.log('Sending SIGTERM to data collection process...');
      dataCollectionProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      const timeout = setTimeout(() => {
        if (dataCollectionProcess) {
          console.log('Force killing data collection process...');
          dataCollectionProcess.kill('SIGKILL');
        }
      }, 5000);
      
      dataCollectionProcess.on('close', () => {
        clearTimeout(timeout);
      });
      
      dataCollectionProcess = null;
      currentDeviceIP = null;
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'Data collection stopped gracefully' 
      }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'No data collection was running' 
      }));
    }
  } catch (error) {
    console.error('Error stopping data collection:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

async function handleCollectionStatus(req, res) {
  try {
    let collectorStatus = {
      isRunning: false,
      status: 'unknown',
      lastUpdate: null,
      platform: process.platform
    };

    // Only check status file, do not start or import any collector
    try {
      const statusFile = process.platform === 'win32'
        ? 'data/collector-status.json'
        : 'data/collector-status.json';
      const statusPath = join(__dirname, statusFile);
      if (existsSync(statusPath)) {
        const statusData = JSON.parse(readFileSync(statusPath, 'utf8'));
        collectorStatus = { ...collectorStatus, ...statusData };
      }
    } catch (importError) {
      console.log('[SERVER] Could not read collector status file:', importError.message);
    }

    // Combine with process status
    const status = {
      processRunning: dataCollectionProcess !== null,
      deviceIP: currentDeviceIP,
      ...collectorStatus
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  } catch (error) {
    console.error('[SERVER] Error getting collection status:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

async function handleTestIP(req, res) {
  try {
    const body = await getRequestBody(req);
    const { ip } = JSON.parse(body);
    
    if (!ip) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'IP address is required' }));
      return;
    }
    
    console.log(`🔍 Testing IP: ${ip}`);
    
    // Only test /shelly endpoint since it's the only one that works for Shelly devices
    const endpoint = '/shelly';
    const results = {};
    
    try {
      console.log(`📡 Trying ${ip}${endpoint}...`);
      
      const response = await fetch(`http://${ip}${endpoint}`, {
        signal: AbortSignal.timeout(3000) // Reduced timeout for faster scanning
      });
      
      if (response.ok) {
        const data = await response.json();
        results[endpoint] = {
          success: true,
          status: response.status,
          data: data,
          keys: Object.keys(data),
          // Analysis for Shelly detection
          analysis: {
            hasType: !!data.type,
            hasDevice: !!data.device,
            hasMac: !!data.mac,
            hasRelays: !!data.relays,
            hasEmeters: !!data.emeters,
            hasMeters: !!data.meters,
            hasWifiSta: !!data.wifi_sta,
            hasCloud: !!data.cloud,
            hasMqtt: !!data.mqtt,
            hasFw: !!data.fw,
            hasApp: !!data.app,
            hasPower: !!(data.apower || data.apower_a || data.power),
            hasVoltage: !!(data.voltage || data.voltage_a),
            hasCurrent: !!(data.current || data.current_a)
          }
        };
        console.log(`✅ ${endpoint}: Success - Found ${data.app || data.type || 'Shelly device'}`);
      } else {
        results[endpoint] = {
          success: false,
          status: response.status,
          error: `HTTP ${response.status} ${response.statusText}`
        };
        console.log(`❌ ${endpoint}: HTTP ${response.status}`);
      }
    } catch (error) {
      results[endpoint] = {
        success: false,
        error: error.message
      };
      // Only log if it's not a common network error (to reduce noise)
      if (!error.message.includes('fetch failed') && !error.message.includes('ECONNREFUSED')) {
        console.log(`❌ ${endpoint}: ${error.message}`);
      }
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      ip: ip,
      results: results,
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    console.error('Error testing IP:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

async function handleClearData(req, res) {
  try {
    const csvPath = join(__dirname, 'test-readings.csv');
    
    // Clear the CSV file by writing an empty string
    writeFileSync(csvPath, '');
    
    console.log('📊 CSV data file cleared');
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      message: 'CSV data cleared successfully' 
    }));
    
  } catch (error) {
    console.error('Error clearing CSV data:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

async function handleSaveConfig(req, res) {
  try {
    const body = await getRequestBody(req);
    const { filename, data } = JSON.parse(body);
    
    if (!filename || !data) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Filename and data are required' }));
      return;
    }
    
    const filePath = join(__dirname, filename);
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    console.log(`💾 Configuration saved to: ${filename}`);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      message: `Configuration saved to ${filename}` 
    }));
    
  } catch (error) {
    console.error('Error saving configuration:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

async function handleSaveTracking(req, res) {
  try {
    const body = await getRequestBody(req);
    const { filename, data } = JSON.parse(body);
    
    if (!filename || !data) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Filename and data are required' }));
      return;
    }
    
    const filePath = join(__dirname, filename);
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    console.log(`📊 Tracking data saved to: ${filename}`);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      message: `Tracking data saved to ${filename}` 
    }));
    
  } catch (error) {
    console.error('Error saving tracking data:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

async function handleLoadConfig(req, res) {
  try {
    const filePath = join(__dirname, 'shelly-environment-config.json');
    
    if (!existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Configuration file not found' }));
      return;
    }
    
    const data = readFileSync(filePath, 'utf8');
    const config = JSON.parse(data);
    
    console.log('📋 Configuration loaded from file');
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(config));
    
  } catch (error) {
    console.error('Error loading configuration:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

async function handleLoadTracking(req, res) {
  try {
    const trackingPath = join(__dirname, 'shelly-tracking-data.json');
    
    if (!existsSync(trackingPath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        deviceAssociations: [],
        learningData: [],
        eventHistory: [],
        deviceEvents: [],
        consumptionPatterns: []
      }));
      return;
    }
    
    const trackingData = readFileSync(trackingPath, 'utf8');
    console.log('📊 Tracking data loaded from file');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(trackingData);
  } catch (error) {
    console.error('Error loading tracking data:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

async function handleSaveConsumptionEvent(req, res) {
  try {
    const body = await getRequestBody(req);
    const eventData = JSON.parse(body);
    
    // Check if this is a clear request
    if (eventData.clear === true) {
      const eventsPath = join(__dirname, 'consumption_events_for_browser.json');
      writeFileSync(eventsPath, JSON.stringify([], null, 2));
      console.log('Cleared all consumption events');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'All events cleared successfully',
        totalEvents: 0
      }));
      return;
    }
    
    // Validate event data
    if (!eventData.id || !eventData.phase || !eventData.type || !eventData.startTime || !eventData.endTime) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid event data - missing required fields' }));
      return;
    }
    
    const eventsPath = join(__dirname, 'consumption_events_for_browser.json');
    
    // Load existing events
    let existingEvents = [];
    if (existsSync(eventsPath)) {
      try {
        const existingData = readFileSync(eventsPath, 'utf8');
        existingEvents = JSON.parse(existingData);
      } catch (parseError) {
        console.warn('Error parsing existing events file, starting fresh:', parseError.message);
        existingEvents = [];
      }
    }
    
    // Check for existing event in the same time interval and phase
    const existingEventIndex = existingEvents.findIndex(existingEvent => 
      existingEvent.phase === eventData.phase &&
      existingEvent.startTime === eventData.startTime &&
      existingEvent.endTime === eventData.endTime
    );
    
    if (existingEventIndex !== -1) {
      // Replace the existing event with the new one
      const oldEvent = existingEvents[existingEventIndex];
      existingEvents[existingEventIndex] = eventData;
      
      console.log(`Replaced existing event ${oldEvent.id} with new event ${eventData.id} for phase ${eventData.phase} (${eventData.startTime} - ${eventData.endTime})`);
      
      // Save updated events
      writeFileSync(eventsPath, JSON.stringify(existingEvents, null, 2));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        message: 'Event replaced successfully',
        eventId: eventData.id,
        oldEventId: oldEvent.id,
        totalEvents: existingEvents.length,
        replaced: true
      }));
      return;
    }
    
    // Generate a unique ID if the current one might conflict
    const maxExistingId = existingEvents.length > 0 ? Math.max(...existingEvents.map(e => parseInt(e.id) || 0)) : 0;
    if (parseInt(eventData.id) <= maxExistingId) {
      eventData.id = maxExistingId + 1;
    }
    
    // Add new event
    existingEvents.push(eventData);
    
    // Save updated events
    writeFileSync(eventsPath, JSON.stringify(existingEvents, null, 2));
    
    console.log(`Saved consumption event ${eventData.id} for phase ${eventData.phase} (${eventData.type})`);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      message: 'Event saved successfully',
      eventId: eventData.id,
      totalEvents: existingEvents.length,
      duplicate: false
    }));
    
  } catch (error) {
    console.error('Error saving consumption event:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

// API handler for device types from Appliances CSV
async function handleGetDeviceTypes(req, res) {
  try {
    const appliancesPath = join(__dirname, 'data', 'Appliances.csv');
    
    if (!existsSync(appliancesPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Appliances CSV file not found' }));
      return;
    }
    
    const csvContent = readFileSync(appliancesPath, 'utf8');
    const appliances = parseAppliancesCSV(csvContent);
    
    // Extract device type names and sort them
    const deviceTypes = Object.keys(appliances).sort();
    
    console.log(`📋 Loaded ${deviceTypes.length} device types from Appliances.csv`);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ deviceTypes }));
    
  } catch (error) {
    console.error('Error loading device types from Appliances CSV:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

// API handler for appliances consumption data
async function handleGetAppliances(req, res) {
  try {
    const appliancesPath = join(__dirname, 'data', 'Appliances.csv');
    
    if (!existsSync(appliancesPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Appliances CSV file not found' }));
      return;
    }
    
    const csvContent = readFileSync(appliancesPath, 'utf8');
    const appliances = parseAppliancesCSV(csvContent);
    
    console.log(`📊 Loaded ${Object.keys(appliances).length} appliances from CSV`);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ appliances }));
    
  } catch (error) {
    console.error('Error loading appliances from CSV:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

// API handler to get suggested consumption for a device type
async function handleGetSuggestedConsumption(req, res) {
  try {
    const body = await getRequestBody(req);
    const { deviceType } = JSON.parse(body);
    
    if (!deviceType) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Device type is required' }));
      return;
    }
    
    const appliancesPath = join(__dirname, 'data', 'Appliances.csv');
    
    if (!existsSync(appliancesPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Appliances CSV file not found' }));
      return;
    }
    
    const csvContent = readFileSync(appliancesPath, 'utf8');
    const appliances = parseAppliancesCSV(csvContent);
    
    // Try to find exact match first
    let suggestedConsumption = appliances[deviceType];
    let matchType = 'exact';
    
    // If no exact match, try to find similar device types
    if (!suggestedConsumption) {
      const deviceTypeLower = deviceType.toLowerCase();
      const similarKeys = Object.keys(appliances).filter(key => 
        key.toLowerCase().includes(deviceTypeLower) || 
        deviceTypeLower.includes(key.toLowerCase())
      );
      
      if (similarKeys.length > 0) {
        suggestedConsumption = appliances[similarKeys[0]];
        matchType = 'similar';
      }
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      deviceType,
      suggestedConsumption: suggestedConsumption || null,
      matchType,
      available: !!suggestedConsumption
    }));
    
  } catch (error) {
    console.error('Error getting suggested consumption:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

// API handler to add a new device type to the Appliances CSV file
async function handleAddDeviceType(req, res) {
  try {
    const body = await getRequestBody(req);
    const { deviceType, wattage } = JSON.parse(body);
    
    if (!deviceType || typeof deviceType !== 'string' || deviceType.trim() === '') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Device type name is required' }));
      return;
    }
    
    if (typeof wattage !== 'number' || wattage < 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Valid wattage value is required (0 or greater)' }));
      return;
    }
    
    const appliancesPath = join(__dirname, 'data', 'Appliances.csv');
    
    // Read existing appliances
    let appliances = {};
    if (existsSync(appliancesPath)) {
      const appliancesContent = readFileSync(appliancesPath, 'utf8');
      appliances = parseAppliancesCSV(appliancesContent);
    }
    
    // Check if device type already exists (case-insensitive)
    const existingType = Object.keys(appliances).find(type => 
      type.toLowerCase() === deviceType.toLowerCase()
    );
    
    if (existingType) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Device type already exists' }));
      return;
    }
    
    // Add new device type
    appliances[deviceType] = wattage;
    
    // Write updated Appliances.csv
    const appliancesContent = 'Nome dispositivo,Consumo (Watt)\n' + 
      Object.entries(appliances)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, consumption]) => `${name},${consumption}`)
        .join('\n') + '\n';
    writeFileSync(appliancesPath, appliancesContent, 'utf8');
    
    console.log(`✅ Added device type "${deviceType}" with ${wattage}W to Appliances.csv`);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      message: `Device type "${deviceType}" added successfully with ${wattage}W`,
      deviceType,
      wattage
    }));
    
  } catch (error) {
    console.error('Error adding device type:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

// API handler to remove a device type from the Appliances CSV file
async function handleRemoveDeviceType(req, res) {
  try {
    const body = await getRequestBody(req);
    const { deviceType } = JSON.parse(body);
    
    if (!deviceType || typeof deviceType !== 'string' || deviceType.trim() === '') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Device type name is required' }));
      return;
    }
    
    const appliancesPath = join(__dirname, 'data', 'Appliances.csv');
    
    if (!existsSync(appliancesPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Appliances CSV file not found' }));
      return;
    }
    
    // Read existing appliances
    const appliancesContent = readFileSync(appliancesPath, 'utf8');
    const appliances = parseAppliancesCSV(appliancesContent);
    
    // Check if device type exists (case-insensitive)
    const existingType = Object.keys(appliances).find(type => 
      type.toLowerCase() === deviceType.toLowerCase()
    );
    
    if (!existingType) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Device type not found' }));
      return;
    }
    
    // Remove the device type
    delete appliances[existingType];
    
    // Write updated Appliances.csv
    const updatedContent = 'Nome dispositivo,Consumo (Watt)\n' + 
      Object.entries(appliances)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, consumption]) => `${name},${consumption}`)
        .join('\n') + '\n';
    writeFileSync(appliancesPath, updatedContent, 'utf8');
    
    console.log(`🗑️ Removed device type "${existingType}" from Appliances.csv`);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      message: `Device type "${existingType}" removed successfully`,
      deviceType: existingType
    }));
    
  } catch (error) {
    console.error('Error removing device type:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

const server = createServer(async (req, res) => {
  try {
    // Log all incoming requests
    console.log(`[SERVER] ${req.method} ${req.url}`);
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      if (body) {
        console.log(`[SERVER] Request body: ${body}`);
      }
    });
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle API endpoints
    if (req.method === 'POST' && req.url === '/start-collection') {
      return handleStartCollection(req, res);
    }
    
    if (req.method === 'POST' && req.url === '/stop-collection') {
      return handleStopCollection(req, res);
    }
    
    if (req.method === 'GET' && req.url === '/collection-status') {
      return handleCollectionStatus(req, res);
    }

    // New endpoint for testing specific IPs
    if (req.method === 'POST' && req.url === '/test-ip') {
      return handleTestIP(req, res);
    }

    // New endpoint for clearing CSV data
    if (req.method === 'POST' && req.url === '/clear-data') {
      return handleClearData(req, res);
    }

    // New endpoints for file-based configuration storage
    if (req.method === 'POST' && req.url === '/api/save-config') {
      return handleSaveConfig(req, res);
    }

    if (req.method === 'POST' && req.url === '/api/save-tracking') {
      return handleSaveTracking(req, res);
    }

    // New endpoints for loading configuration and tracking data
    if (req.method === 'GET' && req.url === '/api/load-config') {
      return handleLoadConfig(req, res);
    }

    if (req.method === 'GET' && req.url === '/api/load-tracking') {
      return handleLoadTracking(req, res);
    }

    // New endpoint for saving consumption event
    if (req.method === 'POST' && req.url === '/api/save-consumption-event') {
      return handleSaveConsumptionEvent(req, res);
    }

    // New endpoints for device types and appliances
    if (req.method === 'GET' && req.url === '/api/get-device-types') {
      return handleGetDeviceTypes(req, res);
    }

    if (req.method === 'GET' && req.url === '/api/get-appliances') {
      return handleGetAppliances(req, res);
    }

    if (req.method === 'POST' && req.url === '/api/get-suggested-consumption') {
      return handleGetSuggestedConsumption(req, res);
    }

    if (req.method === 'POST' && req.url === '/api/add-device-type') {
      return handleAddDeviceType(req, res);
    }

    if (req.method === 'POST' && req.url === '/api/remove-device-type') {
      return handleRemoveDeviceType(req, res);
    }

    // Handle static files
    let filePath = req.url === '/' ? '/graphs.html' : req.url;
    
    // Remove query parameters for file path
    filePath = filePath.split('?')[0];
    
    const fullPath = join(__dirname, filePath);
    const ext = extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';

    try {
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error: ' + error.message);
    }
  } catch (err) {
    console.error('[SERVER] Uncaught error in request handler:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', details: err.message }));
  }
});

process.on('uncaughtException', (err) => {
  console.error('[SERVER] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Unhandled Rejection:', reason);
});

server.listen(PORT, () => {
  console.log(`[SERVER] 🚀 Dashboard server running at http://localhost:${PORT}`);
  console.log(`[SERVER] 📊 Open http://localhost:${PORT} to view the readings dashboard`);
  console.log(`[SERVER] 📁 Serving files from: ${__dirname}`);
  console.log(`[SERVER] 📈 CSV file: ${join(__dirname, 'test-readings.csv')}`);
  console.log('[SERVER] Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[SERVER] 👋 Shutting down server...');
  
  // Stop data collection if running
  if (dataCollectionProcess) {
    console.log('[SERVER] 🛑 Stopping data collection...');
    dataCollectionProcess.kill();
    dataCollectionProcess = null;
  }
  
  server.close(() => {
    console.log('[SERVER] ✅ Server stopped');
    process.exit(0);
  });
}); 