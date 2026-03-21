"use client";

import { useState, useEffect, useRef } from 'react';
import { 
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
  Settings,
  User,
  Menu,
  X,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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
    { id: 'm1', role: 'assistant', senderName: 'Nexus AI', content: "Hello! I've analyzed your current CI/CD pipeline. How can I help you optimize the Discord webhook triggers today? Here's an example of a webhook structure:\n\n```json\n{\n  \"content\": \"Build Success!\",\n  \"embeds\": [{\n    \"title\": \"Android App\",\n    \"description\": \"Build #45 passed gracefully.\",\n    \"color\": 3066993\n  }]\n}\n```", timestamp: '10:24 AM', avatar: 'https://picsum.photos/seed/ai/100/100' },
    { id: 'm2', role: 'user', senderName: 'You', content: "Let's review the triggers. We need more granular build data in the notifications.", timestamp: '10:25 AM' },
  ],
};

export default function ChatPage() {
  const isMobile = useIsMobile();
  const [activeConvId, setActiveConvId] = useState<string>('2');
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES['2'] || []);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isMobile !== undefined) {
      setSidebarOpen(!isMobile);
    }
  }, [isMobile]);

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
    if (isMobile) setSidebarOpen(false);
  }, [activeConvId, isMobile]);

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

    setTimeout(() => {
      setIsTyping(false);
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        senderName: 'Nexus AI',
        content: "I've processed that request. The webhook payload has been updated to include granular telemetry for build status, duration, and error logs.\n\n### Updated Configuration\n\n```yaml\nwebhook:\n  url: \"${DISCORD_WEBHOOK_URL}\"\n  triggers:\n    - build_status\n    - duration_metrics\n    - error_logs\n```",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avatar: 'https://picsum.photos/seed/ai/100/100'
      };
      setMessages(prev => [...prev, reply]);
    }, 1500);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const userDisplayName = userData?.displayName || "Developer";
  const userPhoto = userData?.photoURL || "";
  const userTag = userData?.userTag || { name: "User", color: "gray" };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-body dark">
      
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "bg-[#0d0d0d] border-r border-white/5 transition-all duration-300 flex flex-col shrink-0 z-50",
        isMobile ? "fixed inset-y-0 left-0" : "relative",
        sidebarOpen ? "w-72" : "w-0 overflow-hidden border-none"
      )}>
        <div className="p-4 flex items-center justify-between">
          <Button 
            variant="ghost" 
            className="flex-1 mr-2 justify-start gap-3 hover:bg-white/5 text-sm font-medium h-11 px-3 rounded-lg"
            onClick={() => {}}
          >
            <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <Plus size={14} className="text-white" />
            </div>
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
                  <h3 className="px-3 text-[11px] font-bold text-white/30 uppercase tracking-widest mb-2">
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
        
        <div className="p-4 border-t border-white/5 mt-auto">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
            <Avatar className="h-8 w-8 rounded-full border border-white/10">
              <AvatarImage src={userPhoto} />
              <AvatarFallback><User size={16} /></AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-white/90">{userDisplayName}</p>
            </div>
            <Settings size={16} className="text-white/30 group-hover:text-white transition-colors" />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        
        <header className="h-14 flex items-center px-4 border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" className="text-white/50 hover:text-white" onClick={() => setSidebarOpen(true)}>
                <Menu size={20} />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white/90 truncate max-w-[150px] sm:max-w-none">
                {INITIAL_CONVERSATIONS.find(c => c.id === activeConvId)?.name || "New Chat"}
              </span>
            </div>
          </div>
        </header>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto custom-scrollbar"
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 sm:space-y-10">
            {messages.length === 0 ? (
              <div className="h-[60vh] flex flex-col items-center justify-center text-center px-4">
                <div className="h-12 w-12 rounded-full border border-white/10 flex items-center justify-center mb-6">
                   <MessageSquare size={24} className="text-white/20" />
                </div>
                <h1 className="text-xl sm:text-2xl font-semibold text-white/90 mb-2">How can I help you today?</h1>
              </div>
            ) : (
              messages.map((msg) => {
                const isAI = msg.role === 'assistant';
                return (
                  <div key={msg.id} className="animate-fade-in group">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <Avatar className={cn(
                        "h-7 w-7 sm:h-8 sm:w-8 rounded-full shrink-0",
                        isAI ? "bg-[#19c37d] text-white" : "bg-white/10"
                      )}>
                        <AvatarImage src={isAI ? msg.avatar : userPhoto} />
                        <AvatarFallback>{isAI ? 'AI' : 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-xs sm:text-sm font-bold text-white">
                            {isAI ? 'Nexus AI' : userDisplayName}
                          </p>
                          {msg.role === 'user' && userTag && (
                            <span 
                              className="text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-white inline-flex items-center align-middle"
                              style={{ background: userTag.color }}
                            >
                              {userTag.name}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm sm:text-[15px] leading-6 sm:leading-7 text-white/90 whitespace-pre-wrap break-words markdown-content">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                  <div className="relative group/code my-4">
                                    <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] rounded-t-lg border-x border-t border-white/5">
                                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{match[1]}</span>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 text-white/40 hover:text-white"
                                        onClick={() => copyToClipboard(String(children).replace(/\n$/, ''), msg.id)}
                                      >
                                        {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                                      </Button>
                                    </div>
                                    <SyntaxHighlighter
                                      style={vscDarkPlus}
                                      language={match[1]}
                                      PreTag="div"
                                      className="!m-0 !rounded-b-lg !bg-[#0d0d0d] !border-x !border-b !border-white/5 !p-4 custom-scrollbar"
                                      {...props}
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                  </div>
                                ) : (
                                  <code className={cn("bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono text-white", className)} {...props}>
                                    {children}
                                  </code>
                                );
                              },
                              p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>,
                              h1: ({ children }) => <h1 className="text-xl font-bold mb-4 mt-6">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-bold mb-3 mt-5">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-md font-bold mb-2 mt-4">{children}</h3>,
                              blockquote: ({ children }) => <blockquote className="border-l-4 border-white/10 pl-4 italic my-4">{children}</blockquote>,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>

                        <div className="mt-3 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-white/30 hover:text-white">
                            <Share2 size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-white/30 hover:text-destructive">
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            {isTyping && (
              <div className="flex items-start gap-3 sm:gap-4 animate-pulse">
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-[#19c37d] shrink-0" />
                <div className="flex-1 pt-2 space-y-2">
                  <div className="h-3 w-20 sm:w-24 bg-white/10 rounded" />
                  <div className="h-3 w-full bg-white/5 rounded" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 sm:pb-8 bg-gradient-to-t from-background via-background to-transparent z-20">
          <div className="max-w-3xl mx-auto relative">
            <div className="relative flex flex-col bg-[#2f2f2f] border border-white/5 rounded-2xl overflow-hidden focus-within:border-white/20 transition-all shadow-xl">
              
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
                className="w-full bg-transparent border-none focus:ring-0 text-sm sm:text-[15px] min-h-[52px] py-3.5 px-4 resize-none placeholder:text-white/40 focus:outline-none scrollbar-hide"
              />

              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/5 rounded-lg">
                    <Plus size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/5 rounded-lg">
                    <Paperclip size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/5 rounded-lg hidden sm:flex">
                    <Mic size={16} />
                  </Button>
                </div>
                
                <Button 
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim()}
                  className={cn(
                    "h-8 w-8 rounded-lg p-0 transition-all",
                    inputValue.trim() 
                      ? "bg-white text-black hover:bg-white/90" 
                      : "bg-white/10 text-white/20"
                  )}
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
            <p className="mt-3 text-[10px] sm:text-[11px] text-center text-white/30 font-medium px-4">
              Nexus AI can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}