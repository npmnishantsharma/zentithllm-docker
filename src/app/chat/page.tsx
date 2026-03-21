"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Settings, 
  Send, 
  Plus, 
  Sparkles,
  ChevronDown,
  MessageSquare,
  MoreHorizontal,
  SquarePen,
  ArrowUp,
  Share,
  LayoutDashboard,
  User,
  Crown,
  Paperclip,
  Mic
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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

type Conversation = {
  id: string;
  name: string;
  lastMessage: string;
};

const INITIAL_CONVERSATIONS: Conversation[] = [
  { id: '1', name: 'Wikipedia to Markdown', lastMessage: 'Anyone ready for the standup?' },
  { id: '2', name: 'Android CI with Discord', lastMessage: 'The new Tailwind config looks great.' },
  { id: '3', name: 'Docker Project Ideas', lastMessage: 'Can you review my PR?' },
  { id: '4', name: 'Derivative Function Rules', lastMessage: 'Meetings moved to tomorrow.' },
  { id: '5', name: 'AI Instagram Support App', lastMessage: 'Success: build finished in 45s.' },
  { id: '6', name: 'Gun Realism Request', lastMessage: 'Working on the new assets.' },
  { id: '7', name: 'Image Generator Prompt', lastMessage: 'Prompt engineering session.' },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  '2': [
    { id: 'm2', role: 'assistant', senderName: 'Nexus AI', content: "I've analyzed the CI workflow. Here's a suggested configuration for the Discord webhook integration.", timestamp: '10:24 AM', avatar: 'https://picsum.photos/seed/ai/100/100' },
    { id: 'm3', role: 'user', senderName: 'You', content: "That looks solid. Can we also include the build duration in the message?", timestamp: '10:25 AM' },
    { id: 'm4', role: 'assistant', senderName: 'Nexus AI', content: "Certainly. I'll update the script to capture the start and end times, then calculate the delta for the notification payload.", timestamp: '10:26 AM', avatar: 'https://picsum.photos/seed/ai/100/100' },
  ],
};

const AUTH_USER = {
  displayName: "Nishant Sharma",
  username: "nishant",
  photoURL: "https://res.cloudinary.com/dtywxosgx/image/upload/v1764086999/profile-pictures/g7sujspn1cmdso0v1bfr.jpg",
  role: "admin",
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
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    setMessages(MOCK_MESSAGES[activeConvId] || []);
    fetchAiSuggestions(MOCK_MESSAGES[activeConvId] || []);
  }, [activeConvId]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const fetchAiSuggestions = async (history: Message[]) => {
    if (history.length === 0) {
      setAiSuggestions(null);
      return;
    }
    setIsLoadingSuggestions(true);
    try {
      const chatHistory = history.map(m => ({ role: m.role, content: m.content }));
      const result = await aiMessageContextAssistant({ chatHistory });
      setAiSuggestions(result);
    } catch (err) {
      // Silent fail
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSendMessage = async (content: string = inputValue) => {
    if (!content.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      senderName: 'You',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setAiSuggestions(null);

    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        senderName: 'Nexus AI',
        content: "Understood. Updating the implementation now. Is there anything else you'd like to refine?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatar: 'https://picsum.photos/seed/ai/100/100'
      };
      const finalMessages = [...updatedMessages, reply];
      setMessages(finalMessages);
      fetchAiSuggestions(finalMessages);
    }, 1200);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-body dark">
      
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-sidebar border-none shrink-0 border-r border-border/10">
        <div className="p-3">
          <Button variant="ghost" className="w-full justify-start gap-2 hover:bg-sidebar-accent rounded-lg text-sm font-medium">
            <SquarePen size={18} />
            <span>New chat</span>
          </Button>
        </div>

        <div className="px-3 mb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input 
              placeholder="Search chats" 
              className="h-9 w-full pl-9 bg-transparent border-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/60 focus:outline-none"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-0.5">
            {INITIAL_CONVERSATIONS.map(conv => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-left truncate",
                  activeConvId === conv.id 
                    ? "bg-sidebar-accent text-foreground" 
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                )}
              >
                <span className="truncate">{conv.name}</span>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Sidebar Footer - Authenticated User Profile */}
        <div className="p-3 border-t border-border/10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer group">
              <Avatar className="h-9 w-9 border border-border/20">
                <AvatarImage src={AUTH_USER.photoURL} />
                <AvatarFallback className="bg-primary/10 text-primary">{AUTH_USER.displayName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="text-sm font-semibold truncate text-foreground leading-tight">
                    {AUTH_USER.displayName}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <div 
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-white flex items-center gap-1"
                    style={{ background: AUTH_USER.userTag.color }}
                  >
                    <span>{AUTH_USER.userTag.emoji}</span>
                    {AUTH_USER.userTag.name}
                  </div>
                </div>
              </div>
              <Settings size={14} className="text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        {/* Header */}
        <header className="h-14 flex items-center px-4 justify-between shrink-0 border-b border-border/5">
          <div className="flex items-center gap-1 group cursor-pointer hover:bg-muted/50 px-2 py-1 rounded-lg transition-colors">
            <h2 className="text-sm font-semibold">NexusLLM</h2>
            <ChevronDown size={14} className="text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <Share size={18} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreHorizontal size={18} />
            </Button>
          </div>
        </header>

        {/* Centered Message Feed */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto custom-scrollbar"
        >
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-primary/40">
                  <LayoutDashboard size={24} />
                </div>
                <h3 className="text-xl font-bold">How can I help you today?</h3>
              </div>
            ) : (
              messages.map((msg) => {
                const isAI = msg.role === 'assistant';
                return (
                  <div key={msg.id} className="animate-fade-in group">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "h-8 w-8 rounded-full shrink-0 flex items-center justify-center overflow-hidden border",
                        isAI ? "bg-background" : "bg-muted border-none"
                      )}>
                        {isAI ? (
                          <Avatar className="h-full w-full">
                            <AvatarImage src={msg.avatar} />
                            <AvatarFallback>AI</AvatarFallback>
                          </Avatar>
                        ) : (
                          <Avatar className="h-full w-full">
                            <AvatarImage src={AUTH_USER.photoURL} />
                            <AvatarFallback><User size={16} /></AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="font-bold text-sm mb-1 flex items-center gap-2">
                          {isAI ? 'Nexus AI' : AUTH_USER.displayName}
                          {!isAI && (
                            <span 
                              className="text-[8px] px-1 py-0.2 rounded-full font-bold text-white uppercase tracking-tighter scale-90 origin-left"
                              style={{ background: AUTH_USER.userTag.color }}
                            >
                              {AUTH_USER.userTag.name}
                            </span>
                          )}
                        </div>
                        <div className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {isTyping && (
              <div className="flex items-start gap-4 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                <div className="flex-1 pt-1">
                  <div className="h-4 w-24 bg-muted rounded mb-2" />
                  <div className="h-4 w-full bg-muted rounded" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Input Bar */}
        <footer className="p-4 pb-8 shrink-0">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* AI Suggestions */}
            {(aiSuggestions || isLoadingSuggestions) && (
              <div className="flex flex-wrap gap-2 px-2">
                {isLoadingSuggestions ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-8 w-32 rounded-full bg-muted animate-pulse" />
                  ))
                ) : (
                  aiSuggestions?.suggestedReplies.slice(0, 2).map((reply, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(reply)}
                      className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-xs text-muted-foreground hover:text-foreground transition-all border border-border/50"
                    >
                      {reply}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Input Bar */}
            <div className="relative flex flex-col bg-muted/30 border border-border/50 rounded-2xl overflow-hidden focus-within:border-border/80 transition-all shadow-sm focus-within:ring-1 focus-within:ring-border/20">
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
                placeholder="Message Nexus AI..."
                className="w-full bg-transparent border-none focus:ring-0 text-[15px] min-h-[56px] py-4 px-4 resize-none placeholder:text-muted-foreground/50 focus:outline-none custom-scrollbar"
              />
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted rounded-lg">
                    <Plus size={18} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted rounded-lg">
                    <Paperclip size={18} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted rounded-lg">
                    <Mic size={18} />
                  </Button>
                </div>
                <Button 
                  onClick={() => handleSendMessage()}
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 transition-all rounded-lg shrink-0",
                    inputValue.trim() ? "bg-foreground text-background hover:bg-foreground/90" : "text-muted-foreground/30"
                  )}
                  disabled={!inputValue.trim()}
                >
                  <ArrowUp size={18} strokeWidth={2.5} />
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-center text-muted-foreground/50">
              Nexus AI can make mistakes. Check important info.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
