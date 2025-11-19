'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const MODEL_PRESETS = [
  // OpenAI (general + reasoning + budget tiers)
  { id: 'openai:gpt-5.1', label: 'OpenAI • GPT-5.1 — flagship reasoning', provider: 'openai', openAIModel: 'gpt-5.1' },
  { id: 'openai:gpt-5', label: 'OpenAI • GPT-5 — next-gen balanced', provider: 'openai', openAIModel: 'gpt-5' },
  { id: 'openai:gpt-5-mini', label: 'OpenAI • GPT-5 Mini — affordable high quality', provider: 'openai', openAIModel: 'gpt-5-mini' },
  { id: 'openai:gpt-5-nano', label: 'OpenAI • GPT-5 Nano — ultra low cost', provider: 'openai', openAIModel: 'gpt-5-nano' },
  { id: 'openai:gpt-5.1-chat-latest', label: 'OpenAI • GPT-5.1 Chat Latest — chat tuned', provider: 'openai', openAIModel: 'gpt-5.1-chat-latest' },
  { id: 'openai:gpt-4.1', label: 'OpenAI • GPT-4.1 — deep reasoning (8k context)', provider: 'openai', openAIModel: 'gpt-4.1' },
  { id: 'openai:gpt-4.1-mini', label: 'OpenAI • GPT-4.1 Mini — faster reasoning', provider: 'openai', openAIModel: 'gpt-4.1-mini' },
  { id: 'openai:gpt-4.1-nano', label: 'OpenAI • GPT-4.1 Nano — ultra budget reasoning', provider: 'openai', openAIModel: 'gpt-4.1-nano' },
  { id: 'openai:gpt-4o', label: 'OpenAI • GPT-4o — balanced flagship', provider: 'openai', openAIModel: 'gpt-4o' },
  { id: 'openai:gpt-4o-2024-05-13', label: 'OpenAI • GPT-4o (May 2024) — legacy stable', provider: 'openai', openAIModel: 'gpt-4o-2024-05-13' },
  { id: 'openai:gpt-4o-mini', label: 'OpenAI • GPT-4o Mini — fastest general model', provider: 'openai', openAIModel: 'gpt-4o-mini' },
  { id: 'openai:gpt-4o-mini-2024-07-18', label: 'OpenAI • GPT-4o Mini (Jul 2024) — tuned economy', provider: 'openai', openAIModel: 'gpt-4o-mini-2024-07-18' },
  { id: 'openai:o4-mini', label: 'OpenAI • o4 Mini — structured reasoning', provider: 'openai', openAIModel: 'o4-mini' },
  { id: 'openai:o4-mini-deep-research', label: 'OpenAI • o4 Mini Deep Research — analytical deep-dives', provider: 'openai', openAIModel: 'o4-mini-deep-research' },
  { id: 'openai:o3', label: 'OpenAI • o3 — chain-of-thought heavy', provider: 'openai', openAIModel: 'o3' },
  { id: 'openai:o3-pro', label: 'OpenAI • o3 Pro — premium reasoning', provider: 'openai', openAIModel: 'o3-pro' },
  { id: 'openai:o3-mini', label: 'OpenAI • o3 Mini — budget reasoning', provider: 'openai', openAIModel: 'o3-mini' },
  { id: 'openai:o1', label: 'OpenAI • o1 — guided reasoning', provider: 'openai', openAIModel: 'o1' },
  { id: 'openai:o1-mini', label: 'OpenAI • o1 Mini — affordable guided reasoning', provider: 'openai', openAIModel: 'o1-mini' },
  { id: 'openai:o1-pro', label: 'OpenAI • o1 Pro — enterprise reasoning', provider: 'openai', openAIModel: 'o1-pro' },
  { id: 'openai:o1-32k', label: 'OpenAI • o1 32K — long context reasoning', provider: 'openai', openAIModel: 'o1-32k' },
  { id: 'claude:sonar-pro', label: 'Claude • 3.5 Sonnet — rich balanced answers', provider: 'claude', model: 'sonar-pro' },
  { id: 'claude:sonar', label: 'Claude • 3 Haiku — ultra-fast', provider: 'claude', model: 'sonar' },
  { id: 'claude:sonar-reasoning', label: 'Claude • 3 Sonnet — reasoning mode', provider: 'claude', model: 'sonar-reasoning' },
  { id: 'claude:sonar-reasoning-pro', label: 'Claude • 3 Opus — deep reasoning', provider: 'claude', model: 'sonar-reasoning-pro' },
  { id: 'claude:sonar-deep-research', label: 'Claude • 3.5 Sonnet — deep research', provider: 'claude', model: 'sonar-deep-research' },
  { id: 'perplexity:sonar-pro', label: 'Perplexity • Sonar Pro — research style', provider: 'perplexity', model: 'sonar-pro' }
];

const SettingsPanel = memo(({ isOpen, onClose, settings, onUpdateSettings }) => {

  const defaultLocalSettings = {
    language: 'en',
    model: 'sonar-pro',
    provider: 'openai',
    openAIModel: 'gpt-4o-mini',
    useStreaming: true,
    enableCaching: true,
    quickResponses: true,
    autoSave: true,
    voiceResponses: false,
    totalQuestions: 0,
    sessionQuestions: 0,
    ...(settings || {})
  };
  
  const [localSettings, setLocalSettings] = useState(defaultLocalSettings);

  const resolvePresetId = (settingsObj) => {
    if (!settingsObj) return MODEL_PRESETS[0].id;
    if ((settingsObj.provider || 'openai') === 'openai') {
      const match = MODEL_PRESETS.find(p => p.provider === 'openai' && p.openAIModel === (settingsObj.openAIModel || 'gpt-4o-mini'));
      return match?.id || MODEL_PRESETS[0].id;
    }
    const match = MODEL_PRESETS.find(p => p.provider === settingsObj.provider && p.model === settingsObj.model);
    return match?.id || MODEL_PRESETS[0].id;
  };

  const selectedPresetId = resolvePresetId(localSettings);

  useEffect(() => {
    if (isOpen && settings) {
      setLocalSettings(prev => ({
        ...prev,
        ...settings
      }));
    }
  }, [settings, isOpen]);

  const handleSave = useCallback(() => {
    try {
      if (!localSettings || !onUpdateSettings) {
        console.error('Settings or onUpdateSettings is missing');
        return;
      }
      onUpdateSettings(localSettings);
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [localSettings, onUpdateSettings, onClose]);

  const handleChange = useCallback((key, value) => {
    setLocalSettings(prev => {
      if (!prev) return { [key]: value };
      if (prev[key] === value) return prev;
      return {
        ...prev,
        [key]: value
      };
    });
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚙️ Settings"
      size="full"
      className="sm:max-w-5xl"
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Main Settings Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
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
                    value={localSettings?.language || 'en'}
                    onChange={(e) => handleChange('language', e.target.value)}
                    className="w-full p-3 sm:p-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 touch-manipulation"
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
                    value={selectedPresetId}
                    onChange={(e) => {
                      const preset = MODEL_PRESETS.find(p => p.id === e.target.value) || MODEL_PRESETS[0];
                      handleChange('provider', preset.provider);
                      if (preset.provider === 'openai') {
                        handleChange('openAIModel', preset.openAIModel);
                      } else {
                        handleChange('model', preset.model || 'sonar-pro');
                      }
                      setLocalSettings(prev => ({
                        ...prev,
                        provider: preset.provider,
                        openAIModel: preset.openAIModel || prev.openAIModel,
                        model: preset.model || prev.model
                      }));
                    }}
                    className="w-full p-3 sm:p-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 touch-manipulation"
                  >
                    {MODEL_PRESETS.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Choose the exact model you want to use—this will automatically select the right provider under the hood.
                  </p>
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
                  {settings?.totalQuestions || localSettings?.totalQuestions || 0}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Total Questions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {settings?.sessionQuestions || localSettings?.sessionQuestions || 0}
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
                  checked={localSettings?.useStreaming !== false}
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
                  checked={localSettings?.enableCaching !== false}
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
                  checked={localSettings?.quickResponses !== false}
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
                  checked={localSettings?.autoSave !== false}
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
                  checked={localSettings?.voiceResponses === true}
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
      <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-slate-900 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4 sm:pb-0 flex-shrink-0">
        <Button
          variant="secondary"
          onClick={onClose}
          className="flex-1 py-3 sm:py-2.5 text-base sm:text-sm text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 touch-manipulation"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          className="flex-1 py-3 sm:py-2.5 text-base sm:text-sm bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 touch-manipulation"
        >
          Save Settings
        </Button>
      </div>
    </Modal>
  );
});

export default SettingsPanel;
