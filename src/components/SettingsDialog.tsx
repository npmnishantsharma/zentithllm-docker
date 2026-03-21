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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('nexus_session_active');
    localStorage.removeItem('nexus_user_data');
    router.push('/login');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[600px] p-0 bg-[#171717] border-white/5 overflow-hidden flex flex-col sm:flex-row gap-0 rounded-3xl">
        {/* Sidebar */}
        <aside className="w-full sm:w-64 border-r border-white/5 bg-[#171717] p-4 flex flex-col gap-1 overflow-y-auto shrink-0">
          <DialogHeader className="px-2 mb-4">
            <DialogTitle className="sr-only">Settings</DialogTitle>
          </DialogHeader>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors text-left",
                activeTab === item.id
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon size={18} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 bg-[#171717]">
          {activeTab === "general" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-semibold text-white mb-6">General</h2>

              <div className="space-y-6">
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium text-white/90">Appearance</span>
                  <Select defaultValue="system">
                    <SelectTrigger className="w-40 bg-transparent border-none text-white/60 hover:text-white transition-colors focus:ring-0 px-0 justify-end gap-2 text-right">
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
                    <SelectTrigger className="w-40 bg-transparent border-none text-white/60 hover:text-white transition-colors focus:ring-0 px-0 justify-end gap-2 text-right">
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
                    <SelectTrigger className="w-40 bg-transparent border-none text-white/60 hover:text-white transition-colors focus:ring-0 px-0 justify-end gap-2 text-right">
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
                      <SelectTrigger className="w-40 bg-transparent border-none text-white/60 hover:text-white transition-colors focus:ring-0 px-0 justify-end gap-2 text-right">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2f2f2f] border-white/10 text-white">
                        <SelectItem value="auto">Auto-detect</SelectItem>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="en-UK">English (UK)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-white/30 leading-relaxed">
                    For best results, select the language you mainly speak. If it's not listed, it may still be supported via auto-detection.
                  </p>
                </div>

                <div className="h-px bg-white/5" />

                <div className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium text-white/90">Voice</span>
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" className="bg-white/5 hover:bg-white/10 text-white gap-2 rounded-full h-8 px-4">
                      <Play size={14} className="fill-white" />
                      Play
                    </Button>
                    <Select defaultValue="spruce">
                      <SelectTrigger className="w-24 bg-transparent border-none text-white/60 hover:text-white transition-colors focus:ring-0 px-0 justify-end gap-2 text-right">
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

                <div className="flex items-center justify-between gap-8 py-1">
                  <div className="flex-1 space-y-1">
                    <span className="text-sm font-medium text-white/90">Separate Voice</span>
                    <p className="text-xs text-white/30 leading-relaxed">
                      Keep ChatGPT Voice in a separate full screen, without real time transcripts and visuals.
                    </p>
                  </div>
                  <Switch className="data-[state=checked]:bg-white data-[state=unchecked]:bg-white/10 border-none h-5 w-9 shrink-0" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h2 className="text-xl font-semibold text-white mb-6">Security</h2>

              <div className="space-y-6">
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
                <div className="flex items-center justify-between py-1 group cursor-pointer gap-8">
                  <div className="flex-1 space-y-1">
                    <span className="text-sm font-medium text-white/90">Passkeys</span>
                    <p className="text-xs text-white/30 leading-relaxed">
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
                <h3 className="text-md font-semibold text-white/90 pt-2">Multi-factor authentication (MFA)</h3>

                {/* Authenticator App */}
                <div className="flex items-center justify-between gap-8 py-1">
                  <div className="flex-1 space-y-1">
                    <span className="text-sm font-medium text-white/90">Authenticator app</span>
                    <p className="text-xs text-white/30 leading-relaxed">
                      Use one-time codes from an authenticator app.
                    </p>
                  </div>
                  <Switch className="data-[state=checked]:bg-white data-[state=unchecked]:bg-white/10 border-none h-5 w-9 shrink-0" />
                </div>

                <div className="h-px bg-white/5" />

                {/* Text Message */}
                <div className="flex items-center justify-between gap-8 py-1">
                  <div className="flex-1 space-y-1">
                    <span className="text-sm font-medium text-white/90">Text message</span>
                    <p className="text-xs text-white/30 leading-relaxed">
                      Get 6-digit verification codes by SMS or WhatsApp based on your country code
                    </p>
                  </div>
                  <Switch className="data-[state=checked]:bg-white data-[state=unchecked]:bg-white/10 border-none h-5 w-9 shrink-0" />
                </div>

                <div className="h-px bg-white/5" />

                {/* Trusted Devices */}
                <div className="space-y-1 py-1">
                  <span className="text-sm font-medium text-white/90">Trusted Devices</span>
                  <p className="text-xs text-white/30 leading-relaxed">
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
                    className="bg-white/5 hover:bg-white/10 text-white rounded-2xl h-10 px-6 font-medium"
                  >
                    Log out
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab !== "general" && activeTab !== "security" && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
              <p className="text-sm font-medium">Settings for {activeTab} coming soon.</p>
            </div>
          )}
        </main>
      </DialogContent>
    </Dialog>
  );
}