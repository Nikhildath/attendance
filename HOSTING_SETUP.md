# Socket.IO Server - Production Hosting Setup

## Overview
This guide covers deploying the Socket.IO server on various hosting platforms so it runs automatically 24/7.

## Deployment Options

### Option 1: Render (Recommended - Easiest)

Render automatically starts your Socket.IO server and keeps it running.

#### Steps:

1. **Connect your GitHub repository to Render**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repo branch

2. **Configuration (Render auto-detects from render.yaml)**
   - Name: `attendance-socket-server`
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm run start:socket`
   - Instance Type: Free or Starter

3. **Set Environment Variables**
   In Render Dashboard → Environment:
   ```
   NODE_ENV=production
   PORT=3001
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   FRONTEND_URL=https://your-frontend-url.vercel.app
   ```

4. **Update Frontend `.env`**
   After deployment, your Socket server URL will be:
   ```
   VITE_SOCKET_URL=https://attendance-socket-server.onrender.com
   ```

5. **Test Connection**
   Visit: `https://attendance-socket-server.onrender.com/health`
   Should show: `{"status":"ok","message":"Socket.io server is running"}`

#### Auto-Start Features:
- ✅ Automatically starts on deployment
- ✅ Auto-restarts if crashes
- ✅ Keeps running 24/7
- ✅ Free tier available (with 15-min idle timeout)
- ✅ Paid tier never sleeps

---

### Option 2: Railway

Railway provides simple deployment with auto-restart.

#### Steps:

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign in with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repo

3. **Configure Service**
   - Service name: `socket-server`
   - Build: `npm install`
   - Start: `npm run start:socket`

4. **Add Environment Variables**
   ```
   NODE_ENV=production
   PORT=3001
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   FRONTEND_URL=https://your-frontend-url
   ```

5. **Deploy**
   - Railway auto-deploys on git push
   - Auto-restarts if server crashes

---

### Option 3: Heroku (Legacy but Still Works)

#### Steps:

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Login and Create App**
   ```bash
   heroku login
   heroku create attendance-socket-server
   ```

3. **Add Buildpack**
   ```bash
   heroku buildpacks:add heroku/nodejs
   ```

4. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set VITE_SUPABASE_URL=your-url
   heroku config:set VITE_SUPABASE_ANON_KEY=your-key
   heroku config:set FRONTEND_URL=your-frontend-url
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

6. **View Logs**
   ```bash
   heroku logs --tail
   ```

---

### Option 4: Self-Hosted with PM2 (VPS/Dedicated Server)

For maximum control, use PM2 on your own server.

#### Prerequisites:
- VPS or Dedicated Server (DigitalOcean, AWS EC2, Linode, etc.)
- Node.js 16+ installed
- SSH access

#### Steps:

1. **Install PM2 Globally**
   ```bash
   npm install -g pm2
   ```

2. **Clone and Setup Repository**
   ```bash
   git clone your-repo-url
   cd attendance-hub-pro-main
   npm install
   ```

3. **Start with PM2**
   ```bash
   pm2 start ecosystem.config.js
   pm2 startup
   pm2 save
   ```

4. **Check Status**
   ```bash
   pm2 status
   pm2 logs attendance-socket-server
   ```

5. **Auto-Start on Server Reboot**
   ```bash
   pm2 startup
   pm2 save
   ```

6. **Configure Reverse Proxy (Nginx)**
   ```nginx
   server {
       listen 80;
       server_name socket.yourdomain.com;

       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

7. **Enable SSL with Certbot**
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d socket.yourdomain.com
   ```

---

## Environment Variables Reference

### Required Variables
```env
NODE_ENV=production          # Set to 'production' for hosting
PORT=3001                    # Port for Socket server
VITE_SUPABASE_URL=xxx        # Supabase project URL
VITE_SUPABASE_ANON_KEY=xxx   # Supabase anon key
FRONTEND_URL=https://your-frontend.com  # Your frontend URL
```

### Optional Variables
```env
LOG_LEVEL=info              # Logging level
RECONNECTION_DELAY=1000     # Socket reconnection delay (ms)
RECONNECTION_DELAY_MAX=5000 # Max reconnection delay (ms)
```

---

## Monitoring and Maintenance

### Check if Server is Running

```bash
# Using curl
curl https://your-socket-server.com/health

# Expected response:
# {"status":"ok","message":"Socket.io server is running"}
```

### View Server Logs

**Render:**
- Dashboard → Web Service → Logs

**Railway:**
- Dashboard → Service → Logs

**Heroku:**
- `heroku logs --tail`

**Self-hosted with PM2:**
- `pm2 logs attendance-socket-server`

### Restart Server

**Render/Railway:**
- Automatic on git push

**Heroku:**
- `heroku restart`

**PM2:**
- `pm2 restart attendance-socket-server`

---

## Troubleshooting

### Server Won't Start
1. Check environment variables are set
2. Check logs for errors
3. Verify Supabase credentials
4. Test locally: `node server.js`

### Crashes After 15 Minutes (Render Free Tier)
- Render free tier sleeps after 15 minutes of inactivity
- Upgrade to Starter tier ($7/month) to prevent sleep
- Or use Railway/Heroku alternative

### High Memory Usage
- Check number of concurrent connections
- Review location update frequency
- PM2 will auto-restart if exceeds 500MB (configurable)

### Connection Refused Errors
- Verify port 3001 is open
- Check firewall settings
- Ensure FRONTEND_URL matches actual frontend domain
- Check CORS configuration in server.js

---

## Deployment Checklist

- [ ] Update `render.yaml` with correct configuration
- [ ] Set `VITE_SOCKET_URL` in frontend `.env`
- [ ] Add all required environment variables
- [ ] Test Socket connection with `/health` endpoint
- [ ] Verify location updates appear in Field Tracking
- [ ] Check server logs for errors
- [ ] Monitor first week for crashes
- [ ] Set up monitoring/alerts (optional)

---

## Cost Comparison

| Platform | Cost | Auto-Restart | Keep-Alive |
|----------|------|--------------|-----------|
| Render Free | Free | ✅ | 15 min timeout |
| Render Starter | $7/month | ✅ | Always on |
| Railway | $5/month+ | ✅ | Always on |
| Heroku | $50/month+ | ✅ | Always on |
| Self-hosted | $3-10/month | ✅ (PM2) | Depends |

---

## Quick Start Command Summary

### Local Development
```bash
npm run server:dev          # With auto-reload (nodemon)
npm run server:socket       # Production mode
```

### With PM2
```bash
pm2 start ecosystem.config.js    # Start
pm2 stop attendance-socket-server # Stop
pm2 restart attendance-socket-server # Restart
pm2 logs attendance-socket-server # View logs
pm2 delete attendance-socket-server # Remove
```

### Deploy to Render
```bash
git add .
git commit -m "Update render.yaml for Socket.IO"
git push origin main
# Render auto-deploys
```

---

## Success Indicators

✅ Server is running 24/7  
✅ Auto-restarts after crashes  
✅ All employees show as "active" on field tracking  
✅ Real-time location updates appear instantly  
✅ No Socket connection errors in browser console  
✅ Health check endpoint returns 200 OK
