# PrivatePump Vercel Deployment Guide

## Quick Setup (5 minutes)

### Step 1: Connect GitHub to Vercel
1. Go to https://vercel.com/new
2. Click "Continue with GitHub"
3. Authorize Vercel to access your GitHub account
4. Search for "PrivatePump" repository
5. Click "Import"

### Step 2: Configure Environment Variables

**Minimum Required (2 variables):**

```
NEXT_PUBLIC_PROGRAM_ID = 84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk
NEXT_PUBLIC_RPC_URL = https://api.devnet.solana.com
```

**Full Setup (4 variables):**

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `NEXT_PUBLIC_PROGRAM_ID` | `84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk` | ✅ Yes | Solana smart contract |
| `NEXT_PUBLIC_RPC_URL` | `https://api.devnet.solana.com` | ✅ Yes | Solana RPC endpoint |
| `NEXT_PUBLIC_SERVER_URL` | `https://your-server.railway.app` | ⚠️ Optional | Socket.io backend URL |
| `DATABASE_URL` | `postgresql://...` | ⚠️ Optional | PostgreSQL connection |

### Step 3: Deploy

1. In Vercel dashboard, go to Settings → Environment Variables
2. Add all 4 variables listed above
3. Select environments: **Production, Preview, Development**
4. Click "Save" then "Redeploy"
5. Wait 2-3 minutes for build to complete
6. Your app is live at `https://your-project.vercel.app`

---

## ⚙️ Production Server Setup (Socket.io Backend)

Your Socket.io server needs separate hosting. Choose one:

### Option 1: Railway.app (Recommended - $5/month)

```bash
# 1. Create account at https://railway.app
# 2. Connect GitHub
# 3. Create new project → Deploy from GitHub
# 4. Select PrivatePump repository
# 5. Set root directory to: server
# 6. Add environment variables:
#    PORT=3002
#    NODE_ENV=production
# 7. Deploy
# 8. Get public URL from Railway dashboard
```

**After deployment, add to Vercel:**
```
NEXT_PUBLIC_SERVER_URL = https://your-app-name.up.railway.app
```

### Option 2: Render.com (Free tier available)

```bash
# 1. Create account at https://render.com
# 2. Click "New +" → "Web Service"
# 3. Connect GitHub repo
# 4. Set root directory to: server
# 5. Set build command: pnpm install && pnpm build
# 6. Set start command: pnpm start
# 7. Add environment variables
# 8. Deploy
```

**After deployment, add to Vercel:**
```
NEXT_PUBLIC_SERVER_URL = https://your-app-name.onrender.com
```

### Option 3: Replit (Free + Easy)

1. Go to https://replit.com
2. Create new Replit project
3. Import from GitHub: `ck2010317/PrivatePump`
4. Create `.replit` file:
```
run = "cd server && pnpm install && pnpm start"
```
5. Click "Run"
6. Get public URL from Replit (shown at top)

**After deployment, add to Vercel:**
```
NEXT_PUBLIC_SERVER_URL = https://your-username.replit.dev
```

---

## 📊 Environment Variables Explained

### NEXT_PUBLIC_PROGRAM_ID
- **Value:** `84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk`
- **What it is:** Your deployed Solana smart contract
- **Used by:** Trading instructions, bonding curve calculations
- **Safe to expose:** Yes (public data)

### NEXT_PUBLIC_RPC_URL
- **Devnet:** `https://api.devnet.solana.com`
- **Testnet:** `https://api.testnet.solana.com`
- **Mainnet:** `https://api.mainnet-beta.solana.com`
- **What it is:** Connection to Solana blockchain
- **Safe to expose:** Yes (public RPC)

### NEXT_PUBLIC_SERVER_URL
- **Local dev:** `http://localhost:3002`
- **Railway:** `https://your-app.up.railway.app`
- **Render:** `https://your-app.onrender.com`
- **Replit:** `https://your-username.replit.dev`
- **What it is:** Socket.io backend for real-time updates
- **Purpose:** Chat messages, trade notifications, chart updates
- **If missing:** Features still work, just without real-time updates

### DATABASE_URL
- **Supabase:** `postgresql://postgres.[xxxxx].pooler.supabase.com:6543/postgres?sslmode=require&password=[password]`
- **Railway:** `postgresql://user:password@host:5432/privatepump`
- **Optional?** Yes! App works perfectly without it
- **What it stores:** User portfolio, trade history, chat messages
- **If missing:** Data persists in-memory only (resets on restart)

---

## 🔧 Updating Environment Variables

**To update after deployment:**

1. Go to Vercel dashboard
2. Select your project
3. Click "Settings"
4. Click "Environment Variables"
5. Click the variable you want to update
6. Change the value
7. Click "Save"
8. Click "Deployments" → redeploy the latest commit

---

## 🚀 Full Architecture After Deployment

```
┌─────────────────────────────────────────┐
│        Vercel (Frontend)                │
│  https://your-project.vercel.app        │
│  • Next.js app                          │
│  • API routes                           │
│  • Real-time charts                     │
│  • Trading interface                    │
└────────────┬────────────────────────────┘
             │
      ┌──────┴──────────┐
      │                 │
   ┌──▼──┐        ┌─────▼──────────┐
   │ L1  │        │ Socket.io Srv  │
   │RPC  │        │ (Railway/Render)
   └─────┘        └────────────────┘
      │                 │
      └────────┬────────┘
               │
        ┌──────▼────────────────────┐
        │  Solana Devnet/Mainnet    │
        │  Program ID:              │
        │  84NjS3mddtNU...          │
        └───────────────────────────┘
```

---

## ✅ Verification Checklist

After deployment:

- [ ] Frontend loads at `https://your-project.vercel.app`
- [ ] Can create token
- [ ] Can buy/sell token
- [ ] Charts display correctly
- [ ] Wallet connects (Phantom)
- [ ] Chat works (if SERVER_URL set)
- [ ] Real-time updates (if SERVER_URL + Database set)

---

## 🆘 Troubleshooting

### Build fails on Vercel
- Check build logs: Settings → Deployments → Latest → View Build Logs
- Ensure Node 18+: Set in vercel.json
- Clear cache: Deployments → ... → Redeploy

### App loads but trading fails
- Check NEXT_PUBLIC_PROGRAM_ID is correct
- Check NEXT_PUBLIC_RPC_URL is reachable
- Open browser console (F12) for errors

### Chat/Real-time not working
- Check NEXT_PUBLIC_SERVER_URL is set
- Ensure Socket.io server is running on Railway/Render/Replit
- Check Socket.io server logs for connection errors

### Database errors
- DATABASE_URL is optional (app works without it)
- If you want persistence, set up Supabase or PostgreSQL
- Connection string format: `postgresql://user:password@host:port/database`

---

## 📞 Support Links

- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- Render Docs: https://docs.render.com
- Replit Docs: https://docs.replit.com
- Solana Docs: https://docs.solana.com

---

**Ready to deploy? Click "Deploy" in Vercel now!** 🚀
