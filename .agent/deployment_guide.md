# 🚀 Deployment Guide for G-One AI Assistant

## ❌ Why GitHub Pages Won't Work

GitHub Pages **only serves static HTML/CSS/JS files**. Your application requires:
- ✅ Node.js server (Next.js SSR)
- ✅ API routes (`/api/*`)
- ✅ Backend service (medical-agent FastAPI)
- ✅ Database connections (MongoDB)
- ✅ Environment variables
- ✅ Server-side rendering

**GitHub Pages cannot provide any of these.**

---

## ✅ Recommended Deployment Options

### Option 1: Vercel (Best for Next.js) ⭐ RECOMMENDED

**Why Vercel?**
- Made by Next.js creators
- Free tier with generous limits
- Automatic HTTPS
- Global CDN
- Zero configuration
- Serverless functions for API routes

**Setup Steps:**

#### 1. Create Vercel Account
```bash
# Visit https://vercel.com/signup
# Sign up with your GitHub account
```

#### 2. Install Vercel CLI (Optional - for local deployment)
```bash
npm i -g vercel
```

#### 3. Deploy via GitHub Integration (Easiest)

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select your repository: `IROMIMPULSE15/g-one-hybrid-multi-agent-system`
4. Configure project:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`

5. Add Environment Variables:
   ```
   MONGODB_URI=your_mongodb_connection_string
   NEXTAUTH_SECRET=your_secret_key
   NEXTAUTH_URL=https://your-app.vercel.app
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   PINECONE_API_KEY=your_pinecone_key
   PINECONE_ENVIRONMENT=your_pinecone_env
   GEMINI_API_KEY=your_gemini_key
   ```

6. Click "Deploy"

#### 4. Automatic Deployments
- Every push to `main` branch auto-deploys
- Pull requests get preview deployments
- Rollback to any previous deployment

**Your app will be live at:** `https://your-project.vercel.app`

---

### Option 2: Railway.app (Full-Stack Support)

**Why Railway?**
- Supports both frontend and backend
- Can run Docker containers
- PostgreSQL/MongoDB databases included
- Free tier: $5 credit/month

**Setup Steps:**

1. Visit [https://railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway auto-detects Next.js and deploys
6. Add environment variables in Railway dashboard

**Cost:** Free tier, then pay-as-you-go

---

### Option 3: Render.com (Docker Support)

**Why Render?**
- Free tier for web services
- Supports Docker (your docker-compose.yml)
- Auto-deploy from GitHub
- Managed databases

**Setup Steps:**

1. Visit [https://render.com](https://render.com)
2. Sign up with GitHub
3. Create "New Web Service"
4. Connect your repository
5. Configure:
   - **Environment:** Docker
   - **Docker Command:** Use your Dockerfile
6. Add environment variables
7. Deploy

**Cost:** Free tier available

---

### Option 4: DigitalOcean App Platform

**Why DigitalOcean?**
- $5/month for basic apps
- Full Docker support
- Managed databases
- Scalable

**Setup Steps:**

1. Visit [https://cloud.digitalocean.com/apps](https://cloud.digitalocean.com/apps)
2. Click "Create App"
3. Connect GitHub repository
4. Configure build settings
5. Add environment variables
6. Deploy

**Cost:** Starting at $5/month

---

### Option 5: Self-Hosted VPS (Advanced)

**Platforms:**
- AWS EC2
- Google Cloud Platform
- Azure
- DigitalOcean Droplets
- Linode

**Setup Steps:**

1. Create a VPS instance (Ubuntu 22.04 recommended)
2. SSH into your server
3. Install Docker and Docker Compose:
   ```bash
   sudo apt update
   sudo apt install docker.io docker-compose -y
   ```

4. Clone your repository:
   ```bash
   git clone https://github.com/IROMIMPULSE15/g-one-hybrid-multi-agent-system.git
   cd g-one-hybrid-multi-agent-system
   ```

5. Set up environment variables:
   ```bash
   cp .env.example .env
   nano .env  # Edit with your values
   ```

6. Build and run:
   ```bash
   docker-compose up -d
   ```

7. Set up Nginx reverse proxy:
   ```bash
   sudo apt install nginx -y
   ```

8. Configure SSL with Let's Encrypt:
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot --nginx -d yourdomain.com
   ```

**Cost:** $5-10/month for basic VPS

---

## 🎯 Quick Comparison

| Platform | Cost | Ease | Best For | Docker Support |
|----------|------|------|----------|----------------|
| **Vercel** | Free tier | ⭐⭐⭐⭐⭐ | Next.js apps | ❌ (Serverless) |
| **Railway** | $5/mo credit | ⭐⭐⭐⭐ | Full-stack | ✅ |
| **Render** | Free tier | ⭐⭐⭐⭐ | Docker apps | ✅ |
| **DigitalOcean** | $5/mo | ⭐⭐⭐ | Production apps | ✅ |
| **VPS** | $5-10/mo | ⭐⭐ | Full control | ✅ |

---

## 🚨 Important Notes

### For Medical-Agent Backend

Your FastAPI backend (`medical-agent/`) needs separate deployment:

**Option A:** Deploy to same platform (Railway/Render support multiple services)

**Option B:** Deploy separately:
- Frontend on Vercel
- Backend on Railway/Render
- Update `MEDICAL_AGENT_URL` environment variable

### Database Considerations

Your app uses MongoDB. Options:
1. **MongoDB Atlas** (Free tier: 512MB) - Recommended
2. **Railway MongoDB** (Included with deployment)
3. **Self-hosted** (On VPS)

---

## 📋 Pre-Deployment Checklist

- [ ] All environment variables documented
- [ ] MongoDB database set up (Atlas recommended)
- [ ] API keys obtained (Google, Gemini, Pinecone)
- [ ] `.env.example` updated with all required variables
- [ ] Build succeeds locally (`npm run build`)
- [ ] Docker build succeeds (`docker-compose build`)
- [ ] Health endpoints working (`/api/health`, `/health`)

---

## 🎬 Recommended Deployment Path

### For Beginners:
1. **Deploy to Vercel** (frontend + API routes)
2. **Deploy medical-agent to Railway** (backend)
3. **Use MongoDB Atlas** (database)

### For Production:
1. **Vercel** for frontend (global CDN)
2. **Railway/Render** for backend
3. **MongoDB Atlas** (production tier)
4. **Set up monitoring** (Sentry already configured)

---

## 🔗 Useful Links

- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

## 🆘 Need Help?

If you encounter issues:
1. Check deployment logs
2. Verify environment variables
3. Test locally with `npm run build && npm start`
4. Check health endpoints
5. Review error messages in platform dashboard

---

**Ready to deploy? I recommend starting with Vercel!** 🚀
