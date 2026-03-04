# Quick Vercel Deployment Guide

## ⚡ 5-Minute Setup

### Step 1: Go to Vercel Dashboard
```
https://vercel.com/dashboard
```

### Step 2: Click "Add New" → "Project"
![Add New Project]

### Step 3: Import GitHub Repository
- Click "Import Git Repository"
- Search for: `ck2010317/PrivatePump`
- Click "Import"

### Step 4: Configure Project
- **Framework Preset:** Next.js (auto-detected)
- **Root Directory:** `./app` (or auto-detect)
- **Build Command:** `npm run build`
- **Output Directory:** `.next`

### Step 5: Add Environment Variables
**Click "Environment Variables" and add these 3:**

```
NEXT_PUBLIC_PROGRAM_ID = 84NjS3mddtNU8fcvAoeYEMzVxhuWSutTKWvAP2nWjsfk
NEXT_PUBLIC_RPC_URL = https://api.devnet.solana.com
NEXT_PUBLIC_SERVER_URL = https://your-server-url.railway.app
```

(SERVER_URL is optional - remove if you don't have a backend server yet)

### Step 6: Deploy
- Click **"Deploy"**
- Wait 2-3 minutes for build to complete
- Your app is live! 🎉

---

## 🔍 Viewing Deployment Logs

### During Deployment
1. Vercel shows live logs as it builds
2. Watch for any errors in the "Build" tab

### After Deployment
1. Click on your deployment
2. Go to "Deployments" tab
3. Click the latest deployment
4. Go to "Logs" section
5. View build/runtime logs

### Common Issues & Solutions

**Error: "Cannot find module @privatepump/sdk"**
- ✅ **Fixed** - All imports updated
- Make sure you're on the latest commit

**Error: "NEXT_PUBLIC_PROGRAM_ID is not set"**
- ✅ **Hardcoded default** - will use default value
- But best to set it in Environment Variables for clarity

**Error: "Socket.io connection failed"**
- ✅ **Expected** if you don't have backend server
- App still works for viewing tokens
- To enable real-time: deploy Socket.io server to Railway/Render

**Deployment times out**
- Increase timeout in vercel.json
- Or contact Vercel support

---

## 📱 Testing After Deployment

Once deployed, test these features:

1. **Home Page** - Should load token list
2. **Create Token** - Try creating a test token
3. **Buy/Sell** - Try trading (requires Phantom wallet + devnet SOL)
4. **Charts** - Should show candlestick data
5. **Chat** - Will work locally, may fail if no SERVER_URL

---

## 🚀 Optional: Deploy Socket.io Backend

If you want real-time chat and updates:

### Option 1: Railway.app (Recommended)
```bash
1. Go to https://railway.app
2. Create account
3. New Project → Deploy from GitHub
4. Select ck2010317/PrivatePump
5. Set root directory: server
6. Deploy
7. Get your URL (e.g., https://app-name.up.railway.app)
8. Add to Vercel: NEXT_PUBLIC_SERVER_URL=https://app-name.up.railway.app
```

### Option 2: Render.com
```bash
1. Go to https://render.com
2. New Web Service → Connect GitHub
3. Select ck2010317/PrivatePump
4. Set root directory: server
5. Deploy
6. Get your URL
7. Add to Vercel environment variables
```

---

## 📊 Monitoring After Deployment

### Check Deployment Status
- Vercel Dashboard → Your Project → Deployments

### View Logs
- Click deployment → Logs tab
- Filter by "Build" or "Runtime"

### Monitor Performance
- Analytics tab shows:
  - Page load times
  - API response times
  - Error rates
  - Bandwidth usage

---

## 🔄 Redeploying

To redeploy after code changes:

### Option A: Automatic (Recommended)
- Push to GitHub main branch
- Vercel auto-deploys immediately

### Option B: Manual
- Vercel Dashboard → Click deployment → "Redeploy"
- Or use Vercel CLI:
  ```bash
  vercel --prod
  ```

---

## 💡 Pro Tips

1. **Use Preview Deployments**
   - Every push creates a preview URL
   - Test before merging to main

2. **Rollback to Previous Deployment**
   - Vercel Dashboard → Deployments
   - Click three dots → Promote to Production

3. **Custom Domain**
   - Vercel Dashboard → Settings → Domains
   - Add your custom domain (optional)

4. **Edge Caching**
   - Vercel automatically caches static content
   - API routes cached based on response headers

---

## 🆘 Support & Troubleshooting

### Vercel Docs
- https://vercel.com/docs/deployments/overview

### Common Commands
```bash
# Login to Vercel
vercel login

# Deploy preview
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs

# Check status
vercel status
```

### Debug Mode
- Add this to vercel.json for verbose logs:
```json
"buildCommand": "npm run build -- --debug"
```

---

**✨ That's it! Your PrivatePump is live on Vercel! 🚀**
