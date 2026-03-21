import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Terminal } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Terminal size={28} />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl font-headline">
          DevCom <span className="text-primary">Chat</span>
        </h1>
      </div>
      <p className="mb-10 max-w-md text-lg text-muted-foreground">
        The communication hub for modern developer teams. Connect, collaborate, and share code in a beautiful environment.
      </p>
      <div className="flex gap-4">
        <Button asChild size="lg" className="px-8 font-medium">
          <Link href="/login">Get Started</Link>
        </Button>
      </div>
      <div className="mt-20 flex gap-8 grayscale opacity-50">
        <div className="text-sm font-code">v1.2.4-stable</div>
        <div className="text-sm font-code">US-EAST-1</div>
        <div className="text-sm font-code">2ms latency</div>
      </div>
    </div>
  );
}