# Quick Deployment Checklist

## Pre-Deployment (Local Testing)

- [ ] Socket server runs locally: `npm run server:socket`
- [ ] Health check works: `curl http://localhost:3001/health`
- [ ] Frontend connects to socket: Check browser console for "Socket connected successfully"
- [ ] Location updates appear in real-time
- [ ] All employees show as "active" green dots in Field Tracking

---

## Step 1: Choose Hosting Platform

### Easiest Option: Render
- [ ] Render.yaml is updated ✅ (Already done)
- [ ] No additional config needed

### Alternative: Railway
- [ ] Use same render.yaml logic
- [ ] Create railway.toml if needed

### Self-Hosted: PM2
- [ ] Install PM2: `npm install -g pm2`
- [ ] Test locally: `pm2 start ecosystem.config.js`
- [ ] Verify: `pm2 status`

---

## Step 2: Environment Variables

### For Render (Add in Dashboard)
```
NODE_ENV=production
PORT=3001
VITE_SUPABASE_URL=https://rrooywngvlmssikmzgse.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
FRONTEND_URL=https://your-deployed-frontend-url
```

### For PM2 (.env file - already set)
- [ ] Check .env has all required variables
- [ ] Verify paths are correct

---

## Step 3: Deploy

### Option A: Render (Automated)
```bash
# Just push to GitHub - Render auto-deploys!
git add .
git commit -m "Deploy Socket.IO with auto-start"
git push origin main
```

Then:
1. Go to Render Dashboard
2. Check "attendance-socket-server" service
3. Wait 2-3 minutes for deployment
4. Check "Logs" tab for "Socket.io server running on port 3001"

### Option B: PM2 (Manual VPS)
```bash
# SSH into your server
ssh user@your-server.com

# Clone and setup
git clone your-repo-url
cd attendance-hub-pro-main
npm install

# Start with PM2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

---

## Step 4: Post-Deployment Verification

### Check 1: Server is Running
```bash
# Get your deployed Socket URL from Render/Railway
curl https://your-socket-server.onrender.com/health
```
Expected: `{"status":"ok","message":"Socket.io server is running"}`

### Check 2: Frontend Socket Configuration
Update your frontend `.env` file:
```env
VITE_SOCKET_URL=https://your-socket-server.onrender.com
# (or your Railway/self-hosted URL)
```

### Check 3: Test Real Connection
1. Redeploy frontend with new Socket URL
2. Log in as employee
3. Open Field Tracking page
4. Check browser DevTools Console → Should see:
   ```
   Attempting Socket connection to: https://your-socket-server.onrender.com
   Socket connected successfully: xxxxx
   Received batch locations: 5
   ```

### Check 4: Verify in UI
- All logged-in employees show green "active" dots
- Locations update in real-time (try moving around)
- No red errors in console

---

## Step 5: Monitor

### Render (Free)
- ⚠️ Will sleep after 15 min inactivity
- ✅ Auto-wakes on incoming request
- 💡 Consider upgrading to Starter ($7/month) to prevent sleep

### Railway/Heroku
- ✅ Always running
- Monitor from dashboard

### PM2 (Self-Hosted)
```bash
pm2 status                    # Check status
pm2 logs                      # View real-time logs
pm2 monit                     # Monitor CPU/Memory
```

---

## Troubleshooting Quick Fixes

### Socket says "not connected" in console
1. Check Socket URL is correct: `VITE_SOCKET_URL`
2. Check server is deployed and running
3. Wait 30 seconds for first attempt
4. Try refreshing page

### Employees still show as "offline"
1. Check server logs for auth errors
2. Verify VITE_SUPABASE_URL and KEY are correct
3. Ensure geolocation permission is granted
4. Check browser console for errors

### Server keeps crashing
1. Check Supabase credentials are valid
2. View logs for error messages
3. Check memory limit (Render free = 512MB)
4. Consider upgrading to paid tier

### CORS errors
1. Verify FRONTEND_URL matches your deployed frontend
2. Restart socket server
3. Clear browser cache

---

## Configuration Files Summary

| File | Purpose | Status |
|------|---------|--------|
| `render.yaml` | Render deployment config | ✅ Updated |
| `ecosystem.config.js` | PM2 process management | ✅ Created |
| `package.json` | Scripts and dependencies | ✅ Updated |
| `.env` | Environment variables | ⏳ Manual setup |
| `server.js` | Socket.IO server | ✅ Production-ready |

---

## What Happens Now

1. **Auto-Start**: Socket server starts automatically on deployment
2. **Auto-Restart**: If crashes, automatically restarts (Render/Railway/PM2)
3. **Always Running**: 24/7 uptime (except Render free tier sleeps)
4. **Real-Time**: Location updates broadcast to all connected users
5. **Fallback**: If Socket fails, app falls back to Supabase Realtime

---

## Next Steps

1. [ ] Choose hosting platform (Render recommended)
2. [ ] Set environment variables in platform dashboard
3. [ ] Push to GitHub (auto-deploys on Render/Railway)
4. [ ] Verify Socket server health endpoint
5. [ ] Update frontend `VITE_SOCKET_URL`
6. [ ] Test with employees logging in
7. [ ] Monitor first week for issues

---

## Support

### View Deployment Logs
- **Render**: Dashboard → Web Service → Logs
- **Railway**: Dashboard → Logs
- **PM2**: `pm2 logs attendance-socket-server`

### Common Commands
```bash
# Local testing
npm run server:socket

# PM2 management
pm2 start ecosystem.config.js
pm2 stop attendance-socket-server
pm2 restart attendance-socket-server
pm2 delete attendance-socket-server

# View processes
pm2 status
pm2 monit
```

---

**Estimated Setup Time**: 10-15 minutes  
**Annual Cost**: Free (Render) to $7/month (Render Starter)  
**Reliability**: 99%+ uptime
