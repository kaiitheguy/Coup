import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';

const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const corsOrigin = ORIGIN === '*' ? '*' : ORIGIN.split(',').map((s) => s.trim());

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Health check for Render (and other platforms)
app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

// Types
interface Player {
  id: string;
  name: string;
  connected: boolean;
  joinedAt: number;
}

interface RoomState {
  roomCode: string;
  hostId: string;
  players: Player[];
  status: 'waiting' | 'in_game';
}

// In-memory room storage
const rooms = new Map<string, RoomState>();

// Helper: Generate room code
function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper: Generate player ID
function generatePlayerId(): string {
  return `p${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Game state is JSON-serializable; we don't import client types
type GameStatePayload = Record<string, unknown>;

// In-memory game state per room (optional cache; clients are source of truth per update)
const gameStates = new Map<string, GameStatePayload>();

// Helper: Broadcast room state to all clients in a room
async function broadcastRoomState(roomCode: string) {
  const room = rooms.get(roomCode);
  if (room) {
    const sockets = await io.in(roomCode).fetchSockets();
    console.log(`[broadcast] roomCode=${roomCode} event=room:state sockets=${sockets.length}`);
    io.to(roomCode).emit('room:state', { roomState: room });
  }
}

// Helper: Broadcast game state to all clients in a room
async function broadcastGameState(roomCode: string, gameState: GameStatePayload) {
  gameStates.set(roomCode, gameState);
  const sockets = await io.in(roomCode).fetchSockets();
  console.log(`[broadcast] roomCode=${roomCode} event=game:state sockets=${sockets.length}`);
  io.to(roomCode).emit('game:state', { gameState });
}

// Helper: Reassign host if current host disconnected
function reassignHostIfNeeded(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room || room.status === 'in_game') return;

  const host = room.players.find(p => p.id === room.hostId);
  if (host && host.connected) return; // Host is still connected

  // Find earliest connected player
  const connectedPlayers = room.players.filter(p => p.connected).sort((a, b) => a.joinedAt - b.joinedAt);
  if (connectedPlayers.length > 0) {
    room.hostId = connectedPlayers[0].id;
    broadcastRoomState(roomCode);
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Create room
  socket.on('room:create', (data: { name: string }) => {
    const { name } = data;
    if (!name || name.trim().length === 0) {
      socket.emit('error', { message: 'Name is required' });
      return;
    }

    const roomCode = generateRoomCode();
    const playerId = generatePlayerId();

    const room: RoomState = {
      roomCode,
      hostId: playerId,
      players: [{
        id: playerId,
        name: name.trim(),
        connected: true,
        joinedAt: Date.now(),
      }],
      status: 'waiting',
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);

    socket.emit('room:created', {
      roomCode,
      playerId,
      roomState: room,
    });

    console.log(`Room created: ${roomCode} by ${name}`);
  });

  // Join room
  socket.on('room:join', (data: { roomCode: string; name: string }) => {
    const { roomCode, name } = data;
    
    if (!name || name.trim().length === 0) {
      socket.emit('error', { message: 'Name is required' });
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.status === 'in_game') {
      socket.emit('error', { message: 'Game already started' });
      return;
    }

    if (room.players.length >= 6) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    // Check if player already exists (reconnection)
    let player = room.players.find(p => p.name === name.trim());
    if (player) {
      player.connected = true;
      socket.join(roomCode);
      socket.emit('room:joined', {
        roomCode,
        playerId: player.id,
        roomState: room,
      });
      broadcastRoomState(roomCode);
      console.log(`Player reconnected: ${name} to room ${roomCode}`);
      return;
    }

    // New player
    const playerId = generatePlayerId();
    const newPlayer: Player = {
      id: playerId,
      name: name.trim(),
      connected: true,
      joinedAt: Date.now(),
    };

    room.players.push(newPlayer);
    socket.join(roomCode);

    socket.emit('room:joined', {
      roomCode,
      playerId,
      roomState: room,
    });

    broadcastRoomState(roomCode);
    console.log(`Player joined: ${name} to room ${roomCode}`);
  });

  // Start room
  socket.on('room:start', (data: { roomCode: string; playerId: string }) => {
    const { roomCode, playerId } = data;
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.hostId !== playerId) {
      socket.emit('error', { message: 'Only host can start the game' });
      return;
    }

    if (room.players.length < 2) {
      socket.emit('error', { message: 'Need at least 2 players' });
      return;
    }

    if (room.status === 'in_game') {
      socket.emit('error', { message: 'Game already started' });
      return;
    }

    room.status = 'in_game';
    broadcastRoomState(roomCode);
    console.log(`Room started: ${roomCode}`);
  });

  // Game state update: one client sends new state, server broadcasts to entire room
  socket.on('game:update', (data: { roomCode: string; gameState: GameStatePayload }) => {
    const { roomCode, gameState } = data;
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'in_game') return;
    broadcastGameState(roomCode, gameState);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // Find and mark player as disconnected
    for (const [roomCode, room] of rooms.entries()) {
      const player = room.players.find(p => socket.rooms.has(roomCode));
      if (player) {
        player.connected = false;
        console.log(`Player disconnected: ${player.name} from room ${roomCode}`);
        
        // Reassign host if needed
        if (room.status === 'waiting' && room.hostId === player.id) {
          reassignHostIfNeeded(roomCode);
        }
        
        broadcastRoomState(roomCode);
        break;
      }
    }
  });
});

const PORT = Number(process.env.PORT) || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});
