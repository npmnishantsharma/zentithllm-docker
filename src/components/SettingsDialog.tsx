"use client";

import * as React from "react";
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

      // Load security preferences
      setMfaEnabled(localStorage.getItem('nexus_mfa_enabled') === 'true');
      setSmsEnabled(localStorage.getItem('nexus_sms_enabled') === 'true');
    }
  }, [open]);

  const handleLogout = () => {
    localStorage.removeItem('nexus_session_active');
    localStorage.removeItem('nexus_user_data');
    router.push('/login');
    onOpenChange(false);
  };

  const handleMfaToggle = (checked: boolean) => {
    setMfaEnabled(checked);
    localStorage.setItem('nexus_mfa_enabled', checked.toString());
    toast({
      title: checked ? "Authenticator App Enabled" : "Authenticator App Disabled",
      description: checked 
        ? "Your account is now protected with multi-factor authentication." 
        : "One-time codes via app have been disabled.",
    });
  };

  const handleSmsToggle = (checked: boolean) => {
    setSmsEnabled(checked);
    localStorage.setItem('nexus_sms_enabled', checked.toString());
    toast({
      title: checked ? "SMS Authentication Enabled" : "SMS Authentication Disabled",
      description: checked 
        ? "You will now receive verification codes via text message." 
        : "Text message verification has been disabled.",
    });
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
                <div className="flex items-center justify-between py-1 group cursor-pointer gap-4 sm:gap-8">
                  <div className="flex-1 space-y-1">
                    <span className="text-sm font-medium text-white/90">Passkeys</span>
                    <p className="text-[10px] sm:text-xs text-white/30 leading-relaxed">
                      Passkeys are secure and protect your account with multi-factor authentication. They don't require any extra steps.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-white/30 group-hover:text-white transition-colors shrink-0">
                    <span className="text-sm">Add</span>
                    <ChevronRight size={16} />
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
                  </div>
                  <Switch 
                    checked={mfaEnabled}
                    onCheckedChange={handleMfaToggle}
                    className="data-[state=checked]:bg-white data-[state=unchecked]:bg-white/10 border-none h-5 w-9 shrink-0" 
                  />
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
    </Dialog>
  );
}
