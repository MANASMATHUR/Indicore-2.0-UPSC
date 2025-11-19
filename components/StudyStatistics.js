'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function StudyStatistics() {
  const { data: session } = useSession();
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [studyStartTime, setStudyStartTime] = useState(null);

  useEffect(() => {
    if (session) {
      fetchStatistics();
      
      // Track study time
      setStudyStartTime(Date.now());
      
      return () => {
        if (studyStartTime) {
          const studyTimeMinutes = Math.floor((Date.now() - studyStartTime) / 60000);
          if (studyTimeMinutes > 0) {
            updateStudyTime(studyTimeMinutes);
          }
        }
      };
    }
  }, [session]);

  const fetchStatistics = async () => {
    try {
      const response = await fetch('/api/user/statistics');
      if (response.ok) {
        const data = await response.json();
        setStatistics(data.statistics);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStudyTime = async (minutes) => {
    try {
      await fetch('/api/user/statistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyTimeMinutes: minutes })
      });
    } catch (error) {
      console.error('Error updating study time:', error);
    }
  };

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (loading) {
    return (
      <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
          <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!statistics) {
    return null;
  }

  return (
    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        📊 Study Statistics
      </h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {formatTime(statistics.totalStudyTime || 0)}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Total Study Time</div>
        </div>
        
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {statistics.totalQuestions || 0}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Questions Asked</div>
        </div>
        
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {statistics.totalChats || 0}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Total Chats</div>
        </div>
        
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {statistics.studyStreak || 0} 🔥
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Day Streak</div>
        </div>
      </div>

      {statistics.topicsCovered && statistics.topicsCovered.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Topics Covered
          </h4>
          <div className="flex flex-wrap gap-2">
            {statistics.topicsCovered.slice(0, 5).map((topic, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
              >
                {topic.topic} ({topic.count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

