# Generazione Eventi di Consumo da Dati CSV

## 📋 Panoramica

Questo script analizza i dati storici presenti nel file `data/readings.csv` e genera automaticamente gli eventi di consumo energetico basati sulle soglie configurate.

## 🚀 Come Utilizzare

### 1. Esecuzione dello Script

```bash
# Esegui lo script di generazione
node generate_consumption_events.cjs
```

### 2. Output dello Script

Lo script genera due file:

- **`generated_consumption_events.json`**: File completo con metadati e statistiche
- **`consumption_events_for_browser.json`**: File ottimizzato per il caricamento nel browser

### 3. Caricamento nel Dashboard

#### Opzione A: Tramite Pagina di Test
1. Apri `http://localhost:3000/test_thresholds.html`
2. Clicca su "Load CSV-Generated Events"
3. Gli eventi verranno caricati automaticamente nel localStorage

#### Opzione B: Manualmente via Console Browser
1. Apri il dashboard (`http://localhost:3000/graphs.html`)
2. Apri la console del browser (F12)
3. Esegui il comando mostrato nell'output dello script

#### Opzione C: Copia Diretta
```javascript
// Copia questo comando nella console del browser
localStorage.setItem('consumptionEvents', JSON.stringify([
  // ... eventi generati dallo script
]));
```

## 📊 Struttura Dati CSV

Lo script analizza il file CSV con la seguente struttura:
```
device_id,timestamp,sequence,voltage_a,voltage_b,voltage_c,current_a,current_b,current_c,...
```

### Calcolo della Potenza
- **Potenza Fase A**: `voltage_a * current_a`
- **Potenza Fase B**: `voltage_b * current_b`  
- **Potenza Fase C**: `voltage_c * current_c`

## ⚙️ Configurazione Soglie

Le soglie utilizzate sono:
```javascript
const powerThresholds = {
    low: 300,      // Watt
    medium: 1000   // Watt
    // high: > 1000W (automatico)
};
```

## 📈 Logica di Rilevamento Eventi

### Inizio Evento
- Un evento inizia quando la potenza supera la soglia bassa (300W)

### Fine Evento  
- Un evento termina quando la potenza scende sotto la soglia bassa

### Classificazione Evento
Basata sulla **potenza massima** raggiunta durante l'evento:
- **LOW**: max ≤ 300W
- **MEDIUM**: 300W < max ≤ 1000W
- **HIGH**: max > 1000W

## 📋 Formato Eventi Generati

Ogni evento contiene:

```json
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
```

### Campi Spiegati
- **id**: Identificativo univoco dell'evento
- **phase**: Fase elettrica (A, B, o C)
- **type**: Tipo di consumo (LOW/MEDIUM/HIGH)
- **startTime/endTime**: Timestamp ISO di inizio e fine
- **duration**: Durata in millisecondi
- **minPower/maxPower**: Potenza minima e massima (Watt)
- **averagePower**: Potenza media (Watt)
- **totalEnergy**: Energia totale consumata (Wh)

## 📊 Esempio di Output

```
🔍 Analyzing CSV data to generate consumption events...
📊 Thresholds: Low=300W, Medium=1000W, High>1000W
📁 Found 5133 readings in CSV file
📈 Processed 1000/5133 readings...
📈 Processed 2000/5133 readings...
📈 Processed 3000/5133 readings...
📈 Processed 4000/5133 readings...
📈 Processed 5000/5133 readings...
🔚 Closing any remaining active events...
✅ Analysis complete! Generated 2 consumption events

📊 Event Statistics:
   Low consumption events: 0
   Medium consumption events: 1
   High consumption events: 1

💾 Events saved to: generated_consumption_events.json
🌐 Browser-compatible events saved to: consumption_events_for_browser.json
```

## 🔧 Personalizzazione

### Modifica delle Soglie
Modifica le soglie nel file `generate_consumption_events.cjs`:

```javascript
const powerThresholds = {
    low: 500,      // Nuova soglia bassa
    medium: 1500   // Nuova soglia media
};
```

### Filtri Aggiuntivi
Puoi aggiungere filtri per:
- Intervalli temporali specifici
- Fasi specifiche
- Durata minima degli eventi
- Soglie di energia

## 🚨 Note Importanti

1. **Backup**: Lo script sovrascrive i file di output esistenti
2. **Memoria**: Per file CSV molto grandi, considera l'elaborazione a blocchi
3. **Precisione**: I timestamp sono convertiti da Unix timestamp a millisecondi
4. **Fasi**: Ogni fase (A, B, C) viene analizzata indipendentemente

## 🔍 Troubleshooting

### Errore "File not found"
```bash
❌ File readings.csv not found in data/ directory
```
**Soluzione**: Assicurati che il file `data/readings.csv` esista

### Errore "require is not defined"
```bash
ReferenceError: require is not defined in ES module scope
```
**Soluzione**: Usa l'estensione `.cjs` per lo script

### Nessun Evento Generato
**Possibili cause**:
- Tutti i valori di potenza sono sotto la soglia bassa
- Dati CSV corrotti o formato non corretto
- Soglie troppo alte per i dati disponibili

### Verifica Dati
```bash
# Controlla le prime righe del CSV
head -10 data/readings.csv

# Controlla il numero di righe
wc -l data/readings.csv
```

## 🎯 Prossimi Passi

Dopo aver generato gli eventi:

1. **Visualizza nel Dashboard**: Apri `graphs.html` per vedere le soglie
2. **Analizza i Risultati**: Usa `consumption_analysis.html` per i grafici
3. **Esporta i Dati**: Usa la funzione di export per analisi esterne
4. **Configura Soglie**: Modifica le soglie nel dashboard se necessario

## 📈 Integrazione Continua

Per automatizzare il processo:

```bash
# Script di automazione
#!/bin/bash
echo "Generating consumption events from CSV..."
node generate_consumption_events.cjs

echo "Starting dashboard server..."
node server.js
```

Questo permette di rigenerare automaticamente gli eventi ogni volta che i dati CSV vengono aggiornati. 