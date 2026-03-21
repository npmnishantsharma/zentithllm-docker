import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Cpu, Sparkles } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1e1f22] p-4 font-body">
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none">
        <div className="absolute h-full w-full bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-[400px] animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-sm bg-[#2b2d30] border border-border text-primary shadow-xl">
            <Cpu size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">DevCom <span className="text-primary">IDE</span></h1>
          <p className="text-xs text-muted-foreground mt-2 font-code">Authentication Required</p>
        </div>

        <Card className="border-border bg-[#2b2d30] shadow-2xl rounded-sm overflow-hidden">
          <div className="h-1 bg-primary w-full" />
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-lg font-bold">Secure Gateway</CardTitle>
            <CardDescription className="text-[10px] font-code uppercase tracking-widest opacity-40">
              node_access_v2.0
            </CardDescription>
          </CardHeader>
          <CardContent className="py-6">
            <div className="space-y-4">
              <p className="text-[11px] text-center text-muted-foreground font-code leading-relaxed">
                Connect your neural identity via NexusLLM to access the dev cluster and encrypted communication channels.
              </p>
              
              <Button 
                className="w-full bg-primary hover:bg-primary/90 text-white rounded-sm h-12 transition-all font-bold group shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
                asChild
              >
                <Link href="/chat">
                  <Sparkles className="mr-2 h-4 w-4 group-hover:animate-pulse" />
                  Sign in with NexusLLM
                </Link>
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2 pt-0 pb-6">
            <div className="flex items-center justify-center gap-2 font-code">
              <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[8px] uppercase tracking-tighter text-muted-foreground/40 font-bold">
                Identity Provider: ACTIVE
              </span>
            </div>
          </CardFooter>
        </Card>

        <div className="mt-8 flex items-center justify-center gap-2 font-code">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">
            System Status: 100% Operational
          </span>
        </div>
      </div>
    </div>
  );
}
