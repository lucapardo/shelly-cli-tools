#!/usr/bin/env node
import { readFileSync } from 'fs';
import { Command, Option } from 'commander';
import { Shelly3EM } from '@allterco/shelly/shelly-3em.js';
import { wsTransport } from '@allterco/transport/websocket.js';
import { mapToFile } from '../src/utils.js';
import { measurementFromDeviceEMStatus } from '../src/model.js';

const DEBUG = process.env.DEBUG || 'none';

async function continuousRead(options) {
  const _shellyIP = options.shelly;
  const _outputFileName = options.output;
  const _intervalMs = parseInt(options.interval) || 1000;
  const _durationMs = options.duration ? parseInt(options.duration) : null; // null means infinite
  
  console.log(`Shelly Pro 3EM device at ${_shellyIP}`);
  if (_durationMs) {
    console.log(`Reading every ${_intervalMs}ms for ${_durationMs}ms`);
  } else {
    console.log(`Reading every ${_intervalMs}ms continuously (until stopped)`);
  }
  
  const _transport = new wsTransport();
  const _testDev = new Shelly3EM(_transport);
  _transport.setDebug(DEBUG);
  _testDev.setDebug(DEBUG);

  try {
    await _transport.connect(_shellyIP);
    const _devInfo = await _testDev.getInfo();
    console.log(`Connected to device: ${_devInfo.mac}`);
    
    const startTime = Date.now();
    let readingCount = 0;
    let isRunning = true;
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      isRunning = false;
      console.log(`\nStopped after ${readingCount} readings`);
      process.exit(0);
    });
    
    // Main reading loop
    while (isRunning && (_durationMs === null || Date.now() - startTime < _durationMs)) {
      try {
        const readingStart = Date.now();
        const _status = await _testDev.EM.getStatus();
        const _measurement = measurementFromDeviceEMStatus(_status.response);
        const _resultMap = new Map([
          ['mac', _devInfo.mac],
          ['ts', Math.floor(Date.now() / 1000)],
          ['reading_id', readingCount++],
          ...Object.entries(_measurement),
        ]);
        
        // Reduced logging - only show reading count and timestamp
        if (readingCount % 10 === 0) {
          console.log(`Reading ${readingCount}: ${new Date().toISOString()}`);
        }
        
        if (_outputFileName) {
          mapToFile(_resultMap, _outputFileName);
        }
        
        // Wait for the remaining interval time
        const elapsed = Date.now() - readingStart;
        const waitTime = Math.max(0, _intervalMs - elapsed);
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
      } catch (e) {
        console.error('Reading error:', e.message);
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, _intervalMs));
      }
    }
    
    if (_durationMs) {
      console.log(`\nCompleted ${readingCount} readings in ${Date.now() - startTime}ms`);
    } else {
      console.log(`\nStopped after ${readingCount} readings (${Date.now() - startTime}ms elapsed)`);
    }
    
  } catch (e) {
    console.error('Device connection error', e);
    throw e;
  } finally {
    try {
      await _transport.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

const cli = new Command('continuous-read');

cli
  .description('Read device data continuously at specified intervals')
  .requiredOption('--shelly <shelly-ip>', 'Shelly IP address')
  .option('-o, --output <output-file>', 'File to output results to')
  .option('-i, --interval <ms>', 'Reading interval in milliseconds', '1000')
  .option('-d, --duration <ms>', 'Total duration in milliseconds (optional, runs indefinitely if not specified)')
  .action(continuousRead);

async function main() {
  return await cli.showHelpAfterError().parseAsync();
}

main()
  .then((_) => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(-1);
  }); 