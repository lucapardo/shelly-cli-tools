# 🚀 Shelly Data Capture Server - Deployment Web

Guida completa per il deployment del server Shelly in ambiente web.

## 📋 Prerequisiti

- **Node.js** 18+ 
- **Docker** (opzionale, per containerizzazione)
- **Docker Compose** (opzionale)
- **Nginx** (opzionale, per reverse proxy)

## 🔧 Metodi di Deployment

### 1. Deployment Diretto (Node.js)

```bash
# Clona il repository
git clone <repository-url>
cd shelly-cli-tools

# Installa dipendenze
npm install

# Avvia il server
npm start
```

Il server sarà disponibile su `http://localhost:3000`

### 2. Deployment con Docker

```bash
# Build dell'immagine Docker
npm run build:docker

# Avvia con Docker Compose
npm run deploy

# Oppure manualmente
docker run -d -p 3000:3000 -v ./data:/app/data shelly-data-capture
```

### 3. Build Completa per Produzione

```bash
# Esegui il build script
npm run build

# Questo creerà:
# - build/ directory con tutti i file
# - shelly-web-deployment.zip per il deployment
```

## 🌐 Configurazione Nginx (Opzionale)

Per un deployment in produzione con HTTPS:

1. Copia `nginx.conf` nella configurazione Nginx
2. Modifica il `server_name` con il tuo dominio
3. Aggiungi i certificati SSL
4. Riavvia Nginx

```bash
# Testa la configurazione
sudo nginx -t

# Riavvia Nginx
sudo systemctl restart nginx
```

## 🔐 Configurazione di Sicurezza

### Variabili d'Ambiente

Crea un file `.env` (non incluso in Git):

```env
NODE_ENV=production
PORT=3000
SHELLY_DEFAULT_IP=192.168.1.51
```

### Firewall

```bash
# Consenti solo le porte necessarie
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # Solo se accesso diretto
```

## 📊 Monitoraggio

### Comandi Utili

```bash
# Visualizza logs
npm run logs

# Stato dei container
docker-compose ps

# Riavvia i servizi
docker-compose restart

# Aggiorna l'applicazione
git pull
npm run deploy
```

### Health Check

L'applicazione espone un endpoint di status:
- `GET /collection-status` - Stato della raccolta dati
- `GET /` - Dashboard principale

## 🔄 Aggiornamenti

Per aggiornare l'applicazione:

```bash
# Ferma i servizi
npm run stop

# Aggiorna il codice
git pull

# Rebuild e riavvia
npm run build
npm run deploy
```

## 🐛 Troubleshooting

### Problemi Comuni

1. **Porta 3000 occupata**
   ```bash
   lsof -i :3000
   kill -9 <PID>
   ```

2. **Errori di permessi**
   ```bash
   sudo chown -R $USER:$USER data/
   chmod -R 755 data/
   ```

3. **Problemi Docker**
   ```bash
   docker-compose down
   docker system prune -f
   npm run deploy
   ```

### Logs

```bash
# Logs applicazione
npm run logs

# Logs sistema
journalctl -u docker -f

# Logs Nginx
sudo tail -f /var/log/nginx/error.log
```

## 📈 Performance

### Ottimizzazioni Consigliate

1. **Reverse Proxy**: Usa Nginx per servire file statici
2. **Gzip**: Attiva compressione per ridurre il traffico
3. **CDN**: Usa CloudFlare o simili per asset statici
4. **Caching**: Implementa cache Redis per dati frequenti

### Monitoraggio Risorse

```bash
# Uso memoria container
docker stats

# Uso disco
df -h

# Processi Node.js
top -p $(pgrep node)
```

## 🔗 URL Utili

- **Dashboard**: `http://your-domain.com/`
- **Grafici**: `http://your-domain.com/graphs.html`
- **Impostazioni**: `http://your-domain.com/settings.html`
- **API Status**: `http://your-domain.com/collection-status`

## 📞 Supporto

Per problemi o domande:
1. Controlla i logs: `npm run logs`
2. Verifica la configurazione Shelly
3. Testa la connettività di rete
4. Consulta la documentazione API Shelly

---

**Nota**: Assicurati che il dispositivo Shelly sia raggiungibile dalla rete dove è deployato il server. 