import { io, Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  joinedAt: number;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  players: Player[];
  status: 'waiting' | 'in_game';
}

export interface SocketEvents {
  // Client -> Server
  'room:create': (data: { name: string }) => void;
  'room:join': (data: { roomCode: string; name: string }) => void;
  'room:start': (data: { roomCode: string; playerId: string }) => void;
  'game:update': (data: { roomCode: string; gameState: Record<string, unknown> }) => void;

  // Server -> Client
  'room:created': (data: { roomCode: string; playerId: string; roomState: RoomState }) => void;
  'room:joined': (data: { roomCode: string; playerId: string; roomState: RoomState }) => void;
  'room:state': (data: { roomState: RoomState }) => void;
  'game:state': (data: { gameState: Record<string, unknown> }) => void;
  'error': (data: { message: string }) => void;
}

/** Emit game state so server broadcasts to all clients in room. */
export function emitGameState(roomCode: string, gameState: Record<string, unknown>): void {
  const s = getSocket();
  if (s) s.emit('game:update', { roomCode, gameState });
}

export function connectSocket(): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SERVER_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Connected to server');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
