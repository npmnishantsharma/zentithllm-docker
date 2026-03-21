"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is "logged in" (mocking session with localStorage)
    const isAuthed = localStorage.getItem('nexus_session_active');
    
    if (isAuthed) {
      router.replace('/chat');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground font-code text-xs uppercase tracking-widest">
      Initializing Workspace...
    </div>
  );
}
