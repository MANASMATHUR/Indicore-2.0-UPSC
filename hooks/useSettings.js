'use client';

import { useState, useCallback, useEffect } from 'react';

const defaultSettings = {
  language: 'en',
  model: 'sonar-pro',
  systemPrompt: 'You are a helpful Multilingual AI assistant. Your name is Indicore-Ai. Provide accurate, detailed, and well-structured responses.',
  totalQuestions: 0,
  sessionQuestions: 0,
};

export function useSettings() {
  const [settings, setSettings] = useState(defaultSettings);

  const loadSettings = useCallback(async () => {
    try {
      // Load from localStorage first
      const savedSettings = localStorage.getItem('indicore-settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      }

      // TODO: Load user preferences from API
      // const response = await fetch('/api/user/preferences');
      // if (response.ok) {
      //   const data = await response.json();
      //   setSettings(prev => ({ ...prev, ...data.preferences }));
      // }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings) => {
    try {
      setSettings(newSettings);
      
      // Save to localStorage
      localStorage.setItem('indicore-settings', JSON.stringify(newSettings));

      // TODO: Save to API
      // const response = await fetch('/api/user/preferences', {
      //   method: 'PUT',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ preferences: newSettings }),
      // });
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  }, []);

  const updateQuestionCount = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      totalQuestions: prev.totalQuestions + 1,
      sessionQuestions: prev.sessionQuestions + 1,
    }));
  }, []);

  const resetSessionQuestions = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      sessionQuestions: 0,
    }));
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    updateSettings,
    loadSettings,
    updateQuestionCount,
    resetSessionQuestions,
  };
}
