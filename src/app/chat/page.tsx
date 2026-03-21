"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Settings, 
  Send, 
  Plus, 
  Hash, 
  Circle,
  Sparkles,
  ChevronRight,
  MessageSquare,
  Users,
  LayoutDashboard,
  Terminal,
  MoreHorizontal,
  X
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
  unreadCount: number;
  status: 'online' | 'offline' | 'idle';
  type: 'direct' | 'channel';
};

const INITIAL_CONVERSATIONS: Conversation[] = [
  { id: '1', name: 'general', lastMessage: 'Anyone ready for the standup?', unreadCount: 2, status: 'online', type: 'channel' },
  { id: '2', name: 'frontend-team', lastMessage: 'The new Tailwind config looks great.', unreadCount: 0, status: 'online', type: 'channel' },
  { id: '3', name: 'Alex Rivera', lastMessage: 'Can you review my PR?', unreadCount: 0, status: 'online', type: 'direct' },
  { id: '4', name: 'Sarah Chen', lastMessage: 'Meetings moved to tomorrow.', unreadCount: 0, status: 'idle', type: 'direct' },
  { id: '5', name: 'deployment-logs', lastMessage: 'Success: build finished in 45s.', unreadCount: 1, status: 'offline', type: 'channel' },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  '1': [
    { id: 'm1', role: 'assistant', senderName: 'Sarah Chen', content: "Anyone ready for the standup?", timestamp: '09:00 AM', avatar: 'https://picsum.photos/seed/sarah/100/100' },
  ],
  '2': [
    { id: 'm2', role: 'assistant', senderName: 'Alex Rivera', content: "Hey! Did you check out the new Shadcn components?", timestamp: '10:24 AM', avatar: 'https://picsum.photos/seed/alex/100/100' },
    { id: 'm3', role: 'user', senderName: 'You', content: "Not yet, which ones were added?", timestamp: '10:25 AM' },
    { id: 'm4', role: 'assistant', senderName: 'Alex Rivera', content: "The charts and the sidebar components are game-changers.", timestamp: '10:26 AM', avatar: 'https://picsum.photos/seed/alex/100/100' },
  ],
  '3': [
    { id: 'm5', role: 'assistant', senderName: 'Alex Rivera', content: "Can you review my PR when you have a sec?", timestamp: 'Yesterday', avatar: 'https://picsum.photos/seed/alex/100/100' },
  ]
};

export default function ChatPage() {
  const [activeConvId, setActiveConvId] = useState<string>('2');
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES['2'] || []);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiMessageContextAssistantOutput | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    setMessages(MOCK_MESSAGES[activeConvId] || []);
    fetchAiSuggestions(MOCK_MESSAGES[activeConvId] || []);
  }, [activeConvId]);

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
      // Silent fail for suggestions
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

    // Mock response
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        senderName: activeConv?.name || 'Assistant',
        content: "Acknowledged. I'll process that request immediately.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatar: `https://picsum.photos/seed/${activeConvId}/100/100`
      };
      const finalMessages = [...updatedMessages, reply];
      setMessages(finalMessages);
      fetchAiSuggestions(finalMessages);
    }, 1200);
  };

  const activeConv = INITIAL_CONVERSATIONS.find(c => c.id === activeConvId);

  return (
    <div className="flex h-screen overflow-hidden bg-[#1e1f22] text-[#bcbec4] font-body">
      
      {/* Sidebar */}
      <aside className="w-72 flex flex-col bg-[#2b2d30] border-r border-[#1e1f22] shrink-0">
        <div className="h-12 flex items-center px-4 border-b border-[#1e1f22] bg-[#2b2d30]/50">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <LayoutDashboard size={18} className="text-primary" />
            <span>DevCom Console</span>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-muted-foreground hover:text-foreground">
            <Plus size={16} />
          </Button>
        </div>

        <div className="p-3">
          <div className="relative group">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search workspaces..." 
              className="h-8 pl-8 bg-[#1e1f22] border-none text-xs placeholder:text-muted-foreground/40 focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-2 pb-4 space-y-6">
            {/* Channels */}
            <div>
              <div className="flex items-center gap-1 px-2 mb-1.5">
                <ChevronRight size={12} className="text-muted-foreground/50 rotate-90" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Clusters</span>
              </div>
              <div className="space-y-[1px]">
                {INITIAL_CONVERSATIONS.filter(c => c.type === 'channel').map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-xs transition-all group",
                      activeConvId === conv.id 
                        ? "bg-[#393b40] text-foreground shadow-sm" 
                        : "text-muted-foreground hover:bg-[#393b40]/40 hover:text-foreground"
                    )}
                  >
                    <Hash size={14} className={cn("shrink-0", activeConvId === conv.id ? "text-primary" : "opacity-40")} />
                    <span className="flex-1 text-left truncate">{conv.name}</span>
                    {conv.unreadCount > 0 && (
                      <Badge className="h-4 min-w-[1rem] px-1 bg-primary text-[9px] font-bold border-none rounded-full">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Messages */}
            <div>
              <div className="flex items-center gap-1 px-2 mb-1.5">
                <ChevronRight size={12} className="text-muted-foreground/50 rotate-90" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Direct Access</span>
              </div>
              <div className="space-y-[1px]">
                {INITIAL_CONVERSATIONS.filter(c => c.type === 'direct').map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-xs transition-all group",
                      activeConvId === conv.id 
                        ? "bg-[#393b40] text-foreground shadow-sm" 
                        : "text-muted-foreground hover:bg-[#393b40]/40 hover:text-foreground"
                    )}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-5 w-5 rounded-sm border border-[#1e1f22]">
                        <AvatarImage src={`https://picsum.photos/seed/${conv.id}/100/100`} />
                        <AvatarFallback className="text-[8px] bg-primary/20">{conv.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[#2b2d30]",
                        conv.status === 'online' ? "bg-green-500" : conv.status === 'idle' ? "bg-yellow-500" : "bg-slate-500"
                      )} />
                    </div>
                    <span className="flex-1 text-left truncate">{conv.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* User Profile */}
        <div className="p-3 mt-auto border-t border-[#1e1f22] bg-[#2b2d30]/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-1">
            <Avatar className="h-8 w-8 rounded-sm ring-1 ring-[#1e1f22]">
              <AvatarImage src="https://picsum.photos/seed/me/100/100" />
              <AvatarFallback>ME</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-foreground truncate">NexusUser_01</div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="text-[9px] text-muted-foreground uppercase font-code">Verified</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <Settings size={14} />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#1e1f22]">
        {/* Header */}
        <header className="h-12 flex items-center px-6 border-b border-[#2b2d30] shrink-0 bg-[#1e1f22]/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {activeConv?.type === 'channel' ? (
              <Hash size={18} className="text-primary/70" />
            ) : (
              <div className="relative">
                <Avatar className="h-6 w-6 rounded-sm border border-[#2b2d30]">
                  <AvatarImage src={`https://picsum.photos/seed/${activeConvId}/100/100`} />
                  <AvatarFallback className="text-[10px]">{activeConv?.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
            )}
            <div>
              <h2 className="text-sm font-bold text-foreground leading-none">{activeConv?.name}</h2>
              <p className="text-[10px] text-muted-foreground/60 font-code mt-0.5">cluster_latency: 14ms</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-4 text-muted-foreground/40">
            <Users size={16} className="hover:text-foreground cursor-pointer transition-colors" />
            <Search size={16} className="hover:text-foreground cursor-pointer transition-colors" />
            <MoreHorizontal size={16} className="hover:text-foreground cursor-pointer transition-colors" />
          </div>
        </header>

        {/* Message Feed */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto custom-scrollbar px-6 py-8"
        >
          <div className="max-w-4xl mx-auto space-y-8">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-[#2b2d30] border border-[#393b40] flex items-center justify-center text-primary/40">
                  <MessageSquare size={32} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground">Beginning of transmission</h3>
                  <p className="text-xs text-muted-foreground">Encryption established for {activeConv?.name}.</p>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => {
              const isMe = msg.role === 'user';
              return (
                <div key={msg.id} className="group animate-fade-in">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-9 w-9 rounded-sm shrink-0 border border-[#2b2d30]">
                      <AvatarImage src={msg.avatar || `https://picsum.photos/seed/${msg.senderName}/100/100`} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">{msg.senderName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className={cn(
                          "text-sm font-bold",
                          isMe ? "text-primary" : "text-foreground"
                        )}>
                          {msg.senderName}
                        </span>
                        <span className="text-[10px] text-muted-foreground/40 font-code">{msg.timestamp}</span>
                      </div>
                      <div className="text-[13px] leading-relaxed text-[#bcbec4] whitespace-pre-wrap font-sans">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-4 animate-pulse">
                <div className="w-9 h-9 bg-[#2b2d30] rounded-sm shrink-0" />
                <div className="h-4 w-32 bg-[#2b2d30] rounded-sm" />
              </div>
            )}
          </div>
        </div>

        {/* Input & AI Suggestions */}
        <footer className="p-6 pt-0 shrink-0">
          <div className="max-w-4xl mx-auto">
            {/* AI Suggestions */}
            {(aiSuggestions || isLoadingSuggestions) && (
              <div className="mb-4">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 mb-2 font-code uppercase tracking-widest">
                  <Sparkles size={12} className="text-primary animate-glow" />
                  NexusLLM IntelliSense
                </div>
                <div className="flex flex-wrap gap-2">
                  {isLoadingSuggestions ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-7 w-28 rounded-sm bg-[#2b2d30] animate-pulse" />
                    ))
                  ) : (
                    <>
                      {aiSuggestions?.suggestedReplies.map((reply, i) => (
                        <button
                          key={i}
                          onClick={() => handleSendMessage(reply)}
                          className="px-3 py-1.5 rounded-sm bg-[#2b2d30] border border-[#393b40] text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all flex items-center gap-2 group"
                        >
                          <span className="text-primary/50 font-code group-hover:text-primary transition-colors">0{i+1}</span>
                          {reply}
                        </button>
                      ))}
                      {aiSuggestions?.suggestedCommands.map((cmd, i) => (
                        <button
                          key={i}
                          onClick={() => handleSendMessage(cmd)}
                          className="px-3 py-1.5 rounded-sm bg-[#2b2d30] border border-[#393b40] text-[11px] text-primary/70 hover:text-primary hover:border-primary/50 transition-all flex items-center gap-2"
                        >
                          <Terminal size={12} />
                          <span className="font-code">{cmd}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Input Bar */}
            <div className="relative bg-[#2b2d30] border border-[#393b40] rounded-sm focus-within:ring-1 focus-within:ring-primary/50 transition-all group overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-focus-within:bg-primary transition-colors" />
              <div className="flex items-end gap-2 p-3 pl-4">
                <div className="flex-1">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    rows={1}
                    placeholder={`Transmit message to ${activeConv?.name}...`}
                    className="w-full bg-transparent border-none focus:ring-0 text-[13px] font-sans h-9 py-2 resize-none placeholder:text-muted-foreground/30 text-foreground"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    onClick={() => handleSendMessage()}
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-9 w-9 transition-all rounded-sm",
                      inputValue.trim() ? "bg-primary text-white hover:bg-primary/90" : "text-muted-foreground/30"
                    )}
                    disabled={!inputValue.trim()}
                  >
                    <Send size={16} />
                  </Button>
                </div>
              </div>
              
              <div className="px-4 py-1 bg-[#1e1f22]/30 flex items-center justify-between text-[9px] font-code text-muted-foreground/40 uppercase tracking-tighter">
                <div className="flex gap-3">
                  <span>UTF-8</span>
                  <span>Markdown Enabled</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                  <span>Secure Transmission Active</span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
