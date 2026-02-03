// app/components/LuminoChat.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Bot, Loader2, ThumbsUp, ThumbsDown, AlertCircle } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "bot" | "system";
  content: string;
  feedback?: 1 | -1 | null;
  isEscalation?: boolean; // NEW: Flag for escalation messages
};

export default function LuminoChat() {
  const [open, setOpen] = useState(false);
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
  const [isEscalated, setIsEscalated] = useState(false); // NEW: Track if conversation is escalated

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

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

  // Handle sending messages with streaming
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: `temp_${Date.now()}`, // Temporary ID
      role: "user",
      content: input.trim(),
      feedback: null,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const botMsgId = `temp_${Date.now() + 1}`; // Temporary ID
    let hasStartedStreaming = false;
    let realMessageId: string | null = null;

    try {
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          sessionId: getSessionId(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to connect');
      }

      // ✅ NEW: Check content-type to handle escalation or errors
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        // Handle JSON response (escalation or error)
        const data = await response.json();
        
        if (data.escalated) {
          // Handle escalation
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
          return; // Stop here, don't process as stream
        }
        
        if (data.error) {
          // Handle error
          console.error('API Error:', data.error);
          throw new Error(data.error);
        }
      }

      // ✅ Continue with streaming response (normal flow)
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (!reader) {
        throw new Error('No reader available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // First chunk received - hide loading, show message bubble
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
            
            // Check if this is a message_id event
            if (parsed.type === 'message_id' && parsed.message_id) {
              realMessageId = parsed.message_id;
              // Update the message with the real ID from database
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === botMsgId ? { ...msg, id: realMessageId! } : msg
                )
              );
              console.log('✅ Received real message ID:', realMessageId);
              continue;
            }

            // Regular content chunk
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

  // Handle feedback (thumbs up/down)
  const handleFeedback = async (messageId: string, rating: 1 | -1) => {
    // Don't send feedback for temporary IDs or welcome message
    if (messageId.startsWith('temp_') || messageId === 'welcome' || messageId.startsWith('escalation_') || messageId.startsWith('error_')) {
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
        // Update local state to show feedback was submitted
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
{/*
  const quickReplies = [
    "Check subscription",
    "Pair new device",
    "Hardware specs",
    "Voice commands",
    "Sentinel Plus",
  ];*/}

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
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="p-1.5 rounded-full hover:bg-orange-100/60 dark:hover:bg-gray-800/60"
              >
                <X size={20} />
              </motion.button>
            </div>

            {/* ✅ NEW: Escalation Banner */}
            {isEscalated && (
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

            {/* Messages */}
            <div className="flex-1 min-h-0 px-4 py-4 overflow-y-auto space-y-4">
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
                    {/* ✅ UPDATED: Show alert icon for system/escalation messages */}
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

                  {/* Feedback Buttons - Only for bot messages (not welcome, not temp IDs, not escalation) */}
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

            {/* Quick Replies */}
            {/*
            {!isEscalated && (
              <div className="px-4 py-2.5 border-t bg-gray-50/80 dark:bg-gray-900/40 flex gap-2 overflow-x-auto">
                {quickReplies.map((reply) => (
                  <button
                    key={reply}
                    onClick={() => {
                      setInput(reply);
                      setTimeout(handleSend, 80);
                    }}
                    className="px-3 py-1.5 text-sm font-medium bg-white/90 dark:bg-gray-800/70 border border-orange-200/70 dark:border-orange-700/60 rounded-full hover:bg-orange-50 whitespace-nowrap"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )} */}

            {/* Input */}
            <div className="p-3  bg-white/90 dark:bg-gray-900/90 flex items-center gap-2.5 sticky bottom-0">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isEscalated ? "Waiting for human agent..." : "Ask about subscription, devices, specs..."}
                className="flex-1 px-4 py-2.5 bg-gray-100/80 dark:bg-gray-800/70 rounded-full border border-orange-200/70 dark:border-orange-700/50 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-400/40 text-sm"
                disabled={isLoading || isEscalated}
              />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSend}
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
    </>
  );
}