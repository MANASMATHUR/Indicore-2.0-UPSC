# 🎓 Indicore - AI-Powered Exam Preparation Platform

A comprehensive AI-driven platform designed for PCS, UPSC, and SSC exam preparation with multilingual support and advanced features.

## ✨ Features

### 🌐 Multilingual Support
- **11 Languages**: English, Hindi, Marathi, Tamil, Bengali, Punjabi, Gujarati, Telugu, Malayalam, Kannada, Spanish
- **Native Speech Synthesis**: Language-specific voice output
- **Smart Translation**: Context-aware translation with proper language detection

### 🎨 Modern UI/UX
- **Dark Mode**: Complete dark theme implementation
- **Responsive Design**: Mobile-first approach
- **Component Library**: Reusable UI components
- **Smooth Animations**: Enhanced user experience

### 🤖 AI Capabilities
- **Intelligent Chat**: Context-aware conversations
- **Streaming Responses**: Real-time AI responses
- **Voice Input/Output**: Speech recognition and synthesis
- **Document Processing**: PDF upload and analysis

### 📚 Study Tools
- **Essay Enhancement**: AI-powered writing improvement
- **Mock Evaluations**: Regional language assessments
- **Vocabulary Builder**: Bilingual word learning
- **Exam Paper Analysis**: Automated evaluation

### 🔧 Technical Features
- **Error Handling**: Enterprise-grade error management
- **Performance Optimization**: Caching and loading states
- **Security**: Input validation and sanitization
- **Monitoring**: Real-time error tracking

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- MongoDB (for data persistence)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/MANASMATHUR/Indicore-for-PCS.git
   cd Indicore-for-PCS
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Node.js, Next.js API Routes
- **Database**: MongoDB
- **Authentication**: NextAuth.js
- **AI Integration**: Gemini API, Cohere API , Mistral API 
- **Translation**: LibreTranslate , MyMemory API , Google Translate API 
- **OCR**: Tesseract.js 
- **Speech Services**: Azure Speech Services 
- **Deployment**: Vercel

## 📁 Project Structure

```
├── app/                    # Next.js app directory
├── components/             # React components
│   ├── chat/              # Chat-related components
│   ├── layout/            # Layout components
│   ├── settings/          # Settings components
│   └── ui/                # Reusable UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
├── pages/                 # API routes and pages
│   ├── api/               # API endpoints
│   └── admin/             # Admin pages
└── public/                # Static assets
```

## 🌟 Key Components

### Enhanced Multilingual Support
- **OCR with Translation**: Extract text from images and translate to regional languages
- **Gemini API Integration**: Advanced AI-powered translation for study materials
- **Free Tier Optimization**: Uses only free APIs to avoid costs
- **Smart Fallbacks**: Multiple translation services with automatic fallback

### Performance Optimizations
- **Response Caching**: 10-minute cache for chat responses, 5-minute for translations
- **Reduced Latency**: Optimized API calls and efficient processing
- **Streamlined UI**: Consolidated tools menu reduces clutter
- **Efficient Resource Usage**: Smart caching and rate limiting

### Speech Service
- **Multilingual Support**: 11 languages with native voices
- **Azure Integration**: High-quality speech synthesis (FREE TIER)
- **Browser Fallback**: Web Speech API support
- **Error Handling**: Graceful degradation

### Chat Interface
- **Streaming Responses**: Real-time AI communication
- **Voice Integration**: Speech input and output
- **Translation**: Multi-language support with OCR integration
- **Context Awareness**: Maintains conversation context

### UI Components
- **Button**: Multiple variants with dark mode
- **Input**: Form inputs with validation
- **Modal**: Overlay dialogs
- **Card**: Content containers
- **Badge**: Status indicators
- **Consolidated Tools Menu**: Streamlined header with organized features

## 🔧 Configuration

### Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/indicore

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# AI Services 
GEMINI_API_KEY=your-gemini-api-key
COHERE_API_KEY=your-cohere-api-key
MISTRAL_API_KEY=your-mistral-api-key
PERPLEXITY_API_KEY=your-perplexity-api-key

# Speech Services - FREE TIER
AZURE_SPEECH_KEY=your-azure-key
AZURE_SPEECH_REGION=your-azure-region

# Translation Services - FREE TIER
GOOGLE_TRANSLATE_API_KEY=your-google-translate-key
```

**Note**: All APIs are configured to use FREE TIER limits. See `FREE_TIER_SETUP.md` for detailed setup instructions.

## 📊 Performance

- **Build Size**: Optimized bundle size
- **Loading Speed**: Fast initial load
- **Caching**: Intelligent caching strategies
- **Error Recovery**: Graceful error handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Author

**Manas Mathur**
- GitHub: [@MANASMATHUR](https://github.com/MANASMATHUR)
- Email: manasmathur1234@gmail.com



---

**Built with ❤️ for competitive exam aspirants**
