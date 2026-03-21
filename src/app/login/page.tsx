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
    setAuthStatus('Initiating secure session...');
    
    try {
      const result = await authenticateWithNexusLLM();
      
      if (result.success) {
        setIsSuccess(true);
        setAuthStatus('Session created. Opening authorization window...');
        
        const sessionId = result.data.session_id || result.data.sessionId;
        const authorizeUrl = result.data.authorize_url || result.data.authorizeUrl;
        
        if (!sessionId) {
          throw new Error('No session ID returned from authentication server.');
        }

        if (authorizeUrl) {
          const width = 600;
          const height = 700;
          const left = window.screenX + (window.outerWidth - width) / 2;
          const top = window.screenY + (window.outerHeight - height) / 2;
          
          window.open(
            authorizeUrl, 
            'NexusLLMAuthorize', 
            `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
          );
        }

        const url = `/api/auth/proxy-stream?sessionId=${sessionId}`;
        const source = new EventSource(url);

        source.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.status === 'authorized' && data.code) {
              setAuthStatus('Identity authorized! Finalizing handshake...');
              
              const userInfoResult = await getUserInfoWithCode(data.code);
              
              if (userInfoResult.success) {
                setAuthStatus(`Verified: ${userInfoResult.data.user?.displayName || 'Developer'}`);
                
                localStorage.setItem('nexus_session_active', 'true');
                localStorage.setItem('nexus_user_data', JSON.stringify(userInfoResult.data.user));

                toast({
                  title: "Handshake Successful",
                  description: "Synchronized with NexusLLM. Redirecting to workspace.",
                });

                source.close();
                
                setTimeout(() => {
                  router.push('/chat');
                }, 1500);
              } else {
                throw new Error(userInfoResult.error || 'Profile synchronization failed.');
              }
            } else if (data.status === 'expired') {
              source.close();
              setIsLoading(false);
              setIsSuccess(false);
              setAuthStatus(null);
              toast({
                variant: "destructive",
                title: "Session Expired",
                description: "The authentication session has timed out. Please try again.",
              });
            } else {
              setAuthStatus(`Uplink Status: ${data.status || 'Waiting for user...'}`);
            }
          } catch (e: any) {
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

        source.onerror = () => {
          source.close();
          toast({
            variant: "destructive",
            title: "Stream Interrupted",
            description: "Connection to auth server lost.",
          });
        };

      } else {
        toast({
          variant: "destructive",
          title: "Session Initialization Failed",
          description: result.error || "Could not reach NexusLLM server.",
        });
        setIsLoading(false);
        setAuthStatus(null);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Unexpected Auth Error",
        description: error.message || "An error occurred during authentication.",
      });
      setIsLoading(false);
      setAuthStatus(null);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 sm:p-6 font-body dark text-foreground">
      <div className="w-full max-w-[400px] animate-fade-in flex flex-col items-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-primary shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <LayoutDashboard size={28} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-primary font-headline">DevCom Workspace</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">Initialize your developer cluster node</p>
        </div>

        <Card className="w-full border-none bg-muted/30 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-sm">
          <CardHeader className="text-center pb-2 pt-8 px-4 sm:px-6">
            <CardTitle className="text-lg sm:text-xl font-bold">NexusLLM Protocol</CardTitle>
          </CardHeader>
          <CardContent className="py-6 sm:py-8 px-4 sm:px-6">
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
                {isSuccess ? "Awaiting Handshake..." : "Sign in with NexusLLM"}
              </Button>
              
              {authStatus && (
                <div className="flex flex-col items-center gap-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-code text-muted-foreground bg-background/40 px-3 py-1.5 rounded-full border border-border/20 text-center">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    <span className="truncate max-w-[200px]">{authStatus}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center justify-center gap-2 px-4 text-center">
          <div className="h-1 w-1 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] shrink-0"></div>
          <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground/50 font-bold font-code">
            Secure Handshake Active
          </span>
        </div>
      </div>
    </div>
  );
}