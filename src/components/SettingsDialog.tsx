"use client";

import * as React from "react";
import QRCode from "react-qr-code";
import { startRegistration } from "@simplewebauthn/browser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Settings,
  Bell,
  Paintbrush,
  Grid,
  Database,
  Shield,
  Users,
  UserCircle,
  Play,
  ChevronRight,
  Mail,
  AtSign,
  Fingerprint,
  ShieldCheck,
  Copy,
  Check,
  AlertCircle,
  Download,
  Trash2,
  Key,
  Loader,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

const NAV_ITEMS = [
  { id: "general", label: "General", icon: Settings },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "personalization", label: "Personalization", icon: Paintbrush },
  { id: "apps", label: "Apps", icon: Grid },
  { id: "data", label: "Data controls", icon: Database },
  { id: "security", label: "Security", icon: Shield },
  { id: "parental", label: "Parental controls", icon: Users },
  { id: "account", label: "Account", icon: UserCircle },
];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = React.useState("general");
  const [userData, setUserData] = React.useState<any>(null);
  const [mfaEnabled, setMfaEnabled] = React.useState(false);
  const [smsEnabled, setSmsEnabled] = React.useState(false);
  const [mfaSetupModal, setMfaSetupModal] = React.useState(false);
  const [mfaStep, setMfaStep] = React.useState<'setup' | 'verify' | 'done'>('setup');
  const [secret, setSecret] = React.useState('');
  const [qrCode, setQrCode] = React.useState('');
  const [verifyCode, setVerifyCode] = React.useState('');
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Passkey states
  const [passkeys, setPasskeys] = React.useState<any[]>([]);
  const [passkeyModal, setPasskeyModal] = React.useState(false);
  const [passkeyName, setPasskeyName] = React.useState('');
  const [passkeyLoading, setPasskeyLoading] = React.useState(false);
  
  const { toast } = useToast();
  const router = useRouter();

  React.useEffect(() => {
    if (open) {
      const savedUser = localStorage.getItem('nexus_user_data');
      if (savedUser) {
        try {
          setUserData(JSON.parse(savedUser));
        } catch (e) {
          console.error("Failed to parse user data", e);
        }
      }

      // Load MFA status from API
      loadMfaStatus();
    }
  }, [open]);

  const loadMfaStatus = async () => {
    try {
      const response = await fetch('/api/mfa/status');
      if (response.ok) {
        const data = await response.json();
        setMfaEnabled(data.mfaEnabled);
      }
    } catch (error) {
      console.error('Failed to load MFA status:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nexus_session_active');
    localStorage.removeItem('nexus_user_data');
    router.push('/login');
    onOpenChange(false);
  };

  const startMfaSetup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/mfa/setup', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setSecret(data.secret);
        setQrCode(data.otpauthUrl);
        setMfaSetupModal(true);
        setMfaStep('setup');
        setVerifyCode('');
        setBackupCodes([]);
      } else {
        toast({
          title: "Error",
          description: "Failed to start MFA setup",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('MFA setup error:', error);
      toast({
        title: "Error",
        description: "Failed to start MFA setup",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyMfaCode = async () => {
    if (verifyCode.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter a 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      });

      if (response.ok) {
        const data = await response.json();
        setBackupCodes(data.backupCodes);
        setMfaStep('done');
        setMfaEnabled(true);
        toast({
          title: "MFA Enabled",
          description: "Your account is now protected with multi-factor authentication",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Verification failed",
          description: error.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('MFA verify error:', error);
      toast({
        title: "Error",
        description: "Failed to verify code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const disableMfa = async () => {
    if (!confirm('Are you sure you want to disable MFA? Your account will be less secure.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/mfa/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      });

      if (response.ok) {
        setMfaEnabled(false);
        toast({
          title: "MFA Disabled",
          description: "Multi-factor authentication has been disabled",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to disable MFA",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('MFA disable error:', error);
      toast({
        title: "Error",
        description: "Failed to disable MFA",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    if (backupCodes.length === 0) return;

    const content = `Zentith LLM - Backup Codes
Generated: ${new Date().toLocaleString()}

IMPORTANT: Keep these codes in a safe place. Use them to access your account if you lose your authenticator device.

${backupCodes.map((code, idx) => `${idx + 1}. ${code}`).join('\n')}

Once a code is used, it cannot be reused.`;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', `zentith-backup-codes-${new Date().toISOString().split('T')[0]}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    toast({
      title: "Downloaded",
      description: "Backup codes saved to your device",
    });
  };

  const handleSmsToggle = (checked: boolean) => {
    setSmsEnabled(checked);
    toast({
      title: checked ? "SMS Authentication Enabled" : "SMS Authentication Disabled",
      description: checked 
        ? "You will now receive verification codes via text message." 
        : "Text message verification has been disabled.",
    });
  };

  const startPasskeyRegistration = async () => {
    if (!passkeyName.trim()) {
      toast({
        title: "Device name required",
        description: "Please enter a name for this passkey",
        variant: "destructive",
      });
      return;
    }

    setPasskeyLoading(true);
    try {
      // Get registration options from server
      const optionsResponse = await fetch('/api/passkey/register-options', {
        method: 'POST',
      });

      if (!optionsResponse.ok) {
        throw new Error('Failed to get registration options');
      }

      const { options } = await optionsResponse.json();

      // Start registration with browser API
      const credential = await startRegistration(options);

      // Verify credential on server
      const verifyResponse = await fetch('/api/passkey/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential,
          deviceName: passkeyName,
        }),
      });

      if (verifyResponse.ok) {
        const data = await verifyResponse.json();
        setPasskeys([...passkeys, data.passkey]);
        setPasskeyModal(false);
        setPasskeyName('');
        toast({
          title: "Passkey registered",
          description: `${passkeyName} has been added to your account`,
        });
      } else {
        const error = await verifyResponse.json();
        throw new Error(error.error || 'Verification failed');
      }
    } catch (error: any) {
      console.error('Passkey registration error:', error);
      toast({
        title: "Registration failed",
        description: error.message || "Failed to register passkey",
        variant: "destructive",
      });
    } finally {
      setPasskeyLoading(false);
    }
  };

  const loadPasskeys = async () => {
    try {
      const response = await fetch('/api/passkey/list');
      if (response.ok) {
        const data = await response.json();
        setPasskeys(data.passkeys || []);
      }
    } catch (error) {
      console.error('Failed to load passkeys:', error);
    }
  };

  const deletePasskey = async (passkeyId: string, passkeyName: string) => {
    if (!confirm(`Delete passkey "${passkeyName}"?`)) {
      return;
    }

    try {
      const response = await fetch('/api/passkey/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: passkeyId }),
      });

      if (response.ok) {
        setPasskeys(passkeys.filter((p) => p.id !== passkeyId));
        toast({
          title: "Passkey deleted",
          description: `${passkeyName} has been removed from your account`,
        });
      } else {
        throw new Error('Failed to delete passkey');
      }
    } catch (error) {
      console.error('Passkey deletion error:', error);
      toast({
        title: "Error",
        description: "Failed to delete passkey",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] h-[85vh] sm:h-[600px] p-0 bg-[#171717] border-white/5 overflow-hidden flex flex-col sm:flex-row gap-0 rounded-2xl sm:rounded-3xl">
        {/* Sidebar / Top Nav on Mobile */}
        <aside className="w-full sm:w-64 border-b sm:border-b-0 sm:border-r border-white/5 bg-[#171717] p-2 sm:p-4 flex flex-row sm:flex-col gap-1 overflow-x-auto sm:overflow-y-auto shrink-0 custom-scrollbar">
          <DialogHeader className="hidden sm:block px-2 mb-4">
            <DialogTitle className="sr-only">Settings</DialogTitle>
          </DialogHeader>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm transition-colors text-left whitespace-nowrap sm:whitespace-normal",
                activeTab === item.id
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon size={16} className="shrink-0 sm:size-[18px]" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#171717] custom-scrollbar">
          {activeTab === "general" && (
            <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">General</h2>

              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium text-white/90">Appearance</span>
                  <Select defaultValue="system">
                    <SelectTrigger className="w-32 sm:w-40 bg-transparent border-none text-white/60 hover:text-white transition-colors focus:ring-0 px-0 justify-end gap-2 text-right">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2f2f2f] border-white/10 text-white">
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="h-px bg-white/5" />

                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium text-white/90">Accent color</span>
                  <Select defaultValue="default">
                    <SelectTrigger className="w-32 sm:w-40 bg-transparent border-none text-white/60 hover:text-white transition-colors focus:ring-0 px-0 justify-end gap-2 text-right">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-white/40" />
                        <SelectValue placeholder="Select" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-[#2f2f2f] border-white/10 text-white">
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="h-px bg-white/5" />

                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium text-white/90">Language</span>
                  <Select defaultValue="auto">
                    <SelectTrigger className="w-32 sm:w-40 bg-transparent border-none text-white/60 hover:text-white transition-colors focus:ring-0 px-0 justify-end gap-2 text-right">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2f2f2f] border-white/10 text-white">
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="h-px bg-white/5" />

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white/90">Spoken language</span>
                    <Select defaultValue="auto">
                      <SelectTrigger className="w-32 sm:w-40 bg-transparent border-none text-white/60 hover:text-white transition-colors focus:ring-0 px-0 justify-end gap-2 text-right">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2f2f2f] border-white/10 text-white">
                        <SelectItem value="auto">Auto-detect</SelectItem>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="en-UK">English (UK)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[10px] sm:text-xs text-white/30 leading-relaxed">
                    For best results, select the language you mainly speak. If it's not listed, it may still be supported via auto-detection.
                  </p>
                </div>

                <div className="h-px bg-white/5" />

                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium text-white/90">Voice</span>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <Button variant="ghost" size="sm" className="bg-white/5 hover:bg-white/10 text-white gap-2 rounded-full h-8 px-3 sm:px-4">
                      <Play size={12} className="fill-white" />
                      <span className="text-xs sm:text-sm">Play</span>
                    </Button>
                    <Select defaultValue="spruce">
                      <SelectTrigger className="w-20 sm:w-24 bg-transparent border-none text-white/60 hover:text-white transition-colors focus:ring-0 px-0 justify-end gap-2 text-right">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2f2f2f] border-white/10 text-white">
                        <SelectItem value="spruce">Spruce</SelectItem>
                        <SelectItem value="oak">Oak</SelectItem>
                        <SelectItem value="willow">Willow</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                <div className="flex items-center justify-between gap-4 sm:gap-8 py-1">
                  <div className="flex-1 space-y-1">
                    <span className="text-sm font-medium text-white/90">Separate Voice</span>
                    <p className="text-[10px] sm:text-xs text-white/30 leading-relaxed">
                      Keep ChatGPT Voice in a separate full screen, without real time transcripts and visuals.
                    </p>
                  </div>
                  <Switch className="data-[state=checked]:bg-white data-[state=unchecked]:bg-white/10 border-none h-5 w-9 shrink-0" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">Security</h2>

              <div className="space-y-4 sm:space-y-6">
                {/* Password */}
                <div className="flex items-center justify-between py-1 group cursor-pointer">
                  <span className="text-sm font-medium text-white/90">Password</span>
                  <div className="flex items-center gap-1 text-white/30 group-hover:text-white transition-colors">
                    <span className="text-sm">Add</span>
                    <ChevronRight size={16} />
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Passkeys */}
                <div className="space-y-3 py-1 group">
                  <div className="flex items-center justify-between gap-4 sm:gap-8 cursor-pointer" onClick={() => {
                    setPasskeyModal(true);
                    loadPasskeys();
                  }}>
                    <div className="flex-1 space-y-1">
                      <span className="text-sm font-medium text-white/90">Passkeys</span>
                      <p className="text-[10px] sm:text-xs text-white/30 leading-relaxed">
                        Passkeys are secure and protect your account with multi-factor authentication. They don't require any extra steps.
                      </p>
                      {passkeys.length > 0 && (
                        <p className="text-[10px] text-green-400 mt-2 flex items-center gap-1">
                          <ShieldCheck size={12} />
                          {passkeys.length} {passkeys.length === 1 ? 'key' : 'keys'} registered
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-white/30 group-hover:text-white transition-colors shrink-0">
                      <span className="text-sm">Manage</span>
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* MFA Header */}
                <h3 className="text-sm sm:text-md font-semibold text-white/90 pt-2">Multi-factor authentication (MFA)</h3>

                {/* Authenticator App */}
                <div className="flex items-center justify-between gap-4 sm:gap-8 py-1">
                  <div className="flex-1 space-y-1">
                    <span className="text-sm font-medium text-white/90">Authenticator app</span>
                    <p className="text-[10px] sm:text-xs text-white/30 leading-relaxed">
                      Use one-time codes from an authenticator app like Google Authenticator or Microsoft Authenticator for maximum security.
                    </p>
                    {mfaEnabled && (
                      <p className="text-[10px] text-green-400 mt-2 flex items-center gap-1">
                        <ShieldCheck size={12} />
                        Enabled
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {mfaEnabled ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs"
                        onClick={disableMfa}
                        disabled={isLoading}
                      >
                        Disable
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={startMfaSetup}
                        disabled={isLoading}
                      >
                        {isLoading ? "Setting up..." : "Enable"}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* Text Message */}
                <div className="flex items-center justify-between gap-4 sm:gap-8 py-1">
                  <div className="flex-1 space-y-1">
                    <span className="text-sm font-medium text-white/90">Text message</span>
                    <p className="text-[10px] sm:text-xs text-white/30 leading-relaxed">
                      Get 6-digit verification codes by SMS or WhatsApp based on your country code
                    </p>
                  </div>
                  <Switch 
                    checked={smsEnabled}
                    onCheckedChange={handleSmsToggle}
                    className="data-[state=checked]:bg-white data-[state=unchecked]:bg-white/10 border-none h-5 w-9 shrink-0" 
                  />
                </div>

                <div className="h-px bg-white/5" />

                {/* Trusted Devices */}
                <div className="space-y-1 py-1">
                  <span className="text-sm font-medium text-white/90">Trusted Devices</span>
                  <p className="text-[10px] sm:text-xs text-white/30 leading-relaxed">
                    When you sign in on another device, it will be added here and can automatically receive device prompts for signing in.
                  </p>
                </div>

                <div className="h-px bg-white/5" />

                {/* Logout */}
                <div className="flex items-center justify-between py-4">
                  <span className="text-sm font-medium text-white/90">Log out of this device</span>
                  <Button 
                    onClick={handleLogout}
                    variant="ghost" 
                    className="bg-white/5 hover:bg-white/10 text-white rounded-xl sm:rounded-2xl h-9 sm:h-10 px-4 sm:px-6 font-medium text-xs sm:text-sm"
                  >
                    Log out
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "account" && userData && (
            <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">Account</h2>
              
              <div className="flex flex-col items-center gap-3 sm:gap-4 p-4 sm:p-6 bg-white/5 rounded-2xl sm:rounded-3xl border border-white/5 mb-6 sm:mb-8">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-primary/20">
                  <AvatarImage src={userData.photoURL} />
                  <AvatarFallback className="bg-white/10 text-white text-lg sm:text-xl">
                    {userData.displayName?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="text-base sm:text-lg font-bold text-white">{userData.displayName}</h3>
                  <p className="text-xs sm:text-sm text-white/40">@{userData.username}</p>
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
                      <Mail size={14} className="sm:size-[16px]" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-white/90">Email address</span>
                  </div>
                  <span className="text-xs sm:text-sm text-white/40 truncate max-w-[120px] sm:max-w-none">{userData.email}</span>
                </div>

                <div className="h-px bg-white/5" />

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
                      <AtSign size={14} className="sm:size-[16px]" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-white/90">Username</span>
                  </div>
                  <span className="text-xs sm:text-sm text-white/40">@{userData.username}</span>
                </div>

                <div className="h-px bg-white/5" />

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
                      <ShieldCheck size={14} className="sm:size-[16px]" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-white/90">Role</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold uppercase tracking-wider">
                      {userData.role}
                    </span>
                    {userData.userTag && (
                      <span 
                        className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold text-white hidden sm:inline"
                        style={{ background: userData.userTag.color }}
                      >
                        {userData.userTag.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="h-px bg-white/5" />

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
                      <Fingerprint size={14} className="sm:size-[16px]" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-white/90">User ID</span>
                  </div>
                  <code className="text-[9px] sm:text-[10px] bg-white/5 px-2 py-1 rounded text-white/30 font-mono truncate max-w-[100px] sm:max-w-[150px]">
                    {userData.uid}
                  </code>
                </div>
              </div>
            </div>
          )}

          {activeTab !== "general" && activeTab !== "security" && activeTab !== "account" && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-4">
              <p className="text-sm font-medium">Settings for {activeTab} coming soon.</p>
            </div>
          )}
        </main>
      </DialogContent>

      {/* MFA Setup Modal */}
      <Dialog open={mfaSetupModal} onOpenChange={setMfaSetupModal}>
        <DialogContent className="max-w-md bg-[#171717] border-white/5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {mfaStep === 'setup' && 'Set Up Authenticator'}
              {mfaStep === 'verify' && 'Verify Your Code'}
              {mfaStep === 'done' && 'MFA Enabled Successfully'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {mfaStep === 'setup' && (
              <>
                <p className="text-sm text-white/70">
                  Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.):
                </p>
                
                {/* QR Code Display */}
                <div className="flex justify-center p-6 bg-white/5 rounded-lg">
                  {qrCode && (
                    <div className="bg-white p-4 rounded-lg">
                      <QRCode value={qrCode} size={256} level="H" includeMargin={true} />
                    </div>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-[#171717] text-white/50">Or enter this secret manually</span>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-lg text-center">
                  <code className="text-sm font-mono text-green-400 break-all">
                    {secret}
                  </code>
                </div>

                <p className="text-xs text-white/50">
                  After scanning or entering the secret, click next to verify your setup.
                </p>

                <Button
                  onClick={() => setMfaStep('verify')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  Next: Verify Code
                </Button>
              </>
            )}

            {mfaStep === 'verify' && (
              <>
                <p className="text-sm text-white/70">
                  Enter the 6-digit code from your authenticator app:
                </p>

                <Input
                  type="text"
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-widest bg-white/5 border-white/10 text-white"
                  maxLength={6}
                />

                <Button
                  onClick={verifyMfaCode}
                  disabled={verifyCode.length !== 6 || isLoading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Enable MFA'}
                </Button>

                <Button
                  onClick={() => setMfaStep('setup')}
                  variant="ghost"
                  className="w-full text-white/50 hover:text-white"
                >
                  Back
                </Button>
              </>
            )}

            {mfaStep === 'done' && (
              <>
                <div className="flex justify-center">
                  <div className="h-12 w-12 rounded-full bg-green-600/20 flex items-center justify-center">
                    <ShieldCheck className="h-6 w-6 text-green-400" />
                  </div>
                </div>

                <div className="space-y-2 text-center">
                  <p className="text-sm font-medium text-white">
                    Multi-factor authentication is now enabled!
                  </p>
                  <p className="text-xs text-white/50">
                    Save these backup codes. You can use them to access your account if you lose your authenticator device.
                  </p>
                </div>

                {/* Backup Codes */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-white">Backup Codes</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="bg-white/5 hover:bg-white/10 text-white gap-2"
                      onClick={downloadBackupCodes}
                    >
                      <Download size={14} />
                      Download
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {backupCodes.map((code, idx) => (
                      <div
                        key={idx}
                        className="bg-white/5 px-3 py-2 rounded text-sm font-mono text-white/70 flex items-center justify-between group cursor-pointer hover:bg-white/10 transition-colors"
                        onClick={() => {
                          navigator.clipboard.writeText(code);
                          setCopied(code);
                          setTimeout(() => setCopied(null), 2000);
                        }}
                      >
                        <span>{code}</span>
                        {copied === code ? (
                          <Check size={14} className="text-green-400" />
                        ) : (
                          <Copy size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setMfaSetupModal(false);
                    setMfaStep('setup');
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  Done
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Passkey Management Modal */}
      <Dialog open={passkeyModal} onOpenChange={setPasskeyModal}>
        <DialogContent className="max-w-md bg-[#171717] border-white/5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Manage Passkeys</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-white/70">
              Passkeys let you sign in without knowing your password. They're more secure than passwords alone.
            </p>

            {/* List of passkeys */}
            {passkeys.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-white/50">Your passkeys</p>
                {passkeys.map((passkey) => (
                  <div
                    key={passkey.id}
                    className="flex items-center justify-between bg-white/5 p-3 rounded-lg group"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{passkey.deviceName}</p>
                      <p className="text-xs text-white/50">
                        Added {new Date(passkey.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deletePasskey(passkey.id, passkey.deviceName)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {passkeys.length === 0 && !passkeyModal ? null : (
              <div className="h-px bg-white/10" />
            )}

            {/* Add new passkey form */}
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70">Device name</label>
                <Input
                  placeholder="e.g., My Laptop, iPhone 15"
                  value={passkeyName}
                  onChange={(e) => setPasskeyName(e.target.value)}
                  disabled={passkeyLoading}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>

              <Button
                onClick={startPasskeyRegistration}
                disabled={!passkeyName.trim() || passkeyLoading}
                className="w-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
              >
                {passkeyLoading ? (
                  <>
                    <Loader size={16} className="animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Key size={16} className="mr-2" />
                    Add New Passkey
                  </>
                )}
              </Button>
            </div>

            <Button
              onClick={() => {
                setPasskeyModal(false);
                setPasskeyName('');
              }}
              variant="ghost"
              className="w-full text-white/50 hover:text-white"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
