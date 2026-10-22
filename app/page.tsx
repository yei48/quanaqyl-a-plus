import { getUser } from '@/lib/auth';
import LearningApp from '@/components/learning-app';
export const dynamic='force-dynamic';
export default async function Home() {
  const user=await getUser();
  return <LearningApp user={user?{name:user.displayName,email:user.email}:null}
    signOutUrl="/auth/signout" />;
}
