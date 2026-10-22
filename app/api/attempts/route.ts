import { identity, database, protect, payload, json, failure, ApiError } from '@/lib/server';
import { gradeAttempt, InvalidAttempt } from '@/lib/grading';
export async function POST(req: Request) {
    try {
        protect(req);
        const user = await identity();
        let result;
        try {
            result = gradeAttempt(await payload(req));
        }
        catch (error) {
            if (error instanceof InvalidAttempt)
                throw new ApiError('invalid_input');
            throw error;
        }
        const db = database();
        const existing = await db.prepare('SELECT data FROM quanaqyl.attempts WHERE user_id=$1 AND id=$2')
            .bind(user.userId, result.id).first<{
            data: string;
        }>();
        if (existing)
            return json(JSON.parse(existing.data));
        if (result.mode === 'practice') {
            const paused = await db.prepare('SELECT 1 FROM quanaqyl.pauses WHERE user_id=$1 AND "end" IS NULL LIMIT 1').bind(user.userId).first();
            if (paused)
                throw new ApiError('paused', 409);
        }
        const encoded = JSON.stringify(result);
        const statements = [db.prepare('INSERT INTO quanaqyl.attempts (user_id,id,data,created_at) VALUES ($1,$2,$3,$4) ON CONFLICT(user_id,id) DO NOTHING')
                .bind(user.userId, result.id, encoded, result.date)];
        if (result.mode === 'practice' && result.correct === result.total) {
            const first = result.answers[0];
            const key = first.kind === 'challenge' ? first.problemId : `topic-${first.topic}`;
            // Only the exact saved attempt can award points, including concurrent retries.
            statements.push(db.prepare(`INSERT INTO quanaqyl.awards (user_id,key,amount,created_at)
        SELECT $1,$2,$3,$4 WHERE EXISTS (SELECT 1 FROM quanaqyl.attempts WHERE user_id=$5 AND id=$6 AND data=$7)
        ON CONFLICT(user_id,key) DO NOTHING`)
                .bind(user.userId, key, first.kind === 'challenge' ? 150 : 100, result.date, user.userId, result.id, encoded));
        }
        await db.batch(statements);
        const saved = await db.prepare('SELECT data FROM quanaqyl.attempts WHERE user_id=$1 AND id=$2')
            .bind(user.userId, result.id).first<{
            data: string;
        }>();
        if (!saved)
            throw new Error('Attempt write did not persist');
        return json(JSON.parse(saved.data));
    }
    catch (error) {
        return failure(error);
    }
}
