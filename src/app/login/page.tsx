
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, LayoutDashboard, Loader2, CheckCircle2 } from 'lucide-react';
import { authenticateWithNexusLLM, getUserInfoWithCode } from './actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [authStatus, setAuthStatus] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoading(true);
    setAuthStatus('Initiating session...');
    
    try {
      const result = await authenticateWithNexusLLM();
      
      if (result.success) {
        setIsSuccess(true);
        setAuthStatus('Session created. Waiting for authorization...');
        
        const sessionId = result.data.session_id || result.data.sessionId;
        
        if (!sessionId) {
          throw new Error('No session ID returned from authentication server.');
        }

        const url = `/api/auth/proxy-stream?sessionId=${sessionId}`;
        const source = new EventSource(url);

        source.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Stream Update:', data);

            if (data.status === 'authorized' && data.code) {
              setAuthStatus('Authorized! Finalizing handshake...');
              
              // Step 3: Exchange code for user info
              const userInfoResult = await getUserInfoWithCode(data.code);
              
              if (userInfoResult.success) {
                setAuthStatus(`Identity verified: ${userInfoResult.data.name || 'Developer'}`);
                
                toast({
                  title: "Handshake Complete",
                  description: "Synchronized with NexusLLM. Redirecting to workspace.",
                });

                source.close();
                
                setTimeout(() => {
                  router.push('/chat');
                }, 1200);
              } else {
                throw new Error(userInfoResult.error || 'Profile synchronization failed.');
              }
            } else {
              setAuthStatus(`Status: ${data.status || 'Waiting...'}`);
            }
          } catch (e: any) {
            console.error('Error during handshake:', e);
            source.close();
            setIsLoading(false);
            setIsSuccess(false);
            setAuthStatus(null);
            toast({
              variant: "destructive",
              title: "Handshake Error",
              description: e.message || "Failed to finalize authentication.",
            });
          }
        };

        source.onerror = (err) => {
          console.error('EventSource failed:', err);
          source.close();
          setIsLoading(false);
          setIsSuccess(false);
          setAuthStatus(null);
          toast({
            variant: "destructive",
            title: "Uplink Error",
            description: "The authentication stream was interrupted.",
          });
        };

      } else {
        toast({
          variant: "destructive",
          title: "Session Failed",
          description: result.error || "Could not reach NexusLLM server.",
        });
        setIsLoading(false);
        setAuthStatus(null);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Unexpected Error",
        description: error.message || "An error occurred during authentication.",
      });
      setIsLoading(false);
      setAuthStatus(null);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 font-body dark text-foreground">
      <div className="w-full max-w-[400px] animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-primary shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <LayoutDashboard size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">DevCom Workspace</h1>
          <p className="text-sm text-muted-foreground mt-2">Initialize your developer cluster node</p>
        </div>

        <Card className="border-none bg-muted/30 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-sm">
          <CardHeader className="text-center pb-2 pt-8">
            <CardTitle className="text-xl font-bold">NexusLLM Protocol</CardTitle>
          </CardHeader>
          <CardContent className="py-8">
            <div className="space-y-6">
              <Button 
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl h-12 transition-all font-bold group shadow-[0_0_20px_rgba(var(--primary),0.3)]" 
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : isSuccess ? (
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-400" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4 group-hover:animate-pulse" />
                )}
                {isSuccess ? "Handshaking..." : "Sign in with NexusLLM"}
              </Button>
              
              {authStatus && (
                <div className="flex flex-col items-center gap-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs font-code text-muted-foreground bg-background/40 px-3 py-1.5 rounded-full border border-border/20">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    {authStatus}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="h-1 w-1 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-bold font-code">
            Secure Uplink Active
          </span>
        </div>
      </div>
    </div>
  );
}
