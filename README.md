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

Update the `MONGODB_URI` in the `.env` file to the correct URI (found in discord)

```env
MONGODB_URI=mongodb://localhost:27017/movi
DB_NAME=movi
PORT=3000
```

## Running the Application

### Start the Backend

```bash
cd movi-api
./start.sh
# Or manually: python -m flask --app wsgi:app --debug run --port=3000
```

The API will be available at: `http://localhost:3000`

### Start the Frontend

```bash
cd movi-frontend
npm run start
# Or: npx expo start
```
