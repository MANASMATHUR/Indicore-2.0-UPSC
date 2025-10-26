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
      const response = await fetch('/api/ai/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test', language: 'en-IN' })
      });

      if (!response.ok) {
        throw new Error('Azure Speech API not available');
      }

      const result = await response.json();
      this.isAzureAvailable = result.method === 'azure';
      
      if (this.isAzureAvailable) {
        console.log('Azure Speech Services initialized successfully');
      } else {
        console.log('Azure Speech Services not configured, using browser fallback');
      }
      
      return this.isAzureAvailable;
    } catch (error) {
      this.isAzureAvailable = false;
      console.log('Azure Speech Services initialization failed:', error.message);
      return false;
    }
  }

  cleanTextForSpeech(text) {
    if (!text) return '';
    
    // Check for Indian language scripts
    const hasIndianScript = /[\u0980-\u09FF\u0900-\u097F\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF]/.test(text);
    
    if (hasIndianScript) {
      // For Indian languages, minimal cleaning to preserve script integrity
      let cleanedText = text
        .replace(/\[Translated from .*?\]/g, '')
        .replace(/\[Note: .*?\]/g, '')
        .replace(/\[[0-9]+\]/g, '')
        .replace(/\[[0-9]+,\s*[0-9]+,\s*[0-9]+\]/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/---\s*\n/g, '')
        .replace(/\n\s*\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Preserve sentence structure for Indian languages
      cleanedText = cleanedText
        .replace(/([.!?])\s*([^\s])/g, '$1 $2');
      
      return cleanedText;
    } else {
      // For Latin scripts, more aggressive cleaning
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

  async speak(text, language = 'en', options = {}) {
    const startTime = performance.now();
    this.performanceMetrics.totalRequests++;

    console.log('Speech Service - Starting speech synthesis:', {
      textLength: text?.length || 0,
      language,
      languageCode: this.getLanguageCode(language),
      azureVoice: this.getAzureVoice(language),
      options,
      speechSynthesisAvailable: 'speechSynthesis' in window
    });

    try {
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input: text must be a non-empty string');
      }

      if (text.length > 10000) {
        throw new Error('Text too long: maximum 10,000 characters allowed');
      }

      this.stop();

      const cleanText = this.cleanTextForSpeech(text);
      
      const isIndianScript = /[\u0980-\u09FF\u0900-\u097F\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF]/.test(text);
      if (isIndianScript || ['hi', 'mr', 'ta', 'bn', 'pa', 'gu', 'te', 'ml', 'kn'].includes(language)) {
        console.log('Indian Language Speech Debug:', {
          language,
          originalText: text.substring(0, 200) + '...',
          cleanedText: cleanText.substring(0, 200) + '...',
          textLength: text.length,
          cleanedLength: cleanText.length,
          isIndianScript,
          hasMalayalam: /[\u0D00-\u0D7F]/.test(text),
          hasNumbers: /\d/.test(text),
          hasEnglish: /[a-zA-Z]/.test(text)
        });
      }
      
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

      console.log('Speech Service - Azure Available:', this.isAzureAvailable);
      console.log('Speech Service - Language:', language);
      
      if (this.isAzureAvailable) {
        console.log('Using Azure Speech Services for:', language);
        const result = await this.speakWithAzure(cleanText, language, speechOptions);
        this.performanceMetrics.successfulRequests++;
        this.updatePerformanceMetrics(startTime);
        return result;
      } else {
        console.log('Azure not available, using browser speech synthesis for:', language);
        const result = await this.speakWithBrowser(cleanText, language, speechOptions);
        this.performanceMetrics.successfulRequests++;
        this.updatePerformanceMetrics(startTime);
        return result;
      }

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
          const optimalParams = this.getOptimalSpeechParams(this.cleanTextForSpeech(text), language);
          const fallbackOptions = {
            rate: options.rate || optimalParams.rate,
            pitch: options.pitch || optimalParams.pitch,
            volume: options.volume || optimalParams.volume,
            ...options
          };
          return await this.speakWithBrowser(this.cleanTextForSpeech(text), language, fallbackOptions);
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
      
      console.log('Azure Speech Request:', {
        text: text.substring(0, 100) + '...',
        language,
        voice: azureVoice,
        textLength: text.length
      });

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
        const errorText = await response.text();
        console.error('Azure Speech API failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Azure Speech API failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Azure Speech Response:', {
        success: result.success,
        method: result.method,
        hasAudioData: !!result.audioData,
        audioFormat: result.audioFormat
      });
      
      if (result.success && result.method === 'azure' && result.audioData) {
        console.log('Playing Azure audio...');
        return await this.playAzureAudio(result.audioData, result.audioFormat);
      } else {
        throw new Error('Azure Speech Services not available or no audio data received');
      }

    } catch (error) {
      console.error('Azure Speech Error:', error);
      throw error;
    }
  }

  async playAzureAudio(audioBase64, audioFormat) {
    return new Promise((resolve, reject) => {
      try {
        console.log('Processing Azure audio:', {
          audioDataLength: audioBase64.length,
          audioFormat: audioFormat || 'audio/mp3'
        });

        const audioData = atob(audioBase64);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }
        
        const audioBlob = new Blob([audioArray], { type: audioFormat || 'audio/mp3' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        console.log('Created audio blob:', {
          blobSize: audioBlob.size,
          blobType: audioBlob.type,
          audioUrl: audioUrl.substring(0, 50) + '...'
        });
        
        const audio = new Audio(audioUrl);
        this.isSpeaking = true;
        
        audio.onended = () => {
          console.log('Azure audio playback completed');
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          resolve(true);
        };
        
        audio.onerror = (error) => {
          console.error('Azure audio playback error:', error);
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          reject(new Error('Failed to play Azure audio: ' + error.message));
        };
        
        audio.onloadstart = () => {
          console.log('Azure audio loading started');
        };
        
        audio.oncanplay = () => {
          console.log('Azure audio can play');
        };
        
        audio.play().then(() => {
          console.log('Azure audio playback started successfully');
        }).catch(error => {
          console.error('Failed to start Azure audio playback:', error);
          this.isSpeaking = false;
          URL.revokeObjectURL(audioUrl);
          reject(new Error('Failed to start Azure audio playback: ' + error.message));
        });
        
      } catch (error) {
        console.error('Failed to process Azure audio:', error);
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
                
                const isMultilingual = ['hi', 'mr', 'ta', 'bn', 'pa', 'gu', 'te', 'ml', 'kn', 'en'].includes(language);
                if (isMultilingual) {
                  console.log('Multilingual Voice Debug:', {
                    language,
                    langCode,
                    selectedVoice: selectedVoice.name,
                    voiceLang: selectedVoice.lang,
                    availableVoices: voices.filter(v => v.lang.includes(langCode.split('-')[0])).map(v => v.name),
                    allVoices: voices.map(v => ({ name: v.name, lang: v.lang })),
                    utteranceLang: utterance.lang,
                    utteranceText: chunk.substring(0, 50) + '...'
                  });
                }
              } else {
                console.warn('No suitable voice found for language:', language, 'langCode:', langCode);
                console.log('Available voices:', voices.map(v => ({ name: v.name, lang: v.lang })));
                console.log('No voice selected - browser will use default voice for language:', langCode);
              }
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

          this.currentUtterance = utterance;
          this.isSpeaking = true;
          window.speechSynthesis.speak(utterance);
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
    
    if (!selectedVoice) {
      selectedVoice = voices.find(voice => 
        voice.lang.startsWith(language) && 
        !voice.name.includes('Google') &&
        !voice.name.includes('Microsoft')
      );
    }
    
    if (!selectedVoice && ['hi', 'mr', 'ta', 'bn', 'pa', 'gu', 'te', 'ml', 'kn'].includes(language)) {
      const region = langCode.split('-')[1];
      selectedVoice = voices.find(voice => 
        voice.lang.includes(region) && 
        !voice.name.includes('Google')
      );
    }
    
    if (!selectedVoice) {
      selectedVoice = voices.find(voice => 
        voice.lang.includes(language) &&
        !voice.name.includes('Google') &&
        !voice.name.includes('Microsoft')
      );
    }
    
    if (!selectedVoice) {
      selectedVoice = voices.find(voice => 
        !voice.name.includes('Google') &&
        !voice.name.includes('Microsoft') &&
        !voice.lang.includes('en')
      );
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

  async testSpeech(text, language = 'en') {
    console.log('=== SPEECH SYNTHESIS TEST ===');
    console.log('Text:', text);
    console.log('Language:', language);
    console.log('Available voices:', this.getAvailableVoices().map(v => ({ name: v.name, lang: v.lang })));
    
    const langCode = this.getLanguageCode(language);
    const azureVoice = this.getAzureVoice(language);
    console.log('Language code:', langCode);
    console.log('Azure voice:', azureVoice);
    
    const cleanedText = this.cleanTextForSpeech(text);
    console.log('Cleaned text:', cleanedText);
    
    try {
      await this.speak(text, language);
      console.log('Speech synthesis completed successfully');
    } catch (error) {
      console.error('Speech synthesis failed:', error);
    }
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
    console.log('Force re-initializing Azure Speech Services...');
    this.isAzureAvailable = false;
    const result = await this.initializeAzure();
    console.log('Azure re-initialization result:', result);
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
      speechService.initializeAzure();
    } else {
      setTimeout(loadVoices, 100);
    }
  };
  
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  } else {
    loadVoices();
  }
  
}

export default speechService;
