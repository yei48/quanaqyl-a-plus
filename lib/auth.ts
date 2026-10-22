import 'server-only';
import { serverClient } from './supabase/server';
import { authConfigured } from './supabase/config';
export async function getUser() {
  if (!authConfigured()) return null;
  const supabase = await serverClient();
  // Server-verified identity, never client headers or unverified session data.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email) return null;
  const name = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name.slice(0, 100) : '';
  return { userId: user.id, email: user.email, displayName: name || user.email.split('@')[0] };
}
