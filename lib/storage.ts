import 'server-only';
import { serverClient } from './supabase/server';
export async function photoBucket() {
  const supabase = await serverClient();
  return supabase.storage.from('profile-photos');
}
