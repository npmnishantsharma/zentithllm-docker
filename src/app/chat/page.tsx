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
  ChevronRight
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
  const [activeConv, setActiveConv] = useState<string>('3');
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

    // Simulate response
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

  const handleSuggestionClick = (text: string) => {
    handleSendMessage(text);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a] text-foreground">
      {/* Sidebar */}
      <aside className="flex w-72 flex-col border-r border-border bg-[#111827]">
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <Terminal size={18} />
            </div>
            <span className="font-bold tracking-tight font-headline">DevCom</span>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white h-8 w-8">
            <Settings size={18} />
          </Button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              placeholder="Search conversations..." 
              className="pl-10 bg-slate-950/30 border-border h-9 text-sm focus:ring-primary/40"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 px-2">
          <div className="space-y-4">
            <div>
              <h3 className="px-2 mb-2 text-[11px] font-code uppercase tracking-wider text-muted-foreground opacity-70">Channels</h3>
              <div className="space-y-0.5">
                {INITIAL_CONVERSATIONS.filter(c => c.type === 'channel').map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConv(conv.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors group",
                      activeConv === conv.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-slate-800/50 hover:text-foreground"
                    )}
                  >
                    <Hash size={16} className={activeConv === conv.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"} />
                    <span className="flex-1 text-left truncate">{conv.name}</span>
                    {conv.unreadCount > 0 && (
                      <Badge className="h-4 min-w-[1rem] px-1 bg-primary text-[10px] font-bold border-none">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="px-2 mb-2 text-[11px] font-code uppercase tracking-wider text-muted-foreground opacity-70">Direct Messages</h3>
              <div className="space-y-0.5">
                {INITIAL_CONVERSATIONS.filter(c => c.type === 'direct').map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConv(conv.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors group",
                      activeConv === conv.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-slate-800/50 hover:text-foreground"
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-7 w-7 ring-1 ring-border">
                        <AvatarImage src={`https://picsum.photos/seed/${conv.id}/100/100`} />
                        <AvatarFallback>{conv.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#111827]",
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

        <div className="p-4 border-t border-border bg-[#0a0f1b]/50">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarImage src="https://picsum.photos/seed/me/100/100" />
              <AvatarFallback>ME</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">DevMaster</p>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] font-code text-muted-foreground">online</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors">
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex flex-1 flex-col bg-[#0f172a]">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-[#111827] px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Hash size={20} className="text-muted-foreground" />
              <h2 className="text-lg font-semibold tracking-tight">frontend-team</h2>
            </div>
            <Separator orientation="vertical" className="h-6 mx-2" />
            <span className="text-xs text-muted-foreground font-code opacity-70 truncate max-w-[300px]">
              Discussion about frontend architecture and UI components
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
              <Plus size={18} />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
              <AtSign size={18} />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
              <MoreVertical size={18} />
            </Button>
          </div>
        </header>

        {/* Message Feed */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
        >
          {messages.map((msg, idx) => {
            const isMe = msg.role === 'user';
            const showAvatar = idx === 0 || messages[idx-1].senderName !== msg.senderName;

            return (
              <div key={msg.id} className={cn(
                "flex items-start gap-4 animate-fade-in",
                isMe ? "flex-row-reverse" : "flex-row"
              )}>
                {!isMe && (
                  <div className="w-8 shrink-0">
                    {showAvatar ? (
                      <Avatar className="h-8 w-8 border border-white/5">
                        <AvatarImage src={msg.avatar} />
                        <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                      </Avatar>
                    ) : null}
                  </div>
                )}
                <div className={cn(
                  "flex flex-col gap-1 max-w-[70%]",
                  isMe ? "items-end" : "items-start"
                )}>
                  {showAvatar && (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs font-bold font-headline">{msg.senderName}</span>
                      <span className="text-[10px] text-muted-foreground font-code opacity-60">{msg.timestamp}</span>
                    </div>
                  )}
                  <div className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                    isMe 
                      ? "bg-primary text-primary-foreground rounded-tr-none" 
                      : "bg-[#1f2937] text-foreground border border-border rounded-tl-none"
                  )}>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          })}
          
          {isTyping && (
            <div className="flex items-center gap-2 text-muted-foreground animate-pulse px-12">
              <div className="flex gap-1">
                <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                <div className="h-1 w-1 rounded-full bg-muted-foreground" />
              </div>
              <span className="text-xs font-code italic">Alex is typing...</span>
            </div>
          )}
        </div>

        {/* AI Suggestions Bar */}
        {(aiSuggestions || isLoadingSuggestions) && (
          <div className="px-6 pb-2">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2 font-code uppercase tracking-wider">
              <Sparkles size={12} className="text-primary animate-glow" />
              AI Assistant Suggestions
            </div>
            <div className="flex flex-wrap gap-2">
              {isLoadingSuggestions ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-8 w-24 rounded-full bg-slate-800/50 animate-pulse border border-white/5" />
                ))
              ) : (
                <>
                  {aiSuggestions?.suggestedReplies.map((reply, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(reply)}
                      className="px-3 py-1.5 rounded-full bg-[#1e293b]/50 border border-border text-xs text-muted-foreground hover:text-white hover:border-primary/50 transition-all flex items-center gap-1.5 group"
                    >
                      <Plus size={10} className="group-hover:text-primary" />
                      {reply}
                    </button>
                  ))}
                  {aiSuggestions?.suggestedCommands.map((cmd, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(cmd)}
                      className="px-3 py-1.5 rounded-full bg-[#1e293b]/50 border border-border text-xs font-code text-primary/80 hover:text-primary hover:border-primary/50 transition-all flex items-center gap-1.5"
                    >
                      <Terminal size={10} />
                      {cmd}
                    </button>
                  ))}
                  {aiSuggestions?.suggestedCodeSnippets.map((code, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(code)}
                      className="px-3 py-1.5 rounded-full bg-[#1e293b]/50 border border-border text-xs font-code text-purple-400/80 hover:text-purple-400 hover:border-purple-400/50 transition-all flex items-center gap-1.5"
                    >
                      <Code size={10} />
                      Snippet
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <footer className="p-6 bg-transparent">
          <div className="relative group">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/10 to-purple-500/10 blur-xl group-focus-within:opacity-100 opacity-0 transition-opacity pointer-events-none" />
            <div className="relative flex items-center gap-2 bg-[#1f2937]/80 backdrop-blur-xl border border-border rounded-2xl p-2 shadow-2xl focus-within:border-primary/50 transition-all">
              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-white shrink-0">
                <Plus size={20} />
              </Button>
              <Input 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Message #frontend-team..." 
                className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm py-6 h-10 placeholder:text-muted-foreground/50"
              />
              <div className="flex items-center gap-1 pr-1">
                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-white hidden sm:flex">
                  <AtSign size={20} />
                </Button>
                <Button 
                  onClick={() => handleSendMessage()}
                  className={cn(
                    "h-10 w-10 rounded-xl transition-all",
                    inputValue.trim() ? "bg-primary text-white scale-100 shadow-lg shadow-primary/20" : "bg-slate-800 text-muted-foreground opacity-50 cursor-not-allowed"
                  )}
                  disabled={!inputValue.trim()}
                >
                  <Send size={18} />
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-2 px-2 flex items-center justify-between">
            <div className="flex gap-4">
              <span className="text-[10px] font-code text-muted-foreground uppercase tracking-tight">Shift + Enter for new line</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Circle size={8} className="text-green-500 fill-current" />
              <span className="text-[10px] font-code text-muted-foreground uppercase tracking-tight">Connected</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}