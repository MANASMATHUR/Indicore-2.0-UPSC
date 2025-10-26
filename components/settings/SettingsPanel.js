'use client';

import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Card from '../ui/Card';

const SettingsPanel = ({ isOpen, onClose, settings, onUpdateSettings }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onUpdateSettings(localSettings);
    onClose();
  };

  const handleChange = (key, value) => {
    setLocalSettings(prev => {
      if (prev[key] === value) return prev;
      return {
        ...prev,
        [key]: value
      };
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚙️ Settings"
      size="lg"
      className="max-w-5xl max-h-[95vh] overflow-y-auto mx-2 sm:mx-4"
    >
      <div className="space-y-6">
        {/* Main Settings Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Language & Model Settings */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">🌐 Language & AI</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Language
                  </label>
                  <select
                    value={localSettings.language}
                    onChange={(e) => handleChange('language', e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="mr">Marathi</option>
                    <option value="ta">Tamil</option>
                    <option value="bn">Bengali</option>
                    <option value="pa">Punjabi</option>
                    <option value="gu">Gujarati</option>
                    <option value="te">Telugu</option>
                    <option value="ml">Malayalam</option>
                    <option value="kn">Kannada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    AI Model
                  </label>
                  <select
                    value={localSettings.model}
                    onChange={(e) => handleChange('model', e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="sonar-pro">Sonar Pro (Recommended)</option>
                    <option value="llama-3.1-sonar-small-128k-chat">Llama 3.1 Sonar Chat</option>
                    <option value="sonar-reasoning">Sonar Reasoning</option>
                    <option value="sonar-reasoning-pro">Sonar Reasoning Pro</option>
                    <option value="sonar-deep-research">Sonar Deep Research</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* User Statistics */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 p-4 rounded-xl border border-blue-200 dark:border-gray-600">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">📊 Your Statistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {settings.totalQuestions || 0}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Total Questions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {settings.sessionQuestions || 0}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">This Session</div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance & Advanced Settings */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Performance Settings */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">⚡ Performance</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Streaming Responses
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Real-time streaming
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.useStreaming !== false}
                  onChange={(e) => handleChange('useStreaming', e.target.checked)}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ml-2"
                />
              </div>
              
              <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Response Caching
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Cache for faster queries
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.enableCaching !== false}
                  onChange={(e) => handleChange('enableCaching', e.target.checked)}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ml-2"
                />
              </div>

              <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Quick Responses
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Instant responses
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.quickResponses !== false}
                  onChange={(e) => handleChange('quickResponses', e.target.checked)}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ml-2"
                />
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">🔧 Advanced</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Auto-save conversations
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Save chat history
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.autoSave || true}
                  onChange={(e) => handleChange('autoSave', e.target.checked)}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ml-2"
                />
              </div>
              
              <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Voice responses
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Text-to-speech
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.voiceResponses || false}
                  onChange={(e) => handleChange('voiceResponses', e.target.checked)}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ml-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Reset Settings */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-200 dark:border-yellow-800">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">🔄 Reset Settings</h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
            Reset settings to defaults if experiencing issues.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              if (confirm('This will reset all your settings to defaults. Are you sure?')) {
                localStorage.removeItem('indicore-settings');
                window.location.reload();
              }
            }}
            className="w-full bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-yellow-300 py-2"
          >
            Reset Settings to Defaults
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="secondary"
          onClick={onClose}
          className="flex-1 py-2.5 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          className="flex-1 py-2.5 bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Save Settings
        </Button>
      </div>
    </Modal>
  );
};

export default SettingsPanel;
