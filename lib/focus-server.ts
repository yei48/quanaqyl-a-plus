import type { Database } from '../db/adapter';
import { defaultFocusTimer, transitionFocus, validateFocusCommand, FocusError, type FocusTimer, type FocusSnapshot, type FocusSession } from './focus';

type TimerRow = { data: string; revision: number; request_id: string };
async function timerRow(db: Database, userId: string) {
  await db.prepare('INSERT INTO quanaqyl.focus_timers (user_id,data,revision,request_id) VALUES ($1,$2,0,$3) ON CONFLICT(user_id) DO NOTHING')
    .bind(userId, JSON.stringify(defaultFocusTimer()), '').run();
  return (await db.prepare('SELECT data,revision,request_id FROM quanaqyl.focus_timers WHERE user_id=$1').bind(userId).first<TimerRow>())!;
}
export async function getFocusState(db: Database, userId: string, now = Date.now()): Promise<FocusSnapshot> {
  await timerRow(db, userId);
  return db.transaction(async db => {
  // Eight UTC days cover all seven local calendar days, including timezone edges.
  const [timerResult, result] = await db.batch([
    db.prepare('SELECT data,revision,request_id FROM quanaqyl.focus_timers WHERE user_id=$1').bind(userId),
    db.prepare('SELECT id,started_at AS "startedAt",ended_at AS "endedAt",planned_ms AS "plannedMs",focus_ms AS "focusMs",completed FROM quanaqyl.focus_sessions WHERE user_id=$1 AND ended_at>=$2 ORDER BY ended_at DESC')
      .bind(userId, now - 8 * 86_400_000),
  ]);
  const row = timerResult.results[0] as TimerRow;
  const sessions = result.results as (Omit<FocusSession, 'completed'> & { completed: number })[];
  return { timer: { ...JSON.parse(row.data), revision: row.revision }, sessions: sessions.map(s => ({ ...s, completed: Boolean(s.completed) })), serverNow: now };
  }, 'repeatable read');
}
export async function commandFocus(db: Database, userId: string, input: unknown, now = Date.now()) {
  const command = validateFocusCommand(input), row = await timerRow(db, userId);
  // Network retries never run the same command twice.
  if (row.request_id === command.requestId) return getFocusState(db, userId, now);
  if (row.revision !== command.revision) throw new FocusError('focusConflict', 409);
  const original: FocusTimer = { ...JSON.parse(row.data), revision: row.revision };
  const { timer, session, changed } = transitionFocus(original, command, now, crypto.randomUUID());
  if (!changed) return getFocusState(db, userId, now);
  const statements = [db.prepare('UPDATE quanaqyl.focus_timers SET data=$1,revision=$2,request_id=$3 WHERE user_id=$4 AND revision=$5')
    .bind(JSON.stringify(timer), timer.revision, command.requestId, userId, row.revision)];
  if (session) statements.push(db.prepare(`INSERT INTO quanaqyl.focus_sessions (user_id,id,started_at,ended_at,planned_ms,focus_ms,completed)
    SELECT $1,$2,$3,$4,$5,$6,$7 WHERE EXISTS (SELECT 1 FROM quanaqyl.focus_timers WHERE user_id=$8 AND revision=$9 AND request_id=$10)
    ON CONFLICT(user_id,id) DO NOTHING`).bind(userId, session.id, session.startedAt, session.endedAt, session.plannedMs, session.focusMs, Number(session.completed), userId, timer.revision, command.requestId));
  // Save atomically: save the timer and its history together.
  const results = await db.batch(statements);
  if (!results[0].meta.changes) throw new FocusError('focusConflict', 409);
  return getFocusState(db, userId, now);
}
