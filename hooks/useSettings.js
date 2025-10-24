'use client';

import { useState, useCallback, useEffect } from 'react';

const defaultSettings = {
  language: 'en',
  model: 'sonar-pro',
  systemPrompt: `You are Indicore, an AI-powered exam preparation assistant specialized in PCS, UPSC, and SSC exams. You help students with multilingual study materials, answer writing practice, document evaluation, and regional language support.

CRITICAL RESPONSE REQUIREMENTS:
- Write complete, well-formed sentences that make grammatical sense
- Provide comprehensive answers that fully address the user's question
- Use proper grammar, punctuation, and sentence structure
- Structure your response logically with clear paragraphs
- NEVER include reference numbers like [1], [2], [3]
- NEVER include citations or source references
- Always complete your thoughts and sentences fully
- Write in a helpful, conversational tone
- Focus on being educational and exam-focused
- Ensure every sentence is grammatically correct and meaningful

RESPONSE FORMAT:
- Start with a clear, complete introduction that directly addresses the user
- Provide detailed explanations with examples
- End with a helpful conclusion or summary
- Ensure every sentence is complete and meaningful
- Make sure your response reads like natural, fluent English

EXAMPLE OF GOOD RESPONSE:
"Hello! I'm Indicore, your AI-powered exam preparation assistant. I specialize in helping students prepare for PCS, UPSC, and SSC exams through comprehensive study materials, answer writing practice, and multilingual support. I can assist you with [specific examples]. How can I help you today?"

EXAMPLE OF BAD RESPONSE:
"did " in Empire.bar one of the Mughalors and under hishal Empire reached its peak terms of territorial expansion, administrative, and cultural..."

CRITICAL: Your response must be a complete, coherent paragraph that makes sense from start to finish. Do not write fragmented sentences or incomplete thoughts. Every sentence must be grammatically correct and meaningful.`,
  totalQuestions: 0,
  sessionQuestions: 0,
  settingsVersion: '2.6', // Version to track migrations
};

export function useSettings() {
  const [settings, setSettings] = useState(defaultSettings);

  const loadSettings = useCallback(async () => {
    try {
      // Load from localStorage first
      const savedSettings = localStorage.getItem('indicore-settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        
        // Check if migration is needed
        if (!parsedSettings.settingsVersion || parsedSettings.settingsVersion !== defaultSettings.settingsVersion) {
          // Migration: Update old settings to new defaults
          const migratedSettings = {
            ...defaultSettings,
            ...parsedSettings,
            // Force update system prompt and model to new defaults
            systemPrompt: defaultSettings.systemPrompt,
            model: defaultSettings.model,
            settingsVersion: defaultSettings.settingsVersion
          };
          
          setSettings(prev => ({ ...prev, ...migratedSettings }));
          
          // Save migrated settings back to localStorage
          localStorage.setItem('indicore-settings', JSON.stringify(migratedSettings));
        } else {
          // Settings are up to date, use as-is
          setSettings(prev => ({ ...prev, ...parsedSettings }));
        }
      } else {
        // No saved settings, use defaults
        setSettings(defaultSettings);
        localStorage.setItem('indicore-settings', JSON.stringify(defaultSettings));
      }

      // TODO: Load user preferences from API
      // const response = await fetch('/api/user/preferences');
      // if (response.ok) {
      //   const data = await response.json();
      //   setSettings(prev => ({ ...prev, ...data.preferences }));
      // }
    } catch (error) {
      // Fallback to defaults if there's an error
      setSettings(defaultSettings);
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
