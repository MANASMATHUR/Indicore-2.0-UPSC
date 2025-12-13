import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Comprehensive user preferences dashboard
 * Manages UI, study schedule, and notification preferences
 */
export default function PreferencesDashboard() {
    const { data: session } = useSession();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState('ui');

    const [preferences, setPreferences] = useState({
        uiPreferences: {
            theme: 'auto',
            fontSize: 'medium',
            reducedMotion: false,
            notificationsEnabled: true,
            soundEnabled: false,
            compactView: false
        },
        studySchedule: {
            enabled: false,
            dailyGoalMinutes: 120,
            preferredStudyTime: [],
            reminders: {
                studyReminder: false,
                reminderTime: '09:00',
                breakReminder: false,
                breakIntervalMinutes: 50,
                dailyDigest: false,
                digestTime: '20:00'
            }
        },
        notificationPreferences: {
            email: {
                enabled: true,
                studyReminders: true,
                weeklyDigest: true,
                achievementAlerts: true,
                newFeatures: false
            },
            inApp: {
                enabled: true,
                studyStreakAlerts: true,
                goalReminders: true,
                contentRecommendations: true
            }
        },
        languagePreferences: {
            language: 'en',
            model: 'sonar-pro'
        }
    });

    useEffect(() => {
        fetchPreferences();
    }, [session]);

    const fetchPreferences = async () => {
        if (!session) return;

        try {
            const res = await fetch('/api/user/preferences');
            if (res.ok) {
                const data = await res.json();
                setPreferences(prev => ({
                    ...prev,
                    ...data
                }));
            }
        } catch (error) {
            console.error('Failed to fetch preferences:', error);
        } finally {
            setLoading(false);
        }
    };

    const savePreferences = async () => {
        setSaving(true);
        setMessage('');

        try {
            const res = await fetch('/api/user/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(preferences)
            });

            if (res.ok) {
                setMessage('✅ Preferences saved successfully!');
                setTimeout(() => setMessage(''), 3000);
            } else {
                setMessage('❌ Failed to save preferences');
            }
        } catch (error) {
            console.error('Failed to save preferences:', error);
            setMessage('❌ Error saving preferences');
        } finally {
            setSaving(false);
        }
    };

    if (!session) {
        return (
            <div className="preferences-dashboard">
                <p>Please sign in to manage your preferences.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="preferences-dashboard loading">
                <div className="spinner"></div>
                <p>Loading preferences...</p>
            </div>
        );
    }

    return (
        <div className="preferences-dashboard">
            <div className="dashboard-header">
                <h1>⚙️ Preferences</h1>
                <p>Customize your Indicore experience</p>
            </div>

            {message && (
                <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
                    {message}
                </div>
            )}

            {/* Tab Navigation */}
            <div className="tabs">
                <button
                    className={activeTab === 'ui' ? 'active' : ''}
                    onClick={() => setActiveTab('ui')}
                >
                    🎨 UI & Display
                </button>
                <button
                    className={activeTab === 'study' ? 'active' : ''}
                    onClick={() => setActiveTab('study')}
                >
                    📚 Study Schedule
                </button>
                <button
                    className={activeTab === 'notifications' ? 'active' : ''}
                    onClick={() => setActiveTab('notifications')}
                >
                    🔔 Notifications
                </button>
                <button
                    className={activeTab === 'language' ? 'active' : ''}
                    onClick={() => setActiveTab('language')}
                >
                    🌐 Language & AI
                </button>
            </div>

            {/* UI Preferences Tab */}
            {activeTab === 'ui' && (
                <div className="tab-content">
                    <h2>UI & Display Preferences</h2>

                    <div className="preference-group">
                        <label>Theme</label>
                        <select
                            value={preferences.uiPreferences.theme}
                            onChange={(e) => setPreferences({
                                ...preferences,
                                uiPreferences: { ...preferences.uiPreferences, theme: e.target.value }
                            })}
                        >
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                            <option value="auto">Auto (System)</option>
                        </select>
                    </div>

                    <div className="preference-group">
                        <label>Font Size</label>
                        <select
                            value={preferences.uiPreferences.fontSize}
                            onChange={(e) => setPreferences({
                                ...preferences,
                                uiPreferences: { ...preferences.uiPreferences, fontSize: e.target.value }
                            })}
                        >
                            <option value="small">Small</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                        </select>
                    </div>

                    <div className="preference-group checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={preferences.uiPreferences.reducedMotion}
                                onChange={(e) => setPreferences({
                                    ...preferences,
                                    uiPreferences: { ...preferences.uiPreferences, reducedMotion: e.target.checked }
                                })}
                            />
                            Reduced Motion (Less Animations)
                        </label>
                    </div>

                    <div className="preference-group checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={preferences.uiPreferences.compactView}
                                onChange={(e) => setPreferences({
                                    ...preferences,
                                    uiPreferences: { ...preferences.uiPreferences, compactView: e.target.checked }
                                })}
                            />
                            Compact View (More Space Efficient)
                        </label>
                    </div>

                    <div className="preference-group checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={preferences.uiPreferences.soundEnabled}
                                onChange={(e) => setPreferences({
                                    ...preferences,
                                    uiPreferences: { ...preferences.uiPreferences, soundEnabled: e.target.checked }
                                })}
                            />
                            Enable Sound Effects
                        </label>
                    </div>
                </div>
            )}

            {/* Study Schedule Tab */}
            {activeTab === 'study' && (
                <div className="tab-content">
                    <h2>Study Schedule & Goals</h2>

                    <div className="preference-group checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={preferences.studySchedule.enabled}
                                onChange={(e) => setPreferences({
                                    ...preferences,
                                    studySchedule: { ...preferences.studySchedule, enabled: e.target.checked }
                                })}
                            />
                            Enable Study Schedule
                        </label>
                    </div>

                    {preferences.studySchedule.enabled && (
                        <>
                            <div className="preference-group">
                                <label>Daily Study Goal (minutes)</label>
                                <input
                                    type="number"
                                    min="30"
                                    max="720"
                                    step="30"
                                    value={preferences.studySchedule.dailyGoalMinutes}
                                    onChange={(e) => setPreferences({
                                        ...preferences,
                                        studySchedule: {
                                            ...preferences.studySchedule,
                                            dailyGoalMinutes: parseInt(e.target.value)
                                        }
                                    })}
                                />
                                <small>{Math.floor(preferences.studySchedule.dailyGoalMinutes / 60)}h {preferences.studySchedule.dailyGoalMinutes % 60}m per day</small>
                            </div>

                            <div className="preference-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={preferences.studySchedule.reminders.studyReminder}
                                        onChange={(e) => setPreferences({
                                            ...preferences,
                                            studySchedule: {
                                                ...preferences.studySchedule,
                                                reminders: { ...preferences.studySchedule.reminders, studyReminder: e.target.checked }
                                            }
                                        })}
                                    />
                                    Daily Study Reminder
                                </label>
                            </div>

                            {preferences.studySchedule.reminders.studyReminder && (
                                <div className="preference-group">
                                    <label>Reminder Time</label>
                                    <input
                                        type="time"
                                        value={preferences.studySchedule.reminders.reminderTime}
                                        onChange={(e) => setPreferences({
                                            ...preferences,
                                            studySchedule: {
                                                ...preferences.studySchedule,
                                                reminders: { ...preferences.studySchedule.reminders, reminderTime: e.target.value }
                                            }
                                        })}
                                    />
                                </div>
                            )}

                            <div className="preference-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={preferences.studySchedule.reminders.breakReminder}
                                        onChange={(e) => setPreferences({
                                            ...preferences,
                                            studySchedule: {
                                                ...preferences.studySchedule,
                                                reminders: { ...preferences.studySchedule.reminders, breakReminder: e.target.checked }
                                            }
                                        })}
                                    />
                                    Break Reminders
                                </label>
                            </div>

                            <div className="preference-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={preferences.studySchedule.reminders.dailyDigest}
                                        onChange={(e) => setPreferences({
                                            ...preferences,
                                            studySchedule: {
                                                ...preferences.studySchedule,
                                                reminders: { ...preferences.studySchedule.reminders, dailyDigest: e.target.checked }
                                            }
                                        })}
                                    />
                                    Daily Summary Digest
                                </label>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <div className="tab-content">
                    <h2>Notification Preferences</h2>

                    <h3>📧 Email Notifications</h3>
                    <div className="preference-group checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={preferences.notificationPreferences.email.enabled}
                                onChange={(e) => setPreferences({
                                    ...preferences,
                                    notificationPreferences: {
                                        ...preferences.notificationPreferences,
                                        email: { ...preferences.notificationPreferences.email, enabled: e.target.checked }
                                    }
                                })}
                            />
                            Enable Email Notifications
                        </label>
                    </div>

                    {preferences.notificationPreferences.email.enabled && (
                        <>
                            <div className="preference-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={preferences.notificationPreferences.email.studyReminders}
                                        onChange={(e) => setPreferences({
                                            ...preferences,
                                            notificationPreferences: {
                                                ...preferences.notificationPreferences,
                                                email: { ...preferences.notificationPreferences.email, studyReminders: e.target.checked }
                                            }
                                        })}
                                    />
                                    Study Reminders
                                </label>
                            </div>

                            <div className="preference-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={preferences.notificationPreferences.email.weeklyDigest}
                                        onChange={(e) => setPreferences({
                                            ...preferences,
                                            notificationPreferences: {
                                                ...preferences.notificationPreferences,
                                                email: { ...preferences.notificationPreferences.email, weeklyDigest: e.target.checked }
                                            }
                                        })}
                                    />
                                    Weekly Progress Digest
                                </label>
                            </div>

                            <div className="preference-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={preferences.notificationPreferences.email.achievementAlerts}
                                        onChange={(e) => setPreferences({
                                            ...preferences,
                                            notificationPreferences: {
                                                ...preferences.notificationPreferences,
                                                email: { ...preferences.notificationPreferences.email, achievementAlerts: e.target.checked }
                                            }
                                        })}
                                    />
                                    Achievement Alerts
                                </label>
                            </div>
                        </>
                    )}

                    <h3 style={{ marginTop: '2rem' }}>🔔 In-App Notifications</h3>
                    <div className="preference-group checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={preferences.notificationPreferences.inApp.enabled}
                                onChange={(e) => setPreferences({
                                    ...preferences,
                                    notificationPreferences: {
                                        ...preferences.notificationPreferences,
                                        inApp: { ...preferences.notificationPreferences.inApp, enabled: e.target.checked }
                                    }
                                })}
                            />
                            Enable In-App Notifications
                        </label>
                    </div>

                    {preferences.notificationPreferences.inApp.enabled && (
                        <>
                            <div className="preference-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={preferences.notificationPreferences.inApp.studyStreakAlerts}
                                        onChange={(e) => setPreferences({
                                            ...preferences,
                                            notificationPreferences: {
                                                ...preferences.notificationPreferences,
                                                inApp: { ...preferences.notificationPreferences.inApp, studyStreakAlerts: e.target.checked }
                                            }
                                        })}
                                    />
                                    Study Streak Alerts
                                </label>
                            </div>

                            <div className="preference-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={preferences.notificationPreferences.inApp.goalReminders}
                                        onChange={(e) => setPreferences({
                                            ...preferences,
                                            notificationPreferences: {
                                                ...preferences.notificationPreferences,
                                                inApp: { ...preferences.notificationPreferences.inApp, goalReminders: e.target.checked }
                                            }
                                        })}
                                    />
                                    Goal Reminders
                                </label>
                            </div>

                            <div className="preference-group checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={preferences.notificationPreferences.inApp.contentRecommendations}
                                        onChange={(e) => setPreferences({
                                            ...preferences,
                                            notificationPreferences: {
                                                ...preferences.notificationPreferences,
                                                inApp: { ...preferences.notificationPreferences.inApp, contentRecommendations: e.target.checked }
                                            }
                                        })}
                                    />
                                    Content Recommendations
                                </label>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Language & AI Tab */}
            {activeTab === 'language' && (
                <div className="tab-content">
                    <h2>Language & AI Preferences</h2>

                    <div className="preference-group">
                        <label>Preferred Language</label>
                        <select
                            value={preferences.languagePreferences.language}
                            onChange={(e) => setPreferences({
                                ...preferences,
                                languagePreferences: { ...preferences.languagePreferences, language: e.target.value }
                            })}
                        >
                            <option value="en">English</option>
                            <option value="hi">Hindi (हिन्दी)</option>
                            <option value="mr">Marathi (मराठी)</option>
                            <option value="ta">Tamil (தமிழ்)</option>
                            <option value="bn">Bengali (বাংলা)</option>
                            <option value="gu">Gujarati (ગુજરાતી)</option>
                            <option value="te">Telugu (తెలుగు)</option>
                            <option value="kn">Kannada (ಕನ್ನಡ)</option>
                            <option value="ml">Malayalam (മലയാളം)</option>
                            <option value="pa">Punjabi (ਪੰਜਾਬੀ)</option>
                        </select>
                    </div>

                    <div className="preference-group">
                        <label>AI Model</label>
                        <select
                            value={preferences.languagePreferences.model}
                            onChange={(e) => setPreferences({
                                ...preferences,
                                languagePreferences: { ...preferences.languagePreferences, model: e.target.value }
                            })}
                        >
                            <option value="sonar-pro">Sonar Pro (Recommended)</option>
                            <option value="sonar">Sonar (Faster)</option>
                            <option value="sonar-reasoning">Sonar Reasoning (Deep Thinking)</option>
                        </select>
                    </div>

                    <p className="info-text">
                        💡 Your language preference affects the AI responses, but you can still ask questions in any language!
                    </p>
                </div>
            )}

            {/* Save Button */}
            <div className="dashboard-footer">
                <button
                    className="save-button"
                    onClick={savePreferences}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : '💾 Save Preferences'}
                </button>
            </div>

            <style jsx>{`
        .preferences-dashboard {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }

        .dashboard-header {
          margin-bottom: 2rem;
        }

        .dashboard-header h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .dashboard-header p {
          color: #666;
        }

        .message {
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-weight: 500;
        }

        .message.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .message.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 2rem;
          border-bottom: 2px solid #e0e0e0;
        }

        .tabs button {
          padding: 0.75rem 1.5rem;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1rem;
          color: #666;
          border-bottom: 3px solid transparent;
          transition: all 0.2s;
        }

        .tabs button:hover {
          color: #333;
        }

        .tabs button.active {
          color: #007bff;
          border-bottom-color: #007bff;
        }

        .tab-content {
          background: #f9f9f9;
          padding: 2rem;
          border-radius: 8px;
        }

        .tab-content h2 {
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
        }

        .tab-content h3 {
          margin-top: 1.5rem;
          margin-bottom: 1rem;
          font-size: 1.2rem;
        }

        .preference-group {
          margin-bottom: 1.5rem;
        }

        .preference-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .preference-group input[type="number"],
        .preference-group input[type="time"],
        .preference-group select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 1rem;
        }

        .preference-group.checkbox label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .preference-group.checkbox input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .preference-group small {
          display: block;
          margin-top: 0.25rem;
          color: #666;
          font-size: 0.875rem;
        }

        .info-text {
          background: #e3f2fd;
          padding: 1rem;
          border-radius: 6px;
          border-left: 4px solid #2196f3;
          margin-top: 1rem;
        }

        .dashboard-footer {
          margin-top: 2rem;
          display: flex;
          justify-content: flex-end;
        }

        .save-button {
          padding: 1rem 2rem;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .save-button:hover:not(:disabled) {
          background: #0056b3;
        }

        .save-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem;
        }

        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007bff;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}
