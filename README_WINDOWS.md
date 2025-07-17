# 🪟 Shelly Server per Windows - Guida Rapida

Server web per monitoraggio dispositivi Shelly Pro3EM su Windows.

## 🚀 Installazione Rapida (3 Passi)

### 1. Installa Node.js
- Vai su: https://nodejs.org/en/download/
- Scarica "Windows Installer (.msi)" versione LTS
- Installa con le impostazioni predefinite

### 2. Estrai il Progetto
- Estrai `shelly-web-deployment.zip` in una cartella (es: `C:\shelly-server\`)
- Apri la cartella estratta

### 3. Installa e Avvia
- **Doppio click** su `install-windows.bat`
- Segui le istruzioni a schermo
- Il server si avvierà automaticamente

## 🌐 Accesso al Server

Dopo l'installazione, apri il browser su:
- **Locale**: http://localhost:3000
- **Dalla rete**: http://TUO_IP:3000

## 🎛️ Gestione Server

### Avviare il Server
- **Doppio click** su `start-server.bat`
- Oppure apri Command Prompt e digita: `npm start`

### Fermare il Server
- **Doppio click** su `stop-server.bat`
- Oppure premi `Ctrl+C` nella finestra del server

### Controllare se Funziona
1. Apri browser su http://localhost:3000
2. Dovresti vedere la dashboard Shelly
3. Inserisci l'IP del tuo dispositivo Shelly
4. Clicca "Start Data Collection"

## 🔧 Configurazione

### IP Dispositivo Shelly
1. Apri http://localhost:3000
2. Inserisci l'IP del tuo Shelly Pro3EM nel campo "Device IP"
3. Clicca "Start Data Collection"

### Modifica Configurazione
Modifica il file `.env` per cambiare:
```
NODE_ENV=production
PORT=3000
SHELLY_DEFAULT_IP=192.168.1.51
```

## 🌍 Accesso da Altri Computer

### Dalla Stessa Rete
1. Trova l'IP del PC Windows: apri Command Prompt e digita `ipconfig`
2. Cerca "Indirizzo IPv4" (es: 192.168.1.100)
3. Su altri dispositivi vai su: http://192.168.1.100:3000

### Configurazione Firewall
Se non riesci ad accedere da altri dispositivi:
1. Apri "Windows Defender Firewall"
2. Clicca "Consenti app tramite firewall"
3. Aggiungi "Node.js" o "npm"
4. Oppure esegui `install-windows.bat` come Amministratore

## 🐛 Problemi Comuni

### "node non riconosciuto"
- Riavvia Command Prompt dopo aver installato Node.js
- Assicurati di aver installato Node.js correttamente

### "Porta 3000 occupata"
```cmd
netstat -ano | findstr :3000
taskkill /PID NUMERO_PID /F
```

### Server non si avvia
1. Controlla che Node.js sia installato: `node --version`
2. Vai nella cartella corretta del progetto
3. Esegui: `npm install`
4. Riprova: `npm start`

### Non vedo i dati
1. Controlla che il dispositivo Shelly sia acceso
2. Verifica che l'IP del Shelly sia corretto
3. Assicurati che PC e Shelly siano sulla stessa rete

## 📁 File Importanti

- `start-server.bat` - Avvia il server
- `stop-server.bat` - Ferma il server  
- `install-windows.bat` - Installazione automatica
- `.env` - Configurazione
- `data/` - Cartella con i dati raccolti
- `server.js` - File principale del server

## 🔄 Avvio Automatico

### All'Avvio di Windows
1. Premi `Win+R`, digita `shell:startup`
2. Copia `start-server.bat` nella cartella che si apre
3. Il server si avvierà automaticamente al boot

### Con PM2 (Avanzato)
```cmd
npm install -g pm2
npm install -g pm2-windows-service
pm2-service-install
pm2 start server.js --name "shelly-server"
pm2 save
```

## 📞 Supporto

Se hai problemi:
1. Controlla che Shelly e PC siano sulla stessa rete WiFi
2. Verifica l'IP del dispositivo Shelly
3. Prova a disabilitare temporaneamente l'antivirus
4. Assicurati che Windows sia aggiornato

---

## 🎯 Link Utili

- **Dashboard Principale**: http://localhost:3000
- **Grafici Dettagliati**: http://localhost:3000/graphs.html  
- **Impostazioni**: http://localhost:3000/settings.html
- **Stato API**: http://localhost:3000/collection-status

**💡 Suggerimento**: Aggiungi ai preferiti http://localhost:3000 per accesso rapido! 