# NutriAI — AI Calorie Counter & Nutrition Tracker

A full-stack mobile-first nutrition app built with Next.js, Supabase, and Google Vision AI.
Live at: **https://nutriai-sigma.vercel.app**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + React 18 |
| Database & Auth | Supabase (PostgreSQL) |
| Food Scanner | Google Cloud Vision API |
| Barcode Lookup | Open Food Facts API |
| Mobile (Android/iOS) | Capacitor |
| Deployment | Vercel |

---

## Project Structure

```
nutriai-app/
├── app/
│   ├── layout.js              # Root layout
│   ├── page.js                # Entry point
│   ├── globals.css            # All styles
│   ├── privacy/page.js        # Privacy policy page
│   └── api/
│       ├── recognize-food/    # Google Vision food scanner
│       ├── barcode/           # Open Food Facts barcode lookup
│       └── suggestions/       # AI meal suggestions engine
├── components/
│   └── NutriApp.jsx           # Main React app (all screens)
├── lib/
│   ├── supabase.js            # Supabase client
│   ├── db.js                  # All database helpers
│   ├── data.js                # Food database & meal plans
│   └── calculations.js        # BMR/TDEE calorie calculations
├── public/
│   ├── icon-512.png           # App icon (Google Play)
│   ├── icon-192.png           # App icon (Android launcher)
│   ├── feature-graphic.png    # Google Play feature graphic
│   ├── phone-*.png            # Phone screenshots
│   └── screenshot-*.png       # Tablet screenshots
├── android/                   # Capacitor Android project
├── ios/                       # Capacitor iOS project
├── capacitor.config.ts        # Capacitor config
├── supabase-setup.sql         # Initial DB schema
├── supabase-scan-limit.sql    # Scan tracking table
└── supabase-weight-streaks.sql # Weight & streak tables
```

---

## Local Development Setup

### Prerequisites
- Node.js 18+
- Git
- A Supabase project
- Google Cloud Vision API key

### 1. Clone the repository
```bash
git clone https://github.com/praveenr4u/nutriai.git
cd nutriai-app
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env.local` file in the root:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GOOGLE_VISION_API_KEY=your-google-vision-key
CLARIFAI_PAT=your-clarifai-pat
```

### 4. Set up the Supabase database
Run these SQL files in order in your Supabase SQL Editor:
1. `supabase-setup.sql` — core tables (profiles, food_logs, water_logs)
2. `supabase-scan-limit.sql` — scan tracking table
3. `supabase-weight-streaks.sql` — weight logs & streaks tables

### 5. Start the development server
```bash
npm run dev
```
Open **http://localhost:3000** in your browser.

---

## Making Changes

### Changing the UI / Styles
- All styles live in `app/globals.css`
- CSS variables at the top control the entire colour palette:
  ```css
  --lime: #C8FF57;       /* Primary accent */
  --pink: #FF6B9D;       /* Protein colour */
  --purple: #A855F7;     /* Fat colour */
  --orange: #FF8C42;     /* Calories colour */
  --bg: #111111;         /* Background */
  --bg-card: #1C1C1E;    /* Card background */
  ```
- To change a colour globally, update the variable — it updates everywhere instantly.

### Adding a new food to the database
Open `lib/data.js` and add an entry to `FOOD_DB`:
```js
{ name: 'Your Food', brand: 'Brand', cal: 200, protein: 10, carbs: 25, fat: 8, serving: '100g' },
```

### Changing the daily scan limit
Open `app/api/recognize-food/route.js` and update:
```js
const DAILY_SCAN_LIMIT = 10; // change this number
```

### Changing calorie calculation formula
Open `lib/calculations.js` — the `calcNutrition` function uses the Harris-Benedict BMR formula. Adjust the goal deficit/surplus:
```js
if (profile.goal === 'lose') calorieTarget = tdee - 500;  // calorie deficit
else if (profile.goal === 'gain') calorieTarget = tdee + 300; // calorie surplus
```

### Adding a new meal plan day
Open `lib/data.js` and add to the `MEAL_PLANS` array following the existing pattern.

### Updating the AI meal suggestions
Open `app/api/suggestions/route.js` and add meals to the relevant category in the `MEALS` object (e.g. `highProtein`, `lowCalorie`, `breakfast`, etc.).

---

## Deploying to Vercel

### First-time deployment
1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "your changes"
   git push
   ```
2. Go to **[vercel.com](https://vercel.com)** → Import your GitHub repo
3. Add environment variables in Vercel → Settings → Environment Variables
4. Click **Deploy**

### Redeploying after changes
Every `git push` to the `main` branch triggers an automatic redeploy on Vercel.

```bash
git add .
git commit -m "describe your changes"
git push
```
Vercel will redeploy automatically in ~1 minute.

### After adding a new environment variable
1. Add it in Vercel → Settings → Environment Variables
2. Go to Deployments → click the three dots on the latest → **Redeploy**

---

## Building for Android (Google Play)

### Prerequisites
- Android Studio installed
- Java 17+

### Steps
```bash
# 1. Sync latest code to Android project
npx cap sync android

# 2. Open in Android Studio
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync to complete
2. **Build → Generate Signed Bundle / APK**
3. Select **Android App Bundle (.aab)**
4. Use your existing keystore (saved from first build)
5. Select **release** build → Finish
6. Upload the `.aab` file to Google Play Console

**Package name:** `com.praveenr4u.nutriai`
**AAB location:** `android/app/release/app-release.aab`

> ⚠️ Keep your keystore file and passwords safe. You cannot update the app without them.

---

## Building for iOS (App Store)

### Prerequisites
- Mac with Xcode installed
- Apple Developer account ($99/year)
- CocoaPods: `sudo gem install cocoapods`

### Steps
```bash
# 1. Sync latest code to iOS project
npx cap sync ios

# 2. Open in Xcode
npx cap open ios
```

In Xcode:
1. Select your Apple Developer team in Signing & Capabilities
2. Set Bundle ID: `com.praveenr4u.nutriai`
3. **Product → Archive**
4. Upload to App Store Connect via Organizer

---

## Supabase Database Schema

### Tables
| Table | Purpose |
|---|---|
| `profiles` | User profile, body stats, calorie targets |
| `food_logs` | Daily food entries per meal |
| `water_logs` | Daily water intake |
| `scan_logs` | AI scan usage tracking (daily limit) |
| `weight_logs` | Weight history for progress chart |
| `streaks` | Daily logging streaks and badges |

### Row Level Security
All tables use RLS — users can only read/write their own data.

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/recognize-food` | POST | Google Vision AI food recognition |
| `/api/barcode` | GET | Open Food Facts barcode lookup |
| `/api/suggestions` | POST | AI meal suggestions engine |

---

## Key Features

| Feature | Description |
|---|---|
| 📸 AI Food Scanner | Google Vision identifies food from camera |
| 🔲 Barcode Scanner | Scans product barcodes via Open Food Facts |
| 🤖 AI Coach | Suggests meals based on remaining macros |
| ⚖️ Weight Chart | SVG progress chart toward target weight |
| 🔥 Streak Badges | 6 unlock-able achievement badges |
| ✏️ Edit Profile | Update stats and recalculate targets live |
| 💧 Water Tracker | Daily water intake with cup counter |
| 📋 Meal Plan | 7-day personalised meal plan |
| 🔐 Auth | Supabase email/password authentication |
| 📱 Mobile | Android + iOS via Capacitor |

---

## Environment Variables Reference

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `GOOGLE_VISION_API_KEY` | Google Cloud → APIs & Services → Credentials |
| `CLARIFAI_PAT` | Clarifai → Settings → Security |

---

## Common Issues

**App shows loading screen indefinitely**
→ Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly.

**Food scanner returns 502 error**
→ Check `GOOGLE_VISION_API_KEY` is valid and billing is enabled on Google Cloud.

**Barcode not found**
→ The product may not be in the Open Food Facts database. Use manual food search instead.

**Build error: module not found**
→ Run `npm install` to reinstall all dependencies.

**Android build fails**
→ Make sure Gradle is synced in Android Studio (File → Sync Project with Gradle Files).

---

## Contact

Built by Praveen Ramachandran
Live app: https://nutriai-sigma.vercel.app
Privacy policy: https://nutriai-sigma.vercel.app/privacy
