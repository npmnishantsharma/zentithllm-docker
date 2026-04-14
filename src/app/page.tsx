import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const cookieStore = await cookies();
  const hasSessionCookie = Boolean(cookieStore.get('sessionId')?.value);

  redirect(hasSessionCookie ? '/chat' : '/login');
}
