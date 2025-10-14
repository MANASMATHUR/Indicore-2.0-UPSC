# Indicore - PCS/UPSC/SSC Exam Prep AI

A comprehensive AI-powered exam preparation platform built with Next.js, featuring multilingual support, document evaluation, essay enhancement, and regional language assistance for PCS, UPSC, and SSC competitive exams.

## Features

### 🎓 Exam Preparation Focus
- **PCS/UPSC/SSC Specialized**: Tailored for competitive exam preparation
- **Document Evaluation**: Upload exam papers for AI-powered evaluation and feedback
- **Essay Enhancement**: Improve essay writing with AI-powered structure and language enhancement
- **Regional Language Support**: Practice and evaluation in 10+ Indian languages
- **Mock Evaluation System**: Get detailed feedback on your answers in regional languages

### 📚 Study Tools & Resources
- **Bilingual Vocabulary Builder**: Learn exam-relevant terms with flashcards
- **Real-time Translation**: Convert study materials between languages instantly
- **Voice-to-Text Practice**: Practice dictation and translation in multiple languages
- **Subject-specific Categories**: Organized by General Studies, History, Geography, Polity, etc.
- **Difficulty Levels**: Beginner, Intermediate, and Advanced content

### 🔐 Authentication & Security
- **Google OAuth Integration**: Secure login with Google accounts
- **Session Management**: Persistent sessions with NextAuth.js
- **User-specific Memory**: Each user has their own isolated chat history

### 🧠 Memory & Persistence
- **User Memory**: Individual chat histories per Google account
- **Session Memory**: Conversations persist across login/logout
- **Collapsible Sidebar**: Easy access to Chat 1, Chat 2, Chat 3, etc.
- **Chat Management**: Create, load, and manage multiple conversations

### 🌍 Multilingual Support
- **11 Languages**: English, Hindi, Marathi, Tamil, Bengali, Punjabi, Gujarati, Telugu, Malayalam, Kannada, Spanish
- **Voice Input**: Speech-to-text support for all languages
- **Voice Output**: Text-to-speech with native language voices
- **Language-specific AI Responses**: AI responds in the selected language
- **Regional Language Evaluation**: Get feedback on answers written in regional languages

### 🎨 Modern UI/UX
- **Responsive Design**: Works perfectly on desktop and mobile
- **Beautiful Interface**: Modern gradient design with smooth animations
- **Exam-focused Theme**: Professional color scheme optimized for study sessions
- **Collapsible Sidebar**: Memory bar that can be collapsed/expanded
- **Settings Panel**: Customizable AI behavior and preferences
- **Voice Dialog**: Intuitive voice input interface

### 🤖 AI Integration
- **Multiple AI Models**: Sonar Pro, Sonar Reasoning, Sonar Deep Research
- **Perplexity API**: Advanced search-enabled responses
- **Exam-specific Prompts**: Specialized for competitive exam preparation
- **Error Handling**: Comprehensive error management

## Tech Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **React 18**: Modern React with hooks
- **Tailwind CSS**: Utility-first CSS framework
- **NextAuth.js**: Authentication library
- **Lucide React**: Beautiful icons

### Backend
- **Next.js API Routes**: Serverless API endpoints
- **MongoDB**: Database for user data and chat history
- **Mongoose**: MongoDB object modeling
- **JWT**: Secure token-based authentication

### AI & Voice
- **Perplexity AI**: Advanced language model
- **Azure Speech Services**: Voice input/output
- **Web Speech API**: Browser-based speech recognition

## Getting Started

### Prerequisites
- Node.js 18+ 
- MongoDB database
- Google OAuth credentials
- Perplexity API key
- Azure Speech Services key (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd indicore-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file:
   ```env
   # NextAuth Configuration
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key-here

   # Google OAuth
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret

   # MongoDB
   MONGODB_URI=mongodb://localhost:27017/indicore-ai
   
   # Grok (optional, for better chat titles)
   GROK_API_KEY=your-grok-api-key

   # Perplexity API
   PERPLEXITY_API_KEY=your-perplexity-api-key

   # Azure Speech Services (optional)
   AZURE_SPEECH_KEY=your-azure-speech-key
   AZURE_SPEECH_REGION=your-azure-region
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
indicore-ai/
├── app/                    # Next.js App Router
│   ├── globals.css        # Global styles
│   ├── layout.js          # Root layout
│   ├── page.js            # Home page
│   └── providers.js       # Context providers
├── components/            # React components
│   ├── ChatInterface.js   # Main chat interface
│   ├── Sidebar.js         # Collapsible sidebar
│   ├── ChatMessages.js    # Message display
│   ├── ChatInput.js       # Input component
│   ├── SettingsPanel.js   # Settings interface
│   ├── VoiceDialog.js     # Voice input dialog
│   ├── LoginModal.js      # Authentication modal
│   ├── LoadingSpinner.js  # Loading component
│   ├── ErrorBoundary.js   # Error handling
│   └── Toast.js           # Notifications
├── hooks/                 # Custom React hooks
│   ├── useChat.js         # Chat management
│   └── useSettings.js     # Settings management
├── lib/                   # Utility libraries
│   ├── auth.js            # NextAuth configuration
│   └── mongodb.js         # Database connection
├── models/                # Database models
│   ├── User.js            # User schema
│   └── Chat.js            # Chat schema
├── pages/api/             # API routes
│   ├── auth/              # Authentication endpoints
│   ├── chat/              # Chat management
│   └── ai/                # AI integration
├── utils/                 # Utility functions
│   └── validation.js      # Input validation
└── public/                # Static assets
```

## Key Features Explained

### Exam Paper Evaluation
- Upload PDF, DOC, or text files for evaluation
- AI analyzes content quality, structure, and accuracy
- Provides detailed feedback with improvement suggestions
- Supports PCS, UPSC, SSC, and other competitive exams
- Subject-specific evaluation criteria

### Essay & Answer Writing Enhancement
- Convert essays between languages while improving quality
- Enhance structure, vocabulary, and grammar
- Support for 10+ essay types (General, Current Affairs, Social Issues, etc.)
- Word limit management and formatting
- Exam-specific writing style optimization

### Bilingual Vocabulary Builder
- Generate flashcards for exam-relevant terms
- Support for 10+ subject categories
- Multiple difficulty levels (Beginner, Intermediate, Advanced)
- Interactive study mode with answer reveal
- Add vocabulary lists to chat for further discussion

### Regional Language Mock Evaluation
- Evaluate answers written in regional languages
- Detailed scoring and feedback system
- Support for essay, short answer, and analytical questions
- Exam-specific evaluation criteria
- Improvement recommendations and study tips

### User Memory System
- Each Google account gets its own isolated chat history
- Conversations are stored in MongoDB with user association
- Chat names are automatically generated (Chat 1, Chat 2, etc.)
- Users can switch between different conversations seamlessly

### Collapsible Sidebar
- Shows all user's chats in chronological order
- Can be collapsed to save screen space
- Displays chat previews and last message timestamps
- Easy navigation between different conversations

### Session Management
- User sessions persist across browser refreshes
- Automatic login state restoration
- Secure JWT-based authentication
- Session timeout and renewal

### Multilingual Support
- 11 supported languages with native voice support
- AI responds in the selected language
- Voice input/output in multiple languages
- Language-specific system prompts
- Regional language evaluation and feedback

## API Endpoints

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth.js endpoints

### Chat Management
- `GET /api/chat` - Get all user chats
- `POST /api/chat` - Create new chat or send message
- `GET /api/chat/[id]` - Get specific chat
- `PUT /api/chat/[id]` - Update chat (add AI response)
- `DELETE /api/chat/[id]` - Delete chat

### AI Integration
- `POST /api/ai/chat` - Get AI response
- `POST /api/ai/translate` - Translate text between languages
- `POST /api/ai/evaluate-exam` - Evaluate uploaded exam papers
- `POST /api/ai/enhance-essay` - Enhance essay writing
- `POST /api/ai/generate-vocabulary` - Generate bilingual flashcards
- `POST /api/ai/mock-evaluation` - Evaluate answers in regional languages

## Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically

### Other Platforms
- Ensure Node.js 18+ support
- Set all environment variables
- Configure MongoDB connection
- Set up Google OAuth redirect URLs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, please open an issue on GitHub or contact the development team.

## Acknowledgments

- Perplexity AI for advanced language models
- Azure Speech Services for voice capabilities
- Next.js team for the amazing framework
- Tailwind CSS for beautiful styling
- The open-source community for inspiration