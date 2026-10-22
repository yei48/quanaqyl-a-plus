import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { protect, failure } from '@/lib/server';
export async function POST(req: Request) {
  try {
    protect(req);
    const supabase = await serverClient();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    return NextResponse.redirect(new URL('/', req.url), { status: 303, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}
