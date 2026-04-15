"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  Check,
  RotateCcw,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { SettingsDialog } from '@/components/SettingsDialog';
import { graphqlRequest } from '@/lib/graphql-client';
import { clearUserSession } from '@/app/login/actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  senderName: string;
  avatar?: string;
};

type ConversationItem = {
  id: string;
  name: string;
  date: string;
};

type ModelOption = {
  id: string;
  name: string;
  provider?: string;
  description?: string;
};

export default function ChatPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [msgCopiedId, setMsgCopiedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [modelsError, setModelsError] = useState<string>('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getNowConversationGroup = (): string => 'Today';

  const generateUniqueChatId = (existingIds: Set<string>): string => {
    let id = '';

    do {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        id = `chat_${crypto.randomUUID()}`;
      } else {
        id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      }
    } while (existingIds.has(id));

    return id;
  };

  const handleNewChat = () => {
    setConversations((prev) => {
      const existingIds = new Set(prev.map((conv) => conv.id));
      const newChatId = generateUniqueChatId(existingIds);
      const newConversation: ConversationItem = {
        id: newChatId,
        name: 'New Chat',
        date: getNowConversationGroup(),
      };

      setActiveConvId(newChatId);
      setMessages([]);

      return [newConversation, ...prev];
    });
  };

  useEffect(() => {
    if (isMobile !== undefined) {
      const savedState = localStorage.getItem('nexus_sidebar_open');
      if (savedState !== null && !isMobile) {
        setSidebarOpen(savedState === 'true');
      } else {
        setSidebarOpen(!isMobile);
      }
    }
  }, [isMobile]);

  useEffect(() => {
    async function fetchModels() {
      try {
        setModelsError('');
        const response = await fetch('/api/models', { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok || !data?.success || !Array.isArray(data.models)) {
          setModelsError('Could not load models');
          return;
        }

        const availableModels: ModelOption[] = data.models
          .filter((model: any) => model?.id && model?.name)
          .map((model: any) => ({
            id: String(model.id),
            name: String(model.name),
            provider: model.provider ? String(model.provider) : undefined,
            description: model.description ? String(model.description) : undefined,
          }));

        setModels(availableModels);

        const savedModelId = localStorage.getItem('nexus_selected_model_id');
        if (savedModelId && availableModels.some((model) => model.id === savedModelId)) {
          setSelectedModelId(savedModelId);
          return;
        }

        if (availableModels.length > 0) {
          const defaultModelId = availableModels[0].id;
          setSelectedModelId(defaultModelId);
          localStorage.setItem('nexus_selected_model_id', defaultModelId);
        } else {
          setModelsError('No models available');
        }
      } catch (error) {
        console.error('[Chat] Failed to fetch models:', error);
        setModelsError('Could not load models');
      }
    }

    fetchModels();
  }, []);

  const toggleSidebar = (open: boolean) => {
    setSidebarOpen(open);
    if (!isMobile) {
      localStorage.setItem('nexus_sidebar_open', String(open));
    }
  };

  // Fetch user profile from session
  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const result = await graphqlRequest<{
          profile: {
            success: boolean;
            data?: {
              uid?: string;
              displayName?: string;
              email?: string;
              photoURL?: string;
              username?: string;
              role?: string;
              userTag?: { name?: string; color?: string; emoji?: string };
            };
          };
        }>(`
          query ChatProfile {
            profile {
              success
              data {
                uid
                displayName
                email
                photoURL
                username
                role
                userTag {
                  name
                  color
                  emoji
                }
              }
            }
          }
        `);

        const data = result.profile;
        if (data.success && data.data) {
          const profileData = {
            userId: data.data.uid,
            displayName: data.data.displayName,
            email: data.data.email,
            photoURL: data.data.photoURL,
            username: data.data.username,
            role: data.data.role,
            userTag: data.data.userTag || {
              name: 'User',
              color: '#19c37d',
              emoji: '👤',
            },
          };
          setUserData(profileData);
          console.log('[Chat] User profile loaded from session:', profileData);
          return;
        } else {
          console.log('[Chat] Failed to fetch profile. Clearing session and redirecting to login.');
          try {
            await clearUserSession();
          } catch (clearError) {
            console.error('[Chat] Failed to clear session after invalid profile check:', clearError);
          }
          router.replace('/login');
          return;
        }
      } catch (error) {
        console.error('[Chat] Error fetching profile:', error);
        router.replace('/login');
      }
    }

    fetchUserProfile();
  }, [activeConvId, router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleSendMessage = async (customContent?: string) => {
    const content = customContent || inputValue;
    if (!content.trim()) return;

    const isLocalModel = selectedModelId.startsWith('local:');
    const localModelName = isLocalModel ? selectedModelId.replace(/^local:/, '') : '';
    const modelPath = isLocalModel ? `models/${localModelName}` : null;

    if (!customContent) {
      const newMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        senderName: userData?.displayName || 'You',
        content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, newMessage]);
      setInputValue('');
    }

    if (!selectedModelId) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          senderName: 'Nexus AI',
          content: 'Please choose a model first.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      return;
    }

    if (!isLocalModel) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          senderName: 'Nexus AI',
          content: 'This model is remote-only in the current setup. Choose a local GGUF model to run with node-llama-cpp.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      return;
    }

    setIsTyping(true);

    const assistantId = (Date.now() + 1).toString();
    let assistantText = '';
    let assistantCreated = false;

    const appendAssistantChunk = (chunk: string) => {
      if (!chunk) return;
      assistantText += chunk;

      if (!assistantCreated) {
        assistantCreated = true;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            senderName: 'Nexus AI',
            content: assistantText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            avatar: 'https://picsum.photos/seed/ai/100/100',
          },
        ]);
        return;
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: assistantText,
              }
            : message
        )
      );
    };

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: content,
          modelPath,
          maxTokens: 512,
          temperature: 0.7,
          topP: 0.9,
          contextSize: 4096,
          batchSize: 512,
        }),
      });

      if (!response.ok || !response.body) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error || 'Failed to start local model stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventChunk of events) {
          const lines = eventChunk.split('\n');
          const eventType = lines.find((line) => line.startsWith('event:'))?.replace('event:', '').trim();
          const dataLine = lines.find((line) => line.startsWith('data:'))?.replace('data:', '').trim();
          if (!dataLine) continue;

          let payload: any;
          try {
            payload = JSON.parse(dataLine);
          } catch {
            continue;
          }

          if (eventType === 'chunk') {
            appendAssistantChunk(String(payload?.chunk?.text || ''));
          }

          if (eventType === 'done' && !assistantCreated) {
            const responseItems = Array.isArray(payload?.response) ? payload.response : [];
            const fallbackText = responseItems
              .map((item: any) => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object' && 'text' in item) return String(item.text || '');
                return '';
              })
              .join('');
            appendAssistantChunk(fallbackText || 'Done.');
          }

          if (eventType === 'error') {
            throw new Error(String(payload?.error || 'Local model stream failed'));
          }
        }
      }
    } catch (error: any) {
      const message = String(error?.message || 'Failed to generate response');
      if (!assistantCreated) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            senderName: 'Nexus AI',
            content: `Error: ${message}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            avatar: 'https://picsum.photos/seed/ai/100/100',
          },
        ]);
      } else {
        appendAssistantChunk(`\n\nError: ${message}`);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleRegenerate = () => {
    if (messages.length === 0 || isTyping) return;
    
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'assistant') {
      // Remove last assistant message
      setMessages(prev => prev.slice(0, -1));
      // Trigger new response
      handleSendMessage(messages[messages.length - 2]?.content || "Please regenerate that.");
    }
  };

  const copyToClipboard = (text: string, id: string, isFullMsg = false) => {
    navigator.clipboard.writeText(text);
    if (isFullMsg) {
      setMsgCopiedId(id);
      setTimeout(() => setMsgCopiedId(null), 2000);
    } else {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const userDisplayName = userData?.displayName || "Developer";
  const userPhoto = userData?.photoURL || "";
  const userTag = userData?.userTag || { name: "User", color: "gray" };
  const selectedModel = models.find((model) => model.id === selectedModelId);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-body dark">
      
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 animate-in fade-in duration-200"
          onClick={() => toggleSidebar(false)}
        />
      )}

      <aside className={cn(
        "bg-[#0d0d0d] border border-white/10 transition-all duration-300 flex flex-col shrink-0 z-50",
        "mt-[10px] mb-[10px] ml-[10px] rounded-2xl overflow-hidden",
        isMobile ? "fixed inset-y-0 left-0" : "relative",
        sidebarOpen ? "w-72" : "w-0 !m-0 overflow-hidden border-none"
      )}>
        <div className="p-4 flex items-center justify-between">
          <Button 
            variant="ghost" 
            className="flex-1 mr-2 justify-start gap-3 hover:bg-white/5 text-sm font-medium h-11 px-3 rounded-lg"
            onClick={handleNewChat}
          >
            <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <Plus size={14} className="text-white" />
            </div>
            New Chat
          </Button>
          <Button variant="ghost" size="icon" className="text-white/50 hover:text-white" onClick={() => toggleSidebar(false)}>
            <PanelLeftClose size={18} />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-6 py-2">
            {['Today', 'Yesterday', 'Previous 7 Days'].map(dateGroup => {
              const groupConvs = conversations.filter(c => c.date === dateGroup);
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
          <div 
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
          >
            <Avatar className="h-8 w-8 rounded-full border border-white/10">
              <AvatarImage src={userPhoto} />
              <AvatarFallback><User size={16} /></AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-white/90">{userDisplayName}</p>
              {userData?.role && (
                <p className="text-[11px] text-white/50 truncate capitalize">{userData.role}</p>
              )}
            </div>
            <Settings size={16} className="text-white/30 group-hover:text-white transition-colors" />
          </div>
        </div>
      </aside>

      <main className={cn(
        "flex-1 flex flex-col min-w-0 bg-[#0d0d0d] relative overflow-hidden transition-all duration-300",
        sidebarOpen ? "border border-white/10 m-[10px] rounded-2xl" : "m-0 border-none rounded-none"
      )}>
        
        <header className="h-14 flex items-center px-4 border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3 w-full min-w-0">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" className="text-white/50 hover:text-white" onClick={() => toggleSidebar(true)}>
                <Menu size={20} />
              </Button>
            )}
            <div className="flex items-center gap-3 min-w-0 w-full">
              <span className="text-sm font-semibold text-white/90 truncate max-w-[150px] sm:max-w-none">
                {conversations.find(c => c.id === activeConvId)?.name || "New Chat"}
              </span>
              <div className="w-[170px] sm:w-[240px] shrink-0 ml-auto">
                <Select
                  value={selectedModelId}
                  onValueChange={(value) => {
                    setSelectedModelId(value);
                    localStorage.setItem('nexus_selected_model_id', value);
                  }}
                >
                  <SelectTrigger className="h-9 w-full rounded-full border border-white/10 bg-[#1f1f1f] px-3 text-xs sm:text-sm text-white shadow-none transition-colors hover:bg-white/5 focus:ring-0 focus:ring-offset-0 data-[state=open]:bg-white/5">
                    <SelectValue placeholder="Choose model" />
                    
                  </SelectTrigger>
                  <SelectContent align="end" className="min-w-[220px] rounded-2xl border border-white/10 bg-[#111111] text-white shadow-2xl">
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.provider ? `${model.name} (${model.provider})` : model.name}
                      </SelectItem>
                    ))}
                    {models.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-white/60">{modelsError || 'Loading models...'}</div>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
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
              messages.map((msg, index) => {
                const isAI = msg.role === 'assistant';
                const isLast = index === messages.length - 1;

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
                              className="text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-white inline-flex items-center align-middle gap-1"
                              style={{ background: userTag.color }}
                            >
                              {userTag.emoji && <span>{userTag.emoji}</span>}
                              {userTag.name}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm sm:text-[15px] leading-6 sm:leading-7 text-white/90 whitespace-pre-wrap break-words markdown-content">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
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
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 sm:h-8 sm:w-8 text-white/30 hover:text-white"
                            onClick={() => copyToClipboard(msg.content, msg.id, true)}
                          >
                            {msgCopiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                          </Button>
                          {isAI && isLast && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 sm:h-8 sm:w-8 text-white/30 hover:text-white"
                              onClick={handleRegenerate}
                              disabled={isTyping}
                            >
                              <RotateCcw size={13} className={cn(isTyping && "animate-spin")} />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-white/30 hover:text-white">
                            <Share2 size={13} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 sm:h-8 sm:w-8 text-white/30 hover:text-destructive"
                            onClick={() => setMessages(prev => prev.filter(m => m.id !== msg.id))}
                          >
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

        <div className="p-4 sm:pb-8 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d] to-transparent z-20">
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
                  disabled={!inputValue.trim() || isTyping}
                  className={cn(
                    "h-8 w-8 rounded-lg p-0 transition-all",
                    inputValue.trim() && !isTyping
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

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
