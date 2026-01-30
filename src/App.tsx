import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GameState, Phase, Language, ActionType, Role } from '../types';
import { I18N, MIN_PLAYERS, MAX_PLAYERS } from '../constants';
import * as GameEngine from '../services/gameEngine';
import { getPlayerName, formatLogEntry } from '../utils/gameUtils';
import { RoleChip, ROLE_META, getRoleChipClass } from '../constants/roleMeta';
import { Button } from '../components/Button';
import { PlayerCard } from '../components/PlayerCard';
import { GameLog } from '../components/GameLog';
import { Logo } from './components/Logo';
import { Crown, Copy, Users, Globe, BadgeCheck, Wallet, Coins, Landmark, Hand, Swords, Zap, RefreshCw } from 'lucide-react';
import { connectSocket, getSocket, emitGameState, RoomState, Player as SocketPlayer } from './net/socket';
import { useIsMobile } from './hooks/useMediaQuery';
import { BottomSheet } from '../components/BottomSheet';
import { hasJoinConfetti, getCoupButtonClass } from './easterEggs';

type View = 'landing' | 'room' | 'game';

function App() {
  const [lang, setLang] = useState<Language>('en');
  const [view, setView] = useState<View>('landing');
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string>('');
  const [exchangeReturnIndices, setExchangeReturnIndices] = useState<number[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  /** UI-only: when choosing Coup/Assassinate/Steal, user clicks a player card to select target */
  const [targetSelection, setTargetSelection] = useState<{
    mode: 'select-target';
    action: ActionType.COUP | ActionType.ASSASSINATE | ActionType.STEAL;
    validTargetIds: string[];
  } | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [cardLostToast, setCardLostToast] = useState(false);

  const isMobile = useIsMobile();
  const t = I18N[lang];
  const gameStateHandlerRef = useRef<((data: { gameState: GameState }) => void) | null>(null);

  // Formatted game log lines (must run unconditionally for Rules of Hooks)
  const formattedLogs = useMemo(() => {
    if (!gameState) return [];
    const getName = (playerId: string) => getPlayerName(gameState, playerId);
    return gameState.logs.map((entry) => formatLogEntry(entry, getName, t));
  }, [gameState?.logs, gameState?.players, lang, gameState]);

  // Clear target selection when leaving action selection or when not our turn (must run unconditionally)
  useEffect(() => {
    if (!gameState) return;
    const isMyTurn = myPlayerId === gameState.players[gameState.turnIndex]?.id;
    if (gameState.phase !== Phase.ACTION_SELECTION || !isMyTurn) {
      setTargetSelection(null);
      setSelectedTargetId(null);
    }
  }, [gameState?.phase, gameState?.turnIndex, gameState?.players, myPlayerId, gameState]);

  // Clear exchange selection when we first enter EXCHANGE_SELECT (e.g. after others pass) so indices aren't stale
  const prevPhaseRef = useRef<Phase | null>(null);
  useEffect(() => {
    if (!gameState) return;
    const justEnteredExchange =
      gameState.phase === Phase.EXCHANGE_SELECT &&
      gameState.exchangePlayerId === myPlayerId &&
      prevPhaseRef.current !== Phase.EXCHANGE_SELECT;
    prevPhaseRef.current = gameState.phase;
    if (justEnteredExchange) setExchangeReturnIndices([]);
  }, [gameState?.phase, gameState?.exchangePlayerId, myPlayerId, gameState]);

  // All clients in game view listen to game:state continuously (host + non-host); same handler ref for cleanup
  useEffect(() => {
    if (view !== 'game') return;
    const socket = getSocket();
    if (!socket) return;
    const handler = (data: { gameState: GameState }) => {
      const raw = data.gameState;
      if (!raw) return;
      // Deep clone so React always sees a new reference (Play Again sync for non-host)
      const next = JSON.parse(JSON.stringify(raw)) as GameState;
      setGameState(next);
      // If we were on Game Over and new state is active (no winner), UI re-renders to in-game automatically
    };
    gameStateHandlerRef.current = handler;
    socket.on('game:state', handler);
    return () => {
      const ref = gameStateHandlerRef.current;
      if (ref) {
        socket.off('game:state', ref);
        gameStateHandlerRef.current = null;
      }
    };
  }, [view]);

  // Initialize socket and check for existing session (reconnect only; never auto create/join)
  useEffect(() => {
    const socket = connectSocket();

    const savedPlayerId = sessionStorage.getItem('playerId');
    const savedRoomCode = sessionStorage.getItem('roomCode');
    const savedPlayerName = sessionStorage.getItem('playerName');

    const tryReconnect = () => {
      if (!savedPlayerId || !savedRoomCode || !savedPlayerName) return;
      setPlayerName(savedPlayerName);
      setMyPlayerId(savedPlayerId);
      socket.emit('room:reconnect', {
        roomCode: savedRoomCode,
        playerId: savedPlayerId,
        name: savedPlayerName,
      });
    };

    if (savedPlayerId && savedRoomCode && savedPlayerName) {
      if (socket.connected) tryReconnect();
      else socket.once('connect', tryReconnect);
    }

    socket.on('room:reconnected', (data: { roomState: RoomState; gameState?: GameState }) => {
      const { roomState, gameState: gameStatePayload } = data;
      setRoomState(roomState);
      setView(roomState.status === 'in_game' ? 'game' : 'room');
      if (gameStatePayload) setGameState(gameStatePayload as GameState);
      setError('');
    });

    socket.on('room:created', (data) => {
      const { roomCode, playerId, roomState } = data;
      sessionStorage.setItem('playerId', playerId);
      sessionStorage.setItem('roomCode', roomCode);
      sessionStorage.setItem('playerName', roomState.players.find((p: { id: string }) => p.id === playerId)?.name ?? playerName);
      setMyPlayerId(playerId);
      setRoomState(roomState);
      setView('room');
      setError('');
    });

    socket.on('room:joined', (data) => {
      const { roomCode, playerId, roomState } = data;
      sessionStorage.setItem('playerId', playerId);
      sessionStorage.setItem('roomCode', roomCode);
      sessionStorage.setItem('playerName', roomState.players.find((p: { id: string }) => p.id === playerId)?.name ?? playerName);
      setMyPlayerId(playerId);
      setRoomState(roomState);
      setView(roomState.status === 'in_game' ? 'game' : 'room');
      setError('');
    });

    socket.on('room:state', (data) => {
      const room = data.roomState;
      if (!myPlayerId) {
        setRoomState(room);
        if (room.status === 'in_game') setView('game');
        return;
      }
      const stillInRoom = room.players.some((p: { id: string }) => p.id === myPlayerId);
      if (!stillInRoom) {
        sessionStorage.removeItem('roomCode');
        sessionStorage.removeItem('playerId');
        sessionStorage.removeItem('playerName');
        setRoomState(null);
        setGameState(null);
        setView('landing');
        setMyPlayerId('');
        setError('');
        return;
      }
      setRoomState(room);
      if (room.status === 'in_game' && view === 'room') {
        setView('game');
      }
    });

    socket.on('error', (data) => {
      const msg = data.message || '';
      if (msg.includes('Room not found') || msg.includes('Player not found') || msg.includes('not in room')) {
        sessionStorage.removeItem('roomCode');
        sessionStorage.removeItem('playerId');
        sessionStorage.removeItem('playerName');
        setRoomState(null);
        setGameState(null);
        setView('landing');
        setMyPlayerId('');
      }
      setError(msg);
    });

    return () => {
      socket.off('connect', tryReconnect);
      socket.off('room:reconnected');
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:state');
      socket.off('error');
    };
  }, [playerName, view, myPlayerId]);

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    const socket = getSocket();
    if (socket) {
      socket.emit('room:create', { name: playerName.trim() });
    }
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCodeInput.trim()) {
      setError('Please enter a room code');
      return;
    }
    const socket = getSocket();
    if (socket) {
      socket.emit('room:join', {
        roomCode: roomCodeInput.trim().toUpperCase(),
        name: playerName.trim(),
      });
    }
  };

  const handleStartGame = () => {
    if (!roomState || !myPlayerId) return;
    const socket = getSocket();
    if (socket) {
      socket.emit('room:start', {
        roomCode: roomState.roomCode,
        playerId: myPlayerId,
      });
    }
  };

  const handleExitGame = () => {
    const roomCode = sessionStorage.getItem('roomCode');
    const socket = getSocket();
    if (socket && roomCode && myPlayerId) {
      socket.emit('room:leave', { roomCode, playerId: myPlayerId });
    }
    sessionStorage.removeItem('roomCode');
    sessionStorage.removeItem('playerId');
    sessionStorage.removeItem('playerName');
    setRoomState(null);
    setGameState(null);
    setView('landing');
    setMyPlayerId('');
    setError('');
  };

  const handleLeaveRoom = () => {
    const roomCode = sessionStorage.getItem('roomCode');
    const socket = getSocket();
    if (socket && roomCode && myPlayerId) {
      socket.emit('leaveRoom', { roomCode, playerId: myPlayerId });
    }
    sessionStorage.removeItem('roomCode');
    sessionStorage.removeItem('playerId');
    sessionStorage.removeItem('playerName');
    setRoomState(null);
    setGameState(null);
    setView('landing');
    setMyPlayerId('');
    setError('');
  };

  const handlePlayAgain = () => {
    // Host can restart: use roomState, or fallback to gameState when in game (e.g. roomState stale)
    const isHostByRoom = roomState && myPlayerId === roomState.hostId;
    const isHostByGame = gameState && myPlayerId === gameState.hostPlayerId;
    if (!isHostByRoom && !isHostByGame) return;

    const roomCode = roomState?.roomCode ?? gameState?.roomId ?? sessionStorage.getItem('roomCode');
    const gamePlayers = roomState
      ? convertToGamePlayers(roomState.players)
      : (gameState!.players.map((p) => ({ id: p.id, name: p.name, coins: 0, cards: [], isAlive: true, lostCards: [] as Role[] })));
    const hostId = roomState?.hostId ?? gameState!.hostPlayerId;
    if (!roomCode) return;

    const newGameState = GameEngine.initializeGame(
      roomCode,
      gamePlayers.map((p) => p.name),
      hostId
    );
    newGameState.players = newGameState.players.map((p, i) => ({
      ...p,
      id: gamePlayers[i]?.id || p.id,
    }));

    // Optimistic update: host sees new game immediately; server broadcast will sync others (and re-sync host)
    setGameState(newGameState);
    setTargetSelection(null);
    setSelectedTargetId(null);
    setExchangeReturnIndices([]);
    setCardLostToast(false);

    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('game:restart', {
        roomCode,
        playerId: myPlayerId,
        gameState: newGameState as unknown as Record<string, unknown>,
      });
    }
  };

  const toggleLang = () => setLang(l => l === 'en' ? 'zh' : 'en');

  // Convert SocketPlayer to Game Player format
  const convertToGamePlayers = (socketPlayers: SocketPlayer[]) => {
    return socketPlayers.map((p, idx) => ({
      id: p.id,
      name: p.name,
      coins: 0,
      cards: [] as Role[],
      isAlive: true,
      lostCards: [] as Role[],
    }));
  };

  // Initialize game when room starts
  useEffect(() => {
    if (roomState?.status === 'in_game' && !gameState && roomState.players.length >= 2) {
      const gamePlayers = convertToGamePlayers(roomState.players);
      const newGameState = GameEngine.initializeGame(
        roomState.roomCode,
        gamePlayers.map(p => p.name),
        roomState.hostId
      );
      // Preserve player IDs
      newGameState.players = newGameState.players.map((p, i) => ({
        ...p,
        id: gamePlayers[i]?.id || p.id,
      }));
      setGameState(newGameState);
      const roomCode = sessionStorage.getItem('roomCode');
      if (roomCode) emitGameState(roomCode, newGameState as unknown as Record<string, unknown>);
    }
  }, [roomState?.status, roomState?.players, roomState?.hostId, roomState?.roomCode]);

  // Easter egg: 1k confetti once per session
  useEffect(() => {
    if (view !== 'game' || !gameState) return;
    const roomCode = sessionStorage.getItem('roomCode');
    const myPlayer = gameState.players.find((p) => p.id === myPlayerId);
    const name = myPlayer?.name;
    if (!name || !roomCode || !hasJoinConfetti(name)) return;
    const key = `egg_confetti_${roomCode}_${name}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    setShowConfetti(true);
  }, [view, gameState, myPlayerId]);

  useEffect(() => {
    if (!showConfetti) return;
    const t = setTimeout(() => setShowConfetti(false), 1300);
    return () => clearTimeout(t);
  }, [showConfetti]);

  // LANDING VIEW
  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div
          className="absolute right-4 md:top-4"
          style={{ top: 'max(calc(env(safe-area-inset-top, 0px) + 16px), 44px)' }}
        >
          <button
            onClick={toggleLang}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-full shadow text-sm font-bold text-slate-700 md:min-h-11"
          >
            <Globe size={16} /> {lang === 'en' ? 'EN' : '中文'}
          </button>
        </div>

        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="flex justify-center mb-6 text-slate-900">
            <Crown size={48} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">{t.lobby.title}</h1>

          <div className="space-y-4">
            <div>
              <input
                type="text"
                placeholder={t.lobby.enterName}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && playerName.trim()) {
                    handleCreateRoom();
                  }
                }}
              />
            </div>

            <div>
              <input
                type="text"
                placeholder={t.lobby.roomCode}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-slate-900 uppercase"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && playerName.trim() && roomCodeInput.trim()) {
                    handleJoinRoom();
                  }
                }}
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 font-medium bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button fullWidth onClick={handleCreateRoom} disabled={!playerName.trim()}>
                {t.lobby.create}
              </Button>
              <Button
                fullWidth
                variant="secondary"
                onClick={handleJoinRoom}
                disabled={!playerName.trim() || !roomCodeInput.trim()}
              >
                {t.lobby.join}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ROOM VIEW (Waiting Room)
  if (view === 'room' && roomState) {
    const isHost = myPlayerId === roomState.hostId;
    const connectedPlayers = roomState.players.filter(p => p.connected);

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div
          className="absolute right-4 md:top-4 flex items-center gap-2"
          style={{ top: 'max(calc(env(safe-area-inset-top, 0px) + 16px), 44px)' }}
        >
          <button
            onClick={handleLeaveRoom}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-full shadow text-sm font-bold text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 transition md:min-h-11"
          >
            {t.lobby.leaveRoom}
          </button>
          <button
            onClick={toggleLang}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-full shadow text-sm font-bold text-slate-700 md:min-h-11"
          >
            <Globe size={16} /> {lang === 'en' ? 'EN' : '中文'}
          </button>
        </div>

        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="flex justify-center mb-6 text-slate-900">
            <Crown size={48} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-12 tracking-tight">{t.lobby.title}</h1>

          <div className="space-y-6 mt-6">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2">{t.lobby.roomCode}</div>
              <div className="text-2xl font-mono font-bold flex items-center justify-center gap-2">
                {roomState.roomCode}
                <Copy
                  size={16}
                  className="text-slate-400 cursor-pointer hover:text-slate-900"
                  onClick={() => {
                    navigator.clipboard.writeText(roomState.roomCode);
                  }}
                />
              </div>
            </div>

            <div className="text-left">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex justify-between">
                <span>
                  {t.lobby.players} ({connectedPlayers.length}/{MAX_PLAYERS})
                </span>
                <Users size={14} />
              </div>
              <div className="space-y-2">
                {roomState.players.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between text-slate-700 font-medium bg-slate-50 p-2 rounded ${
                      !p.connected ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          p.connected ? 'bg-green-500' : 'bg-gray-400'
                        }`}
                      ></div>
                      {p.name} {p.id === myPlayerId && '(You)'}
                    </div>
                    {p.id === roomState.hostId && (
                      <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        <BadgeCheck size={12} /> {t.lobby.host}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isHost ? (
              <div className="space-y-2">
                <Button
                  fullWidth
                  disabled={connectedPlayers.length < MIN_PLAYERS}
                  onClick={handleStartGame}
                >
                  {t.lobby.startGame}
                </Button>
                {connectedPlayers.length < MIN_PLAYERS ? (
                  <p className="text-sm text-red-500 font-medium">{t.lobby.needPlayers}</p>
                ) : (
                  <p className="text-sm text-green-600 font-medium">{t.lobby.youCanStart}</p>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-400 italic bg-slate-50 py-3 rounded-lg border border-slate-100">
                {t.lobby.waiting}
              </div>
            )}

            {error && (
              <div className="text-sm text-red-500 font-medium bg-red-50 p-2 rounded">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // GAME VIEW
  if (view === 'game' && gameState) {
    const myPlayer = gameState.players.find((p) => p.id === myPlayerId);
    const isMyTurn = myPlayerId === gameState.players[gameState.turnIndex]?.id;
    const isHost = myPlayerId === gameState.hostPlayerId;
    const getName = (playerId: string) => getPlayerName(gameState, playerId);
    const coupGlowClass = getCoupButtonClass(myPlayer?.name ?? '');

    const CONFETTI_COLORS = ['#ec4899', '#f472b6', '#fbbf24', '#a78bfa'];
    const confettiPieces = showConfetti ? Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: 15 + (i * 6) % 70,
      delay: (i * 0.04) % 0.5,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    })) : [];

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row h-screen overflow-hidden">
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-[100]" aria-hidden>
            {confettiPieces.map(({ id, left, delay, color }) => (
              <div
                key={id}
                className="absolute w-2 h-2 rounded-sm"
                style={{
                  left: `${left}%`,
                  top: '30%',
                  background: color,
                  animation: 'confetti-fall 1.2s ease-out forwards',
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
          </div>
        )}
        {/* Top Bar (Mobile) / Header — safe-area, sticky, Logo + Lang + Exit, 44px tap targets */}
        <div
          className="md:hidden bg-white/90 backdrop-blur border-b border-slate-200 flex justify-between items-center flex-shrink-0 sticky top-0 z-40 px-4 py-2"
          style={{ paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 20px), 44px)' }}
        >
          <Logo size={28} withText />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleLang}
              className="min-h-11 min-w-11 flex items-center justify-center text-sm font-bold bg-slate-100 rounded-xl px-4 py-2.5 touch-manipulation transition active:scale-[0.98]"
              aria-label={lang === 'en' ? 'Switch to 中文' : 'Switch to EN'}
            >
              {lang === 'en' ? 'EN' : '中'}
            </button>
            <button
              type="button"
              onClick={handleExitGame}
              className="min-h-11 min-w-11 flex items-center justify-center text-sm font-bold text-slate-500 hover:text-red-600 rounded-xl px-4 py-2.5 border border-slate-200 hover:border-red-200 touch-manipulation transition active:scale-[0.98]"
            >
              {t.game.exitGame}
            </button>
          </div>
        </div>

        {/* LEFT COL: Players */}
        <div className="w-full md:w-80 bg-slate-100/50 border-r border-slate-200 md:h-full flex flex-col">
          <div className="p-4 md:flex-1 overflow-x-auto md:overflow-y-auto flex md:flex-col gap-3 no-scrollbar">
            {gameState.players.map((p) => (
              <div key={p.id} className="min-w-[280px] md:min-w-0">
                <PlayerCard
                  player={p}
                  isMe={p.id === myPlayerId}
                  isCurrentTurn={gameState.players[gameState.turnIndex].id === p.id}
                  lang={lang}
                  isTargetSelectable={targetSelection?.validTargetIds.includes(p.id)}
                  isTargetSelected={selectedTargetId === p.id}
                  onTargetClick={targetSelection ? () => setSelectedTargetId(p.id) : undefined}
                />
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COL: Main Game Area */}
        <div className="flex-1 flex flex-col relative bg-white">
          {/* Game Status Banner — turn pill badge on desktop; Exit/Lang only on desktop (mobile has in header) */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              {gameState.winnerId ? (
                <h2 className="text-lg font-bold text-slate-900">{t.game.winner}</h2>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 font-semibold rounded-full px-3 py-1.5 text-sm">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" aria-hidden />
                    {t.game.turn}: {getName(gameState.players[gameState.turnIndex]?.id ?? '')}
                  </span>
                </div>
              )}
              <div className="text-sm text-slate-500 mt-3">
                {gameState.phase === Phase.ACTION_SELECTION && t.status.waiting}
                {gameState.phase === Phase.CHALLENGE_WINDOW && t.status.challenging}
                {gameState.phase === Phase.BLOCK_RESPONSE && t.status.blocking}
                {gameState.phase === Phase.LOSE_CARD && (gameState.victimId === myPlayerId ? t.game.loseCard : `Waiting for ${getName(gameState.victimId ?? '')} to choose a card.`)}
                {gameState.phase === Phase.EXCHANGE_SELECT && (gameState.exchangePlayerId === myPlayerId ? t.status.exchangeSelect : `Waiting for ${getName(gameState.exchangePlayerId ?? '')} to choose 2 cards.`)}
              </div>
            </div>
            <div className="flex items-center gap-2 hidden md:flex">
              <button
                onClick={handleExitGame}
                className="flex items-center gap-2 text-slate-500 hover:text-red-600 font-bold text-sm px-3 py-2 rounded-xl border border-slate-200 hover:border-red-200 transition active:scale-[0.98]"
              >
                {t.game.exitGame}
              </button>
              <button
                onClick={toggleLang}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm px-3 py-2 rounded-xl transition active:scale-[0.98]"
              >
                <Globe size={16} /> {lang === 'en' ? 'EN' : '中文'}
              </button>
            </div>
          </div>

          {/* Victory overlay when game over */}
          {gameState.winnerId && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full p-6 text-center bg-gradient-to-b from-slate-50 to-white">
                <div className="flex justify-center mb-4">
                  <Logo size={64} withText={false} />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-1">{t.game.winner}</h2>
                <p className="text-2xl font-black text-indigo-600 mb-6">
                  {getName(gameState.winnerId)}
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  {isHost ? (
                    <Button variant="primary" onClick={handlePlayAgain} className="min-h-11">
                      {t.game.playAgain}
                    </Button>
                  ) : (
                    <span className="text-slate-400 text-sm py-2">{t.game.playAgainHostOnly}</span>
                  )}
                  <Button variant="secondary" onClick={handleExitGame} className="min-h-11">
                    {t.game.exitGame}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* LOGS */}
          <div className="flex-1 p-4 overflow-hidden relative">
            <div
              className={`absolute inset-4 md:pb-4 ${
                isMobile && isMyTurn && gameState.phase === Phase.ACTION_SELECTION && !targetSelection ? 'pb-[180px]' : 'pb-24'
              }`}
            >
              <GameLog
                logs={formattedLogs}
                lang={lang}
                boldNames={[
                  ...gameState.players.map((p) => p.name),
                  ...Object.values(t.roles),
                ]}
              />
              {/* Role Cheat Sheet — compact help under log, scrollable + role colors */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  {t.cheatsheet.title}
                </div>
                <div className="max-h-32 overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl no-scrollbar pr-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[Role.DUKE, Role.ASSASSIN, Role.CAPTAIN, Role.AMBASSADOR, Role.CONTESSA].map((role) => {
                      const { icon: Icon } = ROLE_META[role];
                      const roleClass = getRoleChipClass(role);
                      return (
                        <div
                          key={role}
                          className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 border ${roleClass}`}
                        >
                          <span className="flex-shrink-0 mt-0.5 opacity-90">
                            <Icon size={14} strokeWidth={2} />
                          </span>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold">{t.roles[role]}</span>
                            <span className="text-[11px] opacity-90 ml-1.5">— {t.cheatsheet[role]}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE FIXED ACTION BAR (only when my turn + action selection; hide when target sheet open) */}
          {isMobile && gameState.phase === Phase.ACTION_SELECTION && isMyTurn && !targetSelection && (
            <div className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] sm:hidden">
              {myPlayer!.coins >= 10 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-amber-600 text-center">{t.game.mustCoup}</p>
                  <button
                    className={`w-full min-h-[48px] rounded-xl bg-red-500 text-white font-bold shadow-md flex items-center justify-center gap-2 ${coupGlowClass ?? ''}`}
                    onClick={() => {
                      const validTargetIds = gameState.players
                        .filter((p) => p.isAlive && p.id !== myPlayerId)
                        .map((p) => p.id);
                      setTargetSelection({ mode: 'select-target', action: ActionType.COUP, validTargetIds });
                      setSelectedTargetId(null);
                    }}
                  >
                    <Zap size={20} />
                    {t.actionsShort[ActionType.COUP]}
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      [ActionType.INCOME, Wallet, 'bg-slate-100 hover:bg-slate-200 text-slate-800'],
                      [ActionType.FOREIGN_AID, Coins, 'bg-slate-100 hover:bg-slate-200 text-slate-800'],
                      [ActionType.TAX, Landmark, 'bg-violet-100 hover:bg-violet-200 text-violet-800'],
                    ].map(([action, Icon, baseClass]) => (
                      <button
                        key={action as string}
                        className={`min-h-[48px] rounded-xl font-bold flex items-center justify-center gap-1.5 text-sm transition active:scale-[0.98] ${baseClass}`}
                        onClick={() => {
                          const newState = GameEngine.applyAction(gameState, {
                            type: 'SUBMIT_ACTION',
                            payload: { actionType: action as ActionType },
                          });
                          setGameState(newState);
                          const roomCode = sessionStorage.getItem('roomCode');
                          if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                        }}
                      >
                        <Icon size={18} />
                        {t.actionsShort[action as ActionType]}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {[
                      [ActionType.STEAL, Hand, myPlayer!.coins, 0, 'bg-red-100 hover:bg-red-200 text-red-800'],
                      [ActionType.ASSASSINATE, Swords, myPlayer!.coins, 3, 'bg-red-100 hover:bg-red-200 text-red-800'],
                      [ActionType.COUP, Zap, myPlayer!.coins, 7, 'bg-red-500 hover:bg-red-600 text-white shadow-md'],
                      [ActionType.EXCHANGE, RefreshCw, 0, 0, 'bg-teal-100 hover:bg-teal-200 text-teal-800'],
                    ].map(([action, Icon, coins, need, activeClass]) => {
                      const needCoinsDisabled = need ? (coins as number) < need : false;
                      const deckTooSmall = (action as ActionType) === ActionType.EXCHANGE && (gameState.deck?.length ?? 0) < 2;
                      const disabled = needCoinsDisabled || deckTooSmall;
                      const validTargetIds = gameState.players
                        .filter((p) => p.isAlive && p.id !== myPlayerId)
                        .map((p) => p.id);
                      const noTarget = [ActionType.STEAL, ActionType.ASSASSINATE, ActionType.COUP].includes(action as ActionType) && validTargetIds.length === 0;
                      const title = needCoinsDisabled ? t.prompt.needCoins.replace('{n}', String(need)) : deckTooSmall ? t.prompt.deckTooSmall : noTarget ? t.prompt.noValidTarget : undefined;
                      const isCoup = action === ActionType.COUP;
                      const coupExtra = isCoup && !disabled && !noTarget && coupGlowClass ? coupGlowClass : '';
                      return (
                        <button
                          key={action as string}
                          disabled={disabled || noTarget}
                          title={title}
                          className={`min-h-[48px] rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 text-xs transition active:scale-[0.98] ${coupExtra} ${
                            disabled || noTarget
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : activeClass
                          }`}
                          onClick={() => {
                            if (disabled || noTarget) return;
                            if (action === ActionType.EXCHANGE) {
                              const newState = GameEngine.applyAction(gameState, {
                                type: 'SUBMIT_ACTION',
                                payload: { actionType: ActionType.EXCHANGE },
                              });
                              setGameState(newState);
                              const roomCode = sessionStorage.getItem('roomCode');
                              if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                              return;
                            }
                            setTargetSelection({ mode: 'select-target', action: action as ActionType.COUP | ActionType.ASSASSINATE | ActionType.STEAL, validTargetIds });
                            setSelectedTargetId(null);
                          }}
                        >
                          <Icon size={18} />
                          {t.actionsShort[action as ActionType]}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* BOTTOM ACTION PANEL — card on desktop; hidden on mobile when fixed bar shown */}
          <div
            className={`p-4 sm:p-3 bg-white border-t border-slate-100 sm:border sm:border-slate-200 sm:rounded-2xl sm:shadow-sm sm:mx-4 sm:mb-4 z-20 max-w-2xl sm:max-w-none ${
              isMobile && gameState.phase === Phase.ACTION_SELECTION && isMyTurn ? 'hidden sm:block' : ''
            }`}
          >
            {/* Action: Exchange — choose 2 cards to return (desktop; mobile uses sheet below) */}
            {gameState.phase === Phase.EXCHANGE_SELECT &&
              gameState.exchangePlayerId === myPlayerId &&
              myPlayer &&
              myPlayer.cards.length >= 2 && (
                <div className="space-y-2 hidden sm:block">
                  <p className="text-sm font-medium text-slate-600">{t.status.exchangeSelect}</p>
                  <div className="flex flex-wrap gap-2">
                    {myPlayer.cards.map((card, idx) => (
                      <Button
                        key={idx}
                        variant={exchangeReturnIndices.includes(idx) ? 'danger' : 'secondary'}
                        onClick={() => {
                          setExchangeReturnIndices((prev) =>
                            prev.includes(idx) ? prev.filter((i) => i !== idx) : prev.length < 2 ? [...prev, idx] : prev
                          );
                        }}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <RoleChip role={card} label={t.roles[card]} size="sm" />
                          {exchangeReturnIndices.includes(idx) ? ' ✓' : ''}
                        </span>
                      </Button>
                    ))}
                  </div>
                  {exchangeReturnIndices.length === 2 && (
                    <Button
                      fullWidth
                      onClick={() => {
                        const newState = GameEngine.applyAction(gameState, {
                          type: 'EXCHANGE_RETURN',
                          payload: {
                            playerId: myPlayerId,
                            cardIndices: exchangeReturnIndices.slice(0, 2).sort((a, b) => a - b) as [number, number],
                          },
                        });
                        setGameState(newState);
                        setExchangeReturnIndices([]);
                        const roomCode = sessionStorage.getItem('roomCode');
                        if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                      }}
                    >
                      {t.game.returnTwoCards}
                    </Button>
                  )}
                </div>
              )}

            {/* Action: Lose Card — desktop; mobile uses sheet */}
            {gameState.phase === Phase.LOSE_CARD && gameState.victimId === myPlayerId && (
              <div className="space-y-2 hidden sm:block">
                <p className="text-red-600 font-bold text-center mb-2">{t.game.loseCard}</p>
                <div className="flex gap-2">
                  {myPlayer?.cards.map((card, idx) => (
                    <Button
                      key={idx}
                      variant="danger"
                      fullWidth
                      onClick={() => {
                        const newState = GameEngine.applyAction(gameState, {
                          type: 'LOSE_CARD',
                          payload: { playerId: myPlayerId, cardIndex: idx },
                        });
                        setGameState(newState);
                        const roomCode = sessionStorage.getItem('roomCode');
                        if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                      }}
                    >
                      <RoleChip role={card} label={t.roles[card]} size="sm" />
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Action: Selection (My Turn) — click-based target selection (desktop; mobile uses fixed bar + target sheet) */}
            {gameState.phase === Phase.ACTION_SELECTION && isMyTurn && (
              <div className="space-y-2 hidden sm:block">
                {targetSelection ? (
                  <>
                    <p className="text-sm font-medium text-slate-700">
                      {t.game.target}: {t.actions[targetSelection.action]}
                    </p>
                    <p className="text-xs text-slate-500">Click a player card on the left, then Confirm.</p>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        disabled={!selectedTargetId}
                        onClick={() => {
                          if (!selectedTargetId) return;
                          const newState = GameEngine.applyAction(gameState, {
                            type: 'SUBMIT_ACTION',
                            payload: { actionType: targetSelection.action, targetId: selectedTargetId },
                          });
                          setGameState(newState);
                          setTargetSelection(null);
                          setSelectedTargetId(null);
                          const roomCode = sessionStorage.getItem('roomCode');
                          if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                        }}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setTargetSelection(null);
                          setSelectedTargetId(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : myPlayer!.coins >= 10 ? (
                  <div>
                    <p className="text-xs text-amber-600 font-medium mb-2">{t.game.mustCoup}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const validTargetIds = gameState.players
                          .filter((p) => p.isAlive && p.id !== myPlayerId)
                          .map((p) => p.id);
                        setTargetSelection({ mode: 'select-target', action: ActionType.COUP, validTargetIds });
                        setSelectedTargetId(null);
                      }}
                      className={`h-10 px-4 rounded-xl font-medium bg-rose-600 text-white border border-rose-700 hover:bg-rose-700 hover:shadow-sm active:scale-[0.98] transition-all inline-flex items-center gap-2 ${coupGlowClass ?? ''}`}
                    >
                      <Zap size={16} />
                      {t.actions[ActionType.COUP]} — {t.game.target}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        [ActionType.INCOME, Wallet, 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100 hover:shadow-sm'],
                        [ActionType.FOREIGN_AID, Coins, 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100 hover:shadow-sm'],
                        [ActionType.TAX, Landmark, 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:shadow-sm'],
                        [ActionType.EXCHANGE, RefreshCw, 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:shadow-sm'],
                      ].map(([action, Icon, btnClass]) => {
                        const deckTooSmall = (action as ActionType) === ActionType.EXCHANGE && (gameState.deck?.length ?? 0) < 2;
                        const disabled = deckTooSmall;
                        const title = deckTooSmall ? t.prompt.deckTooSmall : undefined;
                        return (
                          <button
                            key={action as string}
                            type="button"
                            disabled={disabled}
                            title={title}
                            onClick={() => {
                              if (action === ActionType.EXCHANGE) {
                                const newState = GameEngine.applyAction(gameState, {
                                  type: 'SUBMIT_ACTION',
                                  payload: { actionType: ActionType.EXCHANGE },
                                });
                                setGameState(newState);
                                const roomCode = sessionStorage.getItem('roomCode');
                                if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                                return;
                              }
                              const newState = GameEngine.applyAction(gameState, {
                                type: 'SUBMIT_ACTION',
                                payload: { actionType: action as ActionType },
                              });
                              setGameState(newState);
                              const roomCode = sessionStorage.getItem('roomCode');
                              if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                            }}
                            className={`h-10 rounded-xl font-medium border flex items-center justify-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-sm active:scale-[0.98] transition-all ${disabled ? 'bg-slate-50 border-slate-200 text-slate-400' : btnClass}`}
                          >
                            <Icon size={14} />
                            {t.actionsShort[action as ActionType]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {[
                        [ActionType.COUP, Zap, myPlayer!.coins, 7, 'bg-rose-600 border-rose-700 text-white hover:bg-rose-700 hover:shadow-sm'],
                        [ActionType.ASSASSINATE, Swords, myPlayer!.coins, 3, 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:shadow-sm'],
                        [ActionType.STEAL, Hand, 0, 0, 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:shadow-sm'],
                      ].map(([action, Icon, coins, need, btnClass]) => {
                        const needCoinsDisabled = need ? (coins as number) < need : false;
                        const validTargetIds = gameState.players
                          .filter((p) => p.isAlive && p.id !== myPlayerId)
                          .map((p) => p.id);
                        const noTarget = validTargetIds.length === 0;
                        const disabled = needCoinsDisabled || noTarget;
                        const title = needCoinsDisabled ? t.prompt.needCoins.replace('{n}', String(need)) : noTarget ? t.prompt.noValidTarget : undefined;
                        const isCoup = action === ActionType.COUP;
                        const coupExtra = isCoup && !disabled && coupGlowClass ? coupGlowClass : '';
                        return (
                          <button
                            key={action as string}
                            type="button"
                            disabled={disabled}
                            title={title}
                            onClick={() => {
                              setTargetSelection({
                                mode: 'select-target',
                                action: action as ActionType.COUP | ActionType.ASSASSINATE | ActionType.STEAL,
                                validTargetIds,
                              });
                              setSelectedTargetId(null);
                            }}
                            className={`h-10 rounded-xl font-medium border flex items-center justify-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-sm active:scale-[0.98] transition-all ${coupExtra} ${disabled ? 'bg-slate-50 border-slate-200 text-slate-400' : btnClass}`}
                          >
                            <Icon size={14} />
                            {t.actionsShort[action as ActionType]}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Action: Challenge / Block (Others) — desktop; mobile uses prompt sheet */}
            {gameState.phase === Phase.CHALLENGE_WINDOW &&
              gameState.pendingAction?.sourceId !== myPlayerId && (
                <div className="flex flex-wrap gap-2 items-center hidden sm:flex">
                  <div className="w-full text-sm font-bold text-slate-500">
                    {getName(gameState.pendingAction?.sourceId ?? '')} uses{' '}
                    {t.actions[gameState.pendingAction?.type as ActionType]}
                    {gameState.pendingAction?.targetId
                      ? ` → ${getName(gameState.pendingAction.targetId)}`
                      : ''}
                  </div>
                  {gameState.pendingAction?.type === ActionType.FOREIGN_AID && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const newState = GameEngine.applyAction(gameState, {
                          type: 'BLOCK',
                          payload: { playerId: myPlayerId, role: Role.DUKE },
                        });
                        setGameState(newState);
                        const roomCode = sessionStorage.getItem('roomCode');
                        if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <RoleChip role={Role.DUKE} label={t.roles[Role.DUKE]} size="sm" />
                        {t.actions[ActionType.BLOCK_FOREIGN_AID]}
                      </span>
                    </Button>
                  )}
                  {gameState.pendingAction?.type === ActionType.ASSASSINATE && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const newState = GameEngine.applyAction(gameState, {
                          type: 'BLOCK',
                          payload: { playerId: myPlayerId, role: Role.CONTESSA },
                        });
                        setGameState(newState);
                        const roomCode = sessionStorage.getItem('roomCode');
                        if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <RoleChip role={Role.CONTESSA} label={t.roles[Role.CONTESSA]} size="sm" />
                        {t.actions[ActionType.BLOCK_ASSASSINATE]}
                      </span>
                    </Button>
                  )}
                  {gameState.pendingAction?.type === ActionType.STEAL && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const newState = GameEngine.applyAction(gameState, {
                            type: 'BLOCK',
                            payload: { playerId: myPlayerId, role: Role.CAPTAIN },
                          });
                          setGameState(newState);
                          const roomCode = sessionStorage.getItem('roomCode');
                          if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                        }}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <RoleChip role={Role.CAPTAIN} label={t.roles[Role.CAPTAIN]} size="sm" />
                          {t.actions[ActionType.BLOCK_STEAL]}
                        </span>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const newState = GameEngine.applyAction(gameState, {
                            type: 'BLOCK',
                            payload: { playerId: myPlayerId, role: Role.AMBASSADOR },
                          });
                          setGameState(newState);
                          const roomCode = sessionStorage.getItem('roomCode');
                          if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                        }}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <RoleChip role={Role.AMBASSADOR} label={t.roles[Role.AMBASSADOR]} size="sm" />
                          {t.actions[ActionType.BLOCK_STEAL]}
                        </span>
                      </Button>
                    </>
                  )}
                  {[ActionType.TAX, ActionType.ASSASSINATE, ActionType.STEAL, ActionType.EXCHANGE].includes(
                    gameState.pendingAction?.type as ActionType
                  ) && (
                    <Button
                      variant="danger"
                      onClick={() => {
                        const newState = GameEngine.applyAction(gameState, {
                          type: 'CHALLENGE',
                          payload: { playerId: myPlayerId },
                        });
                        setGameState(newState);
                        const roomCode = sessionStorage.getItem('roomCode');
                        if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                      }}
                    >
                      {t.actions[ActionType.CHALLENGE]}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const newState = GameEngine.applyAction(gameState, {
                        type: 'PASS',
                        payload: { playerId: myPlayerId },
                      });
                      setGameState(newState);
                      const roomCode = sessionStorage.getItem('roomCode');
                      if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                    }}
                  >
                    {t.actions[ActionType.PASS]}
                  </Button>
                </div>
              )}

            {/* Action: Respond to Block (Original Actor) — desktop; mobile uses sheet */}
            {gameState.phase === Phase.BLOCK_RESPONSE &&
              gameState.pendingAction?.sourceId === myPlayerId && (
                <div className="space-y-2 hidden sm:block">
                  <p className="text-slate-600 text-sm text-center">
                    {getName(gameState.pendingAction.blockedBy ?? '')} blocked your action!
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      fullWidth
                      onClick={() => {
                        const newState = GameEngine.applyAction(gameState, {
                          type: 'CHALLENGE',
                          payload: { playerId: myPlayerId },
                        });
                        setGameState(newState);
                        const roomCode = sessionStorage.getItem('roomCode');
                        if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                      }}
                    >
                      {t.actions[ActionType.CHALLENGE]} (Claim they lie)
                    </Button>
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={() => {
                        const newState = GameEngine.applyAction(gameState, {
                          type: 'PASS',
                          payload: { playerId: myPlayerId },
                        });
                        setGameState(newState);
                        const roomCode = sessionStorage.getItem('roomCode');
                        if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                      }}
                    >
                      {t.actions[ActionType.PASS]} (Accept Block)
                    </Button>
                  </div>
                </div>
              )}

            {/* Passive Waiting State */}
            {!isMyTurn && gameState.phase === Phase.ACTION_SELECTION && (
              <div className="text-center text-slate-400 italic py-2">{t.status.waiting}</div>
            )}

            {/* Game Over actions also in panel for desktop (Victory overlay has primary copy) */}
            {gameState.winnerId && (
              <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-slate-100 hidden sm:flex">
                {isHost && (
                  <Button variant="primary" onClick={handlePlayAgain}>{t.game.playAgain}</Button>
                )}
                <Button variant="secondary" onClick={handleExitGame}>{t.game.exitGame}</Button>
              </div>
            )}
          </div>
        </div>

        {/* ——— MOBILE BOTTOM SHEETS ——— */}
        {isMobile && targetSelection && (
          <BottomSheet
            open
            title={`${t.game.target}: ${t.actions[targetSelection.action]}`}
            onClose={() => { setTargetSelection(null); setSelectedTargetId(null); }}
          >
            <div className="space-y-3">
              {gameState.players
                .filter((p) => targetSelection.validTargetIds.includes(p.id))
                .map((p) => (
                  <button
                    key={p.id}
                    className={`w-full min-h-[52px] rounded-2xl border-2 font-bold flex items-center justify-center transition-all ${
                      selectedTargetId === p.id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                        : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                    }`}
                    onClick={() => setSelectedTargetId(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="primary"
                  fullWidth
                  disabled={!selectedTargetId}
                  onClick={() => {
                    if (!selectedTargetId) return;
                    const newState = GameEngine.applyAction(gameState, {
                      type: 'SUBMIT_ACTION',
                      payload: { actionType: targetSelection.action, targetId: selectedTargetId },
                    });
                    setGameState(newState);
                    setTargetSelection(null);
                    setSelectedTargetId(null);
                    const roomCode = sessionStorage.getItem('roomCode');
                    if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                  }}
                >
                  {t.prompt.confirm}
                </Button>
                <Button variant="ghost" fullWidth onClick={() => { setTargetSelection(null); setSelectedTargetId(null); }}>
                  {t.prompt.cancel}
                </Button>
              </div>
            </div>
          </BottomSheet>
        )}

        {isMobile && gameState.phase === Phase.CHALLENGE_WINDOW && gameState.pendingAction?.sourceId !== myPlayerId && (
          <BottomSheet open title={t.prompt.respond} urgency={t.prompt.respond}>
            <div className="space-y-4">
              <p className="text-slate-700 font-medium">
                <span className="font-bold">{getName(gameState.pendingAction?.sourceId ?? '')}</span>{' '}
                {t.prompt.usesAction}{' '}
                <span className="font-bold text-blue-700">{t.actions[gameState.pendingAction?.type as ActionType]}</span>
                {gameState.pendingAction?.targetId && (
                  <> → <span className="font-bold">{getName(gameState.pendingAction.targetId)}</span></>
                )}
              </p>
              <div className="space-y-2">
                {gameState.pendingAction?.type === ActionType.FOREIGN_AID && (
                  <button
                    className="w-full min-h-[48px] rounded-2xl border-2 border-slate-200 bg-white font-bold flex items-center justify-center gap-2"
                    onClick={() => {
                      const newState = GameEngine.applyAction(gameState, { type: 'BLOCK', payload: { playerId: myPlayerId, role: Role.DUKE } });
                      setGameState(newState);
                      const roomCode = sessionStorage.getItem('roomCode');
                      if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                    }}
                  >
                    <RoleChip role={Role.DUKE} label={t.roles[Role.DUKE]} size="sm" />
                    {t.actions[ActionType.BLOCK_FOREIGN_AID]}
                  </button>
                )}
                {gameState.pendingAction?.type === ActionType.ASSASSINATE && (
                  <button
                    className="w-full min-h-[48px] rounded-2xl border-2 border-slate-200 bg-white font-bold flex items-center justify-center gap-2"
                    onClick={() => {
                      const newState = GameEngine.applyAction(gameState, { type: 'BLOCK', payload: { playerId: myPlayerId, role: Role.CONTESSA } });
                      setGameState(newState);
                      const roomCode = sessionStorage.getItem('roomCode');
                      if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                    }}
                  >
                    <RoleChip role={Role.CONTESSA} label={t.roles[Role.CONTESSA]} size="sm" />
                    {t.actions[ActionType.BLOCK_ASSASSINATE]}
                  </button>
                )}
                {gameState.pendingAction?.type === ActionType.STEAL && (
                  <>
                    <button
                      className="w-full min-h-[48px] rounded-2xl border-2 border-slate-200 bg-white font-bold flex items-center justify-center gap-2"
                      onClick={() => {
                        const newState = GameEngine.applyAction(gameState, { type: 'BLOCK', payload: { playerId: myPlayerId, role: Role.CAPTAIN } });
                        setGameState(newState);
                        const roomCode = sessionStorage.getItem('roomCode');
                        if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                      }}
                    >
                      <RoleChip role={Role.CAPTAIN} label={t.roles[Role.CAPTAIN]} size="sm" />
                      {t.actions[ActionType.BLOCK_STEAL]}
                    </button>
                    <button
                      className="w-full min-h-[48px] rounded-2xl border-2 border-slate-200 bg-white font-bold flex items-center justify-center gap-2"
                      onClick={() => {
                        const newState = GameEngine.applyAction(gameState, { type: 'BLOCK', payload: { playerId: myPlayerId, role: Role.AMBASSADOR } });
                        setGameState(newState);
                        const roomCode = sessionStorage.getItem('roomCode');
                        if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                      }}
                    >
                      <RoleChip role={Role.AMBASSADOR} label={t.roles[Role.AMBASSADOR]} size="sm" />
                      {t.actions[ActionType.BLOCK_STEAL]}
                    </button>
                  </>
                )}
                {[ActionType.TAX, ActionType.ASSASSINATE, ActionType.STEAL, ActionType.EXCHANGE].includes(gameState.pendingAction?.type as ActionType) && (
                  <Button
                    variant="danger"
                    fullWidth
                    className="min-h-[48px]"
                    onClick={() => {
                      const newState = GameEngine.applyAction(gameState, { type: 'CHALLENGE', payload: { playerId: myPlayerId } });
                      setGameState(newState);
                      const roomCode = sessionStorage.getItem('roomCode');
                      if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                    }}
                  >
                    {t.actions[ActionType.CHALLENGE]}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  fullWidth
                  className="min-h-[48px]"
                  onClick={() => {
                    const newState = GameEngine.applyAction(gameState, { type: 'PASS', payload: { playerId: myPlayerId } });
                    setGameState(newState);
                    const roomCode = sessionStorage.getItem('roomCode');
                    if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                  }}
                >
                  {t.prompt.doNotBlock} — {t.actions[ActionType.PASS]}
                </Button>
              </div>
            </div>
          </BottomSheet>
        )}

        {isMobile && gameState.phase === Phase.BLOCK_RESPONSE && gameState.pendingAction?.sourceId === myPlayerId && (
          <BottomSheet open title={t.prompt.respond} urgency={t.prompt.respond}>
            <p className="text-slate-700 font-medium mb-4">
              <span className="font-bold">{getName(gameState.pendingAction?.blockedBy ?? '')}</span> {t.prompt.blockedYourAction}
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="danger"
                fullWidth
                className="min-h-[48px]"
                onClick={() => {
                  const newState = GameEngine.applyAction(gameState, { type: 'CHALLENGE', payload: { playerId: myPlayerId } });
                  setGameState(newState);
                  const roomCode = sessionStorage.getItem('roomCode');
                  if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                }}
              >
                {t.prompt.claimTheyLie}
              </Button>
              <Button
                variant="secondary"
                fullWidth
                className="min-h-[48px]"
                onClick={() => {
                  const newState = GameEngine.applyAction(gameState, { type: 'PASS', payload: { playerId: myPlayerId } });
                  setGameState(newState);
                  const roomCode = sessionStorage.getItem('roomCode');
                  if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                }}
              >
                {t.prompt.acceptBlock}
              </Button>
            </div>
          </BottomSheet>
        )}

        {isMobile && gameState.phase === Phase.EXCHANGE_SELECT && gameState.exchangePlayerId === myPlayerId && myPlayer && myPlayer.cards.length >= 2 && (
          <BottomSheet open title={t.status.exchangeSelect}>
            <div className="space-y-3">
              <p className="text-sm text-slate-600">{t.game.returnTwoCards}</p>
              <div className="space-y-2">
                {myPlayer.cards.map((card, idx) => (
                  <button
                    key={idx}
                    className={`w-full min-h-[56px] rounded-2xl border-2 font-bold flex items-center justify-center gap-2 transition-all ${
                      exchangeReturnIndices.includes(idx)
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                        : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                    }`}
                    onClick={() => {
                      setExchangeReturnIndices((prev) =>
                        prev.includes(idx) ? prev.filter((i) => i !== idx) : prev.length < 2 ? [...prev, idx] : prev
                      );
                    }}
                  >
                    <RoleChip role={card} label={t.roles[card]} size="sm" />
                    {exchangeReturnIndices.includes(idx) ? ' ✓' : ''}
                  </button>
                ))}
              </div>
              <Button
                fullWidth
                disabled={exchangeReturnIndices.length !== 2}
                className="min-h-[48px]"
                onClick={() => {
                  const newState = GameEngine.applyAction(gameState, {
                    type: 'EXCHANGE_RETURN',
                    payload: {
                      playerId: myPlayerId,
                      cardIndices: exchangeReturnIndices.slice(0, 2).sort((a, b) => a - b) as [number, number],
                    },
                  });
                  setGameState(newState);
                  setExchangeReturnIndices([]);
                  const roomCode = sessionStorage.getItem('roomCode');
                  if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                }}
              >
                {t.game.returnTwoCards}
              </Button>
            </div>
          </BottomSheet>
        )}

        {isMobile && gameState.phase === Phase.LOSE_CARD && gameState.victimId === myPlayerId && myPlayer && (
          <BottomSheet open title={t.prompt.chooseCardToLose}>
            <div className="space-y-2">
              {myPlayer.cards.map((card, idx) => (
                <button
                  key={idx}
                  className="w-full min-h-[56px] rounded-2xl border-2 border-red-200 bg-red-50 hover:bg-red-100 font-bold flex items-center justify-center gap-2"
                  onClick={() => {
                    const newState = GameEngine.applyAction(gameState, { type: 'LOSE_CARD', payload: { playerId: myPlayerId, cardIndex: idx } });
                    setGameState(newState);
                    const roomCode = sessionStorage.getItem('roomCode');
                    if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                    if (!isMobile) {
                      setCardLostToast(true);
                      setTimeout(() => setCardLostToast(false), 2000);
                    }
                  }}
                >
                  <RoleChip role={card} label={t.roles[card]} size="sm" />
                </button>
              ))}
            </div>
          </BottomSheet>
        )}

        {/* Toast: Card lost (desktop only; suppressed on mobile to avoid overlapping action bar) */}
        {cardLostToast && !isMobile && (
          <div className="fixed bottom-24 left-4 right-4 z-50 rounded-2xl bg-slate-800 text-white font-bold text-center py-3 shadow-lg">
            {t.prompt.cardLost}
          </div>
        )}
        </div>
    );
  }

  return null;
}

export default App;
