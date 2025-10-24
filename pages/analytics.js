'use client';

import { useState, useEffect } from 'react';

export default function Analytics() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data.users);
      setStats(data.stats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getActivityChart = () => {
    const highActivity = users.filter(u => u.chatCount > 10).length;
    const mediumActivity = users.filter(u => u.chatCount > 5 && u.chatCount <= 10).length;
    const lowActivity = users.filter(u => u.chatCount <= 5).length;
    
    return { highActivity, mediumActivity, lowActivity };
  };

  const getRecentUsers = () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const today = users.filter(u => new Date(u.lastActive) > oneDayAgo).length;
    const thisWeek = users.filter(u => new Date(u.lastActive) > oneWeekAgo).length;
    
    return { today, thisWeek };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4"></div>
            <div className="h-4 bg-white rounded w-48 mx-auto mb-2"></div>
            <div className="h-4 bg-white rounded w-32 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  const activityData = getActivityChart();
  const recentData = getRecentUsers();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white mb-4">
              📊 Indicore Analytics
            </h1>
            <p className="text-xl text-blue-100">
              Beautiful insights into your chatbot users
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Users</p>
                <p className="text-4xl font-bold text-white">{stats.totalUsers}</p>
              </div>
              <div className="text-5xl opacity-80">👥</div>
            </div>
            <div className="mt-4 flex items-center text-green-300">
              <span className="text-sm">↗ +12% this week</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Chats</p>
                <p className="text-4xl font-bold text-white">{stats.totalChats}</p>
              </div>
              <div className="text-5xl opacity-80">💬</div>
            </div>
            <div className="mt-4 flex items-center text-green-300">
              <span className="text-sm">↗ +8% this week</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Messages</p>
                <p className="text-4xl font-bold text-white">{stats.totalMessages}</p>
              </div>
              <div className="text-5xl opacity-80">📝</div>
            </div>
            <div className="mt-4 flex items-center text-green-300">
              <span className="text-sm">↗ +15% this week</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Avg/User</p>
                <p className="text-4xl font-bold text-white">{stats.averageChatsPerUser}</p>
              </div>
              <div className="text-5xl opacity-80">📈</div>
            </div>
            <div className="mt-4 flex items-center text-green-300">
              <span className="text-sm">↗ +3% this week</span>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Activity Level Chart */}
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
            <h3 className="text-2xl font-bold text-white mb-6">📊 User Activity Levels</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-green-400 rounded-full"></div>
                  <span className="text-white">High Activity</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-32 bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-green-400 h-3 rounded-full" 
                      style={{ width: `${(activityData.highActivity / users.length) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-white font-bold">{activityData.highActivity}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
                  <span className="text-white">Medium Activity</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-32 bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-yellow-400 h-3 rounded-full" 
                      style={{ width: `${(activityData.mediumActivity / users.length) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-white font-bold">{activityData.mediumActivity}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-red-400 rounded-full"></div>
                  <span className="text-white">Low Activity</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-32 bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-red-400 h-3 rounded-full" 
                      style={{ width: `${(activityData.lowActivity / users.length) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-white font-bold">{activityData.lowActivity}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
            <h3 className="text-2xl font-bold text-white mb-6">🔥 Recent Activity</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">Today</p>
                  <p className="text-blue-100 text-sm">Active users in last 24h</p>
                </div>
                <div className="text-3xl font-bold text-green-400">{recentData.today}</div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">This Week</p>
                  <p className="text-blue-100 text-sm">Active users in last 7 days</p>
                </div>
                <div className="text-3xl font-bold text-blue-400">{recentData.thisWeek}</div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">Engagement Rate</p>
                  <p className="text-blue-100 text-sm">Users with multiple chats</p>
                </div>
                <div className="text-3xl font-bold text-purple-400">
                  {Math.round((users.filter(u => u.chatCount > 1).length / users.length) * 100)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Users */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 mb-8">
          <h3 className="text-2xl font-bold text-white mb-6">🏆 Top Performers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.slice(0, 6).map((user, index) => (
              <div key={user._id || index} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                    index === 0 ? 'bg-yellow-500' : 
                    index === 1 ? 'bg-gray-400' : 
                    index === 2 ? 'bg-orange-500' : 'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <img
                    className="w-10 h-10 rounded-full border-2 border-white/20"
                    src={user.picture || '/static/default-avatar.jpg'}
                    alt={user.name}
                  />
                  <div className="flex-1">
                    <p className="text-white font-semibold truncate">{user.name}</p>
                    <p className="text-blue-100 text-sm">{user.chatCount} chats</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User List */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
          <h3 className="text-2xl font-bold text-white mb-6">👥 All Users</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-3 px-4 text-blue-100 font-medium">User</th>
                  <th className="text-left py-3 px-4 text-blue-100 font-medium">Activity</th>
                  <th className="text-left py-3 px-4 text-blue-100 font-medium">Last Visit</th>
                  <th className="text-left py-3 px-4 text-blue-100 font-medium">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr key={user._id || index} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <img
                          className="w-10 h-10 rounded-full border-2 border-white/20"
                          src={user.picture || '/static/default-avatar.jpg'}
                          alt={user.name}
                        />
                        <div>
                          <p className="text-white font-medium">{user.name}</p>
                          <p className="text-blue-100 text-sm">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex space-x-2">
                        <span className="bg-blue-500/20 text-blue-200 px-2 py-1 rounded-full text-xs">
                          {user.chatCount} chats
                        </span>
                        <span className="bg-green-500/20 text-green-200 px-2 py-1 rounded-full text-xs">
                          {user.totalMessages} msgs
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-white">{new Date(user.lastActive).toLocaleDateString()}</p>
                      <p className="text-blue-100 text-sm">
                        {Math.floor((new Date() - new Date(user.lastActive)) / (1000 * 60 * 60 * 24))} days ago
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        user.chatCount > 10 ? 'bg-green-500/20 text-green-200' :
                        user.chatCount > 5 ? 'bg-yellow-500/20 text-yellow-200' :
                        'bg-red-500/20 text-red-200'
                      }`}>
                        {user.chatCount > 10 ? 'High' : user.chatCount > 5 ? 'Medium' : 'Low'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <p className="text-blue-100">
              🚀 Analytics powered by MongoDB • Last updated: {new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
