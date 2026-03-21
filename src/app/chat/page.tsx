"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Settings, 
  Plus, 
  MessageSquare, 
  MoreVertical,
  Share2,
  Trash2,
  Paperclip,
  Mic,
  Send,
  PanelLeftClose,
  PanelLeftOpen,
  User
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
  { id: '1', name: 'Wikipedia to Markdown', date: 'Today' },
  { id: '2', name: 'Android CI with Discord', date: 'Today' },
  { id: '3', name: 'Docker Project Ideas', date: 'Yesterday' },
  { id: '4', name: 'Derivative Function Rules', date: 'Yesterday' },
  { id: '5', name: 'AI Instagram Support', date: 'Previous 7 Days' },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  '2': [
    { id: 'm1', role: 'assistant', senderName: 'Nexus AI', content: "Hello! I've analyzed your current CI/CD pipeline. How can I help you optimize the Discord webhook triggers today?", timestamp: '10:24 AM', avatar: 'https://picsum.photos/seed/ai/100/100' },
    { id: 'm2', role: 'user', senderName: 'You', content: "Let's review the triggers. We need more granular build data in the notifications.", timestamp: '10:25 AM' },
  ],
};

export default function ChatPage() {
  const [activeConvId, setActiveConvId] = useState<string>('2');
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES['2'] || []);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('nexus_user_data');
    if (savedUser) {
      try {
        setUserData(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to parse user data", e);
      }
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    setMessages(MOCK_MESSAGES[activeConvId] || []);
  }, [activeConvId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const content = inputValue;
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      senderName: userData?.displayName || 'You',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setIsTyping(true);

    // Mock AI Response
    setTimeout(() => {
      setIsTyping(false);
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        senderName: 'Nexus AI',
        content: "I've processed that request. The webhook payload has been updated to include granular telemetry for build status, duration, and error logs.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatar: 'https://picsum.photos/seed/ai/100/100'
      };
      setMessages(prev => [...prev, reply]);
    }, 1500);
  };

  const userDisplayName = userData?.displayName || "Developer";
  const userPhoto = userData?.photoURL || "";
  const userTag = userData?.userTag || { name: "User", color: "gray" };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-body dark">
      
      {/* Sidebar */}
      <aside className={cn(
        "bg-black/95 border-r border-white/5 transition-all duration-300 flex flex-col shrink-0",
        sidebarOpen ? "w-72" : "w-0 overflow-hidden border-none"
      )}>
        <div className="p-4 flex items-center justify-between">
          <Button 
            variant="outline" 
            className="flex-1 mr-2 justify-start gap-2 border-white/10 hover:bg-white/5 text-xs font-medium h-10"
            onClick={() => {}}
          >
            <Plus size={16} />
            New Chat
          </Button>
          <Button variant="ghost" size="icon" className="text-white/50 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <PanelLeftClose size={18} />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-6 py-2">
            {['Today', 'Yesterday', 'Previous 7 Days'].map(dateGroup => {
              const groupConvs = INITIAL_CONVERSATIONS.filter(c => c.date === dateGroup);
              if (groupConvs.length === 0) return null;
              
              return (
                <div key={dateGroup} className="space-y-1">
                  <h3 className="px-2 text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2">
                    {dateGroup}
                  </h3>
                  {groupConvs.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => setActiveConvId(conv.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left group",
                        activeConvId === conv.id 
                          ? "bg-white/10 text-white" 
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <MessageSquare size={16} className="shrink-0 opacity-50" />
                      <span className="truncate flex-1">{conv.name}</span>
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                        <MoreVertical size={14} className="text-white/30" />
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        {/* Profile Footer */}
        <div className="p-4 border-t border-white/5 mt-auto">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
            <Avatar className="h-9 w-9 border border-white/10">
              <AvatarImage src={userPhoto} />
              <AvatarFallback><User size={18} /></AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate leading-none mb-1">{userDisplayName}</p>
              <div 
                className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-white inline-flex items-center"
                style={{ background: userTag.color }}
              >
                {userTag.name}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-white/30">
              <Settings size={16} />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a] relative">
        
        {/* Mobile / Closed Sidebar Toggle */}
        {!sidebarOpen && (
          <div className="absolute left-4 top-4 z-10">
            <Button variant="ghost" size="icon" className="text-white/50 hover:text-white" onClick={() => setSidebarOpen(true)}>
              <PanelLeftOpen size={20} />
            </Button>
          </div>
        )}

        {/* Message Feed */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto custom-scrollbar"
        >
          <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
            {messages.length === 0 ? (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center opacity-40">
                <div className="h-16 w-16 rounded-3xl bg-white/5 flex items-center justify-center mb-6">
                  <MessageSquare size={32} />
                </div>
                <h1 className="text-2xl font-bold mb-2">How can I help you?</h1>
                <p className="text-sm max-w-sm">Start a conversation with Nexus AI to build, optimize, or research your next project.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isAI = msg.role === 'assistant';
                return (
                  <div key={msg.id} className="animate-fade-in group">
                    <div className="flex items-start gap-4">
                      <Avatar className={cn(
                        "h-8 w-8 rounded-lg shrink-0",
                        isAI ? "bg-primary border border-primary/20" : "bg-white/10 border border-white/10"
                      )}>
                        <AvatarImage src={isAI ? msg.avatar : userPhoto} />
                        <AvatarFallback>{isAI ? 'NX' : 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-[13px] font-bold text-white/90 mb-1">{isAI ? 'Nexus AI' : userDisplayName}</p>
                        <div className="text-[15px] leading-relaxed text-white/80 whitespace-pre-wrap">
                          {msg.content}
                        </div>
                        <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-white/30 hover:text-white">
                            <Share2 size={12} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-white/30 hover:text-destructive">
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            {isTyping && (
              <div className="flex items-start gap-4 animate-pulse">
                <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 shrink-0" />
                <div className="flex-1 pt-2 space-y-2">
                  <div className="h-3 w-24 bg-white/10 rounded" />
                  <div className="h-3 w-full bg-white/5 rounded" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 pb-8">
          <div className="max-w-3xl mx-auto relative group">
            <div className="relative flex flex-col bg-[#1a1a1a] border border-white/10 rounded-[26px] overflow-hidden focus-within:border-white/20 transition-all shadow-2xl">
              
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
                className="w-full bg-transparent border-none focus:ring-0 text-[15px] min-h-[52px] py-3.5 px-12 resize-none placeholder:text-white/20 focus:outline-none scrollbar-hide"
              />

              <div className="absolute left-3 top-3">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white/30 hover:text-white hover:bg-white/5">
                  <Plus size={18} />
                </Button>
              </div>
              
              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-1 ml-9">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/20 hover:text-white">
                    <Paperclip size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/20 hover:text-white">
                    <Mic size={16} />
                  </Button>
                </div>
                
                <Button 
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim()}
                  className={cn(
                    "h-8 w-8 rounded-full p-0 transition-all",
                    inputValue.trim() 
                      ? "bg-white text-black hover:bg-white/90" 
                      : "bg-white/5 text-white/20"
                  )}
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
            <p className="mt-2.5 text-[11px] text-center text-white/20 font-medium tracking-tight">
              Nexus AI can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
