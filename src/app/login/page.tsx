"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, LayoutDashboard, Loader2, CheckCircle2 } from 'lucide-react';
import { authenticateWithNexusLLM } from './actions';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await authenticateWithNexusLLM();
      
      if (result.success) {
        setIsSuccess(true);
        toast({
          title: "Success",
          description: "Authenticated with NexusLLM successfully.",
        });
      } else {
        console.error('Login failed:', result.error);
        toast({
          variant: "destructive",
          title: "Authentication Alert",
          description: result.error || "Could not reach NexusLLM server.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred during login.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 font-body dark text-foreground">
      <div className="w-full max-w-[400px] animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-primary">
            <LayoutDashboard size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">NexusLLM</h1>
          <p className="text-sm text-muted-foreground mt-2">Sign in to start your session</p>
        </div>

        <Card className="border-none bg-muted/30 shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="text-center pb-2 pt-8">
            <CardTitle className="text-xl font-bold">Welcome back</CardTitle>
          </CardHeader>
          <CardContent className="py-8">
            <div className="space-y-4">
              <Button 
                onClick={handleLogin}
                disabled={isLoading || isSuccess}
                className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-2xl h-12 transition-all font-bold group shadow-xl" 
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : isSuccess ? (
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4 group-hover:animate-pulse" />
                )}
                {isSuccess ? "Authenticated" : "Sign in with NexusLLM"}
              </Button>
              
              {isSuccess && (
                <p className="text-center text-xs text-muted-foreground animate-fade-in">
                  Authentication session active.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="h-1 w-1 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-bold">
            System Operational
          </span>
        </div>
      </div>
    </div>
  );
}
