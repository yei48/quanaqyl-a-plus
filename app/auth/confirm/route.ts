import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
// Optional token-hash email template: also works when opened on another device.
export async function GET(req: Request) {
  const url = new URL(req.url), token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  if (token_hash && (type === 'signup' || type === 'recovery' || type === 'email')) {
    const supabase = await serverClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL(type === 'recovery' ? '/auth/reset' : '/', url.origin), { headers: { 'Cache-Control': 'private, no-store' } });
  }
  return NextResponse.redirect(new URL('/?auth_error=1', url.origin), { headers: { 'Cache-Control': 'private, no-store' } });
}
