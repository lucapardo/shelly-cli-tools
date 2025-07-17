# Power Consumption Thresholds - Monitoraggio Consumi Energetici

## 📋 Panoramica

Questo sistema implementa un monitoraggio avanzato dei consumi energetici attraverso soglie di potenza configurabili, rappresentazione grafica e tracciamento automatico degli eventi di consumo.

## 🚀 Funzionalità Implementate

### FASE 1 - Configurazione Soglie di Consumo
- ✅ **Interfaccia di configurazione** nella sidebar del dashboard
- ✅ **Due soglie configurabili**:
  - Soglia basso consumo (default: 300W)
  - Soglia medio consumo (default: 1000W)
  - Soglia alto consumo (automatica: >1000W)
- ✅ **Validazione input** per garantire che basso < medio

### FASE 2 - Visualizzazione Grafica delle Soglie
- ✅ **Linee orizzontali tratteggiate** sui grafici di potenza:
  - 🟢 Linea verde per soglia bassa
  - 🟡 Linea gialla per soglia media
  - 🔴 Linea rossa per soglia alta
- ✅ **Toggle per abilitare/disabilitare** le linee delle soglie

### FASE 3 - Tracciamento Eventi di Consumo
- ✅ **Rilevamento automatico degli eventi** quando la potenza supera le soglie
- ✅ **Gestione intelligente delle pendenze**:
  - Attende il cambio di pendenza prima di classificare l'evento
  - Classifica in base al picco massimo raggiunto
- ✅ **Registrazione completa** di ogni evento:
  - Timestamp inizio e fine
  - Valori minimo, medio e massimo
  - Durata totale
  - Tipo evento (LOW/MEDIUM/HIGH)

### FASE 4 - Registrazione Eventi su File
- ✅ **Salvataggio automatico** in localStorage
- ✅ **Formato JSON strutturato** con tutti i dettagli
- ✅ **Funzione di esportazione** per scaricare i dati

### FASE 5 - Analisi Avanzata dei Consumi
- ✅ **Grafico a torta** con distribuzione percentuale per fasce
- ✅ **Grafico a barre stacked** per analisi temporale:
  - Notte (00:00-07:00)
  - Giorno (07:00-15:00)
  - Sera (15:00-24:00)
- ✅ **Statistiche dettagliate** per ogni fascia di consumo

## 🎯 Come Utilizzare

### 1. Configurazione Soglie
1. Apri il dashboard (`graphs.html`)
2. Clicca sul pulsante "⚙️ Settings" in alto a sinistra
3. Scorri fino alla sezione "⚡ Power Consumption Thresholds"
4. Imposta i valori desiderati per le soglie
5. Abilita/disabilita le linee sui grafici

### 2. Monitoraggio in Tempo Reale
- Le soglie vengono visualizzate automaticamente sui grafici di potenza
- Gli eventi vengono tracciati automaticamente durante la raccolta dati
- I dati vengono salvati in tempo reale nel browser

### 3. Analisi dei Consumi
1. Apri la pagina di analisi (`consumption_analysis.html`)
2. Visualizza le statistiche per fasce di consumo
3. Analizza i grafici di distribuzione temporale
4. Esporta i dati per analisi esterne

### 4. Esportazione Dati
- Dal dashboard: clicca "📥 Export Events" nella sezione soglie
- Dall'analisi: usa il pulsante "📥 Export Data"

## 📊 Struttura Dati Eventi

Ogni evento di consumo viene salvato con la seguente struttura:

```json
{
  "id": 1,
  "phase": "A",
  "type": "MEDIUM",
  "startTime": "2024-01-15T10:30:00.000Z",
  "endTime": "2024-01-15T10:45:00.000Z",
  "duration": 900000,
  "minPower": "250.50",
  "maxPower": "850.75",
  "averagePower": "550.25",
  "totalEnergy": "0.138"
}
```

## 🔧 Configurazione Tecnica

### Soglie Default
```javascript
const powerThresholds = {
    low: 300,      // Watt
    medium: 1000,  // Watt
    enabled: true
};
```

### Fasce Temporali
- **Notte**: 00:00 - 07:00
- **Giorno**: 07:00 - 15:00
- **Sera**: 15:00 - 24:00

### Storage
- **Metodo**: localStorage del browser
- **Chiave**: `consumptionEvents`
- **Formato**: Array JSON di eventi

## 🧪 Testing

È disponibile una pagina di test dedicata:
```
http://localhost:3000/test_thresholds.html
```

Funzionalità di test:
- Validazione delle soglie
- Test del localStorage
- Generazione di eventi di esempio
- Verifica dello stato dell'implementazione

## 📁 File Modificati

### File Principali
- `graphs.html` - Dashboard con configurazione soglie
- `consumption_analysis.html` - Analisi avanzata dei consumi
- `test_thresholds.html` - Pagina di test

### Funzioni Aggiunte

#### graphs.html
- `updateThresholds()` - Aggiorna le soglie di configurazione
- `toggleThresholds()` - Abilita/disabilita le linee delle soglie
- `updateThresholdLines()` - Aggiorna le linee sui grafici
- `processConsumptionEvents()` - Elabora gli eventi di consumo
- `startConsumptionEvent()` - Inizia un nuovo evento
- `endConsumptionEvent()` - Termina un evento
- `exportConsumptionEvents()` - Esporta gli eventi

#### consumption_analysis.html
- `updateThresholdAnalysis()` - Aggiorna l'analisi delle soglie
- `calculateThresholdStatistics()` - Calcola le statistiche per fasce
- `updateThresholdPieChart()` - Aggiorna il grafico a torta
- `updateTimePeriodChart()` - Aggiorna il grafico temporale

## 🎨 Interfaccia Utente

### Colori delle Soglie
- 🟢 **Verde** (`#28a745`): Consumo basso
- 🟡 **Giallo** (`#ffc107`): Consumo medio  
- 🔴 **Rosso** (`#dc3545`): Consumo alto

### Elementi UI Aggiunti
- Campi input per configurazione soglie
- Checkbox per abilitare/disabilitare linee
- Pulsante esportazione eventi
- Sezione analisi soglie con statistiche
- Grafici di distribuzione temporale

## 🔄 Flusso di Lavoro

1. **Configurazione**: L'utente imposta le soglie nel dashboard
2. **Monitoraggio**: Il sistema traccia automaticamente i consumi
3. **Rilevamento**: Quando la potenza supera una soglia, inizia un evento
4. **Classificazione**: L'evento viene classificato in base al picco massimo
5. **Registrazione**: I dati vengono salvati automaticamente
6. **Analisi**: L'utente può visualizzare statistiche e grafici
7. **Esportazione**: I dati possono essere esportati per analisi esterne

## 🚨 Note Importanti

- I dati vengono salvati nel localStorage del browser
- Per un ambiente di produzione, considerare l'uso di un database
- Le soglie sono globali per tutte le fasi
- Gli eventi vengono tracciati separatamente per ogni fase (A, B, C)
- La classificazione degli eventi avviene solo al termine dell'evento

## 🔮 Sviluppi Futuri

Possibili miglioramenti:
- Soglie personalizzabili per ogni fase
- Notifiche in tempo reale per eventi critici
- Integrazione con database esterno
- API REST per accesso ai dati
- Dashboard mobile responsive
- Analisi predittiva dei consumi 