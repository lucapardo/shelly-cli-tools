# Manuale Tecnico IA - Replica Connessione Shelly (DIRECT + WEB)

## 1) Obiettivo del manuale

Questo documento definisce una procedura completa, ripetibile e verificabile per collegare un progetto a dispositivi Shelly, leggere i dati in ingresso e gestire la raccolta continua in due modalita:

- `DIRECT`: connessione locale al dispositivo via rete LAN.
- `WEB`: connessione cloud Shelly tramite API HTTPS.

Il manuale e scritto per un agente IA che deve replicare il comportamento tecnico in un nuovo progetto senza perdita di funzionalita.

---

## 2) Architettura operativa del progetto attuale

Componenti principali:

- `server.js`: orchestratore HTTP locale, avvio/stop del collector, endpoint API.
- `bin/data-collector.js`: collector principale multipiattaforma con supporto DIRECT/WEB.
- `windows-data-collector.js`: collector fallback per Windows (flusso HTTP diretto).
- `packages/transport/websocket.js`: trasporto WebSocket verso `ws://<ip>/rpc`.
- `packages/transport/udp.js`: trasporto UDP opzionale (console RPC).
- `packages/shelly/shelly.js`: client JSON-RPC generico (request/response + notify).
- `packages/shelly/shelly-3em.js`: wrapper per metodi Shelly 3EM (`EM.GetStatus`, etc.).
- `src/model.js`: normalizzazione payload Shelly in record di misura uniforme.
- `src/utils.js`: serializzazione CSV (`mapToFile`).

Output dati persistenti:

- `data/readings.csv`
- `data/collector-status.json`
- `data/collector.log`

---

## 3) Prerequisiti replicazione

### 3.1 Software

- Node.js installato.
- Dipendenze progetto installate (`npm install`).
- Accesso rete al device Shelly (DIRECT) o credenziali cloud (WEB).

### 3.2 Dati richiesti per connessione

#### DIRECT
- `deviceIP` (es. `192.168.1.50`)

#### WEB
- `deviceId`
- `authKey`
- `deviceType` (`trifase` o `monofase`)

---

## 4) Flusso connessione DIRECT (LAN)

## 4.1 Trasporto e protocollo

- Trasporto: WebSocket client.
- Endpoint: `ws://<DEVICE_IP>/rpc`
- Protocollo applicativo: JSON-RPC 2.0.

Messaggio request costruito da client:

```json
{
  "jsonrpc": "2.0",
  "id": "UID-<counter>",
  "src": "shelly-client",
  "method": "EM.GetStatus",
  "params": { "id": 0 }
}
```

Pattern di bootstrap:

1. Connect WebSocket.
2. Chiamata `Shelly.GetDeviceInfo`.
3. Loop di lettura `EM.GetStatus`.

## 4.2 Sequenza pratica minima (CLI)

Lettura singola:

```bash
SHELLY=<DEVICE_IP> node bin/read_data.js read
```

Raccolta continua:

```bash
node bin/data-collector.js \
  --shelly <DEVICE_IP> \
  --output data/readings.csv \
  --interval 1000 \
  --max-retries 10 \
  --retry-delay 5000 \
  --connection-type DIRECT
```

## 4.3 Gestione errori DIRECT

Il collector incrementa `consecutiveErrors` a ogni fallimento di lettura.

- Se `consecutiveErrors < maxRetries`: attende `retryDelayMs` e ritenta.
- Se `consecutiveErrors >= maxRetries`: stop con errore.

Timeout e retry sono obbligatori per resilienza.

---

## 5) Flusso connessione WEB (Cloud Shelly)

## 5.1 Endpoint e richiesta

Metodo: `POST`

URL:

`https://shelly-174-eu.shelly.cloud/v2/devices/api/get?auth_key=<AUTH_KEY>`

Body JSON:

```json
{
  "ids": ["<DEVICE_ID>"],
  "select": ["status"]
}
```

Il collector parse-izza la risposta e usa `status` come base per la normalizzazione.

## 5.2 Mapping payload WEB per tipo device

### `deviceType = trifase`
- Atteso nodo: `resp.status["em:0"]`
- Input normalizzazione: oggetto `em:0`

### `deviceType = monofase`
- Atteso nodo: `resp.status["emeters"]` (array)
- Se disponibile usa `emeters[1]`, fallback su `emeters[0]`
- Converte manualmente verso schema trifase:
  - Fase A valorizzata da emeter attivo
  - Fasi B/C a zero
  - Totali ricavati da potenza/voltaggio

## 5.3 Sequenza pratica minima (CLI)

```bash
node bin/data-collector.js \
  --output data/readings.csv \
  --interval 3000 \
  --max-retries 10 \
  --retry-delay 5000 \
  --connection-type WEB \
  --device-id <DEVICE_ID> \
  --auth-key <AUTH_KEY> \
  --device-type trifase
```

Nota operativa: nel server locale l'intervallo WEB e forzato a 3000ms per ridurre rate limiting.

---

## 6) Normalizzazione dati in ingresso

Funzione di riferimento: `measurementFromDeviceEMStatus(statusResult)`.

Traduzioni chiavi:

- `voltage_*` -> `*_voltage`
- `current_*` -> `*_current`
- `apower_*` -> `*_act_power`
- `aprtpower_*` -> `*_aprt_power`
- `pf_*` -> `*_pf`
- `angle_*` -> `*_angle`

Campi normalizzati finali:

- `voltage_a`, `voltage_b`, `voltage_c`
- `current_a`, `current_b`, `current_c`, `current_n`
- `apower_a`, `apower_b`, `apower_c`
- `aprtpower_a`, `aprtpower_b`, `aprtpower_c`
- `angle_a`, `angle_b`, `angle_c`
- `pf_a`, `pf_b`, `pf_c`

Regola robustezza: campo mancante => `0` (mai rimuovere campi dal record).

---

## 7) Struttura record scritto su CSV

Ogni riga di misura contiene:

- `mac` (o `deviceId` in WEB)
- `ts` (unix timestamp)
- `reading_id` (incrementale locale collector)
- campi misure normalizzate

Header nominale usato dal collector principale:

`device_id,timestamp,reading_id,a_voltage,b_voltage,c_voltage,a_current,b_current,c_current,n_current,a_act_power,b_act_power,c_act_power,a_aprt_power,b_aprt_power,c_aprt_power,a_angle,b_angle,c_angle,a_pf,b_pf,c_pf`

Output path standard:

- `data/readings.csv`

---

## 8) Controllo stato collector

File: `data/collector-status.json`

Campi operativi principali:

- `isRunning`
- `status` (`starting`, `connected`, `running`, `error`, `stopping`, `stopped`, `failed`)
- `readingCount`
- `consecutiveErrors`
- `startTime`
- `lastSuccessfulReading`
- `lastUpdate`

Log runtime:

- `data/collector.log`

---

## 9) API server locale da replicare

Endpoint minimi lato orchestratore:

- `POST /api/start-collection`
  - Input:
    - DIRECT: `deviceIP`, `connectionType=DIRECT`
    - WEB: `deviceId`, `authKey`, `deviceType`, `connectionType=WEB`
  - Azioni:
    1. stop processo precedente (se presente)
    2. spawn collector con argomenti coerenti
    3. ritorno JSON success/error

- `POST /api/stop-collection`
  - stop graceful (`SIGTERM`) + fallback kill hard dopo timeout.

- `GET /api/collection-status`
  - merge stato processo in memoria + `collector-status.json`

Opzionale utile:

- `POST /api/test-ip`
  - test rapido endpoint `http://<ip>/shelly` con timeout

---

## 10) Discovery device locale (supporto connessione DIRECT)

Flusso consigliato:

1. Determina subnet locale (WebRTC o fallback range comuni).
2. Scansiona range IP in batch.
3. Esegui probe HTTP su endpoint Shelly.
4. Valida presenza indicatori dispositivo (es. `type`, `mac`, `app`).
5. Presenta lista dispositivi e consenti selezione.

Parametri pratici:

- Batch parallelo moderato (es. 10 IP).
- Timeout per host breve (2-3 secondi).
- Aggiornamento progressivo stato scan.

---

## 11) Procedura completa di replica in nuovo progetto

1. Copiare moduli logici:
   - trasporto WS
   - client JSON-RPC
   - adapter Shelly3EM
   - normalizzatore misure
   - writer CSV
2. Implementare collector unificato con:
   - `connectionType` DIRECT/WEB
   - retry policy
   - status file + log file
3. Implementare server orchestratore:
   - start/stop/status API
   - process lifecycle management
4. Implementare UI/CLI di bootstrap:
   - input parametri DIRECT/WEB
   - test connessione
5. Verificare output:
   - crescita `readings.csv`
   - coerenza timestamp e reading_id
   - stato `running` stabile

---

## 12) Checklist di validazione tecnica

### Connettivita
- [ ] DIRECT apre `ws://<ip>/rpc` con successo.
- [ ] WEB riceve risposta JSON valida da cloud API.

### Integrita dati
- [ ] Ogni record ha tutti i campi previsti.
- [ ] Campi mancanti valorizzati a `0`.
- [ ] `reading_id` incrementa senza salti anomali.

### Resilienza
- [ ] Retry attivo su errori temporanei.
- [ ] Stop automatico dopo `maxRetries`.
- [ ] Logging diagnostico persistente.

### Operativita
- [ ] API start/stop/status funzionanti.
- [ ] Processo collector separato dalla UI.
- [ ] Raccolta continua anche con browser chiuso.

---

## 13) Troubleshooting rapido

### DIRECT non si connette
- Verifica IP, subnet, firewall, reachability (`/shelly`).
- Verifica supporto RPC su device target.
- Riduci timeout e abilita log debug.

### WEB risponde ma senza `status`
- Verifica `deviceId` e `authKey`.
- Controlla forma risposta (array vs oggetto).
- Verifica `deviceType` corretto (`trifase`/`monofase`).

### Dati CSV incoerenti
- Conferma uso unico normalizzatore.
- Evita mutazioni schema runtime.
- Valida ordine colonne e serializzazione costante.

### Processo si ferma subito
- Controlla stderr collector.
- Verifica path output e permessi scrittura `data/`.
- Verifica dipendenze runtime Node.

---

## 14) Specifica minima da consegnare a una IA implementatrice

Un agente IA che deve rifare il sistema in altro progetto deve ricevere almeno:

- Specifica connessione:
  - DIRECT => WS JSON-RPC su `/rpc`
  - WEB => POST cloud API con `ids + select=status`
- Specifica normalizzazione campi (mapping completo).
- Specifica file output (`readings.csv`, status, log).
- Specifica retry policy e stop conditions.
- Specifica endpoint server start/stop/status.

Se questi 5 blocchi sono rispettati, la replica e funzionalmente equivalente.

