"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldCheck, Fingerprint } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { graphqlRequest } from '@/lib/graphql-client';

export default function VerifyPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState('');
  const [isPasskeyReady, setIsPasskeyReady] = useState(false);

  useEffect(() => {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Invalid Verification Session",
        description: "No verification token found. Returning to login.",
      });
      router.replace('/login');
    }
  }, [token, router, toast]);

  useEffect(() => {
    const checkPasskeySupport = async () => {
      if (window.PublicKeyCredential) {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setIsPasskeyReady(available);
      }
    };
    checkPasskeySupport();
  }, []);

  const handleVerify = async () => {
    if (!code || code.length < 6) {
      toast({
        variant: "destructive",
        title: "Invalid Code",
        description: "Please enter a valid MFA code.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const data = await graphqlRequest<{
        verifyMfaLogin: { success: boolean; error?: string };
      }>(
        `
          mutation VerifyMfaLogin($token: String!, $code: String!) {
            verifyMfaLogin(token: $token, code: $code) {
              success
              error
            }
          }
        `,
        { token, code }
      );

      if (data.verifyMfaLogin?.success) {
        toast({
          title: "Verification Successful",
          description: "MFA verified. Redirecting to workspace.",
        });
        setTimeout(() => {
          router.push('/chat');
        }, 1500);
      } else {
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: data.verifyMfaLogin?.error || "The code is invalid or has expired.",
        });
        setIsLoading(false);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An unexpected error occurred.",
      });
      setIsLoading(false);
    }
  };

  const handlePasskeyVerify = async () => {
    setIsLoading(true);
    try {
      // Create a specific passkey verification flow for this temp token
      // or modify the existing flow to accommodate a token
      // First get the options from token context
      const optionsData = await graphqlRequest<{
        passkeyAuthenticateOptions: { success: boolean; challengeId?: string; optionsJSON?: string | null; error?: string };
      }>(
        `
          mutation PasskeyAuthenticateOptions($token: String) {
            passkeyAuthenticateOptions(token: $token) {
              success
              challengeId
              optionsJSON
              error
            }
          }
        `,
        { token }
      );

      const optionResult = optionsData.passkeyAuthenticateOptions;
      if (!optionResult?.success || !optionResult.optionsJSON || !optionResult.challengeId) {
        throw new Error(optionResult?.error || 'Failed to get passkey options');
      }

      const challengeId = optionResult.challengeId;
      const options = JSON.parse(optionResult.optionsJSON);
      
      const base64urlToUint8Array = (base64url: string) => {
        const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        const paddedBase64 = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
        const binaryString = atob(paddedBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      };

      const assertion = await navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: base64urlToUint8Array(options.challenge),
          allowCredentials: options.allowCredentials?.map((cred: any) => ({
            ...cred,
            id: base64urlToUint8Array(cred.id),
          })) || [],
        },
      });

      if (!assertion || assertion.type !== 'public-key') {
        throw new Error('No passkey credential received');
      }

      const publicKeyAssertion = assertion as any;
      const uint8ArrayToBase64url = (uint8Array: Uint8Array) => {
        const binaryString = String.fromCharCode.apply(null, Array.from(uint8Array));
        const base64 = btoa(binaryString);
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      };

      const credentialPayload = {
        id: publicKeyAssertion.id,
        rawId: uint8ArrayToBase64url(new Uint8Array(publicKeyAssertion.rawId)),
        response: {
          clientDataJSON: uint8ArrayToBase64url(new Uint8Array(publicKeyAssertion.response.clientDataJSON)),
          authenticatorData: uint8ArrayToBase64url(new Uint8Array(publicKeyAssertion.response.authenticatorData)),
          signature: uint8ArrayToBase64url(new Uint8Array(publicKeyAssertion.response.signature)),
          userHandle: publicKeyAssertion.response.userHandle
            ? uint8ArrayToBase64url(new Uint8Array(publicKeyAssertion.response.userHandle))
            : null,
        },
        type: publicKeyAssertion.type,
      };

      const verifyData = await graphqlRequest<{
        passkeyAuthenticateVerify: { success: boolean; error?: string };
      }>(
        `
          mutation PasskeyAuthenticateVerify($credentialJSON: String!, $challengeId: String!, $token: String) {
            passkeyAuthenticateVerify(credentialJSON: $credentialJSON, challengeId: $challengeId, token: $token) {
              success
              error
            }
          }
        `,
        {
          credentialJSON: JSON.stringify(credentialPayload),
          challengeId,
          token,
        }
      );

      if (verifyData.passkeyAuthenticateVerify.success) {
        toast({
          title: "Verification Successful",
          description: "Passkey verified. Redirecting...",
        });
        setTimeout(() => {
          router.push('/chat');
        }, 1500);
      } else {
        throw new Error(verifyData.passkeyAuthenticateVerify.error || 'Authentication verification failed');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Passkey Verification Failed",
        description: error.message,
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 sm:p-6 font-body dark text-foreground">
      <div className="w-full max-w-[400px] animate-fade-in flex flex-col items-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-primary shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-primary font-headline">Security Check</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">Finish sign in to continue</p>
        </div>

        <Card className="w-full border-none bg-muted/30 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-sm">
          <CardContent className="py-6 sm:py-8 px-4 sm:px-6">
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm font-medium text-center">Authenticator Code</p>
                <Input
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase())}
                  className="text-center text-2xl tracking-widest h-14 bg-background/50 border-border/20 rounded-2xl font-mono"
                  maxLength={8}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleVerify();
                  }}
                />
                <Button 
                  onClick={handleVerify}
                  disabled={isLoading || code.length < 6}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl h-12 transition-all font-bold" 
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify Code"}
                </Button>
              </div>

              {isPasskeyReady && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-muted" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background/20 px-2 text-muted-foreground backdrop-blur-xl">Or</span>
                    </div>
                  </div>

                  <Button 
                    onClick={handlePasskeyVerify}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full rounded-2xl h-12 transition-all font-bold border-muted hover:bg-muted/50" 
                  >
                    <Fingerprint className="mr-2 h-4 w-4" />
                    Use Passkey
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
