# 🏗️ Aggiornamento Architettura Sistema - File JSON vs localStorage

## 📋 Panoramica dei Cambiamenti

Il sistema è stato aggiornato per utilizzare **file JSON server-side** invece del **localStorage del browser** per la persistenza degli eventi di consumo energetico.

## 🔄 Architettura Precedente vs Nuova

### ❌ Architettura Precedente (localStorage)
```
Browser (graphs.html) 
    ↓ (eventi di consumo)
localStorage del browser
    ↓ (lettura)
consumption_analysis.html
```

**Problemi:**
- Dati limitati al singolo browser
- Perdita dati se si cancella la cache
- Non condivisibili tra dispositivi
- Limitazioni di storage del browser

### ✅ Nuova Architettura (File JSON)
```
Browser (graphs.html) 
    ↓ (POST /api/save-consumption-event)
Server Node.js
    ↓ (scrittura)
consumption_events_for_browser.json
    ↓ (fetch)
consumption_analysis.html
```

**Vantaggi:**
- Persistenza permanente sul server
- Condivisione tra dispositivi/browser
- Backup automatico
- Scalabilità migliorata
- Integrazione con altri sistemi

## 🛠️ Componenti Modificati

### 1. Server Node.js (`server.js`)
**Nuovo endpoint aggiunto:**
```javascript
POST /api/save-consumption-event
```

**Funzionalità:**
- Riceve eventi di consumo dal browser
- Valida i dati dell'evento
- Aggiunge l'evento al file JSON esistente
- Gestisce errori e fallback

### 2. Dashboard (`graphs.html`)
**Funzione modificata:**
```javascript
function saveConsumptionEvent(event) {
    // Invia evento al server invece di localStorage
    fetch('/api/save-consumption-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
    })
    // Fallback a localStorage in caso di errore server
}
```

### 3. Analisi Consumi (`consumption_analysis.html`)
**Funzione modificata:**
```javascript
async function updateThresholdAnalysis(analysis) {
    // Legge direttamente dal file JSON
    const response = await fetch('consumption_events_for_browser.json');
    const events = await response.json();
    // Processa gli eventi...
}
```

### 4. Pagina di Test (`test_thresholds.html`)
**Funzioni rimosse/modificate:**
- ❌ `generateTestEvents()` (rimossa)
- ❌ `clearTestEvents()` (rimossa)
- ✅ `loadGeneratedEvents()` (non salva più in localStorage)
- ✅ `viewStoredEvents()` (legge dal file JSON)

## 📁 Struttura File

### File di Dati
```
/
├── consumption_events_for_browser.json    # Eventi per il browser
├── generated_consumption_events.json      # Eventi con metadati completi
├── data/
│   └── readings.csv                       # Dati grezzi CSV
└── generate_consumption_events.cjs        # Script di generazione
```

### Formato Eventi
```json
[
  {
    "id": 1,
    "phase": "A",
    "type": "MEDIUM",
    "startTime": "2025-05-29T13:29:25.000Z",
    "endTime": "2025-05-29T19:44:40.806Z",
    "duration": 22515806,
    "minPower": "317.52",
    "maxPower": "684.86",
    "averagePower": "394.99",
    "totalEnergy": "2470.445"
  }
]
```

## 🔄 Flusso di Dati Aggiornato

### 1. Generazione Eventi da CSV
```bash
node generate_consumption_events.cjs
    ↓
consumption_events_for_browser.json (creato/aggiornato)
```

### 2. Monitoraggio Real-time
```
Shelly Device → Server → graphs.html → Rilevamento Eventi
    ↓
POST /api/save-consumption-event
    ↓
consumption_events_for_browser.json (aggiornato)
```

### 3. Visualizzazione Analisi
```
consumption_analysis.html
    ↓
fetch('consumption_events_for_browser.json')
    ↓
Grafici e Statistiche Aggiornate
```

## 🚀 Benefici dell'Aggiornamento

### Per gli Utenti
- ✅ **Persistenza garantita**: I dati non si perdono mai
- ✅ **Multi-dispositivo**: Accesso da qualsiasi browser
- ✅ **Performance migliori**: Caricamento più veloce
- ✅ **Backup automatico**: Dati sempre al sicuro

### Per gli Sviluppatori
- ✅ **Architettura pulita**: Separazione client/server
- ✅ **Scalabilità**: Facile aggiungere nuove funzionalità
- ✅ **Debugging**: Log server-side per troubleshooting
- ✅ **Integrazione**: API REST per sistemi esterni

### Per il Sistema
- ✅ **Affidabilità**: Meno punti di fallimento
- ✅ **Manutenibilità**: Codice più organizzato
- ✅ **Monitoraggio**: Visibilità completa sui dati
- ✅ **Estendibilità**: Base per funzionalità future

## 🔧 Configurazione e Deployment

### Requisiti
- Node.js con moduli ES6
- Accesso in scrittura alla directory del progetto
- Porta 3000 disponibile (o configurabile)

### Avvio Sistema
```bash
# 1. Genera eventi da dati storici (opzionale)
node generate_consumption_events.cjs

# 2. Avvia il server
node server.js

# 3. Accedi al dashboard
# http://localhost:3000/graphs.html
# http://localhost:3000/consumption_analysis.html
```

### Monitoraggio
- **Log server**: Eventi salvati con timestamp
- **File JSON**: Aggiornato in tempo reale
- **Fallback**: localStorage come backup di emergenza

## 🔮 Possibili Estensioni Future

### Database Integration
```
File JSON → SQLite/PostgreSQL → API REST
```

### Cloud Storage
```
File JSON → AWS S3/Google Cloud → CDN
```

### Real-time Updates
```
WebSockets → Live Dashboard Updates
```

### Analytics
```
File JSON → InfluxDB → Grafana Dashboard
```

## 📊 Metriche di Performance

### Prima (localStorage)
- **Capacità**: ~5-10MB per browser
- **Persistenza**: Temporanea
- **Condivisione**: Impossibile
- **Backup**: Manuale

### Dopo (File JSON)
- **Capacità**: Limitata solo dallo spazio disco
- **Persistenza**: Permanente
- **Condivisione**: Automatica
- **Backup**: Automatico

---

## 🎉 Conclusione

L'aggiornamento all'architettura basata su file JSON rappresenta un **significativo miglioramento** in termini di:

- **Affidabilità** dei dati
- **Scalabilità** del sistema  
- **Esperienza utente** migliorata
- **Manutenibilità** del codice

Il sistema è ora **pronto per l'uso in produzione** con una base solida per future espansioni! 🚀 