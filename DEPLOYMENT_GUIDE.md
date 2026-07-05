# Denimisia Deployment Guide

This document contains the complete deployment process for the Denimisia e-commerce platform.

---

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [Deployment Overview](#deployment-overview)
3. [GitHub Setup](#github-setup)
4. [Netlify Deployment](#netlify-deployment)
5. [Render API Deployment](#render-api-deployment)
6. [Environment Variables](#environment-variables)
7. [Cloudflare DNS Setup](#cloudflare-dns-setup)
8. [Cloudflare Worker](#cloudflare-worker)
9. [Troubleshooting](#troubleshooting)

---

## Project Architecture

### Technology Stack

| Component | Framework | Hosting | URL |
|-----------|-----------|---------|-----|
| Storefront | Next.js 16.2.0 | Netlify | denimisia.online |
| Admin Panel | Next.js 16.2.0 | Netlify | admin.denimisia.online |
| API | NestJS 11.x | Render | api.denimisia.online |
| Database | PostgreSQL | Supabase | - |
| Image Storage | Cloudflare R2 | - | - |
| Email | Resend | - | - |
| Search | Algolia | - | - |

### Monorepo Structure

```
/apps
  web        → Next.js storefront (port 3000)
  admin      → Next.js admin panel (port 3002)
  api        → NestJS backend (port 3001)

/packages
  database   → Prisma schema
  ui         → Shared UI components
  types      → TypeScript types
  utils      → Utilities
  fit-engine → Fit recommendation

/workers
  api-cache  → Cloudflare Worker for API caching
```

---

## Deployment Overview

```
GitHub (master branch)
        ↓
   ┌────┴────┐
   ↓         ↓
Netlify   Render
(web+    (API)
admin)
        ↓
   Cloudflare DNS → Custom domains
```

---

## GitHub Setup

The code is hosted at: https://github.com/alissubra-dev/denimisia-main

### Repository Structure
- Branch: `master`
- Auto-deploys on push to master

---

## Netlify Deployment

### Prerequisites
- Netlify account connected to GitHub
- Credits or paid plan (free tier has limitations)

### Step 1: Create Two Sites

Connect the same repository twice:

| Site | Base Directory | Build Command | Publish Directory |
|------|---------------|---------------|-------------------|
| Storefront | `apps/web` | `pnpm --filter web build` | `apps/web/.next` |
| Admin | `apps/admin` | `pnpm --filter admin build` | `apps/admin/.next` |

### Step 2: Environment Variables

#### Storefront (.env)
```
NEXT_PUBLIC_API_URL=https://api.denimisia.online/api/v1
NEXT_PUBLIC_SITE_URL=https://denimisia.online
NEXTAUTH_SECRET=<generate-with: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))">
NEXTAUTH_URL=https://denimisia.online
AUTH_GOOGLE_ID=<your-google-oauth-client-id>
AUTH_GOOGLE_SECRET=<your-google-oauth-secret>
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-8fd9fc20a2834533934345af65d2a992.r2.dev
NEXT_PUBLIC_GA4_MEASUREMENT_ID=<optional>
NEXT_PUBLIC_META_PIXEL_ID=<optional>
```

#### Admin (.env)
```
NEXT_PUBLIC_API_URL=https://api.denimisia.online/api/v1
NEXT_PUBLIC_WEB_ORIGIN=https://denimisia.online
NEXTAUTH_SECRET=<same-as-storefront>
NEXTAUTH_URL=https://admin.denimisia.online
```

### Step 3: netlify.toml Files

The repository includes `netlify.toml` files for both apps:

**apps/web/netlify.toml:**
```toml
[build]
  command = "pnpm --filter web build"
  publish = "apps/web/.next"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/api/*"
  to = "https://api.denimisia.online/api/:splat"
  status = 200
  force = true
```

**apps/admin/netlify.toml:**
```toml
[build]
  command = "pnpm --filter admin build"
  publish = "apps/admin/.next"

[build.environment]
  NODE_VERSION = "20"
```

---

## Render API Deployment

### Step 1: Create Web Service

1. Go to https://dashboard.render.com
2. Click **New** → **Web Service**
3. Connect GitHub and select `alissubra-dev/denimisia-main`
4. Configure:

| Setting | Value |
|---------|-------|
| Name | `denimisia-api` |
| Root Directory | `apps/api` |
| Build Command | `pnpm install && pnpm build` |
| Start Command | `node dist/main.js` |
| Instance Type | Free (or paid for production) |
| Region | Singapore (or closest) |

### Step 2: Environment Variables

```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres:<PASSWORD>@db.xxxxx.supabase.co:6543/postgres?sslmode=require&pgbouncer=true
DIRECT_URL=postgresql://postgres:<PASSWORD>@db.xxxxx.supabase.co:5432/postgres?sslmode=require
JWT_ACCESS_SECRET=<generate-64-char-random-string>
JWT_REFRESH_SECRET=<generate-different-64-char-random-string>
CORS_ORIGINS=https://denimisia.online,https://admin.denimisia.online
R2_ACCOUNT_ID=<your-r2-account-id>
R2_ACCESS_KEY_ID=<your-r2-access-key>
R2_SECRET_ACCESS_KEY=<your-r2-secret>
R2_BUCKET_NAME=denimisia-media
R2_PUBLIC_URL=https://pub-8fd9fc20a2834533934345af65d2a992.r2.dev
RESEND_API_KEY=<your-resend-api-key>
RESEND_FROM_EMAIL=noreply@denimisia.online
RESEND_FROM_NAME=Denimisia
STOREFRONT_URL=https://denimisia.online
ALGOLIA_APP_ID=<optional>
ALGOLIA_API_KEY=<optional>
ALGOLIA_SEARCH_KEY=<optional>
ALGOLIA_INDEX_NAME=products
```

**Note:** Redis is optional. The API works without it.

### Step 3: Database Setup (Supabase)

1. Go to https://supabase.com
2. Select your project
3. Go to **Settings** → **Database**
4. Copy the connection strings:
   - `DATABASE_URL` - port 6543 (with pgbouncer)
   - `DIRECT_URL` - port 5432 (for migrations)

---

## Environment Variables

### Generating Secrets

Run this locally to generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Required Variables Summary

| Variable | Where Used | Required |
|----------|-----------|----------|
| DATABASE_URL | Render | Yes |
| DIRECT_URL | Render | Yes |
| JWT_ACCESS_SECRET | Render | Yes |
| JWT_REFRESH_SECRET | Render | Yes |
| CORS_ORIGINS | Render | Yes |
| R2_* | Render | Yes |
| RESEND_* | Render | No (optional) |
| NEXT_PUBLIC_API_URL | Netlify | Yes |
| NEXTAUTH_SECRET | Netlify | Yes |
| NEXT_PUBLIC_R2_PUBLIC_URL | Netlify | Yes |

---

## Cloudflare DNS Setup

### Step 1: Add DNS Records

In Cloudflare dashboard for `denimisia.online`:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | api | denimisia-api-im1x.onrender.com | Proxied |

### Step 2: Verify

Wait 1-5 minutes, then test:
```
https://api.denimisia.online/health
```

---

## Cloudflare Worker (Optional)

The worker caches API responses at the edge for better performance.

### Deploy Command

```bash
CF_TOKEN=your-cloudflare-token
ACCT=your-account-id
curl -X PUT \
  -H "Authorization: Bearer $CF_TOKEN" \
  -F "metadata={\"main_module\":\"index.js\",\"compatibility_date\":\"2024-09-01\"};type=application/json" \
  -F "index.js=@workers/api-cache/src/index.js;type=application/javascript+module" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCT/workers/scripts/denimisia-api-cache"
```

### What It Does
- Caches public API endpoints at Cloudflare edge
- 60-second TTL
- Bypasses cache for authenticated requests

---

## Troubleshooting

### Build Issues

#### Issue: "nest: not found"
**Fix:** Move `@nestjs/cli` to dependencies in `apps/api/package.json`

#### Issue: Test files causing build failure
**Fix:** Exclude test files in `apps/api/tsconfig.json`:
```json
"exclude": ["node_modules", "dist", "test", "**/*.spec.ts", "**/*.test.ts"]
```

#### Issue: REDIS_URL validation error
**Fix:** Make Redis optional in `apps/api/src/common/env.ts`

### Deployment Issues

#### Issue: Netlify can't find .next directory
**Fix:** Set correct publish path in `netlify.toml`:
```toml
publish = "apps/web/.next"  # not ".next"
```

#### Issue: API fails to start on Render
**Fix:** Make services optional (Redis, Resend) with fallback handling

### DNS Issues

#### Issue: DNS_PROBE_FINISHED_NXDOMAIN
**Fix:**
1. Verify CNAME record exists
2. Ensure Proxy is "Proxied" (orange cloud)
3. Wait 1-5 minutes for propagation
4. Try toggling proxy off and on

---

## Code Changes Made for Deployment

This deployment required several fixes to make the monorepo work in production:

1. **netlify.toml** - Added publish directory paths for monorepo
2. **packages/types/tsconfig.json** - Made standalone for deployment
3. **packages/types/package.json** - Moved TypeScript to dependencies
4. **apps/api/package.json** - Moved @nestjs/cli to dependencies
5. **apps/api/tsconfig.json** - Excluded test files
6. **apps/api/nest-cli.json** - Fixed asset paths for markdown files
7. **apps/api/src/common/env.ts** - Made Redis and Resend optional
8. **apps/api/src/modules/redis/redis.module.ts** - Created safe Redis wrapper
9. **apps/api/src/modules/email/email.service.ts** - Made email optional
10. **apps/web/netlify.toml** - Added API redirect rules
11. **apps/web/.env.example** - Updated R2 URL

---

## Production Checklist

- [ ] Code pushed to GitHub
- [ ] Netlify storefront deployed
- [ ] Netlify admin deployed
- [ ] Render API deployed
- [ ] Database connected
- [ ] DNS configured for api.denimisia.online
- [ ] DNS configured for main domain
- [ ] SSL working
- [ ] API health check passing
- [ ] Storefront loading
- [ ] Admin login working

---

## Support

For issues, check:
1. Render logs: Dashboard → API service → Logs
2. Netlify logs: Dashboard → Site → Deploy logs
3. Cloudflare logs: Dashboard → Workers → Logs

---

*Last updated: June 27, 2026*