import React, { useState, useEffect, useRef } from 'react';
import { GameState, Phase, Language, ActionType, Role } from '../types';
import { I18N, MIN_PLAYERS, MAX_PLAYERS } from '../constants';
import * as GameEngine from '../services/gameEngine';
import { Button } from '../components/Button';
import { PlayerCard } from '../components/PlayerCard';
import { GameLog } from '../components/GameLog';
import { Crown, Copy, Users, Globe, BadgeCheck } from 'lucide-react';
import { connectSocket, getSocket, emitGameState, RoomState, Player as SocketPlayer } from './net/socket';

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

  const t = I18N[lang];
  const gameStateHandlerRef = useRef<((data: { gameState: GameState }) => void) | null>(null);

  // Subscribe to game:state exactly once when in game view; cleanup with same handler reference
  useEffect(() => {
    if (view !== 'game') return;
    const socket = getSocket();
    if (!socket) return;
    const handler = (data: { gameState: GameState }) => {
      console.log('[game:state]', data.gameState);
      setGameState(data.gameState as GameState);
    };
    gameStateHandlerRef.current = handler;
    socket.on('game:state', handler);
    return () => {
      if (gameStateHandlerRef.current) {
        socket.off('game:state', gameStateHandlerRef.current);
        gameStateHandlerRef.current = null;
      }
    };
  }, [view]);

  // Initialize socket and check for existing session
  useEffect(() => {
    const socket = connectSocket();
    
    // Check sessionStorage for existing room
    const savedPlayerId = sessionStorage.getItem('playerId');
    const savedRoomCode = sessionStorage.getItem('roomCode');
    const savedPlayerName = sessionStorage.getItem('playerName');

    if (savedPlayerId && savedRoomCode && savedPlayerName) {
      setPlayerName(savedPlayerName);
      setMyPlayerId(savedPlayerId);
      // Try to rejoin the room
      socket.emit('room:join', {
        roomCode: savedRoomCode,
        name: savedPlayerName,
      });
    }

    // Listen for room events
    socket.on('room:created', (data) => {
      const { roomCode, playerId, roomState } = data;
      sessionStorage.setItem('playerId', playerId);
      sessionStorage.setItem('roomCode', roomCode);
      sessionStorage.setItem('playerName', playerName);
      setMyPlayerId(playerId);
      setRoomState(roomState);
      setView('room');
      setError('');
    });

    socket.on('room:joined', (data) => {
      const { roomCode, playerId, roomState } = data;
      sessionStorage.setItem('playerId', playerId);
      sessionStorage.setItem('roomCode', roomCode);
      sessionStorage.setItem('playerName', playerName);
      setMyPlayerId(playerId);
      setRoomState(roomState);
      setView(roomState.status === 'in_game' ? 'game' : 'room');
      setError('');
    });

    socket.on('room:state', (data) => {
      setRoomState(data.roomState);
      // If game started, switch to game view
      if (data.roomState.status === 'in_game' && view === 'room') {
        setView('game');
      }
    });

    socket.on('error', (data) => {
      setError(data.message);
    });

    return () => {
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:state');
      socket.off('error');
    };
  }, [playerName, view]);

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

  // LANDING VIEW
  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="absolute top-4 right-4">
          <button
            onClick={toggleLang}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-full shadow text-sm font-bold text-slate-700"
          >
            <Globe size={16} /> {lang === 'en' ? 'EN' : '中文'}
          </button>
        </div>

        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="flex justify-center mb-6 text-slate-900">
            <Crown size={48} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">{t.lobby.title}</h1>
          <p className="text-slate-500 mb-8">Web Prototype v0.2</p>

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
        <div className="absolute top-4 right-4">
          <button
            onClick={toggleLang}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-full shadow text-sm font-bold text-slate-700"
          >
            <Globe size={16} /> {lang === 'en' ? 'EN' : '中文'}
          </button>
        </div>

        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="flex justify-center mb-6 text-slate-900">
            <Crown size={48} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">{t.lobby.title}</h1>

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

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row h-screen overflow-hidden">
        {/* Top Bar (Mobile) / Header */}
        <div className="md:hidden bg-white p-3 border-b border-slate-200 flex justify-between items-center z-10">
          <div className="font-bold text-slate-800">{t.lobby.title}</div>
          <button
            onClick={toggleLang}
            className="text-sm font-bold bg-slate-100 px-2 py-1 rounded"
          >
            {lang === 'en' ? 'EN' : '中'}
          </button>
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
                />
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COL: Main Game Area */}
        <div className="flex-1 flex flex-col relative bg-white">
          {/* Game Status Banner */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {gameState.winnerId
                  ? t.game.winner
                  : `${t.game.turn}: ${gameState.players[gameState.turnIndex].name}`}
              </h2>
              <div className="text-sm text-slate-500">
                {gameState.phase === Phase.ACTION_SELECTION && t.status.waiting}
                {gameState.phase === Phase.CHALLENGE_WINDOW && t.status.challenging}
                {gameState.phase === Phase.BLOCK_RESPONSE && t.status.blocking}
                {gameState.phase === Phase.LOSE_CARD && t.game.loseCard}
              </div>
            </div>
            <div className="hidden md:block">
              <button
                onClick={toggleLang}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm"
              >
                <Globe size={16} /> {lang === 'en' ? 'EN' : '中文'}
              </button>
            </div>
          </div>

          {/* LOGS */}
          <div className="flex-1 p-4 overflow-hidden relative">
            <div className="absolute inset-4 pb-24 md:pb-4">
              <GameLog logs={gameState.logs} lang={lang} />
            </div>
          </div>

          {/* BOTTOM ACTION PANEL */}
          <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
            {/* Action: Lose Card */}
            {gameState.phase === Phase.LOSE_CARD && gameState.victimId === myPlayerId && (
              <div className="space-y-2">
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
                      {t.roles[card]}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Action: Selection (My Turn) */}
            {gameState.phase === Phase.ACTION_SELECTION && isMyTurn && (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Button
                  onClick={() => {
                    const newState = GameEngine.applyAction(gameState, {
                      type: 'SUBMIT_ACTION',
                      payload: { actionType: ActionType.INCOME },
                    });
                    setGameState(newState);
                    const roomCode = sessionStorage.getItem('roomCode');
                    if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                  }}
                >
                  {t.actions[ActionType.INCOME]}
                </Button>
                <Button
                  onClick={() => {
                    const newState = GameEngine.applyAction(gameState, {
                      type: 'SUBMIT_ACTION',
                      payload: { actionType: ActionType.FOREIGN_AID },
                    });
                    setGameState(newState);
                    const roomCode = sessionStorage.getItem('roomCode');
                    if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                  }}
                >
                  {t.actions[ActionType.FOREIGN_AID]}
                </Button>
                <Button
                  onClick={() => {
                    const newState = GameEngine.applyAction(gameState, {
                      type: 'SUBMIT_ACTION',
                      payload: { actionType: ActionType.TAX },
                    });
                    setGameState(newState);
                    const roomCode = sessionStorage.getItem('roomCode');
                    if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                  }}
                >
                  {t.actions[ActionType.TAX]}
                </Button>
                <Button
                  variant="danger"
                  disabled={myPlayer!.coins < 7}
                  onClick={() => {
                    const target = prompt('Target Player ID (e.g. p1, p2):');
                    if (target) {
                      const newState = GameEngine.applyAction(gameState, {
                        type: 'SUBMIT_ACTION',
                        payload: { actionType: ActionType.COUP, targetId: target },
                      });
                      setGameState(newState);
                      const roomCode = sessionStorage.getItem('roomCode');
                      if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                    }
                  }}
                >
                  {t.actions[ActionType.COUP]}
                </Button>
              </div>
            )}

            {/* Action: Challenge / Block (Others) */}
            {gameState.phase === Phase.CHALLENGE_WINDOW &&
              !isMyTurn &&
              gameState.pendingAction?.sourceId !== myPlayerId && (
                <div className="flex gap-2">
                  <div className="flex-1 text-sm font-bold flex items-center text-slate-500">
                    {gameState.pendingAction?.sourceId} uses{' '}
                    {t.actions[gameState.pendingAction?.type as ActionType]}...
                  </div>

                  {gameState.pendingAction?.type === ActionType.FOREIGN_AID && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const newState = GameEngine.applyAction(gameState, {
                          type: 'BLOCK',
                          payload: { playerId: myPlayerId },
                        });
                        setGameState(newState);
                        const roomCode = sessionStorage.getItem('roomCode');
                        if (roomCode) emitGameState(roomCode, newState as unknown as Record<string, unknown>);
                      }}
                    >
                      {t.actions[ActionType.BLOCK_FOREIGN_AID]}
                    </Button>
                  )}

                  {gameState.pendingAction?.type === ActionType.TAX && (
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
                        payload: {},
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

            {/* Action: Respond to Block (Original Actor) */}
            {gameState.phase === Phase.BLOCK_RESPONSE &&
              gameState.pendingAction?.sourceId === myPlayerId && (
                <div className="space-y-2">
                  <p className="text-slate-600 text-sm text-center">
                    {gameState.pendingAction.blockedBy} blocked your action!
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
                          payload: {},
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
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;
