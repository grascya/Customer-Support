// app/components/LuminoChat.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Bot, Loader2, ThumbsUp, ThumbsDown, AlertCircle, ArrowLeft, UserCheck } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "bot" | "agent" | "system";
  content: string;
  feedback?: 1 | -1 | null;
  isEscalation?: boolean;
  agentName?: string;
};

type ChatScreen = "suggestions" | "chat";

const SUGGESTION_OPTIONS = [
  {
    id: "subscription",
    icon: "💳",
    title: "Check subscription",
    description: "View your plan details and billing info",
    prompt: "Can you tell me about my subscription status and what features are included?"
  },
  {
    id: "devices",
    icon: "🔌",
    title: "Pair new device",
    description: "Connect smart home devices to your hub",
    prompt: "How do I pair a new device with my Lumino hub?"
  },
  {
    id: "specs",
    icon: "⚙️",
    title: "Hardware specs",
    description: "Technical specifications and requirements",
    prompt: "What are the hardware specifications of the Lumino hub?"
  },
  {
    id: "voice",
    icon: "🎤",
    title: "Voice commands",
    description: "Learn about voice control features",
    prompt: "What voice commands can I use with Lumino?"
  },
  {
    id: "sentinel",
    icon: "🛡️",
    title: "Sentinel Plus",
    description: "Advanced security features",
    prompt: "Tell me about Lumino Sentinel Plus features"
  },
  {
    id: "troubleshoot",
    icon: "🔧",
    title: "Troubleshooting",
    description: "Fix common issues",
    prompt: "My Lumino hub is not responding, how can I fix it?"
  },
  {
    id: "setup",
    icon: "🚀",
    title: "Initial setup",
    description: "Get started with your new hub",
    prompt: "How do I set up my Lumino hub for the first time?"
  },
  {
    id: "support",
    icon: "💬",
    title: "Contact support",
    description: "Speak with a human agent",
    prompt: "I need to speak with a human support agent"
  }
];

const POLL_INTERVAL_MS = 4000; // Poll every 4 seconds for agent replies

export default function LuminoChat() {
  const [open, setOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<ChatScreen>("suggestions");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      content: "Hi! I'm Lumino Assistant 🏠\nHow can I help you with your smart home hub today?",
      feedback: null,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const [isResolved, setIsResolved] = useState(false);
  const [agentIsTyping, setAgentIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track the timestamp of last seen agent message to avoid duplicates
  const lastAgentMessageTimestamp = useRef<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open && currentScreen === "chat") {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open, currentScreen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Session management
  function getSessionId() {
    let sessionId = localStorage.getItem('lumino_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      localStorage.setItem('lumino_session_id', sessionId);
    }
    return sessionId;
  }

  // ─── POLLING: Check for new agent messages ───────────────────────────────────
  const pollForAgentReplies = useCallback(async () => {
    try {
      const sessionId = getSessionId();
      const params = new URLSearchParams({ sessionId });
      if (lastAgentMessageTimestamp.current) {
        params.set('after', lastAgentMessageTimestamp.current);
      }

      const res = await fetch(`/api/chat/poll-agent?${params}`);
      if (!res.ok) return;

      const data = await res.json();

      // Mark as resolved
      if (data.isResolved && !isResolved) {
        setIsResolved(true);
        setIsEscalated(false);
        setMessages(prev => [...prev, {
          id: `resolved_${Date.now()}`,
          role: 'system',
          content: '✅ Your support ticket has been resolved. Is there anything else I can help you with?',
        }]);
      }

      // Add new agent messages
      if (data.hasNewMessages && data.messages?.length > 0) {
        setAgentIsTyping(true);

        // Small delay to simulate agent typing
        setTimeout(() => {
          setAgentIsTyping(false);

          const newMessages: Message[] = data.messages.map((msg: any) => ({
            id: msg.id,
            role: 'agent' as const,
            content: msg.content,
            agentName: msg.metadata?.agent_name || 'Support Agent',
            feedback: null,
          }));

          setMessages(prev => {
            // De-duplicate: skip any messages already in state
            const existingIds = new Set(prev.map(m => m.id));
            const toAdd = newMessages.filter(m => !existingIds.has(m.id));
            return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
          });

          // Update the timestamp cursor
          const latest = data.messages[data.messages.length - 1];
          if (latest?.created_at) {
            lastAgentMessageTimestamp.current = latest.created_at;
          }
        }, 800);
      }
    } catch (err) {
      // Silently ignore polling errors (network issues, etc.)
    }
  }, [isResolved]);

  // Start/stop polling when escalated
  useEffect(() => {
    if (isEscalated && !isResolved) {
      // Start polling
      pollIntervalRef.current = setInterval(pollForAgentReplies, POLL_INTERVAL_MS);
      console.log('🔄 Agent reply polling started');
    } else {
      // Stop polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        console.log('⏹️ Agent reply polling stopped');
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isEscalated, isResolved, pollForAgentReplies]);

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion: typeof SUGGESTION_OPTIONS[0]) => {
    setCurrentScreen("chat");
    setInput(suggestion.prompt);
    setTimeout(() => handleSend(suggestion.prompt), 100);
  };

  // Handle sending messages
  const handleSend = async (messageOverride?: string) => {
    const messageToSend = messageOverride || input.trim();
    if (!messageToSend || isLoading) return;

    const userMsg: Message = {
      id: `temp_${Date.now()}`,
      role: "user",
      content: messageToSend,
      feedback: null,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const botMsgId = `temp_${Date.now() + 1}`;
    let hasStartedStreaming = false;
    let realMessageId: string | null = null;

    try {
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          sessionId: getSessionId(),
        }),
      });

      if (!response.ok) throw new Error('Failed to connect');

      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        const data = await response.json();

        // Handle agent-only mode (conversation already escalated)
        if (data.agentHandling) {
          console.log('📌 Agent is handling this conversation');
          setIsLoading(false);
          
          const agentHandlingMsg: Message = {
            id: `agent_handling_${Date.now()}`,
            role: "system",
            content: data.message || "Your message has been sent to our support agent. They'll respond shortly.",
            feedback: null,
          };
          
          setMessages((prev) => [...prev, agentHandlingMsg]);
          return;
        }

        // Handle new escalation
        if (data.escalated) {
          setIsEscalated(true);
          setIsLoading(false);

          setMessages((prev) => [...prev, {
            id: `escalation_${Date.now()}`,
            role: "system",
            content: data.message || "Your conversation has been escalated to a human agent. Someone will assist you shortly.",
            feedback: null,
            isEscalation: true,
          }]);
          return;
        }

        if (data.error) throw new Error(data.error);
      }

      // Streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (!reader) throw new Error('No reader available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (!hasStartedStreaming) {
          hasStartedStreaming = true;
          setIsLoading(false);
          setMessages((prev) => [...prev, {
            id: botMsgId,
            role: "bot",
            content: "",
            feedback: null,
          }]);
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          const cleanedLine = line.replace(/^data: /, '').trim();
          if (cleanedLine === "" || cleanedLine === "[DONE]") continue;

          try {
            const parsed = JSON.parse(cleanedLine);

            if (parsed.type === 'message_id' && parsed.message_id) {
              realMessageId = parsed.message_id;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === botMsgId ? { ...msg, id: realMessageId! } : msg
                )
              );
              continue;
            }

            const contentChunk = parsed.choices?.[0]?.delta?.content || "";
            if (contentChunk) {
              fullContent += contentChunk;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === botMsgId ? { ...msg, content: fullContent } : msg
                )
              );
            }
          } catch (e) { /* Skip partial JSON */ }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setIsLoading(false);
      setMessages((prev) => [...prev, {
        id: `error_${Date.now()}`,
        role: "bot",
        content: "Sorry, I'm having trouble connecting right now. Please try again.",
        feedback: null,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle feedback
  const handleFeedback = async (messageId: string, rating: 1 | -1) => {
    if (messageId.startsWith('temp_') || messageId === 'welcome' ||
      messageId.startsWith('escalation_') || messageId.startsWith('error_') ||
      messageId.startsWith('resolved_')) return;

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, rating }),
      });

      if (response.ok) {
        setMessages((prev) =>
          prev.map((msg) => msg.id === messageId ? { ...msg, feedback: rating } : msg)
        );
      }
    } catch (error) {
      console.error('❌ Error sending feedback:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => { setCurrentScreen("suggestions"); }, 300);
  };

  // Status label in header
  const statusLabel = isResolved
    ? "✅ Resolved"
    : isEscalated
      ? "🟠 Agent responding..."
      : "Powered by AI • 24/7";

  return (
    <>
      {/* Floating Button */}
      <motion.button
        aria-label="Open Lumino Assistant"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 text-white shadow-2xl flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
      >
        <Bot size={26} strokeWidth={2.2} />
        <motion.span
          className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isEscalated && !isResolved ? 'bg-orange-400' : 'bg-emerald-400'}`}
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ repeat: Infinity, duration: 2.4 }}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.92 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="
              fixed z-50 flex flex-col overflow-hidden
              bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl
              border border-gray-200/60 dark:border-gray-700/50 shadow-2xl
              bottom-0 left-0 right-0 top-0 rounded-none
              sm:top-auto sm:bottom-6 sm:left-auto sm:right-6
              sm:h-[min(600px,90vh)] sm:w-[420px] sm:max-w-[calc(100vw-3rem)]
              sm:rounded-3xl
            "
          >
            {/* Header */}
            <div className="px-5 py-3.5 border-b bg-gradient-to-r from-orange-50/70 via-amber-50/50 to-transparent dark:from-gray-900/80 dark:via-gray-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentScreen === "chat" && (
                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => setCurrentScreen("suggestions")}
                    className="p-1.5 rounded-full hover:bg-orange-100/60 dark:hover:bg-gray-800/60 transition-colors"
                    aria-label="Back to suggestions"
                  >
                    <ArrowLeft size={20} />
                  </motion.button>
                )}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md ${isEscalated && !isResolved ? 'bg-orange-500' : 'bg-gradient-to-br from-orange-500 to-amber-600'}`}>
                  {isEscalated && !isResolved ? <UserCheck size={20} /> : <Bot size={20} />}
                </div>
                <div>
                  <h3 className="font-semibold text-base">
                    {isEscalated && !isResolved ? 'Lumino Support' : 'Lumino Assistant'}
                  </h3>
                  <p className="text-xs text-muted-foreground">{statusLabel}</p>
                </div>
              </div>
              <motion.button
                whileHover={{ rotate: 90 }}
                transition={{ duration: 0.4 }}
                onClick={handleClose}
                aria-label="Close chat"
                className="p-1.5 rounded-full hover:bg-orange-100/60 dark:hover:bg-gray-800/60"
              >
                <X size={20} />
              </motion.button>
            </div>

            {/* Escalation Banner */}
            {isEscalated && !isResolved && currentScreen === "chat" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700/30"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      You're connected to a support agent
                    </p>
                    {/* <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                      Their replies will appear here in real time — no need to check your email.
                    </p> */}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Main Content */}
            <AnimatePresence mode="wait">
              {currentScreen === "suggestions" ? (
                /* ── SUGGESTIONS SCREEN ── */
                <motion.div
                  key="suggestions"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex-1 overflow-y-auto p-4"
                >
                  <p className="text-sm text-muted-foreground mb-4 px-1">
                    How can I help you today? Choose a topic or type your question.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {SUGGESTION_OPTIONS.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleSuggestionClick(s)}
                        className="flex flex-col items-start gap-1 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600 hover:bg-orange-50/50 dark:hover:bg-orange-900/20 transition-all text-left group"
                      >
                        <span className="text-xl">{s.icon}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-orange-700 dark:group-hover:text-orange-300">
                          {s.title}
                        </span>
                        <span className="text-xs text-muted-foreground leading-tight">
                          {s.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                /* ── CHAT SCREEN ── */
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {messages.map((msg) => (
                      <div key={msg.id}>
                        {/* ── SYSTEM / ESCALATION MESSAGE ── */}
                        {msg.role === "system" && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`flex justify-center`}
                          >
                            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm text-center ${
                              msg.isEscalation
                                ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 text-amber-800 dark:text-amber-200'
                                : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30 text-green-800 dark:text-green-200'
                            }`}>
                              {msg.content}
                            </div>
                          </motion.div>
                        )}

                        {/* ── USER MESSAGE ── */}
                        {msg.role === "user" && (
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex justify-end"
                          >
                            <div className="max-w-[80%] bg-gradient-to-br from-orange-500 to-amber-500 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm shadow-sm">
                              {msg.content}
                            </div>
                          </motion.div>
                        )}

                        {/* ── BOT MESSAGE ── */}
                        {msg.role === "bot" && (
                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-start gap-2"
                          >
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0 mt-1">
                              <Bot size={14} className="text-white" />
                            </div>
                            <div className="flex flex-col gap-1 max-w-[80%]">
                              <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                                {msg.content || <Loader2 size={14} className="animate-spin" />}
                              </div>
                              {/* Feedback buttons for bot messages */}
                              {msg.content && !msg.id.startsWith('temp_') && msg.id !== 'welcome' && (
                                <div className="flex gap-1 ml-1">
                                  <button
                                    onClick={() => handleFeedback(msg.id, 1)}
                                    className={`p-1 rounded transition-colors ${msg.feedback === 1 ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`}
                                  >
                                    <ThumbsUp size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(msg.id, -1)}
                                    className={`p-1 rounded transition-colors ${msg.feedback === -1 ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                                  >
                                    <ThumbsDown size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}

                        {/* ── AGENT MESSAGE (Human Support) ── */}
                        {msg.role === "agent" && (
                          <motion.div
                            initial={{ opacity: 0, x: -20, scale: 0.96 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            className="flex items-start gap-2"
                          >
                            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-1">
                              <UserCheck size={14} className="text-white" />
                            </div>
                            <div className="flex flex-col gap-1 max-w-[80%]">
                              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium ml-1 mb-0.5">
                                {msg.agentName || 'Support Agent'}
                              </p>
                              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/40 px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                                {msg.content}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    ))}

                    {/* Agent typing indicator */}
                    {agentIsTyping && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-start gap-2"
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <UserCheck size={14} className="text-white" />
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/40 px-4 py-3 rounded-2xl rounded-tl-sm">
                          <div className="flex gap-1">
                            {[0, 1, 2].map(i => (
                              <motion.div
                                key={i}
                                className="w-2 h-2 bg-blue-400 rounded-full"
                                animate={{ y: [0, -4, 0] }}
                                transition={{ delay: i * 0.15, repeat: Infinity, duration: 0.6 }}
                              />
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Bot loading indicator */}
                    {isLoading && !agentIsTyping && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-start gap-2"
                      >
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center flex-shrink-0">
                          <Bot size={14} className="text-white" />
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm">
                          <div className="flex gap-1">
                            {[0, 1, 2].map(i => (
                              <motion.div
                                key={i}
                                className="w-2 h-2 bg-gray-400 rounded-full"
                                animate={{ y: [0, -4, 0] }}
                                transition={{ delay: i * 0.15, repeat: Infinity, duration: 0.6 }}
                              />
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 rounded-2xl px-4 py-2 border border-gray-200 dark:border-gray-700 focus-within:border-orange-400 transition-colors">
                      <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                        placeholder={
                          isEscalated && !isResolved
                            ? "Reply to support agent..."
                            : "Ask me anything..."
                        }
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 dark:text-white"
                      />
                      <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isLoading}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center disabled:opacity-40 transition-opacity hover:scale-105 active:scale-95"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}