# 🪟 Shelly Data Capture Server - Deployment Windows

Guida completa per far girare il server Shelly come server web su Windows.

## 🔧 Metodo 1: Node.js Diretto (Consigliato)

### Prerequisiti
1. **Scarica Node.js**: https://nodejs.org/en/download/
   - Scegli "Windows Installer (.msi)" 
   - Versione LTS (attualmente 18.x o 20.x)
   - Durante l'installazione, seleziona "Add to PATH"

2. **Verifica installazione** (apri Command Prompt o PowerShell):
   ```cmd
   node --version
   npm --version
   ```

### Installazione e Avvio
```cmd
# 1. Scarica l'archivio di deployment
# Estrai shelly-web-deployment.zip in una cartella (es: C:\shelly-server\)

# 2. Apri Command Prompt come Amministratore e vai nella cartella
cd C:\shelly-server

# 3. Installa dipendenze
npm install

# 4. Avvia il server
npm start
```

Il server sarà disponibile su: `http://localhost:3000`

### 🔄 Avvio Automatico (Servizio Windows)

Per far partire automaticamente all'avvio di Windows:

#### Opzione A: PM2 (Process Manager)
```cmd
# Installa PM2 globalmente
npm install -g pm2
npm install -g pm2-windows-service

# Configura come servizio Windows
pm2-service-install
pm2 start server.js --name "shelly-server"
pm2 save
pm2 startup
```

#### Opzione B: Task Scheduler
1. Apri "Utilità di pianificazione" (Task Scheduler)
2. Crea attività di base
3. Trigger: "All'avvio del computer"
4. Azione: Avvia programma
   - Programma: `C:\Program Files\nodejs\node.exe`
   - Argomenti: `server.js`
   - Directory: `C:\shelly-server`

## 🐳 Metodo 2: Docker Desktop per Windows

### Prerequisiti
1. **Docker Desktop**: https://www.docker.com/products/docker-desktop/
2. **WSL 2**: Windows Subsystem for Linux (si installa automaticamente)

### Installazione
```cmd
# 1. Estrai i file in C:\shelly-server\
cd C:\shelly-server

# 2. Build dell'immagine Docker
docker build -t shelly-data-capture .

# 3. Avvia con Docker Compose
docker-compose up -d

# 4. Verifica che funzioni
docker-compose ps
```

### Gestione Docker
```cmd
# Ferma i servizi
docker-compose down

# Visualizza logs
docker-compose logs -f

# Riavvia
docker-compose restart
```

## 🐧 Metodo 3: WSL (Windows Subsystem for Linux)

### Abilitazione WSL
```powershell
# Esegui in PowerShell come Amministratore
wsl --install
```

### Installazione in WSL
```bash
# In WSL Ubuntu
sudo apt update
sudo apt install nodejs npm

# Vai alla cartella condivisa
cd /mnt/c/shelly-server

# Installa e avvia
npm install
npm start
```

## 🌐 Configurazione Firewall Windows

Per accesso dalla rete locale:

### Windows Firewall
1. Apri "Windows Defender Firewall con sicurezza avanzata"
2. Regole connessioni in entrata → Nuova regola
3. Tipo: Porta
4. TCP, porta 3000
5. Consenti connessione
6. Nome: "Shelly Server"

### Alternativa Command Line
```cmd
netsh advfirewall firewall add rule name="Shelly Server" dir=in action=allow protocol=TCP localport=3000
```

## 🔧 Configurazione Avanzata Windows

### File .bat per Avvio Rapido
Crea `start-shelly.bat`:
```bat
@echo off
cd /d "C:\shelly-server"
echo Starting Shelly Data Capture Server...
npm start
pause
```

### Variabili d'Ambiente Windows
1. Tasto destro su "Questo PC" → Proprietà
2. Impostazioni di sistema avanzate
3. Variabili d'ambiente
4. Aggiungi:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `SHELLY_DEFAULT_IP=192.168.1.51`

### PowerShell Script
Crea `start-shelly.ps1`:
```powershell
# Vai alla directory del server
Set-Location "C:\shelly-server"

# Controlla se Node.js è installato
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js non trovato! Installare da https://nodejs.org/" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Avvio Shelly Data Capture Server..." -ForegroundColor Green
npm start
```

## 🌍 Accesso dalla Rete

### Trova IP Windows
```cmd
ipconfig | findstr IPv4
```

### Modifica server.js (se necessario)
Se vuoi accesso da altri dispositivi, nel server.js cambia:
```javascript
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
```

## 🔐 Sicurezza per Produzione

### 1. Aggiorna regolarmente
```cmd
npm audit
npm audit fix
```

### 2. Usa HTTPS con certificato
Installa certificato SSL e modifica nginx.conf o usa:
- Let's Encrypt per Windows
- Cloudflare per proxy SSL

### 3. Backup automatico
Crea script PowerShell per backup automatico della cartella `data\`:
```powershell
$source = "C:\shelly-server\data"
$destination = "C:\Backup\shelly-data-$(Get-Date -Format 'yyyy-MM-dd')"
Copy-Item -Path $source -Destination $destination -Recurse
```

## 🐛 Troubleshooting Windows

### Errori Comuni

1. **"node non riconosciuto"**
   - Riavvia Command Prompt dopo installazione Node.js
   - Verifica PATH: `echo %PATH%`

2. **Porta 3000 occupata**
   ```cmd
   netstat -ano | findstr :3000
   taskkill /PID <PID_NUMBER> /F
   ```

3. **Errore permessi**
   - Esegui Command Prompt come Amministratore
   - Controlla permessi cartella

4. **Firewall blocca connessioni**
   - Controlla Windows Defender
   - Aggiungi eccezione per porta 3000

### Performance Monitoring
```cmd
# Uso CPU/RAM del processo Node
tasklist /fi "imagename eq node.exe"

# Monitoraggio continuo
wmic process where name="node.exe" get ProcessId,PageFileUsage,WorkingSetSize /format:table
```

## ✅ Verifica Installazione

Dopo l'avvio, verifica che tutto funzioni:

1. **Server locale**: http://localhost:3000
2. **Dalla rete**: http://IP_WINDOWS:3000
3. **API Status**: http://localhost:3000/collection-status

## 📞 Supporto Windows

Per problemi specifici Windows:
- Controlla Event Viewer per errori sistema
- Verifica Windows Update
- Disabilita temporaneamente antivirus per test
- Usa modalità compatibilità se necessario

---
**💡 Tip**: Per un server di produzione su Windows, considera Windows Server con IIS come reverse proxy instead di Nginx. 