"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Settings, 
  LogOut, 
  Terminal, 
  Send, 
  Plus, 
  MoreVertical, 
  Hash, 
  AtSign, 
  Circle,
  Code,
  Sparkles,
  ChevronRight,
  Files,
  Github,
  Bell,
  Cpu,
  FolderOpen,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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

const INITIAL_MESSAGES: Message[] = [
  { id: '1', role: 'assistant', senderName: 'Alex Rivera', content: "Hey! Did you check out the new Shadcn components?", timestamp: '10:24 AM', avatar: 'https://picsum.photos/seed/alex/100/100' },
  { id: '2', role: 'user', senderName: 'You', content: "Not yet, which ones were added?", timestamp: '10:25 AM' },
  { id: '3', role: 'assistant', senderName: 'Alex Rivera', content: "The charts and the sidebar components are game-changers for internal dashboards.", timestamp: '10:26 AM', avatar: 'https://picsum.photos/seed/alex/100/100' },
  { id: '4', role: 'assistant', senderName: 'Alex Rivera', content: "I was thinking of implementing them in our current sprint. What do you think?", timestamp: '10:26 AM', avatar: 'https://picsum.photos/seed/alex/100/100' },
];

export default function ChatPage() {
  const [activeConvId, setActiveConvId] = useState<string>('2');
  const [openTabs, setOpenTabs] = useState<string[]>(['1', '2', '3']);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiMessageContextAssistantOutput | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchAiSuggestions = async (history: Message[]) => {
    setIsLoadingSuggestions(true);
    try {
      const chatHistory = history.map(m => ({ role: m.role, content: m.content }));
      const result = await aiMessageContextAssistant({ chatHistory });
      setAiSuggestions(result);
    } catch (err) {
      console.error("Failed to fetch suggestions", err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    fetchAiSuggestions(messages);
  }, []);

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
        senderName: 'Alex Rivera',
        content: "That sounds like a solid plan. Let's touch base about it later today.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatar: 'https://picsum.photos/seed/alex/100/100'
      };
      const finalMessages = [...updatedMessages, reply];
      setMessages(finalMessages);
      fetchAiSuggestions(finalMessages);
    }, 1500);
  };

  const handleConvClick = (id: string) => {
    setActiveConvId(id);
    if (!openTabs.includes(id)) {
      setOpenTabs([...openTabs, id]);
    }
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabs.filter(tabId => tabId !== id);
    setOpenTabs(newTabs);
    if (activeConvId === id && newTabs.length > 0) {
      setActiveConvId(newTabs[0]);
    }
  };

  const activeConv = INITIAL_CONVERSATIONS.find(c => c.id === activeConvId);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-body">
      {/* Activity Bar (Far Left) */}
      <aside className="w-14 flex flex-col items-center py-4 bg-[#2b2d30] border-r border-border shrink-0">
        <div className="space-y-4">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white transition-colors">
            <Files size={24} />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white transition-colors">
            <Search size={24} />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white transition-colors">
            <Github size={24} />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white transition-colors">
            <Cpu size={24} />
          </Button>
        </div>
        <div className="mt-auto space-y-4">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white transition-colors">
            <Bell size={20} />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white transition-colors">
            <Settings size={20} />
          </Button>
          <Avatar className="h-8 w-8 rounded-sm ring-1 ring-border">
            <AvatarImage src="https://picsum.photos/seed/me/100/100" />
            <AvatarFallback>ME</AvatarFallback>
          </Avatar>
        </div>
      </aside>

      {/* Project Sidebar (Second Left) */}
      <aside className="w-64 flex flex-col bg-[#1e1f22] border-r border-border shrink-0">
        <div className="flex h-12 items-center px-4 border-b border-border">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Project</span>
          <Plus size={14} className="ml-auto text-muted-foreground cursor-pointer hover:text-foreground" />
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-6">
            <div>
              <div className="flex items-center gap-1 px-2 mb-1 group cursor-pointer">
                <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground transition-transform rotate-90" />
                <FolderOpen size={14} className="text-primary/70" />
                <span className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">Channels</span>
              </div>
              <div className="space-y-[1px]">
                {INITIAL_CONVERSATIONS.filter(c => c.type === 'channel').map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => handleConvClick(conv.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-4 py-1.5 text-xs transition-colors group",
                      activeConvId === conv.id ? "bg-[#2d313a] text-primary font-medium" : "text-muted-foreground hover:bg-[#2d313a]/50 hover:text-foreground"
                    )}
                  >
                    <Hash size={14} className={activeConvId === conv.id ? "text-primary" : "text-muted-foreground opacity-60"} />
                    <span className="flex-1 text-left truncate">{conv.name}</span>
                    {conv.unreadCount > 0 && (
                      <Badge className="h-4 min-w-[1rem] px-1 bg-primary text-[9px] font-bold border-none rounded-sm">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1 px-2 mb-1 group cursor-pointer">
                <ChevronRight size={14} className="text-muted-foreground group-hover:text-foreground transition-transform rotate-90" />
                <FolderOpen size={14} className="text-primary/70" />
                <span className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">Direct Messages</span>
              </div>
              <div className="space-y-[1px]">
                {INITIAL_CONVERSATIONS.filter(c => c.type === 'direct').map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => handleConvClick(conv.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-4 py-1.5 text-xs transition-colors group",
                      activeConvId === conv.id ? "bg-[#2d313a] text-primary font-medium" : "text-muted-foreground hover:bg-[#2d313a]/50 hover:text-foreground"
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-4 w-4 rounded-sm">
                        <AvatarImage src={`https://picsum.photos/seed/${conv.id}/100/100`} />
                        <AvatarFallback className="text-[8px]">{conv.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-[#1e1f22]",
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
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Editor-style Tabs */}
        <div className="flex h-10 bg-[#2b2d30] border-b border-border overflow-x-auto no-scrollbar shrink-0">
          {openTabs.map(tabId => {
            const conv = INITIAL_CONVERSATIONS.find(c => c.id === tabId);
            if (!conv) return null;
            const isActive = activeConvId === tabId;
            return (
              <div
                key={tabId}
                onClick={() => setActiveConvId(tabId)}
                className={cn(
                  "relative flex items-center h-full px-4 gap-2 text-xs cursor-pointer border-r border-border transition-colors group min-w-[120px]",
                  isActive ? "bg-[#1e1f22] text-foreground" : "text-muted-foreground hover:bg-[#1e1f22]/50"
                )}
              >
                {conv.type === 'channel' ? <Hash size={14} className="opacity-60" /> : <Files size={14} className="opacity-60" />}
                <span className="truncate max-w-[100px]">{conv.name}.java</span>
                <X 
                  size={14} 
                  className="ml-auto opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 rounded-sm p-0.5" 
                  onClick={(e) => closeTab(tabId, e)}
                />
                {isActive && <div className="active-tab-indicator" />}
              </div>
            );
          })}
        </div>

        {/* Top Header Breadcrumbs */}
        <header className="flex h-8 items-center px-6 bg-[#1e1f22] border-b border-border/50 text-[11px] font-code text-muted-foreground">
          <span className="hover:text-foreground cursor-pointer">src</span>
          <ChevronRight size={12} className="mx-1" />
          <span className="hover:text-foreground cursor-pointer">chat</span>
          <ChevronRight size={12} className="mx-1" />
          <span className="text-foreground">{activeConv?.name}.java</span>
          <div className="ml-auto flex items-center gap-4">
            <span className="flex items-center gap-1"><Circle size={8} className="text-yellow-500 fill-current" /> 5</span>
            <span className="flex items-center gap-1"><Circle size={8} className="text-primary fill-current" /> 3</span>
            <span className="flex items-center gap-1"><Circle size={8} className="text-green-500 fill-current" /> 10</span>
          </div>
        </header>

        {/* Message Feed */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar bg-[#1e1f22]"
        >
          {messages.map((msg, idx) => {
            const isMe = msg.role === 'user';
            return (
              <div key={msg.id} className="flex items-start gap-4 font-code text-[13px]">
                <div className="w-10 text-right text-muted-foreground/30 select-none">
                  {idx + 1}
                </div>
                <div className="flex-1 group">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("font-bold", isMe ? "text-purple-400" : "text-primary")}>
                      {isMe ? "@You" : `@${msg.senderName.replace(/\s/g, '')}`}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">{msg.timestamp}</span>
                  </div>
                  <div className="pl-4 border-l-2 border-transparent group-hover:border-border/50 transition-colors">
                    <p className="leading-relaxed text-[#bcbec4] whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          })}
          
          {isTyping && (
            <div className="flex items-center gap-4 font-code text-[13px] animate-pulse">
              <div className="w-10 text-right text-muted-foreground/30 select-none">*</div>
              <span className="text-muted-foreground italic opacity-50">Remote terminal is typing...</span>
            </div>
          )}
        </div>

        {/* AI Suggestions Bar */}
        {(aiSuggestions || isLoadingSuggestions) && (
          <div className="px-14 pb-4 bg-[#1e1f22]">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2 font-code uppercase tracking-wider">
              <Sparkles size={12} className="text-primary animate-glow" />
              IntelliSense Suggestions
            </div>
            <div className="flex flex-wrap gap-2">
              {isLoadingSuggestions ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-6 w-24 rounded-sm bg-[#2b2d30] animate-pulse" />
                ))
              ) : (
                <>
                  {aiSuggestions?.suggestedReplies.map((reply, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(reply)}
                      className="px-2 py-1 rounded-sm bg-[#2b2d30] border border-border text-[11px] font-code text-muted-foreground hover:text-foreground hover:border-primary transition-all flex items-center gap-1.5"
                    >
                      <Plus size={10} />
                      {reply}
                    </button>
                  ))}
                  {aiSuggestions?.suggestedCommands.map((cmd, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(cmd)}
                      className="px-2 py-1 rounded-sm bg-[#2b2d30] border border-border text-[11px] font-code text-primary/80 hover:text-primary transition-all flex items-center gap-1.5"
                    >
                      <Terminal size={10} />
                      {cmd}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <footer className="p-4 bg-[#1e1f22] border-t border-border">
          <div className="flex items-center gap-2 bg-[#2b2d30] border border-border p-1 rounded-sm focus-within:ring-1 focus-within:ring-primary/50 transition-all">
            <Input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Write to ${activeConv?.name}...`} 
              className="flex-1 bg-transparent border-none focus-visible:ring-0 text-[13px] font-code h-9 placeholder:text-muted-foreground/30"
            />
            <Button 
              onClick={() => handleSendMessage()}
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 transition-colors",
                inputValue.trim() ? "text-primary" : "text-muted-foreground/30"
              )}
              disabled={!inputValue.trim()}
            >
              <Send size={16} />
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between font-code text-[9px] text-muted-foreground/40 uppercase">
            <div className="flex gap-4">
              <span>UTF-8</span>
              <span>Line 42, Col 12</span>
              <span>Spaces: 2</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
              <span>Synced</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}