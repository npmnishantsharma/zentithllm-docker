"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Settings, 
  Plus, 
  MessageSquare, 
  Terminal, 
  Cpu, 
  Database, 
  LayoutGrid,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  ArrowUpRight,
  Share2,
  Trash2,
  Paperclip,
  Mic,
  Command,
  Monitor
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { aiMessageContextAssistant, type AiMessageContextAssistantOutput } from '@/ai/flows/ai-message-context-assistant-flow';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  senderName: string;
  avatar?: string;
};

const INITIAL_CONVERSATIONS = [
  { id: '1', name: 'Wikipedia to Markdown', group: 'Development' },
  { id: '2', name: 'Android CI with Discord', group: 'Automation' },
  { id: '3', name: 'Docker Project Ideas', group: 'Development' },
  { id: '4', name: 'Derivative Function Rules', group: 'Research' },
  { id: '5', name: 'AI Instagram Support', group: 'Automation' },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  '2': [
    { id: 'm1', role: 'assistant', senderName: 'Nexus AI', content: "Protocol check complete. Environment 'development' is active. How shall we proceed with the CI optimization?", timestamp: '10:24 AM', avatar: 'https://picsum.photos/seed/ai/100/100' },
    { id: 'm2', role: 'user', senderName: 'You', content: "Let's review the Discord webhook triggers. We need more granular build data in the notifications.", timestamp: '10:25 AM' },
  ],
};

const AUTH_USER = {
  displayName: "Nishant Sharma",
  photoURL: "https://res.cloudinary.com/dtywxosgx/image/upload/v1764086999/profile-pictures/g7sujspn1cmdso0v1bfr.jpg",
  userTag: {
    name: "Owner",
    emoji: "👑",
    color: "linear-gradient(to right, #11998e, #38ef7d)"
  }
};

export default function ChatPage() {
  const [activeConvId, setActiveConvId] = useState<string>('2');
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES['2'] || []);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiMessageContextAssistantOutput | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    setMessages(MOCK_MESSAGES[activeConvId] || []);
  }, [activeConvId]);

  const handleSendMessage = async (content: string = inputValue) => {
    if (!content.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      senderName: 'You',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        senderName: 'Nexus AI',
        content: "Synchronizing request... Implementation verified. The webhook payload has been updated to include real-time telemetry.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatar: 'https://picsum.photos/seed/ai/100/100'
      };
      setMessages(prev => [...prev, reply]);
    }, 1500);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-body dark">
      
      {/* 1. Activity Bar (The VS Code Style Rail) */}
      <nav className="w-14 flex flex-col items-center py-4 bg-sidebar border-r border-border/40 shrink-0">
        <div className="mb-8 p-2 bg-primary/10 rounded-xl text-primary">
          <Terminal size={22} strokeWidth={2.5} />
        </div>
        <div className="flex flex-col gap-6 flex-1">
          <Button variant="ghost" size="icon" className="h-10 w-10 text-primary bg-primary/5 rounded-xl">
            <MessageSquare size={20} />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground">
            <Cpu size={20} />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground">
            <Database size={20} />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground">
            <LayoutGrid size={20} />
          </Button>
        </div>
        <div className="mt-auto flex flex-col gap-4">
          <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground">
            <Settings size={20} />
          </Button>
          <Avatar className="h-8 w-8 border border-border/50">
            <AvatarImage src={AUTH_USER.photoURL} />
            <AvatarFallback>NS</AvatarFallback>
          </Avatar>
        </div>
      </nav>

      {/* 2. Side Panel (Project Explorer Style) */}
      <aside className="w-72 flex flex-col bg-sidebar/50 border-r border-border/20 shrink-0 overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Workspace</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
            <Plus size={16} />
          </Button>
        </div>

        <div className="px-4 mb-4">
          <div className="relative group">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
            <input 
              placeholder="Search nodes..." 
              className="h-9 w-full pl-8 bg-muted/30 border border-border/10 rounded-lg text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/10 transition-all"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-2 space-y-4">
            {['Development', 'Automation', 'Research'].map(group => (
              <div key={group}>
                <button className="flex items-center gap-1.5 px-2 py-1 w-full text-[10px] font-bold text-muted-foreground/60 hover:text-foreground uppercase tracking-wider mb-1">
                  <ChevronDown size={12} />
                  {group}
                </button>
                <div className="space-y-0.5">
                  {INITIAL_CONVERSATIONS.filter(c => c.group === group).map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => setActiveConvId(conv.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition-all text-left group/item",
                        activeConvId === conv.id 
                          ? "bg-accent/10 text-primary border-l-2 border-primary pl-2.5" 
                          : "text-muted-foreground hover:bg-accent/5 hover:text-foreground border-l-2 border-transparent"
                      )}
                    >
                      <span className="truncate flex-1">{conv.name}</span>
                      <ArrowUpRight size={10} className="opacity-0 group-hover/item:opacity-40 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        {/* Profile Footer */}
        <div className="p-3 bg-muted/10 border-t border-border/10">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-background/40 border border-border/5 shadow-sm">
            <div className="relative">
              <Avatar className="h-8 w-8">
                <AvatarImage src={AUTH_USER.photoURL} />
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 border-2 border-background rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate leading-none mb-1">{AUTH_USER.displayName}</p>
              <div 
                className="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-white inline-flex items-center gap-1 scale-90 origin-left"
                style={{ background: AUTH_USER.userTag.color }}
              >
                {AUTH_USER.userTag.name}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 3. Main Editor Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        {/* Header - Tab bar feel */}
        <header className="h-12 flex items-center px-4 bg-muted/20 border-b border-border/10 shrink-0 gap-4">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Monitor size={14} />
            <span>workspace</span>
            <ChevronRight size={14} className="opacity-30" />
            <span className="text-foreground font-bold">
              {INITIAL_CONVERSATIONS.find(c => c.id === activeConvId)?.name}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-accent/10">
              <Share2 size={16} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Trash2 size={16} />
            </Button>
            <div className="h-4 w-px bg-border/20 mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreVertical size={16} />
            </Button>
          </div>
        </header>

        {/* Message Feed */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] bg-fixed"
        >
          <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
            {messages.map((msg) => {
              const isAI = msg.role === 'assistant';
              return (
                <div key={msg.id} className="animate-fade-in group relative">
                  <div className="flex items-start gap-6">
                    <div className={cn(
                      "h-9 w-9 rounded-xl shrink-0 flex items-center justify-center overflow-hidden border transition-transform group-hover:scale-105",
                      isAI ? "bg-primary/10 border-primary/20" : "bg-muted/50 border-border/10"
                    )}>
                      <Avatar className="h-full w-full rounded-none">
                        <AvatarImage src={isAI ? msg.avatar : AUTH_USER.photoURL} />
                        <AvatarFallback>{isAI ? 'AI' : 'U'}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className={cn(
                          "text-[13px] font-bold tracking-tight",
                          isAI ? "text-primary" : "text-foreground"
                        )}>
                          {isAI ? 'Nexus Protocol' : AUTH_USER.displayName}
                        </span>
                        <span className="text-[10px] text-muted-foreground/40 font-mono">{msg.timestamp}</span>
                      </div>
                      <div className={cn(
                        "text-[15px] leading-relaxed whitespace-pre-wrap font-body",
                        isAI ? "text-foreground/90" : "text-foreground/80"
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                  <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-start gap-6 animate-pulse">
                <div className="h-9 w-9 rounded-xl bg-muted/30 border border-border/10 shrink-0" />
                <div className="flex-1 pt-1 space-y-2">
                  <div className="h-3 w-32 bg-muted/20 rounded" />
                  <div className="h-3 w-full bg-muted/20 rounded" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Console-style Input Area */}
        <footer className="p-4 bg-muted/5 border-t border-border/10">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex flex-col bg-sidebar/40 border border-border/20 rounded-xl overflow-hidden focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/10 transition-all shadow-xl">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border/10">
                <Command size={12} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Execution Command</span>
              </div>
              
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={1}
                placeholder="Initialize message sequence..."
                className="w-full bg-transparent border-none focus:ring-0 text-[14px] min-h-[60px] py-4 px-4 resize-none placeholder:text-muted-foreground/30 focus:outline-none font-code"
              />
              
              <div className="flex items-center justify-between px-3 py-2 bg-muted/5">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors">
                    <Paperclip size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors">
                    <Mic size={16} />
                  </Button>
                  <div className="h-4 w-px bg-border/20 mx-1" />
                  <span className="text-[10px] font-mono text-muted-foreground/30 px-1">Press ⏎ to execute</span>
                </div>
                <Button 
                  onClick={() => handleSendMessage()}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 px-4 transition-all rounded-lg font-bold uppercase text-[10px] tracking-widest",
                    inputValue.trim() 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                      : "text-muted-foreground/30"
                  )}
                  disabled={!inputValue.trim()}
                >
                  Execute
                  <ArrowUpRight size={14} />
                </Button>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-center text-muted-foreground/30 font-mono tracking-tight">
              DEVC-NODE-V4 // READY // HANDSHAKE VERIFIED
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}