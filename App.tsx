import React, { useState, useEffect, useReducer } from 'react';
import { GameState, Phase, Player, Language, ActionType, Role } from './types';
import { I18N, MIN_PLAYERS, MAX_PLAYERS } from './constants';
import * as GameEngine from './services/gameEngine';
import { Button } from './components/Button';
import { PlayerCard } from './components/PlayerCard';
import { GameLog } from './components/GameLog';
import { Crown, Copy, Users, Globe, BadgeCheck } from 'lucide-react';

// --- Simulation of Server & Networking ---
// In a real app, this would be on a Node.js server.
// Here we hold state in a ref or parent component and "broadcast" updates.
const initialGameState: GameState = {
  roomId: 'ROOM-1234',
  hostPlayerId: '',
  phase: Phase.LOBBY,
  players: [],
  turnIndex: 0,
  deck: [],
  pendingAction: null,
  logs: [],
  winnerId: null,
  victimId: null
};

function App() {
  const [lang, setLang] = useState<Language>('en');
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [myPlayerId, setMyPlayerId] = useState<string>(''); // Determines which view we see
  const [lobbyName, setLobbyName] = useState('');
  
  // Helpers to simulate network calls
  const sendCommand = (cmd: string, payload: any) => {
    // Simulate server latency
    setTimeout(() => {
      let newState = { ...gameState };
      
      if (cmd === 'JOIN') {
        if (newState.phase !== Phase.LOBBY) return;
        const newPlayerId = `p${newState.players.length + 1}`;
        const newPlayer = {
            id: newPlayerId,
            name: payload.name,
            coins: 0,
            cards: [],
            isAlive: true,
            lostCards: []
        };
        
        newState.players = [...newState.players, newPlayer];
        
        // Host Assignment: If no host, or list was empty, this player is host
        if (!newState.hostPlayerId || newState.players.length === 1) {
            newState.hostPlayerId = newPlayerId;
        }

        // Auto-login as the joined player for demo
        if (!myPlayerId) setMyPlayerId(newPlayerId);
      }
      else if (cmd === 'START') {
         // Validation: Only host can start
         if (payload.playerId !== newState.hostPlayerId) return;

         newState = GameEngine.initializeGame(
             newState.roomId, 
             newState.players.map(p => p.name),
             newState.hostPlayerId
         );
         // Preserve IDs for continuity in this mock
         newState.players = newState.players.map((p, i) => ({...p, id: `p${i+1}`}));
      }
      else if (cmd === 'ACTION') {
         newState = GameEngine.applyAction(newState, { type: 'SUBMIT_ACTION', payload });
      }
      else if (cmd === 'PASS') {
         newState = GameEngine.applyAction(newState, { type: 'PASS', payload });
      }
      else if (cmd === 'BLOCK') {
         newState = GameEngine.applyAction(newState, { type: 'BLOCK', payload });
      }
      else if (cmd === 'CHALLENGE') {
         newState = GameEngine.applyAction(newState, { type: 'CHALLENGE', payload });
      }
      else if (cmd === 'LOSE_CARD') {
         newState = GameEngine.applyAction(newState, { type: 'LOSE_CARD', payload });
      }
      
      // Implicit Disconnect/Reassign Logic Check (Mocked)
      // If the current host is not in players list, reassign to first player
      const hostExists = newState.players.find(p => p.id === newState.hostPlayerId);
      if (!hostExists && newState.players.length > 0) {
          newState.hostPlayerId = newState.players[0].id;
      }

      setGameState(newState);
    }, 50); // 50ms simulated latency
  };

  const toggleLang = () => setLang(l => l === 'en' ? 'zh' : 'en');
  const t = I18N[lang];

  // Derived state
  const myPlayer = gameState.players.find(p => p.id === myPlayerId);
  const isMyTurn = myPlayerId === gameState.players[gameState.turnIndex]?.id;
  const isHost = myPlayerId === gameState.hostPlayerId;
  
  // --- UI Components ---
  
  // LOBBY VIEW
  if (gameState.phase === Phase.LOBBY) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="absolute top-4 right-4">
            <button onClick={toggleLang} className="flex items-center gap-2 bg-white px-3 py-2 rounded-full shadow text-sm font-bold text-slate-700">
               <Globe size={16}/> {lang === 'en' ? 'EN' : '中文'}
            </button>
        </div>

        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
           <div className="flex justify-center mb-6 text-slate-900">
              <Crown size={48} strokeWidth={1.5} />
           </div>
           <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">{t.lobby.title}</h1>
           <p className="text-slate-500 mb-8">Web Prototype v0.2</p>

           {!myPlayerId ? (
             <div className="space-y-4">
               <input 
                 type="text" 
                 placeholder={t.lobby.enterName}
                 className="w-full px-4 py-3 border border-slate-200 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                 value={lobbyName}
                 onChange={(e) => setLobbyName(e.target.value)}
               />
               <Button 
                 fullWidth 
                 disabled={!lobbyName.trim()}
                 onClick={() => sendCommand('JOIN', { name: lobbyName })}
               >
                 {t.lobby.join}
               </Button>
             </div>
           ) : (
             <div className="space-y-6">
               <div className="bg-slate-50 rounded-xl p-4">
                  <div className="text-xs font-bold text-slate-400 uppercase mb-2">{t.lobby.roomCode}</div>
                  <div className="text-2xl font-mono font-bold flex items-center justify-center gap-2">
                     {gameState.roomId}
                     <Copy size={16} className="text-slate-400 cursor-pointer hover:text-slate-900" />
                  </div>
               </div>

               <div className="text-left">
                  <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex justify-between">
                    <span>{t.lobby.players} ({gameState.players.length}/{MAX_PLAYERS})</span>
                    <Users size={14}/>
                  </div>
                  <div className="space-y-2">
                    {gameState.players.map(p => (
                       <div key={p.id} className="flex items-center justify-between text-slate-700 font-medium bg-slate-50 p-2 rounded">
                          <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              {p.name} {p.id === myPlayerId && "(You)"}
                          </div>
                          {p.id === gameState.hostPlayerId && (
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
                       disabled={gameState.players.length < MIN_PLAYERS}
                       onClick={() => sendCommand('START', { playerId: myPlayerId })}
                     >
                       {t.lobby.startGame}
                     </Button>
                     {gameState.players.length < MIN_PLAYERS ? (
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
               
               {isHost && gameState.players.length < MIN_PLAYERS && (
                  <div className="text-xs text-slate-400">{t.lobby.waitingForPlayers}</div>
               )}
             </div>
           )}
        </div>
      </div>
    );
  }

  // GAME VIEW
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Top Bar (Mobile) / Header */}
      <div className="md:hidden bg-white p-3 border-b border-slate-200 flex justify-between items-center z-10">
        <div className="font-bold text-slate-800">{t.lobby.title}</div>
        <button onClick={toggleLang} className="text-sm font-bold bg-slate-100 px-2 py-1 rounded">
          {lang === 'en' ? 'EN' : '中'}
        </button>
      </div>

      {/* DEBUG: Seat Switcher (for prototype testing) */}
      <div className="absolute bottom-24 right-4 z-50 md:top-4 md:right-4 md:bottom-auto">
         <select 
           value={myPlayerId} 
           onChange={(e) => setMyPlayerId(e.target.value)}
           className="bg-black/80 text-white text-xs p-2 rounded shadow backdrop-blur-md border border-white/20"
         >
           {gameState.players.map(p => <option key={p.id} value={p.id}>View as: {p.name}</option>)}
         </select>
      </div>

      {/* LEFT COL: Players */}
      <div className="w-full md:w-80 bg-slate-100/50 border-r border-slate-200 md:h-full flex flex-col">
        <div className="p-4 md:flex-1 overflow-x-auto md:overflow-y-auto flex md:flex-col gap-3 no-scrollbar">
          {gameState.players.map(p => (
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
                  {gameState.winnerId ? t.game.winner : 
                    `${t.game.turn}: ${gameState.players[gameState.turnIndex].name}`
                  }
               </h2>
               <div className="text-sm text-slate-500">
                  {gameState.phase === Phase.ACTION_SELECTION && t.status.waiting}
                  {gameState.phase === Phase.CHALLENGE_WINDOW && t.status.challenging}
                  {gameState.phase === Phase.BLOCK_RESPONSE && t.status.blocking}
                  {gameState.phase === Phase.LOSE_CARD && t.game.loseCard}
               </div>
            </div>
            <div className="hidden md:block">
              <button onClick={toggleLang} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm">
                <Globe size={16}/> {lang === 'en' ? 'EN' : '中文'}
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
                    <Button key={idx} variant="danger" fullWidth onClick={() => sendCommand('LOSE_CARD', { playerId: myPlayerId, cardIndex: idx })}>
                      {t.roles[card]}
                    </Button>
                  ))}
                </div>
             </div>
          )}

          {/* Action: Selection (My Turn) */}
          {gameState.phase === Phase.ACTION_SELECTION && isMyTurn && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Button onClick={() => sendCommand('ACTION', { actionType: ActionType.INCOME })}>
                {t.actions[ActionType.INCOME]}
              </Button>
              <Button onClick={() => sendCommand('ACTION', { actionType: ActionType.FOREIGN_AID })}>
                {t.actions[ActionType.FOREIGN_AID]}
              </Button>
              <Button onClick={() => sendCommand('ACTION', { actionType: ActionType.TAX })}>
                {t.actions[ActionType.TAX]}
              </Button>
              {/* Coup Target Selection UI would go here, simplified for MVP to auto-select next living player or prompt */}
              <Button 
                variant="danger"
                disabled={myPlayer!.coins < 7}
                onClick={() => {
                   // For MVP, simple prompt to pick target ID
                   const target = prompt("Target Player ID (e.g. p1, p2):");
                   if(target) sendCommand('ACTION', { actionType: ActionType.COUP, targetId: target });
                }}
              >
                {t.actions[ActionType.COUP]}
              </Button>
            </div>
          )}

          {/* Action: Challenge / Block (Others) */}
          {gameState.phase === Phase.CHALLENGE_WINDOW && !isMyTurn && gameState.pendingAction?.sourceId !== myPlayerId && (
            <div className="flex gap-2">
               <div className="flex-1 text-sm font-bold flex items-center text-slate-500">
                  {gameState.pendingAction?.sourceId} uses {t.actions[gameState.pendingAction?.type as ActionType]}...
               </div>
               
               {gameState.pendingAction?.type === ActionType.FOREIGN_AID && (
                  <Button variant="secondary" onClick={() => sendCommand('BLOCK', { playerId: myPlayerId })}>
                    {t.actions[ActionType.BLOCK_FOREIGN_AID]}
                  </Button>
               )}
               
               {gameState.pendingAction?.type === ActionType.TAX && (
                  <Button variant="danger" onClick={() => sendCommand('CHALLENGE', { playerId: myPlayerId })}>
                     {t.actions[ActionType.CHALLENGE]}
                  </Button>
               )}
               
               <Button variant="ghost" onClick={() => sendCommand('PASS', {})}>
                  {t.actions[ActionType.PASS]}
               </Button>
            </div>
          )}

          {/* Action: Respond to Block (Original Actor) */}
          {gameState.phase === Phase.BLOCK_RESPONSE && gameState.pendingAction?.sourceId === myPlayerId && (
            <div className="space-y-2">
               <p className="text-slate-600 text-sm text-center">
                  {gameState.pendingAction.blockedBy} blocked your action!
               </p>
               <div className="flex gap-2">
                  <Button variant="danger" fullWidth onClick={() => sendCommand('CHALLENGE', { playerId: myPlayerId })}>
                     {t.actions[ActionType.CHALLENGE]} (Claim they lie)
                  </Button>
                  <Button variant="secondary" fullWidth onClick={() => sendCommand('PASS', {})}>
                     {t.actions[ActionType.PASS]} (Accept Block)
                  </Button>
               </div>
            </div>
          )}
          
           {/* Passive Waiting State */}
           { !isMyTurn && gameState.phase === Phase.ACTION_SELECTION && (
              <div className="text-center text-slate-400 italic py-2">
                {t.status.waiting}
              </div>
           )}
        </div>
      </div>
    </div>
  );
}

export default App;