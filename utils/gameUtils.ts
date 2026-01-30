import { GameState, LogEntry, Role } from '../types';
import type { I18nSchema } from '../types';

export type LogTone = 'system' | 'action' | 'success' | 'block' | 'challenge' | 'danger';

/**
 * Classify a formatted log line for styling (keyword-based; works for EN/中文).
 */
export function classifyLogLine(line: string): LogTone {
  const lower = line.toLowerCase();
  if (/game (started|over)|wins!|游戏|开始|结束|获胜/.test(lower)) return 'system';
  if (/attempts|attempt|尝试/.test(lower)) return 'action';
  if (/blocks? with|blocked|阻挡/.test(lower)) return 'block';
  if (/challenge (failed|successful)|质疑|挑战|质疑失败|质疑成功/.test(lower)) return 'challenge';
  if (/loses? influence|must lose|lose a card|弃掉|失去|影响|必须失去/.test(lower)) return 'danger';
  if (/used (income|tax|foreign aid)|took .* from|coups?|completed exchange|used income|税收|外援|政变|交换|完成|使用了|拿走了|阻挡成功/.test(lower)) return 'success';
  return 'system';
}

/**
 * Resolve display name for a player: lookup in state.players by id, fallback to shortId (first 6 chars).
 */
export function getPlayerName(state: GameState, playerId: string): string {
  const p = state.players.find((x) => x.id === playerId);
  return p?.name ?? playerId.slice(0, 6);
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return out;
}

/**
 * Render a log entry using i18n templates only (no hardcoded EN). Uses t.log.*, t.roles, t.actions.
 */
export function formatLogEntry(
  entry: string | LogEntry,
  getPlayerName: (playerId: string) => string,
  t: I18nSchema
): string {
  if (typeof entry === 'string') return t.log.unknown_event;

  const name = (id: string) => getPlayerName(id);
  const roleLabel = (r: Role) => t.roles[r] ?? r;

  switch (entry.type) {
    case 'game_start':
      return t.log.game_start;
    case 'game_over':
      return applyTemplate(t.log.game_over, { winner: name(entry.winnerId) });
    case 'income':
      return applyTemplate(t.log.income_used, { actor: name(entry.actorId) });
    case 'coup':
      return applyTemplate(t.log.coup, { actor: name(entry.actorId), target: name(entry.targetId) });
    case 'action_attempt': {
      const actionLabel = t.actions[entry.actionType] ?? entry.actionType;
      if (entry.targetId) {
        return applyTemplate(t.log.action_attempt_target, {
          actor: name(entry.actorId),
          action: actionLabel,
          target: name(entry.targetId),
        });
      }
      return applyTemplate(t.log.action_attempt, { actor: name(entry.actorId), action: actionLabel });
    }
    case 'block':
      return applyTemplate(t.log.block, { blocker: name(entry.blockerId), role: roleLabel(entry.role) });
    case 'block_accepted':
      return t.log.block_accepted;
    case 'steal_success':
      return applyTemplate(t.log.steal_success, {
        actor: name(entry.actorId),
        target: name(entry.targetId),
        amount: String(entry.amount),
      });
    case 'tax_success':
      return applyTemplate(t.log.tax_success, { actor: name(entry.actorId) });
    case 'foreign_aid_success':
      return applyTemplate(t.log.foreign_aid_success, { actor: name(entry.actorId) });
    case 'exchange_start':
      return applyTemplate(t.log.exchange_start, { actor: name(entry.actorId) });
    case 'exchange_done':
      return applyTemplate(t.log.exchange_done, { actor: name(entry.actorId) });
    case 'challenge_started':
      return applyTemplate(t.log.challenge_started, {
        challenger: name(entry.challengerId),
        challenged: name(entry.challengedId),
        role: roleLabel(entry.claimedRole),
      });
    case 'challenge_success':
      return applyTemplate(t.log.challenge_success, {
        challenger: name(entry.challengerId),
        challenged: name(entry.challengedId),
        role: roleLabel(entry.claimedRole),
      });
    case 'challenge_fail':
      return applyTemplate(t.log.challenge_fail, {
        challenger: name(entry.challengerId),
        challenged: name(entry.challengedId),
        role: roleLabel(entry.claimedRole),
      });
    case 'challenge_success_actor':
      if (entry.loserId) {
        return applyTemplate(t.log.challenge_success_actor_loser, {
          actor: name(entry.actorId),
          loser: name(entry.loserId),
        });
      }
      return applyTemplate(t.log.challenge_success_actor, { actor: name(entry.actorId) });
    case 'challenge_success_block':
      return entry.message === 'assassinate'
        ? applyTemplate(t.log.challenge_success_block_assassinate, { blocker: name(entry.blockerId) })
        : applyTemplate(t.log.challenge_success_block_action, { blocker: name(entry.blockerId) });
    case 'assassinate_victim':
      return applyTemplate(t.log.assassinate_victim, { target: name(entry.targetId) });
    default:
      return t.log.unknown_event;
  }
}
