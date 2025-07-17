@echo off
:: Shelly Data Capture Server - Installer per Windows
:: Questo script automatizza l'installazione e la configurazione

echo.
echo ========================================
echo  Shelly Data Capture Server - Windows
echo ========================================
echo.

:: Controlla se Node.js è installato
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERRORE] Node.js non è installato!
    echo.
    echo Scarica e installa Node.js da: https://nodejs.org/en/download/
    echo Scegli la versione LTS per Windows
    echo.
    pause
    exit /b 1
)

:: Mostra versione Node.js
echo [INFO] Node.js trovato:
node --version
npm --version
echo.

:: Controlla se siamo nella directory corretta
if not exist "server.js" (
    echo [ERRORE] File server.js non trovato!
    echo Assicurati di essere nella directory corretta del progetto.
    echo.
    pause
    exit /b 1
)

:: Installa le dipendenze
echo [SETUP] Installazione dipendenze...
npm install
if errorlevel 1 (
    echo [ERRORE] Installazione dipendenze fallita!
    pause
    exit /b 1
)

:: Crea directory data se non esiste
if not exist "data" (
    echo [SETUP] Creazione directory data...
    mkdir data
)

:: Crea file di configurazione se non esiste
if not exist ".env" (
    echo [SETUP] Creazione file di configurazione...
    echo NODE_ENV=production > .env
    echo PORT=3000 >> .env
    echo SHELLY_DEFAULT_IP=192.168.1.51 >> .env
)

:: Configurazione firewall (richiede privilegi amministratore)
echo [SETUP] Configurazione firewall Windows...
netsh advfirewall firewall add rule name="Shelly Server" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Non è stato possibile configurare il firewall automaticamente.
    echo Esegui questo script come Amministratore per configurare il firewall.
)

:: Crea script di avvio
echo [SETUP] Creazione script di avvio...
echo @echo off > start-server.bat
echo cd /d "%~dp0" >> start-server.bat
echo echo Avvio Shelly Data Capture Server... >> start-server.bat
echo npm start >> start-server.bat
echo pause >> start-server.bat

:: Crea script di stop
echo @echo off > stop-server.bat
echo echo Ricerca processi Node.js per Shelly Server... >> stop-server.bat
echo for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo table ^| findstr "node.exe"') do taskkill /pid %%i /f >> stop-server.bat
echo echo Server fermato. >> stop-server.bat
echo pause >> stop-server.bat

:: Trova l'IP locale
echo [INFO] Ricerca indirizzo IP locale...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set LOCAL_IP=%%b
        goto :found_ip
    )
)
:found_ip

echo.
echo ========================================
echo  INSTALLAZIONE COMPLETATA CON SUCCESSO!
echo ========================================
echo.
echo Per avviare il server:
echo  1. Doppio click su "start-server.bat"
echo  2. Oppure esegui: npm start
echo.
echo Il server sarà disponibile su:
echo  - Locale: http://localhost:3000
if defined LOCAL_IP echo  - Rete:   http://%LOCAL_IP%:3000
echo.
echo Per fermare il server:
echo  - Doppio click su "stop-server.bat"
echo  - Oppure premi Ctrl+C nel terminale
echo.
echo File di configurazione creato: .env
echo Logs disponibili nella cartella: data/
echo.
echo Vuoi avviare il server ora? (S/N)
set /p choice=
if /i "%choice%"=="S" (
    echo.
    echo Avvio del server...
    start "Shelly Server" cmd /k npm start
    echo.
    echo Server avviato in una nuova finestra!
    echo Apri il browser su: http://localhost:3000
) else (
    echo.
    echo Per avviare in seguito, usa: start-server.bat
)

echo.
pause 