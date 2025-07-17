# Running Shelly CLI Tools

## 1. Start the Dashboard Server

This serves the web dashboard and manages the data collection process.

```sh
node server.js
```
- The server will be available at: http://localhost:3000
- You can use the web UI to start/stop data collection and view data.

## 2. Start Data Collection (via Web UI)
- Open http://localhost:3000 in your browser.
- Fill in the Device IP (for DIRECT) or Device ID/Auth Key (for WEB).
- Select the connection type (DIRECT or WEB).
- Click "Start Data Collection".
- Data will be written to `data/readings.csv`.

## 3. Start Data Collection (Manually via Terminal)

### DIRECT Mode (local network connection)
```sh
node bin/data-collector.js --shelly <DEVICE_IP> --output data/readings.csv --interval 1000 --max-retries 10 --retry-delay 5000 --connection-type DIRECT
```
- Replace `<DEVICE_IP>` with your Shelly device's IP address.

### WEB Mode (cloud connection)
```sh
node bin/data-collector.js --output data/readings.csv --interval 1000 --max-retries 10 --retry-delay 5000 --connection-type WEB --device-id <DEVICE_ID> --auth-key <AUTH_KEY>
```
- Replace `<DEVICE_ID>` and `<AUTH_KEY>` with your device's ID and cloud auth key.

## 4. Verifying Data Capture
- Data is written to `data/readings.csv`.
- To check if new data is being captured, run:
  ```sh
  tail -n 10 data/readings.csv
  ```
- The timestamp in the second column should be close to the current Unix time:
  ```sh
  date +%s
  ```

## 5. Stopping Data Collection
- If started via the web UI, click "Stop Collection".
- If started manually, press `Ctrl+C` in the terminal where the collector is running.

---

If you encounter issues, check the server terminal for error messages and ensure your device/network/cloud credentials are correct. 