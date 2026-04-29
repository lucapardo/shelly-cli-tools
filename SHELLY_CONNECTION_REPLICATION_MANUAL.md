# Manuale Tecnico IA - Single Source of Truth (Codice Completo)

Questo documento contiene **tutto il codice necessario** per ricreare da zero il sistema di connessione Shelly in un altro progetto, incluse:

- connessione `DIRECT` (LAN, WebSocket JSON-RPC)
- connessione `WEB` (Shelly Cloud API)
- normalizzazione delle misure
- persistenza CSV
- collector continuo con retry
- API server per start/stop/status

## 1) Struttura progetto consigliata

```text
shelly-replica/
  package.json
  server.js
  src/
    model.js
    utils.js
  transport/
    websocket.js
  shelly/
    shelly.js
    shelly-3em.js
  bin/
    data-collector.js
  data/
    (creata runtime)
```

## 2) package.json (minimo funzionante)

```json
{
  "name": "shelly-replica",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "collector": "node bin/data-collector.js"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "ws": "^8.18.0"
  }
}
```

## 3) Codice completo - trasporto WebSocket

File: `transport/websocket.js`

```js
import WebSocket from 'ws';
import { EventEmitter } from 'node:events';

const noop = () => {};

class WsTransport extends EventEmitter {
  constructor() {
    super();
    this.address = null;
    this.connected = false;
    this.ws = null;
    this.connectTimeoutMs = 1000;
    this.debug = noop;
  }

  setDebug(level) {
    this.debug = level === 'debug' ? console.log : noop;
  }

  setAddress(address) {
    this.address = address;
  }

  async connect(address = '') {
    if (address) this.setAddress(address);
    if (!this.address) throw new Error('No address provided');

    return new Promise((resolve, reject) => {
      this.debug('Connecting to', this.address);

      if (this.ws) this.ws.close();
      this.ws = new WebSocket(`ws://${this.address}/rpc`);

      const timer = setTimeout(() => {
        this.debug('Transport timeout');
        reject(new Error('Transport timeout'));
      }, this.connectTimeoutMs);

      this.ws.on('open', (event) => {
        clearTimeout(timer);
        this.connected = true;
        this.emit('connect', event);
        resolve(this);
      });

      this.ws.on('close', (event) => {
        this.connected = false;
        this.emit('close', event);
      });

      this.ws.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`WebSocket error: ${err.message}`));
      });

      this.ws.on('message', (event) => {
        this.emit('message', Buffer.from(event).toString('utf-8'));
      });
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }

  disconnect() {
    this.close();
  }

  send(message) {
    if (!this.ws || !this.connected) return;
    this.ws.send(message);
  }
}

export { WsTransport };
```

## 4) Codice completo - client Shelly JSON-RPC base

File: `shelly/shelly.js`

```js
import EventEmitter from 'events';

const noop = () => {};

class Shelly extends EventEmitter {
  constructor(transport) {
    super();
    this.transport = null;
    this.messageMap = new Map();
    this.messageCounter = 0;
    this.info = null;
    this.debug = noop;

    this.onTransportConnectRef = this.onTransportConnect.bind(this);
    this.onTransportMessageRef = this.onTransportMessage.bind(this);
    this.onTransportCloseRef = this.onTransportClose.bind(this);

    this.setTransport(transport);
  }

  setDebug(level) {
    this.debug = level === 'debug' ? console.log : noop;
  }

  setTransport(transport = null) {
    if (this.transport) {
      this.transport.close();
      this.transport.removeAllListeners('connect');
      this.transport.removeAllListeners('message');
      this.transport.removeAllListeners('close');
    }

    this.transport = transport;
    if (!transport) return;

    transport.addListener('connect', this.onTransportConnectRef);
    transport.addListener('message', this.onTransportMessageRef);
    transport.addListener('close', this.onTransportCloseRef);
  }

  async onTransportConnect() {
    this.info = await this.getInfo();
    this.emit('connect');
  }

  onTransportMessage(message) {
    this.messageHandler(message);
  }

  onTransportClose() {
    this.info = null;
    this.emit('close');
  }

  async getInfo() {
    const response = await this.request({ method: 'Shelly.GetDeviceInfo' });
    return response.response;
  }

  composeMessage({ method, params }) {
    return {
      jsonrpc: '2.0',
      id: `UID-${this.messageCounter++}`,
      src: 'shelly-client',
      method,
      ...(params && { params })
    };
  }

  messageHandler(rawMessage) {
    const parsed = JSON.parse(rawMessage);

    if (parsed.id && this.messageMap.has(parsed.id)) {
      const pending = this.messageMap.get(parsed.id);
      this.messageMap.delete(parsed.id);

      if (parsed.error) {
        pending.reject({
          response: parsed.error,
          method: pending.method
        });
      } else {
        pending.resolve({
          response: parsed.result,
          method: pending.method
        });
      }
      return;
    }

    this.emit('Notify', parsed);
  }

  async request({ method, params }) {
    const rpcMessage = this.composeMessage({ method, params });
    const encoded = JSON.stringify(rpcMessage);
    this.debug('SEND', encoded);
    this.transport.send(encoded);

    return new Promise((resolve, reject) => {
      this.messageMap.set(rpcMessage.id, { resolve, reject, method });
    });
  }
}

class DeviceComponent {
  constructor(device) {
    this._dev = device;
    this.name = this.constructor.name;
  }

  async getStatus(params) {
    return this._dev.request({ method: `${this.name}.GetStatus`, params });
  }

  async getConfig(params) {
    return this._dev.request({ method: `${this.name}.GetConfig`, params });
  }

  async setConfig(params) {
    return this._dev.request({ method: `${this.name}.SetConfig`, params });
  }
}

export { Shelly, DeviceComponent };
```

## 5) Codice completo - adapter Shelly 3EM

File: `shelly/shelly-3em.js`

```js
import { Shelly, DeviceComponent } from './shelly.js';

class EM extends DeviceComponent {
  async getStatus(id = 0) {
    return super.getStatus({ id });
  }
}

class Shelly3EM extends Shelly {
  constructor(transport) {
    super(transport);
    this.EM = new EM(this);
  }
}

export { Shelly3EM };
```

## 6) Codice completo - normalizzazione misure

File: `src/model.js`

```js
const MEASUREMENT = {
  voltage_a: 0,
  voltage_b: 0,
  voltage_c: 0,
  current_a: 0,
  current_b: 0,
  current_c: 0,
  current_n: 0,
  apower_a: 0,
  apower_b: 0,
  apower_c: 0,
  aprtpower_a: 0,
  aprtpower_b: 0,
  aprtpower_c: 0,
  angle_a: 0,
  angle_b: 0,
  angle_c: 0,
  pf_a: 0,
  pf_b: 0,
  pf_c: 0
};

function measurementFromDeviceEMStatus(statusResult) {
  const translate = {
    voltage: 'voltage',
    current: 'current',
    apower: 'act_power',
    aprtpower: 'aprt_power',
    pf: 'pf',
    angle: 'angle'
  };

  const buildMatch = new RegExp(
    `(${Object.keys(translate).join('|')})_(a|b|c|n)`
  );

  return Object.keys({ ...MEASUREMENT }).reduce((result, key) => {
    const match = key.match(buildMatch);
    const type = match[1];
    const phase = match[2];
    const mapped = `${phase}_${translate[type]}`;
    result[key] = statusResult[mapped];
    if (result[key] === undefined) result[key] = 0;
    return result;
  }, {});
}

export { measurementFromDeviceEMStatus };
```

## 7) Codice completo - utilita CSV

File: `src/utils.js`

```js
import { writeFileSync } from 'fs';

function mapToFile(map, fileName, filterFn) {
  const flattenMap = (inputMap) =>
    Array.from(inputMap.entries())
      .filter(([key, value]) => !filterFn || filterFn(key, value))
      .map(([, value]) => value)
      .join(',');

  writeFileSync(fileName, `${flattenMap(map)}\n`, { flag: 'a+' });
}

export { mapToFile };
```

## 8) Codice completo - collector DIRECT + WEB

File: `bin/data-collector.js`

```js
#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { WsTransport } from '../transport/websocket.js';
import { Shelly3EM } from '../shelly/shelly-3em.js';
import { mapToFile } from '../src/utils.js';
import { measurementFromDeviceEMStatus } from '../src/model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEBUG = process.env.DEBUG || 'none';
const DATA_DIR = join(__dirname, '..', 'data');
const STATUS_FILE = join(DATA_DIR, 'collector-status.json');
const LOG_FILE = join(DATA_DIR, 'collector.log');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

class DataCollector {
  constructor(options = {}) {
    this.shellyIP = options.shelly;
    this.connectionType = (options.connectionType || 'DIRECT').toUpperCase();
    this.deviceId = options.deviceId;
    this.authKey = options.authKey;
    this.deviceType = options.deviceType || 'trifase';
    this.outputFile = options.output || join(DATA_DIR, 'readings.csv');
    this.intervalMs = parseInt(options.interval || this.defaultInterval(), 10);
    this.maxRetries = parseInt(options.maxRetries || '5', 10);
    this.retryDelayMs = parseInt(options.retryDelay || '5000', 10);

    this.transport = null;
    this.device = null;
    this.isRunning = false;
    this.readingCount = 0;
    this.startTime = null;
    this.lastSuccessfulReading = null;
    this.consecutiveErrors = 0;

    process.on('SIGINT', () => this.stop('SIGINT'));
    process.on('SIGTERM', () => this.stop('SIGTERM'));
  }

  defaultInterval() {
    return this.connectionType === 'WEB' ? '2000' : '1000';
  }

  log(message, level = 'info') {
    const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
    console.log(line);
    writeFileSync(LOG_FILE, `${line}\n`, { flag: 'a+' });
  }

  updateStatus(status) {
    const payload = {
      isRunning: this.isRunning,
      shellyIP: this.shellyIP,
      outputFile: this.outputFile,
      intervalMs: this.intervalMs,
      readingCount: this.readingCount,
      startTime: this.startTime,
      lastSuccessfulReading: this.lastSuccessfulReading,
      consecutiveErrors: this.consecutiveErrors,
      status,
      lastUpdate: new Date().toISOString()
    };
    writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2));
  }

  async connectDirect() {
    this.transport = new WsTransport();
    this.device = new Shelly3EM(this.transport);
    if (DEBUG !== 'none') {
      this.transport.setDebug(DEBUG);
      this.device.setDebug(DEBUG);
    }
    await this.transport.connect(this.shellyIP);
    const info = await this.device.getInfo();
    this.log(`Connected DIRECT: ${info.mac}`);
    return info;
  }

  async connect() {
    if (this.connectionType === 'WEB') {
      this.log(`Connected WEB: ${this.deviceId}`);
      return { mac: this.deviceId };
    }
    return this.connectDirect();
  }

  cloudRequest() {
    const postData = JSON.stringify({
      ids: [this.deviceId],
      select: ['status']
    });

    const url = `https://shelly-174-eu.shelly.cloud/v2/devices/api/get?auth_key=${this.authKey}`;

    return new Promise((resolve, reject) => {
      const req = https.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => {
            raw += chunk;
          });
          res.on('end', () => {
            try {
              resolve(JSON.parse(raw));
            } catch {
              reject(new Error('Invalid JSON from cloud API'));
            }
          });
        }
      );
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  mapWebStatusToTrifase(statusObj) {
    if (this.deviceType === 'trifase') return statusObj['em:0'];

    const emeters = statusObj.emeters;
    if (!Array.isArray(emeters) || emeters.length === 0) {
      throw new Error('Invalid monofase payload: emeters missing');
    }

    const active = emeters[1] || emeters[0];
    const current = active.power && active.voltage ? active.power / active.voltage : 0;

    return {
      a_act_power: active.power || 0,
      a_aprt_power: active.reactive || 0,
      a_current: current,
      a_pf: active.pf || 0,
      a_voltage: active.voltage || 0,
      a_angle: 0,
      b_act_power: 0,
      b_aprt_power: 0,
      b_current: 0,
      b_pf: 0,
      b_voltage: 0,
      b_angle: 0,
      c_act_power: 0,
      c_aprt_power: 0,
      c_current: 0,
      c_pf: 0,
      c_voltage: 0,
      c_angle: 0,
      n_current: 0
    };
  }

  ensureCsvHeader() {
    if (existsSync(this.outputFile)) return;

    const header = [
      'device_id',
      'timestamp',
      'reading_id',
      'a_voltage',
      'b_voltage',
      'c_voltage',
      'a_current',
      'b_current',
      'c_current',
      'n_current',
      'a_act_power',
      'b_act_power',
      'c_act_power',
      'a_aprt_power',
      'b_aprt_power',
      'c_aprt_power',
      'a_angle',
      'b_angle',
      'c_angle',
      'a_pf',
      'b_pf',
      'c_pf'
    ].join(',');

    writeFileSync(this.outputFile, `${header}\n`);
  }

  writeReading(identity, measurement) {
    const resultMap = new Map([
      ['mac', identity],
      ['ts', Math.floor(Date.now() / 1000)],
      ['reading_id', this.readingCount],
      ...Object.entries(measurement)
    ]);
    mapToFile(resultMap, this.outputFile);
  }

  async readSensorData() {
    try {
      let measurement;

      if (this.connectionType === 'WEB') {
        const cloudData = await this.cloudRequest();
        const response = Array.isArray(cloudData) ? cloudData[0] : cloudData;
        if (!response || !response.status) throw new Error('Missing status in cloud response');

        const emPayload = this.mapWebStatusToTrifase(response.status);
        measurement = measurementFromDeviceEMStatus(emPayload);
        this.writeReading(this.deviceId || 'unknown', measurement);
      } else {
        const status = await this.device.EM.getStatus();
        measurement = measurementFromDeviceEMStatus(status.response);
        this.writeReading(this.device.info?.mac || 'unknown', measurement);
      }

      this.readingCount += 1;
      this.lastSuccessfulReading = new Date().toISOString();
      this.consecutiveErrors = 0;
      return measurement;
    } catch (error) {
      this.consecutiveErrors += 1;
      if (this.consecutiveErrors >= this.maxRetries) {
        throw new Error(`Too many errors (${this.consecutiveErrors}): ${error.message}`);
      }
      throw error;
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async start() {
    this.isRunning = true;
    this.startTime = new Date().toISOString();
    this.readingCount = 0;
    this.consecutiveErrors = 0;
    this.updateStatus('starting');
    this.ensureCsvHeader();

    await this.connect();
    this.updateStatus('running');

    while (this.isRunning) {
      const tickStart = Date.now();
      try {
        await this.readSensorData();
        this.updateStatus('running');
      } catch (error) {
        this.log(error.message, 'error');
        this.updateStatus('error');
        if (this.consecutiveErrors >= this.maxRetries) break;
        await this.sleep(this.retryDelayMs);
      }

      const elapsed = Date.now() - tickStart;
      const wait = Math.max(0, this.intervalMs - elapsed);
      if (this.isRunning && wait > 0) await this.sleep(wait);
    }

    this.isRunning = false;
    if (this.transport) this.transport.disconnect();
    this.updateStatus('stopped');
  }

  stop(reason = 'manual') {
    this.log(`Stopping collector: ${reason}`);
    this.isRunning = false;
    this.updateStatus('stopping');
  }

  static getStatus() {
    if (!existsSync(STATUS_FILE)) {
      return { isRunning: false, status: 'unknown', lastUpdate: null };
    }
    return JSON.parse(readFileSync(STATUS_FILE, 'utf8'));
  }
}

const cli = new Command('data-collector');

cli
  .option('--shelly <ip>')
  .option('--output <file>', join(DATA_DIR, 'readings.csv'))
  .option('--interval <ms>', '1000')
  .option('--max-retries <count>', '5')
  .option('--retry-delay <ms>', '5000')
  .option('--connection-type <type>', 'DIRECT')
  .option('--device-id <id>')
  .option('--auth-key <key>')
  .option('--device-type <type>', 'trifase')
  .action(async (options) => {
    const type = (options.connectionType || 'DIRECT').toUpperCase();
    if (type === 'DIRECT' && !options.shelly) {
      throw new Error('DIRECT requires --shelly');
    }
    if (type === 'WEB' && (!options.deviceId || !options.authKey)) {
      throw new Error('WEB requires --device-id and --auth-key');
    }
    const collector = new DataCollector(options);
    await collector.start();
  });

cli.command('status').action(() => {
  console.log(JSON.stringify(DataCollector.getStatus(), null, 2));
});

if (import.meta.url === `file://${process.argv[1]}`) {
  cli.parseAsync().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

export { DataCollector };
```

## 9) Codice completo - server API orchestratore

File: `server.js`

```js
#!/usr/bin/env node
import { createServer } from 'http';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 3000;

let dataCollectionProcess = null;
let currentDeviceIP = null;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString();
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function json(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function startCollection(req, res) {
  const body = JSON.parse(await readBody(req));
  const { deviceIP, connectionType = 'DIRECT', deviceId, authKey, deviceType = 'trifase' } = body;
  const type = connectionType.toUpperCase();

  if (type === 'DIRECT' && !deviceIP) return json(res, 400, { error: 'deviceIP required' });
  if (type === 'WEB' && (!deviceId || !authKey)) {
    return json(res, 400, { error: 'deviceId and authKey required' });
  }

  if (dataCollectionProcess) {
    dataCollectionProcess.kill('SIGTERM');
    dataCollectionProcess = null;
    await new Promise((r) => setTimeout(r, 500));
  }

  const interval = type === 'WEB' ? '3000' : '1000';
  const args = [
    'bin/data-collector.js',
    '--output', join(__dirname, 'data', 'readings.csv'),
    '--interval', interval,
    '--max-retries', '10',
    '--retry-delay', '5000',
    '--connection-type', type
  ];

  if (type === 'DIRECT') args.push('--shelly', deviceIP);
  if (type === 'WEB') args.push('--device-id', deviceId, '--auth-key', authKey, '--device-type', deviceType);

  dataCollectionProcess = spawn('node', args, {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env: { ...process.env, NODE_PATH: join(__dirname, 'node_modules') }
  });

  dataCollectionProcess.stdout.on('data', (d) => console.log(`[collector] ${d}`.trim()));
  dataCollectionProcess.stderr.on('data', (d) => console.error(`[collector:error] ${d}`.trim()));
  dataCollectionProcess.on('close', () => {
    dataCollectionProcess = null;
    currentDeviceIP = null;
  });

  currentDeviceIP = deviceIP || null;
  return json(res, 200, { success: true, connectionType: type });
}

async function stopCollection(_req, res) {
  if (!dataCollectionProcess) return json(res, 200, { success: true, message: 'No process running' });

  dataCollectionProcess.kill('SIGTERM');
  const watchdog = setTimeout(() => {
    if (dataCollectionProcess) dataCollectionProcess.kill('SIGKILL');
  }, 5000);

  dataCollectionProcess.on('close', () => clearTimeout(watchdog));
  dataCollectionProcess = null;
  currentDeviceIP = null;
  return json(res, 200, { success: true });
}

async function collectionStatus(_req, res) {
  const statusPath = join(__dirname, 'data', 'collector-status.json');
  const fileStatus = existsSync(statusPath)
    ? JSON.parse(readFileSync(statusPath, 'utf8'))
    : { isRunning: false, status: 'unknown', lastUpdate: null };

  return json(res, 200, {
    processRunning: dataCollectionProcess !== null,
    deviceIP: currentDeviceIP,
    ...fileStatus
  });
}

async function testIp(req, res) {
  const body = JSON.parse(await readBody(req));
  const ip = body.ip;
  if (!ip) return json(res, 400, { error: 'ip required' });

  try {
    const response = await fetch(`http://${ip}/shelly`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return json(res, 200, { ip, ok: false, status: response.status });
    const data = await response.json();
    return json(res, 200, { ip, ok: true, data });
  } catch (error) {
    return json(res, 200, { ip, ok: false, error: error.message });
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/start-collection') return startCollection(req, res);
    if (req.method === 'POST' && req.url === '/api/stop-collection') return stopCollection(req, res);
    if (req.method === 'GET' && req.url === '/api/collection-status') return collectionStatus(req, res);
    if (req.method === 'POST' && req.url === '/api/test-ip') return testIp(req, res);

    json(res, 404, { error: 'Not found' });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Shelly server running on http://localhost:${PORT}`);
});
```

## 10) Sequenza operativa obbligatoria per IA implementatrice

1. Creare i file esattamente come in questo documento.
2. Eseguire:

```bash
npm install
node server.js
```

3. Test connessione DIRECT:

```bash
curl -X POST http://localhost:3000/api/start-collection \
  -H "Content-Type: application/json" \
  -d '{"connectionType":"DIRECT","deviceIP":"192.168.1.50"}'
```

4. Test connessione WEB:

```bash
curl -X POST http://localhost:3000/api/start-collection \
  -H "Content-Type: application/json" \
  -d '{"connectionType":"WEB","deviceId":"<DEVICE_ID>","authKey":"<AUTH_KEY>","deviceType":"trifase"}'
```

5. Stato:

```bash
curl http://localhost:3000/api/collection-status
```

6. Stop:

```bash
curl -X POST http://localhost:3000/api/stop-collection
```

## 11) Output attesi

- File `data/readings.csv` in crescita.
- File `data/collector-status.json` aggiornato.
- File `data/collector.log` con eventi runtime.

## 12) Campi misura finali (schema fisso)

- `voltage_a`, `voltage_b`, `voltage_c`
- `current_a`, `current_b`, `current_c`, `current_n`
- `apower_a`, `apower_b`, `apower_c`
- `aprtpower_a`, `aprtpower_b`, `aprtpower_c`
- `angle_a`, `angle_b`, `angle_c`
- `pf_a`, `pf_b`, `pf_c`

Regola: qualsiasi campo assente deve essere scritto a `0`, mai omesso.

