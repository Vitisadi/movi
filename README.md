# Movi

A full-stack application built with React Native (Expo) frontend and Flask backend with MongoDB database.

## Quick Setup

The easiest way to set up the project is using the provided setup script:

```bash
# Run the automated setup script
chmod +x setup.sh
./setup.sh
```

This script will:

-  Install frontend dependencies
-  Install backend dependencies
-  Create a `.env` file template
-  Set up the basic project structure

Update the `MONGODB_URI` in the `.env` file to the correct URI (found in discord or make an account below)

https://www.mongodb.com/lp/cloud/atlas/try4-reg?utm_source=google&utm_campaign=search_gs_pl_evergreen_atlas_core-high-int_prosp-brand_gic-null_amers-us_ps-all_desktop_eng_lead&utm_term=atlasmongo&utm_medium=cpc_paid_search&utm_ad=p&utm_ad_campaign_id=19609124046&adgroup=173739098313&cq_cmp=19609124046&gad_source=1&gad_campaignid=19609124046&gbraid=0AAAAADQ1400jeJMO9GXDlXFfjLEP9NnyC&gclid=Cj0KCQiArt_JBhCTARIsADQZaynxZ3OzAU3vB_B_IulNulLmn9zVEQn_Tmz7oKpYvd4c-Nh_rYNzAbMaAiLyEALw_wcB

Run the `init_db.py` file to load up the database.
Then go through each file and add in the correct `schema.py`

```env
MONGODB_URI=mongodb://localhost:27017/movi
DB_NAME=movi
PORT=3000
TMDB_V3_KEY=(https://developer.themoviedb.org/reference/getting-started) <-- found here
```

## Running the Application

### Start the Backend

```bash
cd movi-api
./start.sh
# Or manually: python -m flask --app wsgi:app --debug run --port=3000 --host=0.0.0.0
```

The API will be available at: `http://localhost:3000` (or `http://<your-local-ip>:3000` on your LAN)

### Start the Frontend

```bash
cd movi-frontend
npm run start
# Or: npx expo start
```

### Developing on a physical device

-  Ensure your phone and computer are on the same network.
-  Update `movi-frontend/.env` with your computer's LAN IP:

   ```env
   EXPO_PUBLIC_API_BASE_URL=http://<your-local-ip>:3000
   ```

-  Restart the Expo dev server after changing the `.env` file so the new API base URL is picked up.

## Deployment

### Environment and secrets

-  The backend reads Mongo credentials from `.env` in `movi-api`. Put your managed cluster string there (e.g., `MONGODB_URI=mongodb+srv://user:pass@cluster.../movi`), plus `DB_NAME` and `PORT`.
-  The frontend uses `EXPO_PUBLIC_API_BASE_URL` at build time to know where to reach the API (e.g., `https://api.example.com`). Keep this in your CI/CD or build environment; `EXPO_PUBLIC_` variables are bundled into the client.

### Backend on AWS EC2 (Flask + Gunicorn)

1. Launch an Amazon Linux 2023 `t3.small` (2 vCPU/2GB) with at least 20GB gp3, allow inbound 22 (SSH), 80/443 (web), and 3000 only for internal/testing. Add the instance public IP to your managed MongoDB IP allowlist.
2. SSH in and install the app:
   ```bash
   sudo dnf update -y
   sudo dnf install -y git python3-pip
   git clone <repo-url> && cd movi/movi-api
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   cat > .env <<'EOF'
   MONGODB_URI=<managed-mongo-uri>
   DB_NAME=movi
   PORT=3000
   EOF
   ```
3. Run the API with Gunicorn (add `--workers` as needed):
   ```bash
   source .venv/bin/activate
   gunicorn --bind 0.0.0.0:3000 wsgi:app
   ```
   For production, create a `systemd` service pointing to the virtualenv and `.env`, and place Nginx in front to terminate TLS and forward to `127.0.0.1:3000`.

### Frontend builds (Expo Router)

-  Prereqs: Node 18+, `npm install`, and `npx expo install eas-cli` (or global `npm i -g eas-cli`).
-  Android: `cd movi-frontend` then `EXPO_PUBLIC_API_BASE_URL=https://api.example.com npx eas build -p android --profile production` to produce an AAB; upload via Play Console.
-  iOS: `EXPO_PUBLIC_API_BASE_URL=https://api.example.com npx eas build -p ios --profile production` (requires an Apple developer account); submit the IPA through Transporter or `eas submit`.
-  Web: `EXPO_PUBLIC_API_BASE_URL=https://api.example.com npx expo export --platform web --output-dir dist-web` then host the static `dist-web` folder on S3/CloudFront, Netlify, Vercel, etc.

### Wiring backend, frontend, and database

-  Database: the managed MongoDB URI in `movi-api/.env` is the single source of truth; ensure the cluster allows traffic from the EC2 instance (or VPC peering).
-  Backend: serve over HTTPS (via Nginx/ALB) on a stable domain like `https://api.example.com`. CORS is enabled in the Flask app.
-  Frontend: set `EXPO_PUBLIC_API_BASE_URL` to the public API URL for every build (Android/iOS/Web) so the app points at the deployed backend.
