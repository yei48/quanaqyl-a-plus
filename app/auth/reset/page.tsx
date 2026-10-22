import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import ResetPassword from '@/components/reset-password';
export const dynamic = 'force-dynamic';
export default async function ResetPage() {
  if (!await getUser()) redirect('/?auth_error=1');
  return <ResetPassword />;
}
