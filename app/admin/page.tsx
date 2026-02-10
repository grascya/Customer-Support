// app/admin/page.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  MessageSquare, Clock, ThumbsUp, ThumbsDown, AlertCircle,
  Users, Smile, Meh, Frown, Filter, Eye, Check, RefreshCw, X, Bot
} from "lucide-react";
import { createClient } from '@supabase/supabase-js';


// Create client-side Supabase instance
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Stats = {
  totalConversations: number;
  activeConversations: number;
  resolvedConversations: number;
  escalatedConversations: number;
  avgResponseTime: number;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  feedbackStats: {
    thumbsUp: number;
    thumbsDown: number;
    total: number;
  };
};

type Conversation = {
  id: string;
  session_id: string;
  created_at: string;
  status: string;
  sentiment: string;
  message_count: number;
  last_message: string;
  metadata?: {
    escalation_reason?: string;
  };
};

type Message = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  metadata?: any;
  feedback?: number | null;
};

type ConversationDetail = {
  conversation: Conversation;
  messages: Message[];
};

type StatusFilter = 'all' | 'active' | 'escalated' | 'resolved';

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/admin/dashboard');
      const data = await response.json();
      setStats(data.stats);
      setConversations(data.conversations);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch conversation details
  const fetchConversationDetail = async (conversationId: string) => {
    try {
      setLoadingDetail(true);
      const response = await fetch(`/api/admin/conversation/${conversationId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch conversation details');
      }
      
      const data = await response.json();
      setSelectedConversation(data);
    } catch (error) {
      console.error('Error fetching conversation detail:', error);
      alert('Failed to load conversation details. Make sure the API endpoint exists.');
    } finally {
      setLoadingDetail(false);
    }
  };
useEffect(() => {
  if (statusFilter === 'all') {
    setFilteredConversations(conversations);
  } else {
    // ✅ Case-insensitive filter
    setFilteredConversations(
      conversations.filter(conv => 
        conv.status?.toLowerCase() === statusFilter.toLowerCase()
      )
    );
  }
}, [conversations, statusFilter]);
  // Initial load
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    console.log('📡 Setting up real-time subscriptions...');

    // Subscribe to conversations
    const conversationsChannel = supabase
      .channel('dashboard-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        (payload) => {
          console.log('🔔 Conversation changed:', payload);
          fetchDashboardData();
        }
      )
      .subscribe();

    // Subscribe to messages
    const messagesChannel = supabase
      .channel('dashboard-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('🔔 New message:', payload);
          fetchDashboardData();
          
          if (selectedConversation && payload.new.conversation_id === selectedConversation.conversation.id) {
            fetchConversationDetail(selectedConversation.conversation.id);
          }
        }
      )
      .subscribe();

    // Subscribe to feedback
    const feedbackChannel = supabase
      .channel('dashboard-feedback')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_feedback'
        },
        (payload) => {
          console.log('🔔 Feedback changed:', payload);
          fetchDashboardData();
          
          if (selectedConversation) {
            fetchConversationDetail(selectedConversation.conversation.id);
          }
        }
      )
      .subscribe();

    // Subscribe to escalations
    const escalationsChannel = supabase
      .channel('dashboard-escalations')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: 'status=eq.escalated'
        },
        (payload) => {
          console.log('🚨 New escalation detected!', payload);
          
          if (Notification.permission === 'granted') {
            new Notification('New Escalation', {
              body: 'A conversation needs human attention',
              icon: '/bot-icon.png',
              tag: 'escalation',
            });
          }
          
          fetchDashboardData();
        }
      )
      .subscribe();

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(feedbackChannel);
      supabase.removeChannel(escalationsChannel);
    };
  }, [selectedConversation]);

  // Filter conversations
  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredConversations(conversations);
    } else {
      setFilteredConversations(
        conversations.filter(conv => conv.status === statusFilter)
      );
    }
  }, [conversations, statusFilter]);

  // Mark conversation as resolved
  const handleMarkResolved = async (conversationId: string) => {
    try {
      const response = await fetch('/api/admin/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });

      if (response.ok) {
        console.log('✅ Conversation marked as resolved');
        fetchDashboardData();
      } else {
        const error = await response.json();
        console.error('Failed to resolve conversation:', error);
        alert(`Error: ${error.error || 'Failed to resolve conversation'}`);
      }
    } catch (error) {
      console.error('Error resolving conversation:', error);
      alert('Error resolving conversation');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  // FIXED: Use stats from API for consistency
  const escalatedCount = stats?.escalatedConversations || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Lumino Assistant Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Monitoring The Chatbot's Performance 
            </p>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Escalation Alert Banner */}
        {escalatedCount > 0 && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <div>
                  <p className="font-medium text-red-900 dark:text-red-100">
                    {escalatedCount} conversation{escalatedCount > 1 ? 's' : ''} need{escalatedCount === 1 ? 's' : ''} attention
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Click on any escalated conversation below to review
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStatusFilter('escalated')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                View Escalations
              </button>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm text-gray-500">Total</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.totalConversations || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Conversations</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm text-gray-500">Active</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.activeConversations || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Ongoing chats</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-sm text-gray-500">Speed</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.avgResponseTime ? `${(stats.avgResponseTime / 1000).toFixed(1)}s` : '0s'}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Avg response</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <span className="text-sm text-gray-500">Escalated</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {escalatedCount}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Need human help</p>
          </div>
        </div>

        {/* Sentiment & Feedback Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Sentiment Distribution
            </h3>
            <div className="space-y-4">
             {['positive', 'neutral', 'negative'].map((type) => {
  const value = stats?.sentimentDistribution[type as keyof typeof stats.sentimentDistribution] || 0;
  
  // Define classes properly
  let Icon, iconClass, barClass;
  
  if (type === 'positive') {
    Icon = Smile;
    iconClass = 'text-green-600';
    barClass = 'bg-green-600';
  } else if (type === 'negative') {
    Icon = Frown;
    iconClass = 'text-red-600';
    barClass = 'bg-red-600';
  } else {
    Icon = Meh;
    iconClass = 'text-gray-600';
    barClass = 'bg-gray-600';
  }
  
  return (
    <div key={type} className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${iconClass}`} />
        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{type}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className={`${barClass} h-2 rounded-full transition-all duration-500`}
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right">
          {value}%
        </span>
      </div>
    </div>
  );
})}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              User Feedback
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Helpful</span>
                </div>
                <span className="text-2xl font-bold text-green-600">
                  {stats?.feedbackStats.thumbsUp || 0}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ThumbsDown className="w-5 h-5 text-red-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Not Helpful</span>
                </div>
                <span className="text-2xl font-bold text-red-600">
                  {stats?.feedbackStats.thumbsDown || 0}
                </span>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Satisfaction Rate
                  </span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    {stats?.feedbackStats.total 
                      ? Math.round((stats.feedbackStats.thumbsUp / stats.feedbackStats.total) * 100)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Conversations Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Conversations
              </h3>
              
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="escalated">Escalated</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
          </div>

          {filteredConversations.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No conversations found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sentiment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Messages</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Message</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredConversations.map((conv) => (
                    <tr key={conv.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                        {conv.session_id.substring(0, 12)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          conv.status === 'active' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : conv.status === 'escalated'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          {conv.status}
                          {conv.status === 'escalated' && conv.metadata?.escalation_reason && (
                            <span className="ml-1" title={conv.metadata.escalation_reason.replace('_', ' ')}>
                              •
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
  {conv.sentiment === 'positive' && <Smile className="w-5 h-5 text-green-600" />}
  {conv.sentiment === 'neutral' && <Meh className="w-5 h-5 text-gray-600" />}
  {conv.sentiment === 'negative' && <Frown className="w-5 h-5 text-red-600" />}
</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {conv.message_count}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {conv.last_message}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {new Date(conv.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => fetchConversationDetail(conv.id)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title="View conversation"
                          >
                            <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          {(conv.status === 'escalated' || conv.status === 'active') && (
  <button
    onClick={() => handleMarkResolved(conv.id)}
    className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
    title="Mark as resolved"
  >
    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
  </button>
)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Conversation Detail Modal */}
        {selectedConversation && (
          <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedConversation(null)}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Conversation Details
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Session: {selectedConversation.conversation.session_id}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Conversation Meta Info */}
                <div className="mt-4 flex items-center gap-4 text-sm">
                  <span className={`px-2 py-1 rounded-full ${
                    selectedConversation.conversation.status === 'active' 
                      ? 'bg-green-100 text-green-800'
                      : selectedConversation.conversation.status === 'escalated'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedConversation.conversation.status}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {selectedConversation.messages.length} messages
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Created: {new Date(selectedConversation.conversation.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                  </div>
                ) : (
                  selectedConversation.messages.map((msg) => (
                    <div key={msg.id} className="flex flex-col">
                      <div className={`flex items-start gap-3 ${
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}>
                        {msg.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                            <Bot size={16} className="text-orange-700 dark:text-orange-300" />
                          </div>
                        )}
                        
                        <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <p className="text-xs mt-2 opacity-70">
                            {new Date(msg.created_at).toLocaleTimeString()}
                          </p>
                        </div>

                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <Users size={16} className="text-blue-700 dark:text-blue-300" />
                          </div>
                        )}
                      </div>

                      {/* Show feedback for assistant messages */}
                      {msg.role === 'assistant' && msg.feedback !== null && (
                        <div className="ml-11 mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                          {msg.feedback === 1 ? (
                            <>
                              <ThumbsUp className="w-3 h-3 text-green-600" />
                              <span>User found this helpful</span>
                            </>
                          ) : (
                            <>
                              <ThumbsDown className="w-3 h-3 text-red-600" />
                              <span>User found this not helpful</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Show sentiment for user messages */}
                      {msg.role === 'user' && msg.metadata?.sentiment && (
                        <div className="mr-11 mt-2 flex items-center justify-end gap-2 text-xs text-gray-600 dark:text-gray-400">
                          Sentiment: {msg.metadata.sentiment}
                          {msg.metadata.sentiment === 'positive' && <Smile className="w-3 h-3 text-green-600" />}
                          {msg.metadata.sentiment === 'neutral' && <Meh className="w-3 h-3 text-gray-600" />}
                          {msg.metadata.sentiment === 'negative' && <Frown className="w-3 h-3 text-red-600" />}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Conversation ID: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{selectedConversation.conversation.id}</code>
                  </div>
                  {(selectedConversation.conversation.status === 'escalated' || 
  selectedConversation.conversation.status === 'active') && (
                    <button
                      onClick={() => {
                        handleMarkResolved(selectedConversation.conversation.id);
                        setSelectedConversation(null);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Mark as Resolved
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}