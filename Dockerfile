# Dockerfile per Shelly Data Capture Server
FROM node:18-alpine

# Imposta la directory di lavoro
WORKDIR /app

# Copia i file di configurazione package
COPY package*.json ./

# Installa le dipendenze di produzione
RUN npm ci --only=production && npm cache clean --force

# Copia il codice sorgente
COPY . .

# Crea la directory data se non esistisse
RUN mkdir -p data

# Espone la porta 3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/collection-status || exit 1

# Avvia il server
CMD ["npm", "start"] 