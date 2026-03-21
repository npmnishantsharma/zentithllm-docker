import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Terminal, Github } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Animated background detail */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
        <div className="absolute h-full w-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-[400px] animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Terminal size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-headline">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Ready to sync with the team?</p>
        </div>

        <Card className="border-border bg-slate-900/50 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Login</CardTitle>
            <CardDescription className="text-xs font-code uppercase tracking-wider opacity-60">
              auth_v2.0_secure
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email or Username</Label>
              <Input 
                id="email" 
                placeholder="developer@example.com" 
                type="text" 
                className="bg-slate-950/50 border-border focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link 
                  href="#" 
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <Input 
                id="password" 
                type="password" 
                className="bg-slate-950/50 border-border focus:ring-primary/50"
              />
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 mt-2" asChild>
              <Link href="/chat">Connect to Server</Link>
            </Button>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0f172a] px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <Button variant="outline" className="w-full border-border bg-transparent hover:bg-slate-800 text-foreground">
              <Github className="mr-2 h-4 w-4" />
              GitHub Account
            </Button>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="#" className="text-primary hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </Card>

        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
          <span className="text-[10px] font-code uppercase tracking-tighter text-muted-foreground">
            status: local_node_active | secure_tunnel_ready
          </span>
        </div>
      </div>
    </div>
  );
}