// app/components/LuminoChat.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Bot, Loader2, ThumbsUp, ThumbsDown, AlertCircle, ArrowLeft } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "bot" | "system";
  content: string;
  feedback?: 1 | -1 | null;
  isEscalation?: boolean;
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion: typeof SUGGESTION_OPTIONS[0]) => {
    setCurrentScreen("chat");
    setInput(suggestion.prompt);
    setTimeout(() => handleSend(suggestion.prompt), 100);
  };

  // Handle sending messages with streaming
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

      if (!response.ok) {
        throw new Error('Failed to connect');
      }

      // Check content-type to handle escalation or errors
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        
        if (data.escalated) {
          console.log('🚨 Conversation escalated:', data.reason);
          setIsEscalated(true);
          setIsLoading(false);
          
          const escalationMsg: Message = {
            id: `escalation_${Date.now()}`,
            role: "system",
            content: data.message || "Your conversation has been escalated to a human agent. Someone will assist you shortly.",
            feedback: null,
            isEscalation: true,
          };
          
          setMessages((prev) => [...prev, escalationMsg]);
          return;
        }
        
        if (data.error) {
          console.error('API Error:', data.error);
          throw new Error(data.error);
        }
      }

      // Continue with streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (!reader) {
        throw new Error('No reader available');
      }

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
              console.log('✅ Received real message ID:', realMessageId);
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
          } catch (e) {
            // Skip partial JSON
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setIsLoading(false);
      const errorMsg: Message = {
        id: `error_${Date.now()}`,
        role: "bot",
        content: "Sorry, I'm having trouble connecting right now. Please try again.",
        feedback: null,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle feedback
  const handleFeedback = async (messageId: string, rating: 1 | -1) => {
    if (messageId.startsWith('temp_') || messageId === 'welcome' || 
        messageId.startsWith('escalation_') || messageId.startsWith('error_')) {
      console.warn('Cannot send feedback for temporary message ID');
      return;
    }

    try {
      console.log(`Sending feedback for message: ${messageId}`);
      
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          rating,
        }),
      });

      if (response.ok) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, feedback: rating } : msg
          )
        );
        console.log(`✅ Feedback sent: ${rating === 1 ? '👍' : '👎'}`);
      } else {
        const error = await response.json();
        console.error('Feedback error:', error);
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

  // Reset to suggestions when closing
  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setCurrentScreen("suggestions");
    }, 300);
  };

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
          className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white"
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
                {/* Back Button - Only show in chat screen */}
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
                
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Lumino Assistant</h3>
                  <p className="text-xs text-muted-foreground">
                    {isEscalated ? "🔴 Escalated to human agent" : "Powered by AI • 24/7"}
                  </p>
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
            {isEscalated && currentScreen === "chat" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700/30"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      Conversation escalated
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                      A human agent will review your messages and respond shortly.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <AnimatePresence mode="wait">
                {currentScreen === "suggestions" ? (
                  <motion.div
                    key="suggestions"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="h-full overflow-y-auto p-4"
                  >
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      How can I help?
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Choose a topic or ask me anything
                    </p>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {SUGGESTION_OPTIONS.map((option, index) => (
                        <motion.button
                          key={option.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleSuggestionClick(option)}
                          className="group relative flex items-start gap-3 p-4 bg-white dark:bg-gray-800/60 hover:bg-orange-50 dark:hover:bg-orange-900/20 border border-gray-200/60 dark:border-gray-700/40 rounded-xl transition-all duration-200 hover:shadow-md hover:border-orange-300 dark:hover:border-orange-700/60 text-left"
                        >
                          <div className="text-2xl flex-shrink-0 mt-0.5">
                            {option.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 dark:text-white text-sm group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                              {option.title}
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                              {option.description}
                            </p>
                          </div>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                              <Send size={12} className="text-white" />
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="h-full flex flex-col"
                  >
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                      {messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className="flex flex-col"
                        >
                          <div className={`flex items-start gap-2.5 ${
                            msg.role === "user" ? "justify-end" : "justify-start"
                          }`}>
                            {msg.role === "bot" && !msg.isEscalation && (
                              <div className="w-8 h-8 rounded-xl bg-orange-100/40 dark:bg-orange-900/30 flex-shrink-0 flex items-center justify-center border border-orange-200/40 dark:border-orange-700/40">
                                <Bot size={16} className="text-orange-700 dark:text-orange-300" />
                              </div>
                            )}
                            
                            {msg.role === "system" && (
                              <div className="w-8 h-8 rounded-xl bg-amber-100/40 dark:bg-amber-900/30 flex-shrink-0 flex items-center justify-center border border-amber-200/40 dark:border-amber-700/40">
                                <AlertCircle size={16} className="text-amber-700 dark:text-amber-300" />
                              </div>
                            )}

                            <div
                              className={`relative max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[14.5px] leading-relaxed ${
                                msg.role === "user"
                                  ? "bg-gradient-to-br from-orange-500 to-amber-600 text-white"
                                  : msg.role === "system"
                                  ? "bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-700/40"
                                  : "bg-gray-100/90 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100"
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>

                          {/* Feedback Buttons */}
                          {msg.role === "bot" && 
                           msg.id !== "welcome" && 
                           !msg.id.startsWith('temp_') &&
                           !msg.isEscalation &&
                           msg.content && (
                            <div className="flex items-center gap-2 mt-2 ml-10">
                              <button
                                onClick={() => handleFeedback(msg.id, 1)}
                                disabled={msg.feedback !== null && msg.feedback !== undefined}
                                className={`p-1.5 rounded-lg transition-all ${
                                  msg.feedback === 1
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-green-600"
                                } ${msg.feedback !== null && msg.feedback !== undefined ? "cursor-not-allowed opacity-50" : ""}`}
                                aria-label="Thumbs up"
                                title="Helpful"
                              >
                                <ThumbsUp size={14} />
                              </button>
                              <button
                                onClick={() => handleFeedback(msg.id, -1)}
                                disabled={msg.feedback !== null && msg.feedback !== undefined}
                                className={`p-1.5 rounded-lg transition-all ${
                                  msg.feedback === -1
                                    ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-600"
                                } ${msg.feedback !== null && msg.feedback !== undefined ? "cursor-not-allowed opacity-50" : ""}`}
                                aria-label="Thumbs down"
                                title="Not helpful"
                              >
                                <ThumbsDown size={14} />
                              </button>
                              {msg.feedback !== null && msg.feedback !== undefined && (
                                <span className="text-xs text-gray-500 ml-1">
                                  Thanks for your feedback!
                                </span>
                              )}
                            </div>
                          )}
                        </motion.div>
                      ))}

                      {isLoading && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-orange-100/40 dark:bg-orange-900/30 flex items-center justify-center">
                            <Loader2 size={16} className="animate-spin text-orange-700 dark:text-orange-300" />
                          </div>
                          <div className="bg-gray-100/90 dark:bg-gray-800/80 px-3.5 py-2.5 rounded-2xl text-sm">
                            Thinking...
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3  bg-white/90 dark:bg-gray-900/90 flex items-center gap-2.5 sticky bottom-0">
                      <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isEscalated ? "Waiting for human agent..." : "Type your message..."}
                        className="flex-1 px-4 py-2.5 bg-gray-100/80 dark:bg-gray-800/70 rounded-full border border-orange-200/70 dark:border-orange-700/50 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-400/40 text-sm"
                        disabled={isLoading || isEscalated}
                      />
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSend()}
                        disabled={isLoading || !input.trim() || isEscalated}
                        aria-label="Send message"
                        className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-full shadow-md disabled:opacity-50"
                      >
                        <Send size={18} />
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}