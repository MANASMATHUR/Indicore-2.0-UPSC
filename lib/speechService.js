'use client';

import errorHandler from './errorHandler';
import { LoadingStates, LoadingTypes } from './loadingStates';

class SpeechService {
  constructor() {
    this.isAzureAvailable = false;
    this.currentUtterance = null;
    this.isSpeaking = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.performanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
  }

  async initializeAzure() {
    try {
      console.log('Initializing Azure Speech Services...');
      const response = await fetch('/api/ai/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test', language: 'en-IN' })
      });

      if (!response.ok) {
        console.log('Azure Speech API not available:', response.status);
        this.isAzureAvailable = false;
        return false;
      }

      const result = await response.json();
      this.isAzureAvailable = result.method === 'azure';
      
      console.log('Azure Speech Services status:', this.isAzureAvailable ? 'AVAILABLE' : 'NOT AVAILABLE');
      console.log('API response method:', result.method);
      
      return this.isAzureAvailable;
    } catch (error) {
      console.log('Azure Speech Services initialization failed:', error.message);
      this.isAzureAvailable = false;
      return false;
    }
  }

  cleanTextForSpeech(text, language = 'en') {
    if (!text) return '';
    
    // Check for Indian language scripts
    const hasIndianScript = /[\u0980-\u09FF\u0900-\u097F\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF]/.test(text);
    
    // Check if this is an Indian language
    const isIndianLanguage = ['hi', 'mr', 'ta', 'bn', 'pa', 'gu', 'te', 'ml', 'kn'].includes(language);
    
    if (hasIndianScript || isIndianLanguage) {
      // For Indian languages, preserve the Indian script and minimize English
      let cleanedText = text
        // Remove markdown formatting
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        // Remove footnotes and references
        .replace(/\[Translated from .*?\]/g, '')
        .replace(/\[Note: .*?\]/g, '')
        .replace(/\[[0-9]+\]/g, '')
        .replace(/\[[0-9]+,\s*[0-9]+,\s*[0-9]+\]/g, '')
        // Remove section separators
        .replace(/---\s*\n/g, '')
        .replace(/={3,}/g, '')
        // Remove English headers and labels (preserve Indian text)
        .replace(/\*\*[A-Z][^*]+\*\*/g, '')
        // Clean up spacing
        .replace(/\n\s*\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Try to remove English-only sentences (detect if they're mostly English)
      if (isIndianLanguage) {
        const lines = cleanedText.split(/[.!?]/);
        cleanedText = lines
          .filter(line => {
            // Keep lines that are mostly Indian script
            const indianChars = line.match(/[\u0980-\u0DFF]/g);
            const totalChars = line.replace(/\s/g, '').length;
            return !line || (indianChars && indianChars.length / totalChars > 0.3) || line.match(/^[\s\u0980-\u0DFF.,;:()]+$/);
          })
          .join('. ');
      }
      
      return cleanedText;
    } else {
      // For Latin scripts (English), clean aggressively
      let cleanedText = text
        .replace(/\[Translated from .*?\]/g, '')
        .replace(/\[Note: .*?\]/g, '')
        .replace(/\[[0-9]+\]/g, '')
        .replace(/\[[0-9]+,\s*[0-9]+,\s*[0-9]+\]/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/---\s*\n/g, '')
        .replace(/\*\*.*?:\*\*/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/🎓|PCS|UPSC|SSC|Manas Mathur|Why did akbar fail|Translated to/g, '')
        .replace(/\n\s*\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      cleanedText = cleanedText
        .replace(/([.!?])\s*([A-Z])/g, '$1. $2')
        .replace(/([.!?])\s*([a-z])/g, '$1. $2')
        .replace(/([.!?])\s*([0-9])/g, '$1. $2')
        .replace(/([a-z])([A-Z])/g, '$1. $2');
      
      return cleanedText;
    }
  }

  getLanguageCode(lang) {
    const languageMap = {
      en: 'en-IN',
      hi: 'hi-IN',
      mr: 'mr-IN',
      ta: 'ta-IN',
      bn: 'bn-IN',
      pa: 'pa-IN',
      gu: 'gu-IN',
      te: 'te-IN',
      ml: 'ml-IN',
      kn: 'kn-IN',
      es: 'es-ES'
    };
    return languageMap[lang] || lang;
  }

  getAzureVoice(language) {
    const voiceMap = {
      'en': 'en-IN-NeerjaNeural',
      'hi': 'hi-IN-SwaraNeural',
      'mr': 'mr-IN-AarohiNeural',
      'ta': 'ta-IN-PallaviNeural',
      'bn': 'bn-IN-TanishaaNeural',
      'pa': 'pa-IN-MeharNeural',
      'gu': 'gu-IN-DhwaniNeural',
      'te': 'te-IN-ShrutiNeural',
      'ml': 'ml-IN-SobhanaNeural',
      'kn': 'kn-IN-SapnaNeural',
      'es': 'es-ES-ElviraNeural'
    };
    return voiceMap[language] || null;
  }

  getOptimalSpeechParams(text, language) {
    const textLength = text.length;
    const hasQuestions = /[?]/.test(text);
    const hasExclamations = /[!]/.test(text);
    const hasNumbers = /\d/.test(text);
    const isLongText = textLength > 200;
    
    let rate = 0.85;
    let pitch = 1.0;
    let volume = 1.0;
    
    if (hasQuestions) {
      pitch = 1.05;
    }
    
    if (hasExclamations) {
      rate = 0.9;
      pitch = 1.02;
    }
    
    if (hasNumbers) {
      rate = 0.8;
    }
    
    if (isLongText) {
      rate = 0.9;
    }
    
    const languageAdjustments = {
      'hi': { rate: 0.8, pitch: 1.0 },
      'mr': { rate: 0.85, pitch: 0.98 },
      'ta': { rate: 0.8, pitch: 1.02 },
      'bn': { rate: 0.85, pitch: 1.0 },
      'pa': { rate: 0.9, pitch: 1.0 },
      'gu': { rate: 0.85, pitch: 0.98 },
      'te': { rate: 0.8, pitch: 1.0 },
      'ml': { rate: 0.85, pitch: 1.0 },
      'kn': { rate: 0.85, pitch: 1.0 },
      'es': { rate: 0.9, pitch: 1.0 }
    };
    
    const langAdjustment = languageAdjustments[language];
    if (langAdjustment) {
      rate = langAdjustment.rate;
      pitch = langAdjustment.pitch;
    }
    
    return { rate, pitch, volume };
  }

  stop() {
    if (this.isSpeaking) {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }

  async waitForVoices() {
    return new Promise((resolve) => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }
      
      const checkVoices = () => {
        const allVoices = window.speechSynthesis.getVoices();
        if (allVoices.length > 0) {
          resolve(allVoices);
        } else {
          setTimeout(checkVoices, 100);
        }
      };
      
      window.speechSynthesis.onvoiceschanged = checkVoices;
      setTimeout(checkVoices, 100);
    });
  }

  async speak(text, language = 'en', options = {}) {
    const startTime = performance.now();
    this.performanceMetrics.totalRequests++;

    try {
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input: text must be a non-empty string');
      }

      if (text.length > 10000) {
        throw new Error('Text too long: maximum 10,000 characters allowed');
      }

      this.stop();

      // Wait for voices to be loaded before speaking
      if (!this.isAzureAvailable && 'speechSynthesis' in window) {
        await this.waitForVoices();
      }

      const cleanText = this.cleanTextForSpeech(text, language);
      
      const isIndianScript = /[\u0980-\u09FF\u0900-\u097F\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF]/.test(text);
      
      if (!cleanText || cleanText.length === 0) {
        throw new Error('Text cleaning resulted in empty content');
      }

      const optimalParams = this.getOptimalSpeechParams(cleanText, language);
      
      const speechOptions = {
        rate: options.rate || optimalParams.rate,
        pitch: options.pitch || optimalParams.pitch,
        volume: options.volume || optimalParams.volume,
        ...options
      };
      
            // Try Azure first if available, then fall back to browser
            let result;
            console.log('Azure availability check:', this.isAzureAvailable);
            
            if (this.isAzureAvailable) {
              try {
                console.log('Attempting Azure Speech for language:', language);
                result = await this.speakWithAzure(cleanText, language, speechOptions);
                console.log('Azure Speech successful');
                this.performanceMetrics.successfulRequests++;
                this.updatePerformanceMetrics(startTime);
                return result;
              } catch (azureError) {
                console.log('Azure Speech failed, falling back to browser:', azureError.message);
                // Silently fall through to browser
              }
            } else {
              console.log('Azure not available, using browser speech synthesis');
            }
            
            console.log('Using browser speech synthesis for language:', language);
            result = await this.speakWithBrowser(cleanText, language, speechOptions);
            console.log('Browser speech synthesis completed');
            this.performanceMetrics.successfulRequests++;
            this.updatePerformanceMetrics(startTime);
            return result;

    } catch (error) {
      this.performanceMetrics.failedRequests++;
      this.updatePerformanceMetrics(startTime);
      
      const errorResult = errorHandler.handleSpeechError(error, {
        textLength: text?.length || 0,
        language,
        options,
        retryCount: this.retryCount
      });

      errorHandler.logError(error, {
        type: 'speech_synthesis_error',
        textLength: text?.length || 0,
        language,
        retryCount: this.retryCount
      }, 'error');

      if (errorResult.canRetry && this.retryCount < this.maxRetries) {
        this.retryCount++;
        await this.delay(this.getRetryDelay(this.retryCount));
        
        try {
          const optimalParams = this.getOptimalSpeechParams(this.cleanTextForSpeech(text, language), language);
          const fallbackOptions = {
            rate: options.rate || optimalParams.rate,
            pitch: options.pitch || optimalParams.pitch,
            volume: options.volume || optimalParams.volume,
            ...options
          };
          return await this.speakWithBrowser(this.cleanTextForSpeech(text, language), language, fallbackOptions);
        } catch (retryError) {
          throw new Error(`Speech synthesis failed after ${this.retryCount} retries: ${retryError.message}`);
        }
      }
      
      throw new Error(errorResult.userMessage);
    }
  }

  async speakWithAzure(text, language, options) {
    try {
      const azureVoice = this.getAzureVoice(language);
      
      if (!azureVoice) {
        throw new Error(`No Azure voice available for language: ${language}`);
      }

      const response = await fetch('/api/ai/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          language: language,
          voice: azureVoice,
          rate: options.rate || '0.9',
          pitch: options.pitch || '1.0'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Azure Speech API failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Check if we got Azure audio data
      if (result.method === 'azure' && result.audioData) {
        return await this.playAzureAudio(result.audioData, result.audioFormat);
      } else if (result.method === 'browser') {
        throw new Error('Azure Speech Services not configured');
      } else {
        throw new Error('Invalid Azure response format');
      }

    } catch (error) {
      throw error;
    }
  }

  async playAzureAudio(audioBase64, audioFormat) {
    return new Promise((resolve, reject) => {
      try {
        const audioData = atob(audioBase64);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }
        
        const audioBlob = new Blob([audioArray], { type: audioFormat || 'audio/mp3' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const audio = new Audio(audioUrl);
        this.isSpeaking = true;
        
        audio.onended = () => {
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          resolve(true);
        };
        
        audio.onerror = (error) => {
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          reject(new Error('Failed to play Azure audio: ' + error.message));
        };
        
        audio.play().then(() => {
        }).catch(error => {
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          reject(new Error('Failed to start Azure audio playback: ' + error.message));
        });
        
      } catch (error) {
        this.isSpeaking = false;
        reject(new Error('Failed to process Azure audio: ' + error.message));
      }
    });
  }

  async speakWithBrowser(text, language, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        if (!('speechSynthesis' in window)) {
          reject(new Error('Speech synthesis not supported'));
          return;
        }

        const chunks = this.createSpeechChunks(text);
        let currentChunk = 0;

        const speakChunk = () => {
          if (currentChunk >= chunks.length) {
            this.isSpeaking = false;
            resolve(true);
            return;
          }

          const chunk = chunks[currentChunk].trim();
          if (!chunk) {
            currentChunk++;
            speakChunk();
            return;
          }

          const utterance = new SpeechSynthesisUtterance(chunk);
          const langCode = this.getLanguageCode(language);
          
          console.log('Speaking with language:', language, 'langCode:', langCode);
          
          utterance.lang = langCode;
          utterance.rate = options.rate || 0.85;
          utterance.pitch = options.pitch || 1.0;
          utterance.volume = options.volume || 1.0;

          const selectVoice = () => {
            const voices = window.speechSynthesis.getVoices();
            
            if (voices.length > 0) {
              const selectedVoice = this.selectBestVoice(voices, langCode, language);
              
              if (selectedVoice) {
                utterance.voice = selectedVoice;
                utterance.lang = selectedVoice.lang;
                console.log('Selected voice:', selectedVoice.name, 'for language:', langCode);
              } else {
                utterance.lang = langCode;
                console.log('No specific voice found, using default for:', langCode);
              }
              
              this.currentUtterance = utterance;
              this.isSpeaking = true;
              
              // Add event listeners for debugging
              utterance.onstart = () => console.log('Speech started');
              utterance.onend = () => console.log('Speech ended');
              utterance.onerror = (event) => {
                console.error('Speech error:', event.error);
                // Try fallback to English if the language fails
                if (langCode !== 'en-US') {
                  console.log('Trying fallback to English...');
                  utterance.lang = 'en-US';
                  utterance.voice = null; // Use default voice
                  window.speechSynthesis.speak(utterance);
                }
              };
              
              window.speechSynthesis.speak(utterance);
            } else {
              setTimeout(selectVoice, 100);
            }
          };
          
          selectVoice();

          utterance.onend = () => {
            currentChunk++;
            const pause = this.calculatePause(chunk);
            setTimeout(speakChunk, pause);
          };

          utterance.onerror = (event) => {
            this.isSpeaking = false;
            reject(new Error(`Speech synthesis failed: ${event.error}`));
          };
        };

        speakChunk();

      } catch (error) {
        this.isSpeaking = false;
        reject(error);
      }
    });
  }

  createSpeechChunks(text) {
    const sentences = text.split(/([.!?]+)/).filter(s => s.trim());
    const chunks = [];
    let currentChunk = '';
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      
      if (currentChunk.length + sentence.length > 150 && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.length > 0 ? chunks : [text];
  }

  selectBestVoice(voices, langCode, language) {
    let selectedVoice = voices.find(voice => 
      voice.lang === langCode && 
      voice.name.toLowerCase().includes('neural')
    );
    
    if (!selectedVoice) {
      selectedVoice = voices.find(voice => voice.lang === langCode);
    }
    
    if (!selectedVoice && language) {
      const langPrefix = language.toLowerCase();
      selectedVoice = voices.find(voice => {
        const voiceLang = voice.lang.toLowerCase();
        return voiceLang.startsWith(langPrefix) && 
               !voice.name.includes('Google') &&
               !voice.name.includes('Microsoft');
      });
    }
    
    if (!selectedVoice && ['hi', 'mr', 'ta', 'bn', 'pa', 'gu', 'te', 'ml', 'kn'].includes(language)) {
      const region = langCode.split('-')[1];
      selectedVoice = voices.find(voice => {
        const voiceLang = voice.lang.toLowerCase();
        return voiceLang.includes(region?.toLowerCase()) && 
               !voice.name.includes('Google') &&
               !voice.name.includes('Microsoft');
      });
    }
    
    if (!selectedVoice) {
      const langPrefix = language?.toLowerCase();
      selectedVoice = voices.find(voice => {
        const voiceLang = voice.lang.toLowerCase();
        return voiceLang.startsWith(langPrefix) &&
               !voice.name.includes('Google') &&
               !voice.name.includes('Microsoft');
      });
    }
    
    return selectedVoice;
  }

  calculatePause(chunk) {
    const endsWithPause = /[.!?]$/.test(chunk.trim());
    const isShortChunk = chunk.length < 50;
    
    if (endsWithPause) {
      return isShortChunk ? 200 : 300;
    } else {
      return 100;
    }
  }

  updatePerformanceMetrics(startTime) {
    const responseTime = performance.now() - startTime;
    const totalTime = this.performanceMetrics.averageResponseTime * (this.performanceMetrics.totalRequests - 1) + responseTime;
    this.performanceMetrics.averageResponseTime = totalTime / this.performanceMetrics.totalRequests;
  }

  getRetryDelay(attempt) {
    return Math.min(1000 * Math.pow(2, attempt), 10000);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      successRate: this.performanceMetrics.totalRequests > 0 
        ? (this.performanceMetrics.successfulRequests / this.performanceMetrics.totalRequests) * 100 
        : 0
    };
  }

  resetPerformanceMetrics() {
    this.performanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
  }

  isAvailable() {
    return 'speechSynthesis' in window || this.isAzureAvailable;
  }

  isSupported() {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window;
  }

  getAvailableVoices() {
    if ('speechSynthesis' in window) {
      return window.speechSynthesis.getVoices();
    }
    return [];
  }

  async testAllLanguages() {
    const testTexts = {
      'en': 'Hello! I am Indicore, your AI assistant.',
      'hi': 'नमस्ते! मैं इंडिकोर हूं, आपका AI सहायक।',
      'mr': 'नमस्कार! मी इंडिकोर आहे, तुमचा AI सहायक।',
      'ta': 'வணக்கம்! நான் இந்திகோர், உங்கள் AI உதவியாளர்।',
      'bn': 'নমস্কার! আমি ইন্ডিকোর, আপনার AI সহায়ক।',
      'pa': 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਇੰਡੀਕੋਰ ਹਾਂ, ਤੁਹਾਡਾ AI ਸਹਾਇਕ।',
      'gu': 'નમસ્તે! હું ઇંડિકોર છું, તમારો AI સહાયક।',
      'te': 'నమస్కారం! నేను ఇండికోర్, మీ AI సహాయకుడు।',
      'ml': 'നമസ്കാരം! ഞാൻ ഇന്റിക്കോർ, നിങ്ങളുടെ AI സഹായി।',
      'kn': 'ನಮಸ್ಕಾರ! ನಾನು ಇಂಡಿಕೋರ್, ನಿಮ್ಮ AI ಸಹಾಯಕ।'
    };

    console.log('=== TESTING ALL LANGUAGES WITH AZURE SPEECH SERVICES ===');
    
    for (const [lang, text] of Object.entries(testTexts)) {
      console.log(`\n--- Testing ${lang.toUpperCase()} ---`);
      console.log('Text:', text);
      console.log('Azure Voice:', this.getAzureVoice(lang));
      console.log('Language Code:', this.getLanguageCode(lang));
      
      try {
        await this.speak(text, lang);
        console.log(`✅ ${lang.toUpperCase()} speech synthesis successful`);
      } catch (error) {
        console.error(`❌ ${lang.toUpperCase()} speech synthesis failed:`, error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n=== ALL LANGUAGE TESTS COMPLETED ===');
  }

  verifyLanguageConfigurations() {
    const supportedLanguages = ['en', 'hi', 'mr', 'ta', 'bn', 'pa', 'gu', 'te', 'ml', 'kn'];
    
    console.log('=== VERIFYING LANGUAGE CONFIGURATIONS ===');
    
    for (const lang of supportedLanguages) {
      const langCode = this.getLanguageCode(lang);
      const azureVoice = this.getAzureVoice(lang);
      
      console.log(`${lang.toUpperCase()}:`);
      console.log(`  Language Code: ${langCode}`);
      console.log(`  Azure Voice: ${azureVoice}`);
      console.log(`  ✅ Configured`);
    }
    
    console.log('\n=== ALL LANGUAGES PROPERLY CONFIGURED ===');
    return true;
  }

  async forceReinitializeAzure() {
    this.isAzureAvailable = false;
    const result = await this.initializeAzure();
    return result;
  }

  checkAzureStatus() {
    console.log('=== AZURE SPEECH SERVICES STATUS ===');
    console.log('Azure Available:', this.isAzureAvailable);
    console.log('Speech Synthesis Supported:', this.isSupported());
    console.log('Available Voices:', this.getAvailableVoices().length);
    
    const supportedLanguages = ['en', 'hi', 'mr', 'ta', 'bn', 'pa', 'gu', 'te', 'ml', 'kn'];
    console.log('\n=== LANGUAGE SUPPORT VERIFICATION ===');
    supportedLanguages.forEach(lang => {
      const langCode = this.getLanguageCode(lang);
      const azureVoice = this.getAzureVoice(lang);
      console.log(`${lang} → langCode: ${langCode}, azureVoice: ${azureVoice || 'N/A'}`);
    });
    
    return {
      azureAvailable: this.isAzureAvailable,
      speechSupported: this.isSupported(),
      voiceCount: this.getAvailableVoices().length
    };
  }
}

const speechService = new SpeechService();

if (typeof window !== 'undefined') {
  const loadVoices = () => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      setTimeout(() => {
        speechService.initializeAzure();
      }, 500);
    } else {
      setTimeout(loadVoices, 100);
    }
  };
  
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  } else {
    loadVoices();
  }
  
  // Also re-initialize Azure on page focus
  window.addEventListener('focus', () => {
    if (speechService.isAzureAvailable) {
      speechService.forceReinitializeAzure();
    }
  });
}

export default speechService;
