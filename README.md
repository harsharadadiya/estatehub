# EstateHub – Real Estate Platform (React + TypeScript + Node + Express + MongoDB)

EstateHub is a real estate website for India. People can search homes for sale or rent, open a listing with photos, and book a viewing time, with or without an account. Owners list their own properties with up to four photos, and they confirm or decline viewing requests from their dashboard. The dashboard updates live while it is open.

This project follows the five modules of the SapphireIQ "RealEstate Platform" guide:

| # | Module | What you get | Main files |
|---|--------|--------------|------------|
| 1 | Setup, models and authentication | Register, login, JWT, password reset by email, `GET /api/users/me` | `server/src/models`, `server/src/controllers/authController.ts` |
| 2 | Properties, filters and image upload | Create, edit and delete your own listings, up to 4 photos on ImageKit, filters by price, type, location and area | `propertyController.ts`, `services/storage.ts`, `client/src/pages/PropertiesPage.tsx` |
| 3 | Appointments and dashboard | Guest booking and logged-in booking (two routes, one model), cancel, owner confirm, dashboard, live updates | `appointmentController.ts`, `services/realtime.ts`, `client/src/pages/dashboard` |
| 4 | Security, SEO and deployment | Helmet, CORS allow list, rate limits, SEO tags, sitemap, robots.txt, Vercel + Render setup | `server/src/app.ts`, `seoRoutes.ts`, `client/vercel.json`, `render.yaml` |
| 5 | Optional bonus: AI Property Hub | Search live portal listings with Firecrawl, remove repeats and rentals, rank with AI, retry with backoff, feature flag | `server/src/services/ai`, `client/src/pages/AiHubPage.tsx` |

There is **no dummy or seed data**. Everything you see comes from your MongoDB Atlas database: you create accounts and listings in the website, and they are saved immediately.

---

## Contents

1. [What you need](#1-what-you-need)
2. [Tools used and why](#2-tools-used-and-why)
3. [Folder structure](#3-folder-structure)
4. [Step 1 – Create the MongoDB Atlas database](#4-step-1--create-the-mongodb-atlas-database)
5. [Step 2 – Start the backend (API)](#5-step-2--start-the-backend-api)
6. [Step 3 – Set up email (password reset and booking emails)](#6-step-3--set-up-email)
7. [Step 4 – Set up ImageKit (photo storage)](#7-step-4--set-up-imagekit)
8. [Step 5 – Start the frontend (website)](#8-step-5--start-the-frontend)
9. [Step 6 – Test everything](#9-step-6--test-everything)
10. [How each part works](#10-how-each-part-works)
11. [Optional: the AI Property Hub](#11-optional-the-ai-property-hub)
12. [Deploy to the internet](#12-deploy-to-the-internet)
13. [API reference](#13-api-reference)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. What you need

Install on your computer:

- **Node.js 20.6 or newer** (the LTS version from <https://nodejs.org>). Check with `node -v`.
- **Git** (optional, needed for deployment).
- A code editor such as **VS Code**.

Create these free accounts:

| Account | Used for | Required? |
|---------|----------|-----------|
| [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) | The database | Yes |
| [ImageKit](https://imagekit.io) | Storing and resizing property photos (a CDN) | Yes for deployment. For local testing, photos can be saved on your computer instead |
| An email (SMTP) service: Gmail, [Brevo](https://www.brevo.com) or [Mailtrap](https://mailtrap.io) | Password reset and booking emails | Yes for deployment. For local testing, emails are printed in the terminal instead |
| [Render](https://render.com) and [Vercel](https://vercel.com) | Hosting the API and the website | Only for deployment |
| [Firecrawl](https://www.firecrawl.dev) and [Anthropic Console](https://console.anthropic.com) | The optional AI Property Hub | Only for module 5 |

---

## 2. Tools used and why

**Backend (`server/`)** – TypeScript, run with `tsx` while developing and compiled with `tsc` for production.

| Tool | Job in this project |
|------|---------------------|
| Express 5 | The web server and REST API. It catches errors from async code by itself |
| MongoDB Atlas + Mongoose 9 | Database and data models (User, Property, Appointment) |
| jsonwebtoken + bcryptjs | Login tokens and password hashing |
| Nodemailer | Sends password reset and booking emails over SMTP |
| Multer + ImageKit | Multer receives uploaded photos and ImageKit stores them on a CDN |
| Zod | Checks every request (body and query) before it reaches the database |
| Helmet, CORS, express-rate-limit | Security headers, only your own website may call the API, and limits on repeated requests |
| MongoDB change streams + Server-Sent Events | Live dashboard updates |
| @anthropic-ai/sdk | AI ranking in the optional AI Property Hub |

**Frontend (`client/`)** – React 19 + TypeScript + Vite.

| Tool | Job in this project |
|------|---------------------|
| React Router 7 | Pages and links. Every page is lazy loaded with `React.lazy` |
| TanStack Query | Loads data from the API with caching, loading and error states |
| Axios | The HTTP client, with the login token added automatically |
| Tailwind CSS 4 | Layout and styling, responsive from phones to wide screens |
| shadcn/ui (Radix) | Buttons, inputs, dialogs, menus, popovers, calendar, checkboxes |
| Material UI | Price/area slider, toggle buttons, tabs, pagination, skeleton loaders, switches, alerts, progress bars |
| React Hook Form + Zod | Forms with validation messages under each field |
| Sonner | Pop-up notifications |

> **Tailwind and MUI together:** MUI styles are placed in a CSS layer named `mui` (see the top of `client/src/index.css` and `enableCssLayer` in `client/src/main.tsx`). Tailwind utilities come in a later layer, so a Tailwind class always wins when both style the same thing.

---

## 3. Folder structure

```
estatehub/
├── README.md                 ← this guide
├── render.yaml               ← one-click API deployment on Render
├── server/                   ← BACKEND (Express + TypeScript)
│   ├── .env.example          ← copy to .env and fill in
│   ├── scripts/api-test.ts   ← automatic end-to-end test of every module
│   └── src/
│       ├── index.ts          ← starts the server (connect DB → start HTTP)
│       ├── app.ts            ← security, CORS, routes, error handling
│       ├── config/           ← env.ts (checked settings), db.ts (MongoDB connection)
│       ├── models/           ← User.ts, Property.ts, Appointment.ts
│       ├── middleware/       ← auth (requireAuth), validate (Zod), upload (Multer), rate limits, errors
│       ├── validators/       ← schemas.ts – every validation rule
│       ├── controllers/      ← auth, users, properties, appointments, dashboard
│       ├── routes/           ← URL → controller mapping (+ seo, realtime, ai)
│       ├── services/         ← email.ts, storage.ts (ImageKit), realtime.ts (live updates), ai/ (bonus)
│       ├── utils/            ← AppError, tokens, India-time dates, price formatting
│       └── types/            ← adds req.user to Express types
└── client/                   ← FRONTEND (React + TypeScript + Vite)
    ├── .env.example
    ├── vercel.json           ← deep links, sitemap forwarding, cache and security headers
    ├── vite.config.ts        ← dev proxy to the API, "@" imports, robots.txt at build time
    ├── components.json       ← shadcn/ui settings (to add more components)
    └── src/
        ├── main.tsx          ← providers: MUI theme, React Query, router, auth
        ├── App.tsx           ← all routes (lazy loaded) and protected routes
        ├── index.css         ← design tokens (colors, font) + Tailwind
        ├── lib/              ← api.ts (Axios), format.ts (₹ Lakh/Crore), images.ts, features.ts (flags)
        ├── services/         ← every API call in one file
        ├── context/          ← AuthContext (who is logged in)
        ├── hooks/            ← useRealtime (live updates), usePropertyFilters (filters in the URL)
        ├── components/       ← ui/ (shadcn), common/, layout/, property/, appointments/
        └── pages/            ← Home, Properties, PropertyDetail, auth/, dashboard/, AiHubPage
```

---

## 4. Step 1 – Create the MongoDB Atlas database

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com) and click **Create** to make a new cluster. Choose the **free (M0)** tier and a region close to you, such as Mumbai (`ap-south-1`).
2. **Create a database user:** *Security → Database Access → Add New Database User*. Choose "Password", and enter a username and a strong password. Avoid `@ : / ? #` in the password, or you will need to URL-encode them (`@` becomes `%40`). Give it the role **Read and write to any database**.
3. **Allow your computer:** *Security → Network Access → Add IP Address → Add Current IP Address*. For deployment on Render, also add `0.0.0.0/0` ("allow access from anywhere"), because Render's IP addresses change.
4. **Copy the connection string:** *Database → Connect → Drivers*. It looks like this:
   ```
   mongodb+srv://myuser:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
5. Replace `<db_password>` with your password and add the database name **`estatehub`** after `.net/`:
   ```
   mongodb+srv://myuser:MyStrongPass123@cluster0.abcde.mongodb.net/estatehub?retryWrites=true&w=majority&appName=Cluster0
   ```
   This is your `MONGODB_URI`.

You do not create collections yourself. When the API starts, it creates the `users`, `properties` and `appointments` collections and their indexes. One of the indexes (`one_active_booking_per_slot`) is what makes double bookings impossible.

> **Real-time database operations.** Atlas clusters are "replica sets", so they support **change streams**. The API watches the `appointments` collection, and when anything changes, the owner's and visitor's dashboards update within a second. You will see `Live updates: MongoDB change streams` when the API starts. On a plain local MongoDB without a replica set, live updates still work for a single server (`direct` mode).

---

## 5. Step 2 – Start the backend (API)

```bash
cd server
npm install
cp .env.example .env        # on Windows: copy .env.example .env
```

Open `server/.env` and fill in at least these:

| Setting | What to put |
|---------|-------------|
| `MONGODB_URI` | The Atlas connection string from Step 1 |
| `JWT_SECRET` | A long random text. Create one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | `http://localhost:5173` for now (the website address) |

Leave the email and ImageKit settings empty for the first run. Then start the API:

```bash
npm run dev
```

You should see:

```
✅ MongoDB connected: cluster0-shard-....mongodb.net/estatehub (replica set – live updates via change streams)
✉️  Email: SMTP not configured – emails will be printed in this terminal
🖼️  Images: local uploads folder (development only)
⚡ Live updates: MongoDB change streams
🚀 EstateHub API running on http://localhost:5000/api (development)
```

Open <http://localhost:5000/api/health>. It should say `"status":"ok"` and `"database":"connected"`.

`npm run dev` restarts the API whenever you save a file. Keep this terminal open.

---

## 6. Step 3 – Set up email

Without SMTP settings, emails are **printed in the API terminal** in development, and the "Forgot password" page shows the reset link directly, so you can test everything without an email account. For real emails (and always in production), fill these in `server/.env`:

**Option A – Gmail** (good for testing with your own address)

1. Turn on 2-Step Verification for your Google account.
2. Go to <https://myaccount.google.com/apppasswords> and create an App Password called "EstateHub". You get a 16-character password.
3. In `server/.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your.address@gmail.com
   SMTP_PASS=the16characterapppassword
   EMAIL_FROM="EstateHub <your.address@gmail.com>"
   ```

**Option B – Brevo** (better for a live site, with a free daily allowance): create an account, then go to *SMTP & API → SMTP*. Use `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, and the login and SMTP key shown there. Verify your sender address in Brevo.

Restart the API. It now prints `✉️ Email: SMTP ready`. The app sends these emails:

- password reset link (valid for 30 minutes, works once)
- "your password was changed"
- a booking confirmation to the visitor, which includes a cancel link for guests
- a new viewing request to the owner
- confirmed or cancelled updates to the other person

---

## 7. Step 4 – Set up ImageKit

1. Create a free account at <https://imagekit.io>.
2. Go to *Developer options → API keys* and copy the **Private key** (it starts with `private_`).
3. In `server/.env`:
   ```
   IMAGEKIT_PRIVATE_KEY=private_xxxxxxxxxxxxxxxxx
   IMAGEKIT_FOLDER=/estatehub/properties
   ```
4. Restart the API. It now prints `🖼️ Images: ImageKit CDN`.

Uploaded photos then appear in your ImageKit Media Library. The website asks ImageKit for smaller versions on the fly (`?tr=w-640`), so phones download less. When a listing is edited or deleted, the photos that are no longer used are deleted from ImageKit too.

Without the key, photos are saved in `server/uploads/`. That is fine on your computer, but hosting services such as Render delete those files on every deploy, so use ImageKit when you deploy.

---

## 8. Step 5 – Start the frontend

Open a **second terminal**:

```bash
cd client
npm install
npm run dev
```

Open <http://localhost:5173>.

You do not need a `client/.env` file for local development: Vite forwards every `/api` request to `http://localhost:5000`. To change a setting, copy `client/.env.example` to `client/.env`.

The site starts empty because there is no seed data. Click **List your property**, create an account, and add your first listing with photos. It appears on the home page straight away.

---

## 9. Step 6 – Test everything

### 9.1 Automatic test (about 75 checks)

With the API running (`npm run dev`), run this in a new terminal:

```bash
cd server
npm run test:api
```

It creates two test accounts, a listing with four photos and several viewings in **your real database**, checks every module, and then **deletes everything it created**. It finishes with:

```
🎉 75 passed, 0 failed
```

Some of what it checks:

- **Auth:** register, login, wrong password, password reset with the emailed token, old tokens stop working after a reset, `/api/users/me`.
- **Listings:** photos (none, fake files, more than 4), filters by price, type, location and area, a second user cannot edit or delete someone else's listing, choosing a new cover photo.
- **Viewings:** guest booking, logged-in booking, five people booking the same slot at the same moment (exactly one succeeds), past times, cancelling, the owner confirming, and the live update reaching the visitor.
- **Security and SEO:** security headers, rate-limit headers, CORS blocking, sitemap.

The password-reset and guest-link checks need `NODE_ENV=development` without SMTP. With SMTP configured, they are skipped because the links go by email.

### 9.2 The module exercises from the project guide

| Module | Exercise | How to do it here |
|--------|----------|-------------------|
| 1 | Register, log in, request a reset email, call `/api/users/me` with the token | Sign up on the website, log out, use **Forgot password**. With Postman/curl: `POST /api/auth/login`, then `GET /api/users/me` with the header `Authorization: Bearer <token>` |
| 2 | Add a property with 4 images, filter by price and type, confirm a second user cannot edit it | **List your property** → add 4 photos. Use the filters on **All listings**. Log in as another user and open `/dashboard/listings/<id>/edit`: you get "You can only edit your own listings" |
| 3 | Book as a guest, then log in, add a listing, see it and your appointments on the dashboard | Log out, open a listing, pick a day and time and book. Create an account **with the same email**: that guest booking shows in **My viewings** |
| 4 | Deploy both apps, set environment variables, test a deep link like `/dashboard` | See [section 12](#12-deploy-to-the-internet). Open `https://your-site.vercel.app/dashboard` directly and refresh the page |
| 5 (optional) | Search a 2 BHK in a city, see ranked results with source badges, trigger a rate-limit error, switch the feature off | See [section 11](#11-optional-the-ai-property-hub) |

### 9.3 Watch live updates

Open the site in two different browsers (or one normal and one private window). Log in as an owner in one and open **Dashboard → Viewing requests**. In the other, book a viewing of that owner's listing. The request and a notification appear in the owner's window within a second, without refreshing. When the owner clicks **Confirm viewing**, the visitor's **My viewings** page changes to "Confirmed" by itself.

### 9.4 Look inside the database

In Atlas, click **Browse Collections**, or install [MongoDB Compass](https://www.mongodb.com/products/compass) and connect with the same `MONGODB_URI`. You will see each user, listing and viewing as you create them.

---

## 10. How each part works

### Authentication (module 1)

- Passwords are hashed with **bcrypt** (cost 12) and are never sent back by the API.
- Login returns a **JWT** that holds the user id and a "token version". The website stores it and sends it as `Authorization: Bearer <token>`.
- `requireAuth` checks the token on protected routes. When a password changes, the token version goes up by one, so every older token stops working at once (other devices are logged out).
- **Password reset:** the API creates a random 64-character token and stores only its SHA-256 hash with a 30-minute expiry, then emails the link `CLIENT_URL/reset-password?token=…`. The answer is the same whether or not the email exists, so nobody can use it to discover accounts.

### Properties, filters and photos (module 2)

- Only the logged-in **owner** can edit or delete a listing (403 for anyone else). Hidden listings are visible only to their owner.
- **Upload:** the form sends `multipart/form-data` with a `data` field (JSON) and up to 4 `images`. Multer keeps them in memory (5 MB each). The API checks the real file contents ("magic bytes"), not just the name, so a renamed text file is rejected. The photos then go to ImageKit. If saving the listing fails, the uploaded photos are deleted again.
- **Filters** are query values: `/api/properties?location=pune&type=apartment&minPrice=5000000&maxPrice=10000000&minArea=800&bedrooms=2&purpose=sale&sort=price_asc&page=1`. On the website they live in the address bar, so the back button works and a search can be shared as a link.
- **Prices** are stored in rupees and shown the Indian way: ₹78 L, ₹1.25 Cr, ₹22,000/month.
- **Recommendations** ("Similar homes nearby") score other listings by type, city, locality, bedrooms, price and size.

### Viewings and dashboard (module 3)

- **Two routes, one model:** `POST /api/appointments/guest` (name, email and phone required) and `POST /api/appointments` (logged in). Both create an `Appointment` with status `pending`, then `confirmed` or `cancelled`.
- Viewing times are 10:00 to 18:00 every 30 minutes, in **India time**, up to 60 days ahead.
- **No double bookings:** a unique MongoDB index allows only one *active* booking per property, date and time. If two people press "Request viewing" at the same moment, the database accepts one and the other gets "this time slot was just booked". The automatic test proves this with five simultaneous requests.
- Guests get an email with a private link to view or cancel their booking. If they later sign up with the same email, those bookings move into their dashboard.
- The **dashboard** shows stats, your listings (hide/show, edit, delete), **My viewings** (homes you will visit) and **Viewing requests** (people who want to see your homes), where you confirm or decline.

### Live updates

The browser asks for a 60-second "ticket", then opens `EventSource('/api/realtime/stream?ticket=…')`. The API watches the appointments collection with a **MongoDB change stream** and pushes each change to the owner and the visitor. The website then refreshes that data and shows a notification. If the connection drops, it reconnects with backoff.

### Security, SEO and deployment (module 4)

- **Helmet** sets safe HTTP headers. **CORS** allows only the addresses in `CLIENT_URL`. **Rate limits** cover the whole API and are stricter on login, password reset, guest booking and AI search.
- Every request is validated with **Zod**. Errors always come back as `{ message, errors: [{ field, message }] }`, and the forms show each message under its field. Internal error details are hidden in production.
- **SEO:** each page sets its own title, description, canonical link and Open Graph tags. Listing pages add Google "RealEstateListing" structured data. `/sitemap.xml` is built from live listings, and `robots.txt` is written at build time with your real site address. Dashboard and account pages are marked `noindex`.

---

## 11. Optional: the AI Property Hub

The hub is **off by default** and the rest of the site never depends on it.

**Turn it on**

1. In `server/.env`: `AI_HUB_ENABLED=true`. Optionally add `ANTHROPIC_API_KEY=...` from <https://console.anthropic.com> for AI ranking (`AI_MODEL` defaults to `claude-haiku-5-5`). Without a key, results are ranked with simple rules.
2. In `client/.env`: `VITE_ENABLE_AI_HUB=true`.
3. Restart both. An **AI search** link appears in the menu.
4. On the AI search page, paste your **Firecrawl** key (free at <https://www.firecrawl.dev>). It is kept in your browser (localStorage) and sent with each search in the `x-firecrawl-key` header ("bring your own key"). The server never stores or logs it.

**What happens when you search** (`server/src/services/ai/aiHub.ts`)

1. Matching homes from **your own database** are added (badge "EstateHub").
2. **Firecrawl search** looks for listing pages on 99acres, MagicBricks, Housing.com, NoBroker and Square Yards in your city.
3. **Repeats are removed** (same address with different tracking codes, or the same title on the same portal), and **rentals are removed** in code.
4. **Firecrawl scrape** reads each listing page as text.
5. **Claude** reads all candidates and returns, in a strict JSON format: price, BHK, area, locality, "is this a rental?", "is this one specific listing?", a match score from 0 to 100 and short reasons. Text from websites is treated as data, never as instructions.
6. Results come back ranked, with a **source badge**, a match score and the reasons.

**Retry with backoff:** every Firecrawl call is retried up to 3 times on rate limits (429), server errors (5xx) and timeouts. The waits are 0.8 s, 1.6 s and 3.2 s, plus a little randomness, and the `Retry-After` header is used when the API sends one. To see it work, tick **Developer test** on the AI search page (development only). The first two portal requests then pretend to be rate-limited, and the results show "Recovered from 2 temporary errors with automatic retries", with a log.

**Switch it off:** set `VITE_ENABLE_AI_HUB=false` and `AI_HUB_ENABLED=false`. The menu link and page disappear, `/api/ai/*` answers 404, and everything else works the same.

> Please respect each property portal's terms of use. Use the hub for learning and personal research, and keep the number of searches small.

---

## 12. Deploy to the internet

Deploy the **API on Render** and the **website on Vercel**, both connected to **MongoDB Atlas**.

### 12.1 Put the code on GitHub

```bash
cd estatehub
git init
git add .
git commit -m "EstateHub real estate platform"
# create an empty repository on github.com, then:
git remote add origin https://github.com/<you>/estatehub.git
git branch -M main
git push -u origin main
```

`.gitignore` already keeps `node_modules`, `dist`, `uploads` and **all `.env` files** out of Git.

### 12.2 API on Render

**Easiest:** Render → **New → Blueprint** → choose your repository. Render reads `render.yaml` and asks for the secret values. Or create it by hand: **New → Web Service** →

- Root Directory: `server`
- Build Command: `npm install --include=dev && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Environment variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | your Atlas string (and add `0.0.0.0/0` in Atlas Network Access) |
| `JWT_SECRET` | a new long random string, at least 32 characters |
| `CLIENT_URL` | your Vercel address, e.g. `https://estatehub.vercel.app` (add it after step 12.3) |
| `SMTP_*`, `EMAIL_FROM` | your email settings (required in production, or no emails are sent) |
| `IMAGEKIT_PRIVATE_KEY` | your ImageKit private key (required in production) |
| `AI_HUB_ENABLED`, `ANTHROPIC_API_KEY` | only for the optional AI hub |

When it is live, open `https://<your-service>.onrender.com/api/health`.

> Render's free plan sleeps after 15 minutes without visits, so the first request after that can take about 50 seconds.

### 12.3 Website on Vercel

1. **Edit `client/vercel.json`:** replace `YOUR-API.onrender.com` with your Render address. This makes `https://your-site/sitemap.xml` show the live sitemap. Commit and push.
2. Vercel → **Add New → Project** → import the repository.
   - Root Directory: `client`
   - Framework Preset: **Vite** (build `npm run build`, output `dist`)
3. Environment variables:
   - `VITE_API_URL` = `https://<your-service>.onrender.com/api`
   - `VITE_SITE_URL` = `https://<your-project>.vercel.app` (your final address)
   - `VITE_ENABLE_AI_HUB` = `false` (or `true`)
4. Deploy. Then go back to Render and set `CLIENT_URL` to the Vercel address (no `/` at the end). Several addresses can be separated with commas.

### 12.4 Check the live site

- Open `https://your-site.vercel.app/dashboard` directly and refresh. It loads (or asks you to log in) instead of showing 404. `vercel.json` sends every page address to the app.
- Request a password reset and check that the email arrives.
- Add a listing and check that the photos load from `ik.imagekit.io`.
- Open `https://your-site.vercel.app/sitemap.xml` and `/robots.txt`.
- Optionally run the API test against production: `API_URL=https://<your-service>.onrender.com npm run test:api`. It cleans up after itself. Some checks are skipped in production because links are emailed.

### Local and production settings

| | Local | Production |
|-|-------|------------|
| `NODE_ENV` | `development` | `production` |
| Website → API | `/api` through the Vite proxy | `VITE_API_URL` = full Render address |
| Emails | printed in the terminal if SMTP is empty | SMTP required |
| Photos | `server/uploads` if ImageKit is empty | ImageKit required |
| Error details | stack traces in responses | hidden |
| Login attempts per 15 min | 500 | 20 |

---

## 13. API reference

Base URL: `http://localhost:5000/api`. 🔒 = needs `Authorization: Bearer <token>`.

**Auth and users**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | `{ name, email, password, phone? }` → `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` |
| POST | `/auth/forgot-password` | `{ email }` → emails a reset link |
| POST | `/auth/reset-password` | `{ token, password }` → `{ token, user }` |
| GET | `/users/me` 🔒 | The logged-in user |
| PATCH | `/users/me` 🔒 | `{ name?, phone? }` |
| PATCH | `/users/me/password` 🔒 | `{ currentPassword, newPassword }` → new token |
| DELETE | `/users/me` 🔒 | `{ password }` – deletes the account, its listings and photos |

**Properties**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/properties` | Search. Query: `location, purpose (sale/rent), type, minPrice, maxPrice, minArea, maxArea, bedrooms (4 = 4+), furnishing, sort (newest/price_asc/price_desc/area_desc/popular), page, limit` |
| GET | `/properties/cities` | Cities with listing counts |
| GET | `/properties/:id` | One listing (owner phone only for logged-in users) |
| GET | `/properties/:id/similar` | Recommendations |
| GET | `/properties/:id/slots?date=YYYY-MM-DD` | Viewing times and whether each is free |
| POST | `/properties` 🔒 | multipart: `data` (JSON) + `images` (1–4 files) |
| PATCH | `/properties/:id` 🔒 owner | multipart or JSON. Optional `imageOrder: ["<fileId>", "new:0", …]` |
| DELETE | `/properties/:id` 🔒 owner | Deletes the listing and its photos, and cancels upcoming viewings |

**Appointments (viewings)**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/appointments/guest` | `{ propertyId, date, time, name, email, phone, message? }` |
| POST | `/appointments` 🔒 | `{ propertyId, date, time, phone?, message? }` |
| GET | `/appointments/mine` 🔒 | Viewings I booked |
| GET | `/appointments/received` 🔒 | Requests for my properties |
| PATCH | `/appointments/:id/status` 🔒 | `{ status: "confirmed" \| "cancelled" }` (only owners can confirm) |
| GET | `/appointments/:id/guest?token=` | A guest opens their booking from the email link |
| POST | `/appointments/:id/guest-cancel` | `{ token }` – a guest cancels |

**Dashboard, live updates, other**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/summary` 🔒 | Numbers for the dashboard |
| GET | `/dashboard/properties` 🔒 | All my listings with request counts |
| POST | `/realtime/ticket` 🔒 | A 60-second ticket for the live stream |
| GET | `/realtime/stream?ticket=` | Server-Sent Events: `appointment.created`, `appointment.updated` |
| GET | `/health`, `/config` | Status and public settings |
| GET | `/ai/status`, POST `/ai/search` | Optional AI hub (404 when switched off) |
| GET | `/sitemap.xml` (no `/api`) | Sitemap from live listings |

**Status codes:** 200 OK · 201 created · 400 invalid data · 401 not logged in · 402 Firecrawl credits used up · 403 not allowed · 404 not found · 409 conflict (email taken, time slot taken) · 429 too many requests · 5xx server problem.

---

## 14. Troubleshooting

| Problem | Fix |
|---------|-----|
| `Invalid environment settings: MONGODB_URI…` | You have not created `server/.env`. Copy `.env.example` to `.env` and fill it in |
| `Could not connect to MongoDB` / `querySrv ENOTFOUND` | Check the connection string. Your network may block DNS SRV records; try another network, or use the "standard connection string" Atlas offers for older drivers |
| `bad auth : authentication failed` | Wrong database user or password, or the password has special characters that must be URL-encoded (`@` → `%40`) |
| Connection times out | Your IP is not in Atlas **Network Access**. On Render, add `0.0.0.0/0` |
| Website says "Cannot reach the server" | Start the API (`cd server && npm run dev`) and open <http://localhost:5000/api/health> |
| Port 5000 already in use (often on macOS, by AirPlay) | Set `PORT=5050` in `server/.env` and `VITE_DEV_API_PROXY=http://localhost:5050` in `client/.env` |
| CORS error on the live site | `CLIENT_URL` on Render must exactly match the Vercel address, with no `/` at the end |
| `/dashboard` gives 404 on Vercel after a refresh | The Vercel **Root Directory** must be `client`, so that `client/vercel.json` is used |
| Photos disappear after a Render deploy | Set `IMAGEKIT_PRIVATE_KEY`. Local `uploads` are deleted on every deploy |
| "ImageKit rejected the private key" | Use the **private** key (starts with `private_`), not the public key |
| Reset emails do not arrive | Check the API logs for `Email … failed`. For Gmail, use an **App Password**, not your normal password. Check the spam folder |
| Live updates do not appear | They need a login. Behind some proxies, streams are blocked; the dashboard still refreshes when you switch back to the tab |
| AI search: "Firecrawl rejected the API key" / "credits are used up" | Check the key on the AI search page, or add credits at firecrawl.dev |
| `npm install` errors | Use Node 20.6 or newer (`node -v`). Delete `node_modules` and `package-lock.json`, then run `npm install` again |
