'use client';

// Import Azure Speech SDK from npm package instead of CDN (fixes CORS issues)
let SpeechSDK = null;
if (typeof window !== 'undefined') {
  import('microsoft-cognitiveservices-speech-sdk').then(sdk => {
    SpeechSDK = sdk;
    console.log('[Azure Speech] SDK imported from npm package');
  }).catch(err => {
    console.error('[Azure Speech] Failed to import SDK from npm:', err);
  });
}

class AzureSpeechRecognition {
  constructor() {
    this.recognizer = null;
    this.speechConfig = null;
    this.audioConfig = null;
    this.isListening = false;
    this.isAzureAvailable = false;
    this.finalTranscript = '';
    this.interimTranscript = '';
    this.onTranscriptUpdate = null;
    this.onError = null;
    this.onListeningStateChange = null;
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.audioLevel = 0;
    this.mediaStream = null;
    this.azureToken = null;
    this.azureRegion = null;
  }

  async initialize() {
    try {
      console.log('[Azure Speech] Starting initialization...');

      // Check if running in browser
      if (typeof window === 'undefined') {
        console.log('[Azure Speech] Not in browser environment');
        return false;
      }


      // Wait for SDK to be imported from npm package
      if (!SpeechSDK) {
        console.log('[Azure Speech] Waiting for SDK to be imported from npm...');

        let attempts = 0;
        const maxAttempts = 100; //10 seconds

        while (!SpeechSDK && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!SpeechSDK) {
          console.error('[Azure Speech] SDK import timeout - SDK not available after 10 seconds');
          this.isAzureAvailable = false;
          return false;
        }
      }

      console.log('[Azure Speech] SDK successfully available!');

      // Check Azure credentials by getting token
      console.log('[Azure Speech] Fetching token from server...');
      const tokenResponse = await fetch('/api/ai/speech-token');
      const tokenData = await tokenResponse.json();
      console.log('[Azure Speech] Token response:', { available: tokenData.available, hasToken: !!tokenData.token });

      if (tokenData.available && tokenData.token) {
        this.azureToken = tokenData.token;
        this.azureRegion = tokenData.region;
        this.isAzureAvailable = true;
        console.log('[Azure Speech] ✅ Azure Speech is AVAILABLE and configured!');
        return true;
      }

      this.isAzureAvailable = false;
      console.warn('[Azure Speech] Token not available, using browser fallback');
      return false;
    } catch (error) {
      console.error('[Azure Speech] ❌ Initialization failed:', error.message);
      console.warn('[Azure Speech] Falling back to browser recognition');
      this.isAzureAvailable = false;
      return false;
    }
  }

  getLanguageCode(language) {
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
    return languageMap[language] || language || 'en-IN';
  }

  async startRecognition(language = 'en', options = {}) {
    if (this.isListening) {
      this.stopRecognition();
    }

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Store stream reference for cleanup
      this.mediaStream = stream;

      // Initialize audio visualization
      this.initializeAudioVisualization(stream);

      if (this.isAzureAvailable && window.SpeechSDK) {
        await this.startAzureRecognition(language, stream);
      } else {
        await this.startBrowserRecognition(language);
      }
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        const errorMsg = 'Microphone access denied. Please allow microphone access in your browser settings.';
        if (this.onError) this.onError(new Error(errorMsg));
        throw new Error(errorMsg);
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        const errorMsg = 'No microphone found. Please connect a microphone and try again.';
        if (this.onError) this.onError(new Error(errorMsg));
        throw new Error(errorMsg);
      } else {
        console.error('Error starting recognition:', error);
        if (this.onError) this.onError(error);
        throw error;
      }
    }
  }

  async startAzureRecognition(language, stream) {
    try {
      if (!SpeechSDK) {
        throw new Error('Azure Speech SDK not loaded');
      }

      // Get or refresh Azure token
      if (!this.azureToken) {
        const tokenResponse = await fetch('/api/ai/speech-token');
        const tokenData = await tokenResponse.json();

        if (!tokenData.available || !tokenData.token) {
          throw new Error('Azure Speech token not available');
        }

        this.azureToken = tokenData.token;
        this.azureRegion = tokenData.region;
      }

      const langCode = this.getLanguageCode(language);

      // Create speech config from token
      this.speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
        this.azureToken,
        this.azureRegion
      );
      this.speechConfig.speechRecognitionLanguage = langCode;
      this.speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;

      // Set properties for better recognition
      this.speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
        "5000"
      );
      this.speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
        "2000"
      );

      // Create audio config from default microphone
      this.audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      // Create recognizer
      this.recognizer = new SpeechSDK.SpeechRecognizer(this.speechConfig, this.audioConfig);

      // Set up event handlers
      this.recognizer.recognizing = (s, e) => {
        if (e.result.text) {
          this.interimTranscript = e.result.text;
          this.updateTranscript();
        }
      };

      this.recognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          this.finalTranscript += e.result.text + ' ';
          this.interimTranscript = '';
          this.updateTranscript();
        } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
          console.warn('No speech could be recognized');
        }
      };

      this.recognizer.canceled = (s, e) => {
        let errorMessage = 'Speech recognition canceled';

        if (e.reason === SpeechSDK.CancellationReason.Error) {
          errorMessage = `Recognition error: ${e.errorDetails}`;
          if (e.errorCode === SpeechSDK.CancellationErrorCode.AuthenticationFailure) {
            // Token expired, refresh it
            this.azureToken = null;
            errorMessage = 'Authentication failed. Please try again.';
          }
        }

        if (this.onError) {
          this.onError(new Error(errorMessage));
        }
        this.isListening = false;
        if (this.onListeningStateChange) {
          this.onListeningStateChange(false);
        }
      };

      this.recognizer.sessionStopped = (s, e) => {
        this.isListening = false;
        if (this.onListeningStateChange) {
          this.onListeningStateChange(false);
        }
      };

      // Start continuous recognition
      this.recognizer.startContinuousRecognitionAsync(
        () => {
          this.isListening = true;
          this.finalTranscript = '';
          this.interimTranscript = '';
          if (this.onListeningStateChange) {
            this.onListeningStateChange(true);
          }
        },
        (error) => {
          console.error('Error starting Azure recognition:', error);
          if (this.onError) {
            this.onError(new Error(`Failed to start recognition: ${error}`));
          }
          this.isListening = false;
          if (this.onListeningStateChange) {
            this.onListeningStateChange(false);
          }
          // Fallback to browser recognition
          this.startBrowserRecognition(language);
        }
      );

    } catch (error) {
      console.error('Azure recognition error:', error);
      // Fallback to browser recognition
      await this.startBrowserRecognition(language);
    }
  }

  async startBrowserRecognition(language) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported in this browser');
    }

    this.recognizer = new SpeechRecognition();
    const recognition = this.recognizer;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = this.getLanguageCode(language);
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      this.isListening = true;
      this.finalTranscript = '';
      this.interimTranscript = '';
      if (this.onListeningStateChange) this.onListeningStateChange(true);
    };

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalText += transcript + ' ';
        } else {
          interimText += transcript;
        }
      }

      this.finalTranscript += finalText;
      this.interimTranscript = interimText;
      this.updateTranscript();
    };

    recognition.onerror = (event) => {
      let errorMessage = 'Speech recognition error';

      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try speaking again.';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone not accessible. Please check permissions.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      if (this.onError) this.onError(new Error(errorMessage));
    };

    recognition.onend = () => {
      this.isListening = false;
      if (this.onListeningStateChange) this.onListeningStateChange(false);
    };

    recognition.start();
  }

  initializeAudioVisualization(stream) {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);

      this.analyser.fftSize = 256;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      const updateAudioLevel = () => {
        if (this.isListening && this.analyser) {
          this.analyser.getByteFrequencyData(this.dataArray);
          const average = this.dataArray.reduce((a, b) => a + b) / bufferLength;
          this.audioLevel = Math.min(100, (average / 255) * 100);
          requestAnimationFrame(updateAudioLevel);
        } else {
          this.audioLevel = 0;
        }
      };

      updateAudioLevel();
    } catch (error) {
      console.warn('Audio visualization not available:', error);
    }
  }

  updateTranscript() {
    const fullTranscript = (this.finalTranscript + this.interimTranscript).trim();
    if (this.onTranscriptUpdate) {
      this.onTranscriptUpdate(fullTranscript, this.interimTranscript);
    }
  }

  stopRecognition() {
    if (this.recognizer) {
      try {
        if (this.isAzureAvailable && this.recognizer.stopContinuousRecognitionAsync) {
          this.recognizer.stopContinuousRecognitionAsync(
            () => {
              console.log('Azure recognition stopped');
            },
            (error) => {
              console.error('Error stopping Azure recognition:', error);
            }
          );
        } else if (this.recognizer.stop) {
          this.recognizer.stop();
        } else if (this.recognizer.abort) {
          this.recognizer.abort();
        }
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }

      // Close recognizer
      if (this.recognizer.close) {
        try {
          this.recognizer.close();
        } catch (error) {
          console.warn('Error closing recognizer:', error);
        }
      }

      this.recognizer = null;
    }

    // Close audio config
    if (this.audioConfig) {
      try {
        this.audioConfig.close();
      } catch (error) {
        console.warn('Error closing audio config:', error);
      }
      this.audioConfig = null;
    }

    // Close speech config
    if (this.speechConfig) {
      try {
        this.speechConfig.close();
      } catch (error) {
        console.warn('Error closing speech config:', error);
      }
      this.speechConfig = null;
    }

    // Stop media stream tracks
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.warn('Error stopping media stream:', error);
      }
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (error) {
        console.warn('Error closing audio context:', error);
      }
      this.audioContext = null;
      this.analyser = null;
    }

    this.isListening = false;
    this.audioLevel = 0;
    if (this.onListeningStateChange) this.onListeningStateChange(false);
  }

  getTranscript() {
    return this.finalTranscript.trim();
  }

  getAudioLevel() {
    return this.audioLevel;
  }

  isAvailable() {
    return this.isAzureAvailable ||
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  cleanup() {
    this.stopRecognition();
    this.recognizer = null;
    this.speechConfig = null;
    this.audioConfig = null;
    this.onTranscriptUpdate = null;
    this.onError = null;
    this.onListeningStateChange = null;
  }
}

// Create singleton instance
const azureSpeechRecognition = new AzureSpeechRecognition();

// Initialize on load
if (typeof window !== 'undefined') {
  azureSpeechRecognition.initialize().catch(() => {
    // Silently fail - will use browser fallback
  });
}

export default azureSpeechRecognition;

