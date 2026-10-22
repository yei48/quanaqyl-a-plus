import { identity, database, protect, payload, json, failure, ApiError } from '@/lib/server';
import { changePause } from '@/lib/pause-server';
export async function POST(req: Request) {
  try {
    protect(req);
    const user = await identity(), input = await payload(req);
    if (input.action !== 'pause' && input.action !== 'resume') throw new ApiError('invalid_input');
    if (!await changePause(database(), user.userId, input.action)) throw new ApiError('pause_limit');
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
