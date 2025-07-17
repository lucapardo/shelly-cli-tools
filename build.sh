#!/bin/bash

# Build script per Shelly Data Capture Server
# Prepara l'applicazione per il deployment web

set -e

echo "🚀 Shelly Data Capture Server - Build Web"
echo "======================================="

# Colori per l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funzione per logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# 1. Controllo prerequisiti
log "Controllo prerequisiti..."

if ! command -v node &> /dev/null; then
    error "Node.js non è installato"
fi

if ! command -v npm &> /dev/null; then
    error "npm non è installato"
fi

NODE_VERSION=$(node --version)
info "Node.js version: $NODE_VERSION"

# 2. Installazione dipendenze
log "Installazione dipendenze..."
npm ci --production

# 3. Creazione directory di build
log "Creazione directory build..."
rm -rf build/
mkdir -p build/

# 4. Copia file necessari
log "Copia file per deployment..."
cp -r bin build/
cp -r packages build/
cp -r src build/
cp -r config build/ 2>/dev/null || true
cp -r env build/ 2>/dev/null || true

# Copia data/ escludendo i log troppo grandi
mkdir -p build/data/
cp data/*.csv build/data/ 2>/dev/null || true
cp data/*.json build/data/ 2>/dev/null || true
cp data/*.backup build/data/ 2>/dev/null || true

cp *.html build/
cp *.js build/
cp *.json build/
cp Dockerfile build/
cp docker-compose.yml build/
cp nginx.conf build/
cp install-windows.bat build/
cp README_WINDOWS.md build/
cp WINDOWS_DEPLOYMENT.md build/
cp .env.example build/

# 5. Verifica integrità file
log "Verifica integrità file..."
if [ ! -f "build/server.js" ]; then
    error "File server.js mancante nella build"
fi

if [ ! -f "build/package.json" ]; then
    error "File package.json mancante nella build"
fi

# 6. Creazione archivio di deployment
log "Creazione archivio di deployment..."
cd build/
zip -r ../shelly-web-deployment.zip . -x "*.DS_Store" "*/.*" 2>/dev/null
cd ..

# 7. Informazioni finali
log "Build completata con successo!"
info "File di deployment: shelly-web-deployment.zip"
info "Dimensione: $(du -h shelly-web-deployment.zip | cut -f1)"

echo ""
echo "📦 Deployment pronto!"
echo "==================="
echo "Per deployare:"
echo "1. Copia shelly-web-deployment.zip sul server"
echo "2. Estrai il file ZIP"
echo "3. Windows: Doppio click su install-windows.bat"
echo "4. Linux/Docker: docker-compose up -d"
echo ""
echo "Oppure esegui direttamente:"
echo "npm start"
echo ""
echo "🌐 L'applicazione sarà disponibile su http://localhost:3000"

echo "🏗️  Building Shelly Web Deployment Package..."

# Clean previous build
rm -rf build/
rm -f shelly-web-deployment.zip

# Create build directory
mkdir -p build

echo "📂 Copying server files..."
# Copy main server files
cp server.js build/
cp package.json build/
cp windows-data-collector.js build/

echo "📂 Copying required directories..."
# Copy required directories (not contents, but the directories themselves)
cp -r bin build/
cp -r src build/
cp -r config build/
cp -r packages build/

echo "📂 Copying data directory structure..."
# Create data directory structure
mkdir -p build/data

echo "📂 Copying web files..."
# Copy main HTML files
cp *.html build/

echo "📂 Copying Windows deployment files..."
# Copy Windows-specific files
cp install-windows.bat build/
cp README_WINDOWS.md build/
cp WINDOWS_DEPLOYMENT.md build/
cp .env.example build/

echo "📂 Copying Docker files..."
# Copy Docker files
cp Dockerfile build/
cp docker-compose.yml build/
cp nginx.conf build/
cp DEPLOYMENT.md build/

echo "📦 Installing dependencies..."
cd build
npm install --production

echo "🧹 Cleaning up large log files..."
# Remove any large log files to keep package size manageable
find . -name "*.log" -size +10M -delete
find . -name "node_modules" -type d -exec find {} -name "*.log" -delete \;

cd ..

echo "📊 Package contents:"
du -sh build/*

echo "🗜️  Creating ZIP package..."
cd build
zip -r ../shelly-web-deployment.zip . -x "*.git*" "node_modules/.cache/*" "*.tmp"
cd ..

echo "✅ Build complete!"
echo "📦 Package: shelly-web-deployment.zip"
ls -lh shelly-web-deployment.zip 