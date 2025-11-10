'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function VisitorAnalytics() {
  const { data: session } = useSession({ required: false });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');
  const [includeBots, setIncludeBots] = useState('true');

  useEffect(() => {
    fetchStats();
  }, [period, includeBots]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/visitor-stats?period=${period}&includeBots=${includeBots}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600">Please sign in to view analytics.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading analytics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-600">Failed to load analytics</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Visitor Analytics</h1>
          <p className="text-gray-600">
            Track all visitors including anonymous users and bots
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Period
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-600 focus:border-red-600"
            >
              <option value="1d">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Include Bots
            </label>
            <select
              value={includeBots}
              onChange={(e) => setIncludeBots(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-600 focus:border-red-600"
            >
              <option value="true">Yes (All Traffic)</option>
              <option value="false">No (Humans Only)</option>
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Total Unique Visitors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.totals.totalVisitors}</div>
              <p className="text-sm text-gray-500 mt-1">
                {stats.totals.humanVisitors} humans, {stats.totals.botCount} bots
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {stats.totals.convertedVisitors} converted to users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Total Visits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.totals.totalVisits}</div>
              <p className="text-sm text-gray-500 mt-1">
                {stats.totals.botCount} bot visits
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Authenticated Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.totals.totalUsers}</div>
              <p className="text-sm text-gray-500 mt-1">
                {stats.totals.conversionRate} conversion rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Bot Traffic</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.totals.botCount}</div>
              <p className="text-sm text-gray-500 mt-1">
                {stats.totals.totalVisits > 0 
                  ? ((stats.totals.botCount / stats.totals.totalVisits) * 100).toFixed(1) 
                  : 0}% of total visits
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown by Device */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Visitors by Device</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.breakdown.byDevice.map((item) => (
                  <div key={item._id} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 capitalize">{item._id || 'Unknown'}</span>
                    <span className="font-semibold text-gray-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Visitors by Browser</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.breakdown.byBrowser.slice(0, 5).map((item) => (
                  <div key={item._id} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{item._id || 'Unknown'}</span>
                    <span className="font-semibold text-gray-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Visitors by OS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.breakdown.byOS.slice(0, 5).map((item) => (
                  <div key={item._id} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{item._id || 'Unknown'}</span>
                    <span className="font-semibold text-gray-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Trends */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Daily Visitor Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unique Visitors
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Visits
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.trends.daily.map((day) => (
                    <tr key={day.date}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(day.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {day.uniqueVisitors}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {day.totalVisits}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Top Landing Pages */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Top Landing Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topLandingPages.map((page, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 truncate">{page._id || '/'}</span>
                  <span className="font-semibold text-gray-900">{page.count} visits</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Visitors */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Visitors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visitor ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Browser
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Visit
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.recentVisitors.map((visitor) => (
                    <tr key={visitor._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                        {visitor.visitorId.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                        {visitor.device || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {visitor.browser || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {visitor.visitCount || 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          visitor.isBot 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : visitor.converted
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {visitor.isBot ? 'Bot' : visitor.converted ? 'User' : 'Anonymous'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(visitor.lastVisit).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

