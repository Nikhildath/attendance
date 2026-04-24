# ✅ TWO SEPARATE DEPLOYMENTS - Simple Guide

Your project is now separated into **2 independent parts**:

## 1️⃣ SOCKET SERVER (Backend)
Location: `/socket-server` folder  
Purpose: Handles real-time location updates  
Deploy to: **Render** (or Railway)

## 2️⃣ REACT FRONTEND (Website)
Location: Main folder `/` (root)  
Purpose: Employee app they see in browser  
Deploy to: **Vercel, Netlify, or Render**

---

## 📋 Deployment Steps

### Step 1: Deploy Socket Server to Render ⚙️

1. Go to **https://render.com** (sign in)
2. Click **"New +" → "Web Service"**
3. Select your GitHub repo
4. For **Root Directory**, enter: `socket-server`
5. Click **"Deploy"**
6. After it deploys, copy the URL (looks like: `https://attendance-socket-server.onrender.com`)

### Step 2: Set Socket Server Environment Variables

On Render Dashboard:
1. Go to your Socket service
2. Click **"Environment"** tab
3. Add these variables:
   ```
   VITE_SUPABASE_URL = https://rrooywngvlmssikmzgse.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   FRONTEND_URL = https://your-frontend-url-here.com
   ```

> 💡 **Later:** Update `FRONTEND_URL` to where you deploy your React app

### Step 3: Deploy Frontend to Vercel (Easiest) 🎨

1. Go to **https://vercel.com** (sign in with GitHub)
2. Click **"Add New..." → "Project"**
3. Select your GitHub repo
4. Click **"Deploy"** (Vercel auto-detects everything)

### Step 4: Set Frontend Environment Variables

On Vercel Dashboard:
1. Go to your project
2. Click **"Settings" → "Environment Variables"**
3. Add these:
   ```
   VITE_SUPABASE_URL = https://rrooywngvlmssikmzgse.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   VITE_SOCKET_URL = https://attendance-socket-server.onrender.com
   ```

> ✅ Use the Socket server URL from Step 1

### Step 5: Redeploy Frontend

1. Go back to Vercel
2. Click **"Redeploy"** to apply new environment variables

---

## ✨ After Deployment

| Service | What to Test |
|---------|-------------|
| **Socket Server** | Go to `https://your-socket-server.onrender.com/health` → Should show `{"status":"ok",...}` |
| **Frontend** | Go to `https://your-frontend.vercel.app` → Should load app |
| **Together** | Log in → Go to Field Tracking → Should see green dots |

---

## 🎯 Quick Summary

```
GitHub Repo (One)
├── /socket-server    →  Deploy to Render  →  https://socket.onrender.com
└── / (frontend)      →  Deploy to Vercel  →  https://app.vercel.app
```

Both services talk to **same Supabase database** ✅

---

## 💰 Costs

| Service | Free Tier | Cost/Month |
|---------|-----------|-----------|
| Render Socket | 15 min sleep | $7 (no sleep) |
| Vercel Frontend | Forever free | FREE |
| Netlify Frontend | Forever free | FREE |
| **Total** | **FREE** (with sleep) | **$7** (always on) |

---

## ⚠️ Important Notes

- **Socket server Render free tier:** Falls asleep after 15 min with no traffic
  - ✅ Wakes up when app tries to connect
  - 💡 Upgrade to **Starter ($7/month)** to prevent sleep

- **Frontend URL must match:** Update `FRONTEND_URL` in Socket server if you change frontend URL

- **Push to GitHub:** Auto-deploys on both Render and Vercel

---

## File Structure Explanation

```
attendance-hub-pro-main/
├── socket-server/              ← Deploy THIS to Render (backend)
│   ├── package.json            ← Socket server dependencies only
│   ├── server.js               ← Socket.IO server code
│   ├── .env                    ← Socket server env vars
│   ├── render.yaml             ← Render config
│   └── README.md               ← Socket server docs
│
├── src/                        ← React app source
├── package.json                ← React app dependencies (updated)
├── render.yaml                 ← Frontend-only config
├── .env                        ← Frontend env vars
└── ... other files
```

---

## Troubleshooting

### Socket server not connecting
- [ ] Check Socket URL in frontend `.env` is correct
- [ ] Verify Socket server health: `/health` endpoint
- [ ] Check `FRONTEND_URL` matches deployed frontend

### Employees still offline
- [ ] Verify Supabase URL & KEY are correct (in both)
- [ ] Check browser geolocation permission
- [ ] Restart/redeploy services

### "Connection refused" error
- [ ] Wait 2-3 min for deployment to complete
- [ ] Check firewall isn't blocking port 3001
- [ ] Try accessing `/health` endpoint in browser

---

## Next Steps

1. ✅ Deploy Socket server to Render (`/socket-server`)
2. ✅ Deploy Frontend to Vercel
3. ✅ Update environment variables in both
4. ✅ Test `/health` endpoint
5. ✅ Test app login and Field Tracking
6. ✅ Monitor for 24 hours

---

**Everything is ready! Just push to GitHub and deploy.** 🚀
