'use client';

import { useState, useCallback, useEffect } from 'react';

const defaultSettings = {
  language: 'en',
  model: 'sonar-pro',
  systemPrompt: `You are Indicore, an exam preparation assistant for UPSC, PCS, and SSC exams. Provide clear, well-structured answers that are easy to read. Use simple formatting: write in paragraphs with proper spacing, use bullet points sparingly, and avoid markdown headers (###) or excessive bold text. Keep responses natural and readable. Write in complete sentences. Do not include citations or reference numbers.`,
  totalQuestions: 0,
  sessionQuestions: 0,
  settingsVersion: '2.6', // Version to track migrations
};

export function useSettings() {
  const [settings, setSettings] = useState(defaultSettings);

  const loadSettings = useCallback(async () => {
    try {
      const savedSettings = localStorage.getItem('indicore-settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        
        if (!parsedSettings.settingsVersion || parsedSettings.settingsVersion !== defaultSettings.settingsVersion) {
          const migratedSettings = {
            ...defaultSettings,
            ...parsedSettings,
            systemPrompt: defaultSettings.systemPrompt,
            model: defaultSettings.model,
            settingsVersion: defaultSettings.settingsVersion
          };
          
          setSettings(prev => ({ ...prev, ...migratedSettings }));
          
          localStorage.setItem('indicore-settings', JSON.stringify(migratedSettings));
        } else {
          setSettings(prev => ({ ...prev, ...parsedSettings }));
        }
      } else {
        setSettings(defaultSettings);
        localStorage.setItem('indicore-settings', JSON.stringify(defaultSettings));
      }
    } catch (error) {
      setSettings(defaultSettings);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings) => {
    try {
      setSettings(newSettings);
      
      localStorage.setItem('indicore-settings', JSON.stringify(newSettings));
    } catch (error) {
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
