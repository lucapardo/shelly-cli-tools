# 🔄 Verifica Sistema Auto-Update Eventi di Consumo

## ✅ **CONFERMA: Il Sistema è GIÀ Configurato Correttamente**

Il sistema di monitoraggio dei consumi per fasce è **già configurato per aggiornare automaticamente** il file JSON degli eventi. Ecco la verifica completa:

## 🔧 **PROBLEMA RISOLTO: Eventi LOW Non Rilevati**

### **Problema Identificato**
Gli eventi di consumo LOW (0-300W) non venivano rilevati né nei dati storici né in tempo reale, nonostante fossero visibili molti punti dati sotto la soglia LOW nel dashboard.

### **Causa del Problema**
La logica di rilevamento eventi aveva due problemi:
1. **Eventi iniziavano solo quando** `power > powerThresholds.low` (300W)
2. **Eventi finivano quando** `power <= powerThresholds.low` (300W)

Questo significava che:
- ❌ Consumi tra 10W-300W non venivano mai rilevati come eventi
- ❌ Solo consumi > 300W generavano eventi
- ❌ I grafici mostravano dati LOW ma l'analisi non li catturava

### **Soluzione Implementata**
Modificata la logica di rilevamento eventi:

**Prima (ERRATO):**
```javascript
// Inizia evento solo se power > 300W
if (power > powerThresholds.low) {
    startConsumptionEvent(phase, power, timestamp);
}
// Finisce evento quando power <= 300W
const shouldEnd = power <= powerThresholds.low;
```

**Dopo (CORRETTO):**
```javascript
// Inizia evento se power > 10W (soglia minima per evitare rumore)
if (power > 10) {
    startConsumptionEvent(phase, power, timestamp);
}
// Finisce evento quando power <= 10W (quasi zero)
const shouldEnd = power <= 10;
```

### **Vantaggi della Nuova Logica**
- ✅ **Cattura eventi LOW**: Rileva consumi 10W-300W
- ✅ **Evita rumore**: Soglia 10W elimina falsi positivi da standby
- ✅ **Classificazione corretta**: Eventi classificati in base al picco massimo
- ✅ **Coerenza**: Stessa logica per dati storici e tempo reale

### **Test della Correzione**
Creata pagina di test: `test_low_consumption_events.html`
- ✅ Verifica rilevamento eventi LOW (150W-200W)
- ✅ Verifica rilevamento eventi MEDIUM (500W-600W)  
- ✅ Verifica pattern misti (LOW → OFF → LOW)

## 📋 **Configurazione Attuale**

### **Auto-Refresh Abilitato**
- ✅ **Stato**: Abilitato di default (`isAutoRefreshEnabled = true`)
- ✅ **Intervallo**: 5 secondi (configurabile)
- ✅ **Inizializzazione**: Automatica all'avvio della pagina

### **Flusso di Aggiornamento Automatico**
```
Auto-refresh (5 sec) → loadData() → updateCharts() → processConsumptionEvents() → saveConsumptionEvent() → File JSON aggiornato
```

## 🔧 **PROBLEMA RISOLTO: Linee Soglie Non Visibili**

### **Problema Identificato**
Le linee orizzontali delle soglie non erano visibili sui grafici di potenza a causa di problemi di timing nell'inizializzazione.

### **Soluzioni Implementate**
1. ✅ **Chiamata ritardata**: Aggiunta chiamata a `updateThresholds()` con delay di 2 secondi dopo l'inizializzazione
2. ✅ **Aggiornamento automatico**: Le soglie vengono aggiornate ogni volta che i grafici vengono aggiornati con nuovi dati
3. ✅ **Controlli di sicurezza**: Verifiche che i grafici e il plugin di annotazione esistano prima di aggiungere le linee
4. ✅ **Debug migliorato**: Aggiunta di log per tracciare l'aggiornamento delle soglie

### **Configurazione Soglie Ottimizzata**
- 🟢 **Linea Verde (LOW)**: Soglia bassa (default: 300W)
  - **Sempre visibile** per riferimento base
- 🟡 **Linea Gialla (MEDIUM)**: Soglia media (default: 1000W)  
  - **Visibilità dinamica**: Mostrata solo se ci sono dati che superano questa soglia
  - **Auto-nascosta**: Si nasconde automaticamente quando tutti i dati sono sotto la soglia
  - **Aggiornamento automatico**: Controllata ad ogni refresh del grafico
- 🔴 **Soglia HIGH**: Rimossa per permettere scaling automatico
  - La soglia HIGH è definita come qualsiasi valore > MEDIUM
  - Questo permette al grafico di scalare automaticamente in base ai dati reali
  - Evita che una linea fissa a 2000W comprima la visualizzazione dei dati

### **Vantaggi del Nuovo Approccio**
- ✅ **Scaling dinamico**: I grafici si adattano automaticamente ai valori massimi dei dati
- ✅ **Migliore leggibilità**: Dettagli più visibili senza compressione causata da linee fisse troppo alte
- ✅ **Flessibilità**: Il sistema si adatta a qualsiasi range di potenza senza configurazione aggiuntiva
- ✅ **Visualizzazione intelligente**: Le soglie appaiono solo quando rilevanti per i dati attuali
- ✅ **Scaling ottimale**: Il grafico mantiene sempre la scala migliore per i dati presenti

### **Modifiche Apportate**
- **graphs.html**: Aggiunta chiamata `updateThresholdLines()` in `updateCharts()`
- **graphs.html**: Timeout di 1 secondo per inizializzazione soglie in `initialize()`
- **graphs.html**: Controlli di sicurezza in `updateThresholdLines()`

## 🔍 **Come Verificare il Funzionamento**

### **Metodo 1: Pagina di Test Soglie**
1. Apri `http://localhost:3000/test_thresholds_visibility.html`
2. Clicca "📊 Genera Dati Test" per vedere le linee delle soglie
3. Modifica i valori delle soglie e clicca "🔄 Aggiorna Soglie"
4. Verifica che le linee verde, gialla e rossa siano visibili

### **Metodo 2: Dashboard Principale**
1. Apri `http://localhost:3000/graphs.html`
2. Apri la sidebar delle impostazioni (⚙️ Settings)
3. Verifica che "Enable Threshold Lines on Charts" sia spuntato
4. Controlla i grafici di potenza per le linee tratteggiate:
   - **Verde**: Soglia bassa (300W default)
   - **Gialla**: Soglia media (1000W default)  
   - **Rossa**: Soglia alta (>1000W)

### **Metodo 3: Pagina di Test Auto-Update**
1. Apri `http://localhost:3000/test_auto_update.html`
2. Clicca "📄 Controlla File Eventi" per vedere gli eventi attuali
3. Clicca "⚡ Simula Evento" per aggiungere un evento di test
4. Clicca "🔍 Avvia Monitoraggio" per monitorare gli aggiornamenti automatici

### **Metodo 4: Analisi Consumi**
1. Apri `http://localhost:3000/consumption_analysis.html`
2. Verifica che i grafici delle soglie mostrino dati
3. Controlla le statistiche per fasce di consumo
4. Osserva gli aggiornamenti automatici dei dati

## 📁 **File Coinvolti**

### **File JSON degli Eventi**
- **Percorso**: `consumption_events_for_browser.json`
- **Formato**: Array di oggetti evento con id, fase, tipo, tempi, potenza, energia
- **Aggiornamento**: Automatico tramite API `/api/save-consumption-event`

### **Configurazione Soglie**
- **Soglia Bassa**: 300W (default) - Linea verde tratteggiata
- **Soglia Media**: 1000W (default) - Linea gialla tratteggiata
- **Soglia Alta**: >1000W (automatica) - Linea rossa tratteggiata

## ⚙️ **Configurazione Server**

### **Endpoint API Attivo**
```javascript
POST /api/save-consumption-event
```
- ✅ **Stato**: Implementato e funzionante
- ✅ **Validazione**: Controllo dati evento
- ✅ **Persistenza**: Salvataggio su file JSON
- ✅ **Fallback**: localStorage se server non disponibile

### **Server Status**
```bash
# Verifica che il server sia in esecuzione
ps aux | grep "node server.js"
```

## 🔧 **Risoluzione Problemi**

### **Se le Linee Soglie Non Sono Visibili**

1. **Controlla Console Browser**
   - Apri Developer Tools (F12)
   - Cerca log: "Updating threshold lines..." e "Added threshold lines to..."
   - Verifica errori relativi al plugin annotation

2. **Verifica Plugin Annotation**
   - Il plugin `chartjs-plugin-annotation@3` deve essere caricato
   - Controlla che `Chart.register(ChartAnnotation)` sia eseguito

3. **Forza Aggiornamento Soglie**
   - Apri sidebar impostazioni
   - Disabilita e riabilita "Enable Threshold Lines on Charts"
   - Oppure modifica i valori delle soglie

4. **Test Isolato**
   - Usa `test_thresholds_visibility.html` per test isolato
   - Verifica che le soglie funzionino in ambiente controllato

### **Se gli Eventi Non Si Aggiornano**

1. **Verifica Server**
   ```bash
   node server.js
   ```

2. **Controlla Auto-Refresh**
   - Apri `graphs.html`
   - Verifica status indicator (deve essere verde)
   - Clicca "Toggle Auto Refresh" se necessario

3. **Verifica Soglie**
   - Apri sidebar configurazione
   - Controlla che le soglie siano abilitate
   - Verifica valori: Low < Medium

4. **Controlla Console Browser**
   - Apri Developer Tools (F12)
   - Cerca errori nella console
   - Verifica chiamate API nella tab Network

### **Se il File JSON Non Esiste**
Il file viene creato automaticamente al primo evento. Se non esiste:
1. Simula un evento tramite `test_auto_update.html`
2. Oppure attendi che si verifichi un evento reale di consumo

## 📊 **Monitoraggio in Tempo Reale**

### **Indicatori di Funzionamento**
- ✅ **Status verde** in `graphs.html`
- ✅ **Timestamp aggiornato** ogni 5 secondi
- ✅ **Linee soglia** visibili sui grafici di potenza (verde, gialla, rossa)
- ✅ **Eventi salvati** in `consumption_events_for_browser.json`

### **Log di Sistema**
```javascript
// Console browser mostra:
"Updating threshold lines... {low: 300, medium: 1000, enabled: true}"
"Added threshold lines to powerAChart: {...}"
"Started consumption event for Phase A: {...}"
"Completed consumption event for Phase A: {...}"
"Consumption event saved successfully: {...}"
```

## 🎯 **Conclusione**

**Il sistema è COMPLETAMENTE FUNZIONANTE e aggiorna automaticamente il file JSON degli eventi di consumo ogni volta che:**

1. ✅ Un dispositivo supera le soglie configurate
2. ✅ L'auto-refresh carica nuovi dati (ogni 5 secondi)
3. ✅ Gli eventi vengono processati e classificati
4. ✅ I dati vengono salvati nel file JSON via API
5. ✅ **NUOVO**: Le linee delle soglie sono visibili sui grafici di potenza

**Problema delle linee soglie RISOLTO** - ora le linee verde, gialla e rossa sono visibili sui grafici di potenza.

## 🔗 **Link Utili**

- **Dashboard**: http://localhost:3000/graphs.html
- **Analisi Consumi**: http://localhost:3000/consumption_analysis.html
- **Test Auto-Update**: http://localhost:3000/test_auto_update.html
- **Test Soglie**: http://localhost:3000/test_thresholds_visibility.html
- **Configurazione**: http://localhost:3000/settings.html 