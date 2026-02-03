
// app/admin/page.tsx

"use client";

import { useState, useEffect } from "react";
import { 
  MessageSquare, 
  TrendingUp, 
  Clock, 
  ThumbsUp, 
  ThumbsDown,
  AlertCircle,
  Users,
  Smile,
  Meh,
  Frown
} from "lucide-react";

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
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/admin/dashboard');
      const data = await response.json();
      setStats(data.stats);
      setConversations(data.conversations);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Lumino Assistant Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor The chatbot's performance and conversations
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Conversations */}
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
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Conversations
            </p>
          </div>

          {/* Active */}
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
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Ongoing chats
            </p>
          </div>

          {/* Avg Response Time */}
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
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Avg response
            </p>
          </div>

          {/* Escalated */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <span className="text-sm text-gray-500">Escalated</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.escalatedConversations || 0}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Need human help
            </p>
          </div>
        </div>

        {/* Sentiment & Feedback Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Sentiment Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Sentiment Distribution
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smile className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Positive</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ 
                        width: `${(stats?.sentimentDistribution.positive || 0)}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right">
                    {stats?.sentimentDistribution.positive || 0}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Meh className="w-5 h-5 text-gray-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Neutral</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gray-600 h-2 rounded-full" 
                      style={{ 
                        width: `${(stats?.sentimentDistribution.neutral || 0)}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right">
                    {stats?.sentimentDistribution.neutral || 0}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Frown className="w-5 h-5 text-red-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Negative</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-red-600 h-2 rounded-full" 
                      style={{ 
                        width: `${(stats?.sentimentDistribution.negative || 0)}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right">
                    {stats?.sentimentDistribution.negative || 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback Stats */}
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

        {/* Recent Conversations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Conversations
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Session ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sentiment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Messages
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {conversations.map((conv) => (
                  <tr key={conv.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}