#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configurazione soglie (deve corrispondere a quella in graphs.html)
const powerThresholds = {
    low: 300,
    medium: 1000
};

// Struttura per tracciare eventi attivi per ogni fase
const activeEvents = new Map();
let eventIdCounter = 0;
const completedEvents = [];

console.log('🔍 Analyzing CSV data to generate consumption events...');
console.log(`📊 Thresholds: Low=${powerThresholds.low}W, Medium=${powerThresholds.medium}W, High>${powerThresholds.medium}W`);

// Leggi il file CSV
const csvPath = path.join(__dirname, 'data', 'readings.csv');
if (!fs.existsSync(csvPath)) {
    console.error('❌ File readings.csv not found in data/ directory');
    process.exit(1);
}

const csvData = fs.readFileSync(csvPath, 'utf8');
const lines = csvData.trim().split('\n');

console.log(`📁 Found ${lines.length} readings in CSV file`);

// Analizza ogni riga del CSV
lines.forEach((line, index) => {
    const fields = line.split(',');
    
    if (fields.length < 15) {
        console.warn(`⚠️  Skipping line ${index + 1}: insufficient fields`);
        return;
    }
    
    // Estrai i dati (basato sulla struttura osservata)
    const deviceId = fields[0];
    const timestamp = parseInt(fields[1]) * 1000; // Converti da Unix timestamp a milliseconds
    const voltageA = parseFloat(fields[3]) || 0;
    const voltageB = parseFloat(fields[4]) || 0;
    const voltageC = parseFloat(fields[5]) || 0;
    const currentA = parseFloat(fields[6]) || 0;
    const currentB = parseFloat(fields[7]) || 0;
    const currentC = parseFloat(fields[8]) || 0;
    
    // Calcola la potenza per ogni fase (P = V * I)
    const powerA = voltageA * currentA;
    const powerB = voltageB * currentB;
    const powerC = voltageC * currentC;
    
    // Processa ogni fase
    processPhaseEvent('A', powerA, timestamp);
    processPhaseEvent('B', powerB, timestamp);
    processPhaseEvent('C', powerC, timestamp);
    
    // Mostra progresso ogni 1000 righe
    if ((index + 1) % 1000 === 0) {
        console.log(`📈 Processed ${index + 1}/${lines.length} readings...`);
    }
});

// Chiudi tutti gli eventi attivi
console.log('🔚 Closing any remaining active events...');
for (const [eventKey, event] of activeEvents.entries()) {
    endConsumptionEvent(eventKey, Date.now());
}

console.log(`✅ Analysis complete! Generated ${completedEvents.length} consumption events`);

// Statistiche per i nuovi eventi
const newStats = completedEvents.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
}, {});

console.log('📊 New Event Statistics:');
console.log(`   Low consumption events: ${newStats.LOW || 0}`);
console.log(`   Medium consumption events: ${newStats.MEDIUM || 0}`);
console.log(`   High consumption events: ${newStats.HIGH || 0}`);

// Statistiche per gli eventi sostituiti
if (replacedCount > 0) {
    console.log(`🔄 Replaced ${replacedCount} existing events`);
}

// Statistiche totali (esistenti + nuovi)
const totalStats = localStorageData.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
}, {});

console.log('📊 Total Event Statistics:');
console.log(`   Low consumption events: ${totalStats.LOW || 0}`);
console.log(`   Medium consumption events: ${totalStats.MEDIUM || 0}`);
console.log(`   High consumption events: ${totalStats.HIGH || 0}`);

// Salva gli eventi in formato JSON
const outputData = {
    generatedAt: new Date().toISOString(),
    thresholds: powerThresholds,
    totalEvents: localStorageData.length,
    newEvents: completedEvents.length,
    statistics: totalStats,
    events: localStorageData
};

const outputPath = path.join(__dirname, 'generated_consumption_events.json');
fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
console.log(`💾 Events saved to: ${outputPath}`);

// Salva anche in formato compatibile con localStorage
// Controlla se esistono già eventi nel file e evita duplicati
const localStoragePath = path.join(__dirname, 'consumption_events_for_browser.json');
let existingEvents = [];

if (fs.existsSync(localStoragePath)) {
    try {
        const existingData = fs.readFileSync(localStoragePath, 'utf8');
        existingEvents = JSON.parse(existingData);
        console.log(`📁 Found ${existingEvents.length} existing events in file`);
    } catch (parseError) {
        console.warn('⚠️  Error parsing existing events file, starting fresh:', parseError.message);
        existingEvents = [];
    }
}

// Sostituisci eventi esistenti con quelli nuovi per lo stesso intervallo temporale
let replacedCount = 0;
const finalEvents = [...existingEvents]; // Copia eventi esistenti

completedEvents.forEach(newEvent => {
    const existingIndex = finalEvents.findIndex(existingEvent => 
        existingEvent.phase === newEvent.phase &&
        existingEvent.startTime === newEvent.startTime &&
        existingEvent.endTime === newEvent.endTime
    );
    
    if (existingIndex !== -1) {
        // Sostituisci l'evento esistente
        const oldEvent = finalEvents[existingIndex];
        finalEvents[existingIndex] = newEvent;
        replacedCount++;
        console.log(`🔄 Replaced event ${oldEvent.id} with new event ${newEvent.id} for phase ${newEvent.phase}`);
    } else {
        // Aggiungi nuovo evento
        finalEvents.push(newEvent);
    }
});

if (replacedCount > 0) {
    console.log(`🔄 Replaced ${replacedCount} existing events`);
}

const localStorageData = finalEvents;

// Genera ID univoci per i nuovi eventi se necessario
let maxExistingId = existingEvents.length > 0 ? Math.max(...existingEvents.map(e => parseInt(e.id) || 0)) : 0;
newEvents.forEach((event, index) => {
    if (parseInt(event.id) <= maxExistingId) {
        event.id = maxExistingId + index + 1;
    }
});

fs.writeFileSync(localStoragePath, JSON.stringify(localStorageData, null, 2));
console.log(`🌐 Browser-compatible events saved to: ${localStoragePath} (${localStorageData.length} total events)`);

// Funzioni di elaborazione eventi
function processPhaseEvent(phase, power, timestamp) {
    const eventKey = `phase_${phase}`;
    const activeEvent = activeEvents.get(eventKey);
    
    if (!activeEvent) {
        // Start a new event if power is above a minimum threshold (e.g., 10W to avoid noise)
        // This will capture LOW, MEDIUM, and HIGH consumption events
        if (power > 10) { // Minimum threshold to avoid noise from standby/off devices
            startConsumptionEvent(phase, power, timestamp);
        }
    } else {
        // Update existing event
        updateConsumptionEvent(eventKey, power, timestamp);
    }
}

function startConsumptionEvent(phase, power, timestamp) {
    const eventKey = `phase_${phase}`;
    const eventId = ++eventIdCounter;
    
    const newEvent = {
        id: eventId,
        phase: phase,
        startTime: timestamp,
        endTime: null,
        minPower: power,
        maxPower: power,
        totalPower: power,
        dataPoints: 1,
        type: null, // Sarà determinato quando l'evento finisce
        isActive: true,
        lastPower: power,
        trend: 'rising' // rising, falling, stable
    };
    
    activeEvents.set(eventKey, newEvent);
}

function updateConsumptionEvent(eventKey, power, timestamp) {
    const event = activeEvents.get(eventKey);
    if (!event) return;
    
    // Aggiorna i dati dell'evento
    event.minPower = Math.min(event.minPower, power);
    event.maxPower = Math.max(event.maxPower, power);
    event.totalPower += power;
    event.dataPoints++;
    
    // Determina la tendenza
    const powerDiff = power - event.lastPower;
    if (Math.abs(powerDiff) > 5) { // Soglia di 5W per rilevare la tendenza
        event.trend = powerDiff > 0 ? 'rising' : 'falling';
    }
    event.lastPower = power;
    
    // Check if event should end - use minimum threshold instead of LOW threshold
    // This allows LOW consumption events to be properly captured
    const shouldEnd = power <= 10; // End when power drops to near zero
    
    if (shouldEnd) {
        endConsumptionEvent(eventKey, timestamp);
    }
}

function endConsumptionEvent(eventKey, timestamp) {
    const event = activeEvents.get(eventKey);
    if (!event) return;
    
    event.endTime = timestamp;
    event.isActive = false;
    event.duration = event.endTime - event.startTime;
    event.averagePower = event.totalPower / event.dataPoints;
    
    // Determina il tipo di evento basato sulla potenza massima raggiunta
    if (event.maxPower <= powerThresholds.low) {
        event.type = 'LOW';
    } else if (event.maxPower <= powerThresholds.medium) {
        event.type = 'MEDIUM';
    } else {
        event.type = 'HIGH';
    }
    
    // Crea l'evento finale nel formato richiesto
    const finalEvent = {
        id: event.id,
        phase: event.phase,
        type: event.type,
        startTime: new Date(event.startTime).toISOString(),
        endTime: new Date(event.endTime).toISOString(),
        duration: event.duration,
        minPower: event.minPower.toFixed(2),
        maxPower: event.maxPower.toFixed(2),
        averagePower: event.averagePower.toFixed(2),
        totalEnergy: (event.averagePower * (event.duration / 1000 / 3600)).toFixed(3) // Wh
    };
    
    // Aggiungi agli eventi completati
    completedEvents.push(finalEvent);
    
    // Rimuovi dagli eventi attivi
    activeEvents.delete(eventKey);
}

console.log('🎉 Script completed successfully!');
console.log('');
console.log('📋 Next steps:');
console.log('1. Copy the events to browser localStorage:');
console.log('   - Open browser console on your dashboard');
console.log(`   - Run: localStorage.setItem('consumptionEvents', JSON.stringify(${JSON.stringify(localStorageData)}))`);
console.log('2. Or use the test page to load the generated events');
console.log('3. Refresh the consumption analysis page to see the results'); 