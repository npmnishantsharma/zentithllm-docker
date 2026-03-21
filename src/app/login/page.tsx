import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, Github, Cpu } from 'lucide-react';

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
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-bold">Sign In</CardTitle>
            <CardDescription className="text-[10px] font-code uppercase tracking-widest opacity-40">
              node_access_v2.0
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-code uppercase opacity-60">Credentials</Label>
              <Input 
                id="email" 
                placeholder="identity@devcom.io" 
                type="text" 
                className="bg-[#1e1f22] border-border focus:ring-primary/40 rounded-sm font-code text-sm"
              />
            </div>
            <div className="space-y-2">
              <Input 
                id="password" 
                placeholder="••••••••"
                type="password" 
                className="bg-[#1e1f22] border-border focus:ring-primary/40 rounded-sm font-code text-sm"
              />
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90 text-white rounded-sm mt-2 transition-all font-bold" asChild>
              <Link href="/chat">Establish Connection</Link>
            </Button>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border"></span>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-code">
                <span className="bg-[#2b2d30] px-2 text-muted-foreground/60">External Identity</span>
              </div>
            </div>

            <Button variant="outline" className="w-full border-border bg-transparent hover:bg-[#1e1f22] text-foreground rounded-sm font-code text-xs transition-colors">
              <Github className="mr-2 h-4 w-4" />
              GitHub Auth
            </Button>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-2">
            <p className="text-center text-[11px] text-muted-foreground font-code">
              New to the cluster?{' '}
              <Link href="#" className="text-primary hover:underline">
                Create Account
              </Link>
            </p>
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