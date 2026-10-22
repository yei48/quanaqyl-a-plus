import type { Database } from '../db/adapter';
export async function changePause(db: Database, userId: string, action: 'pause' | 'resume', now = Date.now()) {
  return db.transaction(async tx => {
    await tx.lock('pause', userId);
    if (action === 'resume') {
      await tx.prepare('UPDATE quanaqyl.pauses SET "end"=$1 WHERE user_id=$2 AND "end" IS NULL').bind(now, userId).run();
      return true;
    }
    const date = new Date(now), month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    const result = await tx.prepare('INSERT INTO quanaqyl.pauses (user_id,id,start) SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM quanaqyl.pauses WHERE user_id=$4 AND "end" IS NULL) AND (SELECT COUNT(*) FROM quanaqyl.pauses WHERE user_id=$5 AND start>=$6)<5')
      .bind(userId, crypto.randomUUID(), now, userId, userId, month).run();
    return result.meta.changes > 0;
  });
}
