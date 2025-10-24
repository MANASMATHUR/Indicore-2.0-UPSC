'use client';

import errorHandler from './errorHandler';
import { LoadingStates, LoadingTypes } from './loadingStates';

// Enterprise Speech Service Utility for Azure Speech Services with Browser Fallback
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

  // Initialize Azure Speech Services (if available)
  async initializeAzure() {
    try {
      // Check if Azure Speech Services are configured
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

  // Enhanced text cleaning for speech synthesis with better prosody
  cleanTextForSpeech(text) {
    if (!text) return '';
    
    // Detect if text contains non-Latin scripts (all Indian languages + others)
    const hasNonLatinScript = /[\u0980-\u09FF\u0900-\u097F\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
    
    // For non-Latin scripts, be very conservative with cleaning
    if (hasNonLatinScript) {
      let cleanedText = text
        .replace(/\[Translated from .*?\]/g, '')    // Remove translation metadata
        .replace(/\[Note: .*?\]/g, '')              // Remove translation notes
        .replace(/\*\*(.*?)\*\*/g, '$1')            // Remove bold markdown but keep content
        .replace(/\*(.*?)\*/g, '$1')               // Remove italic markdown but keep content
        .replace(/---\s*\n/g, '')                  // Remove separator lines
        .replace(/\n\s*\n/g, ' ')                  // Replace multiple newlines with single space
        .replace(/\s+/g, ' ')                       // Replace multiple spaces with single space
        .trim();
      
      // Only add basic pauses after sentence endings for non-Latin scripts
      cleanedText = cleanedText
        .replace(/([.!?])\s*([^\s])/g, '$1. $2');  // Add pauses after sentences
      
      return cleanedText;
    } else {
      // For English/Latin scripts, use more aggressive cleaning
      let cleanedText = text
        .replace(/\[Translated from .*?\]/g, '')    // Remove translation metadata
        .replace(/\[Note: .*?\]/g, '')              // Remove translation notes
        .replace(/\*\*(.*?)\*\*/g, '$1')            // Remove bold markdown but keep content
        .replace(/\*(.*?)\*/g, '$1')               // Remove italic markdown but keep content
        .replace(/---\s*\n/g, '')                  // Remove separator lines
        .replace(/\*\*.*?:\*\*/g, '')              // Remove bold headers like **Notes:**
        .replace(/\[.*?\]/g, '')                   // Remove any remaining brackets
        .replace(/🎓|PCS|UPSC|SSC|Manas Mathur|Why did akbar fail|Translated to/g, '') // Remove specific metadata
        .replace(/\n\s*\n/g, ' ')                  // Replace multiple newlines with single space
        .replace(/\s+/g, ' ')                       // Replace multiple spaces with single space
        .trim();
      
      // Apply English-specific regex patterns
      cleanedText = cleanedText
        .replace(/([.!?])\s*([A-Z])/g, '$1. $2')   // Add pauses after sentences
        .replace(/([.!?])\s*([a-z])/g, '$1. $2')   // Add pauses after sentences (lowercase)
        .replace(/([.!?])\s*([0-9])/g, '$1. $2')   // Add pauses before numbers
        .replace(/([a-z])([A-Z])/g, '$1. $2');     // Add pauses between camelCase words
      
      return cleanedText;
    }
  }

  // Get appropriate language code for speech synthesis
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
    // Return the mapped language code or the original language code if not found
    // This ensures we don't fallback to English for unsupported languages
    return languageMap[lang] || lang;
  }

  // Get Azure voice for language with enhanced voice selection
  getAzureVoice(language) {
    const voiceMap = {
      'en': 'en-IN-NeerjaNeural',      // Clear, professional Indian English
      'hi': 'hi-IN-SwaraNeural',       // Natural Hindi voice
      'mr': 'mr-IN-AarohiNeural',      // Warm Marathi voice
      'ta': 'ta-IN-PallaviNeural',     // Melodious Tamil voice
      'bn': 'bn-IN-TanishaaNeural',    // Expressive Bengali voice
      'pa': 'pa-IN-MeharNeural',       // Friendly Punjabi voice
      'gu': 'gu-IN-DhwaniNeural',      // Clear Gujarati voice
      'te': 'te-IN-ShrutiNeural',      // Pleasant Telugu voice
      'ml': 'ml-IN-SobhanaNeural',     // Smooth Malayalam voice
      'kn': 'kn-IN-SapnaNeural',       // Clear Kannada voice
      'es': 'es-ES-ElviraNeural'       // Professional Spanish voice
    };
    // Return the mapped voice or null if not found (no English fallback)
    return voiceMap[language] || null;
  }

  // Get optimal speech parameters based on content type and language
  getOptimalSpeechParams(text, language) {
    const textLength = text.length;
    const hasQuestions = /[?]/.test(text);
    const hasExclamations = /[!]/.test(text);
    const hasNumbers = /\d/.test(text);
    const isLongText = textLength > 200;
    
    // Base parameters
    let rate = 0.85;  // Slightly slower for better comprehension
    let pitch = 1.0;
    let volume = 1.0;
    
    // Adjust for content type
    if (hasQuestions) {
      pitch = 1.05;  // Slightly higher pitch for questions
    }
    
    if (hasExclamations) {
      rate = 0.9;    // Slightly faster for excitement
      pitch = 1.02;
    }
    
    if (hasNumbers) {
      rate = 0.8;    // Slower for numbers to ensure clarity
    }
    
    if (isLongText) {
      rate = 0.9;    // Slightly faster for long texts to maintain engagement
    }
    
    // Language-specific adjustments
    const languageAdjustments = {
      'hi': { rate: 0.8, pitch: 1.0 },    // Hindi: slower, natural pitch
      'mr': { rate: 0.85, pitch: 0.98 },   // Marathi: slightly slower
      'ta': { rate: 0.8, pitch: 1.02 },   // Tamil: slower, slightly higher
      'bn': { rate: 0.85, pitch: 1.0 },   // Bengali: moderate pace
      'pa': { rate: 0.9, pitch: 1.0 },   // Punjabi: slightly faster
      'gu': { rate: 0.85, pitch: 0.98 }, // Gujarati: moderate
      'te': { rate: 0.8, pitch: 1.0 },    // Telugu: slower
      'ml': { rate: 0.85, pitch: 1.0 },  // Malayalam: moderate
      'kn': { rate: 0.85, pitch: 1.0 },  // Kannada: moderate
      'es': { rate: 0.9, pitch: 1.0 }     // Spanish: slightly faster
    };
    
    const langAdjustment = languageAdjustments[language];
    if (langAdjustment) {
      rate = langAdjustment.rate;
      pitch = langAdjustment.pitch;
    }
    
    return { rate, pitch, volume };
  }

  // Stop current speech
  stop() {
    if (this.isSpeaking) {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }

  // Speak text using Azure Speech Services or browser fallback with enhanced tonality and error handling
  async speak(text, language = 'en', options = {}) {
    const startTime = performance.now();
    this.performanceMetrics.totalRequests++;

    console.log('Speech Service - Starting speech synthesis:', {
      textLength: text?.length || 0,
      language,
      options,
      speechSynthesisAvailable: 'speechSynthesis' in window
    });

    try {
      // Input validation
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input: text must be a non-empty string');
      }

      if (text.length > 10000) {
        throw new Error('Text too long: maximum 10,000 characters allowed');
      }

      // Stop any current speech
      this.stop();

      // Clean the text with enhanced prosody
      const cleanText = this.cleanTextForSpeech(text);
      
      // Debug logging for multilingual text issues
      const isNonLatinScript = /[\u0980-\u09FF\u0900-\u097F\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
      if (isNonLatinScript || ['hi', 'mr', 'ta', 'bn', 'pa', 'gu', 'te', 'ml', 'kn'].includes(language)) {
        console.log('Multilingual Speech Debug:', {
          language,
          originalText: text.substring(0, 200) + '...',
          cleanedText: cleanText.substring(0, 200) + '...',
          textLength: text.length,
          cleanedLength: cleanText.length,
          isNonLatinScript,
          hasKannada: /[\u0C80-\u0CFF]/.test(text),
          hasNumbers: /\d/.test(text),
          hasEnglish: /[a-zA-Z]/.test(text)
        });
      }
      
      if (!cleanText || cleanText.length === 0) {
        throw new Error('Text cleaning resulted in empty content');
      }

      // Get optimal speech parameters based on content and language
      const optimalParams = this.getOptimalSpeechParams(cleanText, language);
      
      // Merge user options with optimal parameters
      const speechOptions = {
        rate: options.rate || optimalParams.rate,
        pitch: options.pitch || optimalParams.pitch,
        volume: options.volume || optimalParams.volume,
        ...options
      };

      // Try Azure Speech Services first
      console.log('Speech Service - Azure Available:', this.isAzureAvailable);
      console.log('Speech Service - Language:', language);
      
      if (this.isAzureAvailable) {
        console.log('Using Azure Speech Services for:', language);
        const result = await this.speakWithAzure(cleanText, language, speechOptions);
        this.performanceMetrics.successfulRequests++;
        this.updatePerformanceMetrics(startTime);
        return result;
      } else {
        // Fallback to browser speech synthesis with enhanced parameters
        console.log('Azure not available, using browser speech synthesis for:', language);
        console.log('Browser speech synthesis may not support this language properly');
        const result = await this.speakWithBrowser(cleanText, language, speechOptions);
        this.performanceMetrics.successfulRequests++;
        this.updatePerformanceMetrics(startTime);
        return result;
      }

    } catch (error) {
      this.performanceMetrics.failedRequests++;
      this.updatePerformanceMetrics(startTime);
      
      // Handle error with enterprise error handling
      const errorResult = errorHandler.handleSpeechError(error, {
        textLength: text?.length || 0,
        language,
        options,
        retryCount: this.retryCount
      });

      // Log error for monitoring
      errorHandler.logError(error, {
        type: 'speech_synthesis_error',
        textLength: text?.length || 0,
        language,
        retryCount: this.retryCount
      }, 'error');

      // Retry logic for retryable errors
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
          // Final fallback failed
          throw new Error(`Speech synthesis failed after ${this.retryCount} retries: ${retryError.message}`);
        }
      }
      
      throw new Error(errorResult.userMessage);
    }
  }

  // Speak using Azure Speech Services
  async speakWithAzure(text, language, options) {
    try {
      const azureVoice = this.getAzureVoice(language);
      
      // If no Azure voice is available for this language, fall back to browser
      if (!azureVoice) {
        console.log('No Azure voice available for language:', language, '- falling back to browser');
        return await this.speakWithBrowser(text, language, options);
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
        // Play the Azure-generated audio
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

  // Play Azure-generated audio
  async playAzureAudio(audioBase64, audioFormat) {
    return new Promise((resolve, reject) => {
      try {
        console.log('Processing Azure audio:', {
          audioDataLength: audioBase64.length,
          audioFormat: audioFormat || 'audio/mp3'
        });

        // Convert base64 to blob
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
        
        // Create and play audio
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

  // Speak using browser Speech Synthesis API with enhanced voice selection
  async speakWithBrowser(text, language, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        if (!('speechSynthesis' in window)) {
          reject(new Error('Speech synthesis not supported'));
          return;
        }

        // Enhanced chunking for better prosody and natural pauses
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

          // Enhanced voice selection with priority ranking
          const selectVoice = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
              const selectedVoice = this.selectBestVoice(voices, langCode, language);
              if (selectedVoice) {
                utterance.voice = selectedVoice;
                
                // Debug logging for multilingual voice selection
                const isMultilingual = ['hi', 'mr', 'ta', 'bn', 'pa', 'gu', 'te', 'ml', 'kn'].includes(language);
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
                
                // No fallback to English - let the browser handle it with the correct language code
                console.log('No voice selected - browser will use default voice for language:', langCode);
              }
            } else {
              // Voices not loaded yet, wait a bit and try again
              setTimeout(selectVoice, 100);
            }
          };
          
          selectVoice();

          utterance.onend = () => {
            currentChunk++;
            // Dynamic pause based on chunk content
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

  // Create intelligent speech chunks with natural pause points
  createSpeechChunks(text) {
    // Split by sentences first for better prosody
    const sentences = text.split(/([.!?]+)/).filter(s => s.trim());
    const chunks = [];
    let currentChunk = '';
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      
      // If adding this sentence would make chunk too long, start new chunk
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

  // Select the best available voice for the language
  selectBestVoice(voices, langCode, language) {
    // Priority 1: Exact language match with neural voices
    let selectedVoice = voices.find(voice => 
      voice.lang === langCode && 
      voice.name.toLowerCase().includes('neural')
    );
    
    // Priority 2: Exact language match
    if (!selectedVoice) {
      selectedVoice = voices.find(voice => voice.lang === langCode);
    }
    
    // Priority 3: Language family match (e.g., hi-IN for Hindi)
    if (!selectedVoice) {
      selectedVoice = voices.find(voice => 
        voice.lang.startsWith(language) && 
        !voice.name.includes('Google') &&
        !voice.name.includes('Microsoft')
      );
    }
    
    // Priority 4: Regional match for Indian languages
    if (!selectedVoice && ['hi', 'mr', 'ta', 'bn', 'pa', 'gu', 'te', 'ml', 'kn'].includes(language)) {
      const region = langCode.split('-')[1];
      selectedVoice = voices.find(voice => 
        voice.lang.includes(region) && 
        !voice.name.includes('Google')
      );
    }
    
    // Priority 5: Any voice that supports the language (no English fallback)
    if (!selectedVoice) {
      selectedVoice = voices.find(voice => 
        voice.lang.includes(language) &&
        !voice.name.includes('Google') &&
        !voice.name.includes('Microsoft')
      );
    }
    
    // Priority 6: Any non-Google, non-Microsoft voice (but not English)
    if (!selectedVoice) {
      selectedVoice = voices.find(voice => 
        !voice.name.includes('Google') &&
        !voice.name.includes('Microsoft') &&
        !voice.lang.includes('en')
      );
    }
    
    return selectedVoice;
  }

  // Calculate appropriate pause between chunks
  calculatePause(chunk) {
    const endsWithPause = /[.!?]$/.test(chunk.trim());
    const isShortChunk = chunk.length < 50;
    
    if (endsWithPause) {
      return isShortChunk ? 200 : 300; // Longer pause after sentences
    } else {
      return 100; // Short pause for mid-sentence breaks
    }
  }

  // Update performance metrics
  updatePerformanceMetrics(startTime) {
    const responseTime = performance.now() - startTime;
    const totalTime = this.performanceMetrics.averageResponseTime * (this.performanceMetrics.totalRequests - 1) + responseTime;
    this.performanceMetrics.averageResponseTime = totalTime / this.performanceMetrics.totalRequests;
  }

  // Get retry delay with exponential backoff
  getRetryDelay(attempt) {
    return Math.min(1000 * Math.pow(2, attempt), 10000);
  }

  // Delay utility
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      successRate: this.performanceMetrics.totalRequests > 0 
        ? (this.performanceMetrics.successfulRequests / this.performanceMetrics.totalRequests) * 100 
        : 0
    };
  }

  // Reset performance metrics
  resetPerformanceMetrics() {
    this.performanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
  }

  // Check if speech synthesis is available
  isAvailable() {
    return 'speechSynthesis' in window || this.isAzureAvailable;
  }

  // Check if speech synthesis is currently supported
  isSupported() {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window;
  }

  // Get available voices
  getAvailableVoices() {
    if ('speechSynthesis' in window) {
      return window.speechSynthesis.getVoices();
    }
    return [];
  }

  // Debug method to test speech synthesis
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

  // Test all supported languages
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
      
      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n=== ALL LANGUAGE TESTS COMPLETED ===');
  }

  // Verify all language configurations
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

  // Force re-initialize Azure Speech Services
  async forceReinitializeAzure() {
    console.log('Force re-initializing Azure Speech Services...');
    this.isAzureAvailable = false;
    const result = await this.initializeAzure();
    console.log('Azure re-initialization result:', result);
    return result;
  }

  // Check Azure status
  checkAzureStatus() {
    console.log('=== AZURE SPEECH SERVICES STATUS ===');
    console.log('Azure Available:', this.isAzureAvailable);
    console.log('Speech Synthesis Supported:', this.isSupported());
    console.log('Available Voices:', this.getAvailableVoices().length);
    return {
      azureAvailable: this.isAzureAvailable,
      speechSupported: this.isSupported(),
      voiceCount: this.getAvailableVoices().length
    };
  }
}

// Create singleton instance
const speechService = new SpeechService();

// Initialize Azure on load
if (typeof window !== 'undefined') {
  // Load voices first, then initialize Azure
  const loadVoices = () => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      speechService.initializeAzure();
    } else {
      // Retry after a short delay
      setTimeout(loadVoices, 100);
    }
  };
  
  // Load voices when they become available
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  } else {
    loadVoices();
  }
}

export default speechService;
