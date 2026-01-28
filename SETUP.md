# Socket.io Server Setup

## Installation

Install dependencies:
```bash
npm install
```

## Environment variables

- Create a **`.env`** file in the **project root** (copy from `.env.example`).
- Set **`VITE_SERVER_URL`** to your server URL, e.g. `http://localhost:3001` (local) or `https://coup-amlw.onrender.com` (production).
- **Important:** Vite reads env vars when the dev server **starts**. After changing `.env`, you must **restart** `npm run dev` for the new value to take effect.

## Running the Application

### Option 1: Run Server and Client Separately

**Terminal 1 - Start the Socket.io server:**
```bash
npm run dev:server
```
Server will run on `http://localhost:3001`

**Terminal 2 - Start the Vite client:**
```bash
npm run dev
```
Client will run on `http://localhost:3000`

### Option 2: Use a Process Manager

You can use tools like `concurrently` or `npm-run-all` to run both in one command (not included by default).

## Features

- **Real-time room management** - Create and join rooms across browser tabs/devices
- **Session persistence** - Player ID and room code saved in sessionStorage for reconnection
- **Host management** - Automatic host reassignment if host disconnects before game starts
- **Live player list** - See connected/disconnected players in real-time
- **Room state sync** - All clients in a room receive updates when players join/leave

## Usage

1. Enter your name
2. Click "Create Room" to create a new room, or enter a room code and click "Join Room"
3. Wait for other players to join
4. Host can start the game when at least 2 players are connected
5. If you refresh the page, you'll automatically rejoin your room
