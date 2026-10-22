import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { authDestination } from '@/lib/auth-path';
export async function GET(req: Request) {
  const url = new URL(req.url), code = url.searchParams.get('code');
  if (code) {
    const supabase = await serverClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(authDestination(url.searchParams.get('next')), url.origin), { headers: { 'Cache-Control': 'private, no-store' } });
  }
  return NextResponse.redirect(new URL('/?auth_error=1', url.origin), { headers: { 'Cache-Control': 'private, no-store' } });
}
