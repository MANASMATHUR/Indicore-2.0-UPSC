# Indicore

## 🎯 Overview

**Indicore** is an AI-powered UPSC exam preparation platform designed to revolutionize how aspirants study. With 15+ intelligent tools, personalized learning, and ChatGPT-style memory, Indicore adapts to your unique learning style and goals.

### Key Highlights

- 🤖 **AI-Powered Chat** with PYQ context and memory
- 🧠 **Smart Memory System** that learns from conversations
- 📝 **Complete Mock Test Suite** with AI evaluation
- 📚 **10,000+ PYQ Database** with pattern analysis
- ✍️ **Essay Writing Tools** with automated feedback
- 🎯 **Interview Preparation** with DAF-based questions
- 🎤 **Voice Interface** (Speech-to-Text & Text-to-Speech)
- 🌐 **Multi-language Support** (10+ Indian languages)
- 📊 **Learning Analytics** with personalized insights
- 🔖 **Smart Bookmarks** and content organization

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- MongoDB database (local or Atlas)
- API Keys for:
  - OpenAI
  - Azure Cognitive Services (Speech + Translator)
  - Google Cloud (OAuth + Translate)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd indicore

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev

# Open browser
# Navigate to http://localhost:3000
```

### Environment Variables

Create `.env.local` based on dotenv requirements:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/indicore

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-random-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# AI Services
OPENAI_API_KEY=<your-openai-key>

# Azure Services
AZURE_SPEECH_KEY=<your-azure-speech-key>
AZURE_SPEECH_REGION=<your-region>
AZURE_TRANSLATOR_KEY=<your-translator-key>
AZURE_TRANSLATOR_ENDPOINT=<translator-endpoint>

# Google Cloud
GOOGLE_TRANSLATE_KEY=<your-google-translate-key>
```

---

## 📁 Project Structure

```
indicore/
├── pages/                    # Next.js pages & routing
│   ├── api/                  # 74 API endpoints
│   │   ├── ai/              # AI & chat (11 endpoints)
│   │   ├── user/            # User management (10)
│   │   ├── mock-tests/      # Mock tests (6)
│   │   ├── pyq/             # PYQ system (11)
│   │   ├── interview/       # Interview prep (5)
│   │   └── ...              # Other features
│   ├── chat.js              # Main chat interface
│   ├── settings.js          # User settings
│   └── ...                  # Other pages
├── components/               # React components
│   ├── settings/            
│   │   ├── MemoryManager.js      # Memory UI
│   │   └── PreferencesDashboard.js
│   └── ...
├── lib/                     # Utilities & services
│   ├── smartMemoryExtractor.js   # AI memory extraction
│   ├── memoryService.js          # Memory utilities
│   ├── ai-providers.js           # AI abstraction
│   ├── mongodb.js               # DB connection
│   └── ...
├── models/                  # Mongoose schemas
│   ├── User.js              # User model
│   ├── Chat.js              # Chat model
│   ├── MockTest.js          # Mock test model
│   └── ...
├── docs/                    # Documentation
│   ├── architecture.md      # System architecture
│   ├── features-guide.md    # Feature documentation
│   └── api-reference.md     # API reference
├── public/                  # Static assets
├── .env.local               # Environment variables
├── next.config.js           # Next.js config
└── package.json             # Dependencies
```

---

## 🛠️ Technology Stack

### Frontend
- **Framework:** Next.js 14 (React 18)
- **Styling:** Tailwind CSS
- **State:** React Hooks, Context
- **Real-time:** SSE, WebSocket
- **Auth:** NextAuth.js

### Backend
- **Runtime:** Node.js
- **API:** Next.js API Routes
- **Database:** MongoDB + Mongoose

### AI & Services
- **LLM:** OpenAI (GPT-4)
- **Speech:** Azure Cognitive Services
- **Translation:** Azure + Google Translate
- **Auth:** Google OAuth 2.0

---

## 🏗️ High-Level Design (HLD) & Architecture

### 1. High-Level Architecture
**The Big Picture: How users connect to our AI brain.**

```mermaid
graph TD
    %% Styling
    classDef user fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
    classDef app fill:#f0fdf4,stroke:#16a34a,stroke-width:2px;
    classDef ai fill:#f3e8ff,stroke:#9333ea,stroke-width:2px;

    User([User Device]) -->|1. Request| App[Indicore Platform]
    
    subgraph "Core Engine"
        App -->|2. Verify| Auth[Secure Auth]
        App -->|3. Route| Router{Feature Router}
        
        Router -->|Chat| Chat[AI Chatbot]
        Router -->|Study| Quiz[Mock Tests]
        Router -->|Speak| Voice[Voice Engine]
        Router -->|Upload| DAF[DAF Analyzer]
    end

    subgraph "Intelligence Layer"
        Chat <-->|Context| DB[(Database)]
        Chat <-->|Reasoning| LLM[AI Model]
        Voice <-->|Process| Speech[Speech AI]
        DAF -->|Read| OCR[Text Extractor]
    end

    LLM -->|4. Smart Answer| App
    Speech -->|4. Voice Response| App
    App -->|5. Personalized Result| User

    class User user;
    class App,Auth,Router,Chat,Quiz,Voice,DAF app;
    class LLM,Speech,OCR,DB ai;
```

**Value Proposition:**
*   **Scalable:** Built to handle thousands of concurrent users.
*   **Secure:** Enterprise-grade authentication protects user data.
*   **Intelligent:** Every feature is powered by advanced AI models.

### 2. AI Chatbot Flow
**How we answer UPSC questions instantly.**

```mermaid
sequenceDiagram
    participant User
    participant App as Indicore Chat
    participant Brain as AI Brain (Ctx + LLM)

    User->>App: Asks: "Explain Article 21"
    App->>App: Checks User History
    App->>Brain: Send Question + History
    Brain->>Brain: Retrieving Legal Context...
    Brain->>Brain: Formulating Answer...
    Brain-->>App: Streams Answer Token-by-Token
    App-->>User: Displays Answer in Real-time
    Note right of User: User sees answer < 2s
```

### 3. DAF Interview Analysis
**Our "data flow" for personalized interview prep.**

```mermaid
graph TD
    User([User]) -->|Uploads PDF| DAF[DAF Upload]
    DAF -->|Extract| Text[Raw Text]
    Text -->|Analyze| AI[AI Profiler]
    
    AI -->|Detect| Weak[Weaknesses]
    AI -->|Identify| Strong[Strengths]
    AI -->|Map| Hobbies[Hobbies & Interests]
    
    Weak & Strong & Hobbies -->|Generate| Q[Personalized Questions]
    Q -->|Display| User

    style AI fill:#f3e8ff,stroke:#9333ea
```

### 4. Real-Time Voice Engine
**How users can "talk" to Indicore.**

```mermaid
graph LR
    User([User Voice]) -->|Audio| App[Mic Input]
    App -->|Stream| STT[Speech-to-Text]
    STT -->|Text| AI[AI Processor]
    AI -->|Response| TTS[Text-to-Speech]
    TTS -->|Audio| Speaker([User Speaker])
    
    style STT fill:#fff7ed,stroke:#c2410c
    style TTS fill:#fff7ed,stroke:#c2410c
    style AI fill:#f3e8ff,stroke:#9333ea
```

### 5. Essay Generation & Translation Engine
**How we generate multilingual essays instantly.**

```mermaid
graph TD
    User([User]) -->|Topic + Language| API[Essay API]
    API -->|Check| DB{Has Cached Info?}
    
    DB -->|Yes: Return Content| User
    DB -->|No: Generate English Base| OpenAI[OpenAI GPT-4]
    
    OpenAI -->|English Text| Trans{Target Language?}
    
    Trans -->|English: Save| DB
    Trans -->|Other: Translate| Azure[Azure Translator]
    
    Azure -->|Localized Essay| DB
    DB -->|Final Content| User

    style OpenAI fill:#10a37f,stroke:#0d8c6d
    style Azure fill:#0078d4,stroke:#005a9e
```



### 6. Smart Flashcard System
**Turning conversations into study material.**

```mermaid
graph LR
    Chat[Chat History] -->|Analyze| AI[Concept Extractor]
    Note[User Notes] -->|Analyze| AI
    
    AI -->|Extract Key Terms| Logic[Flashcard Engine]
    Logic -->|Create Front/Back| Card[New Flashcard]
    Card -->|Save| DB[(MongoDB)]
    
    DB -->|Spaced Repetition| Review[Review Session]
```

**Value:** Automates note-taking so students focus on understanding.

### 7. Secure Authentication Flow
**Enterprise-grade security for user data.**

```mermaid
sequenceDiagram
    participant User
    participant NextAuth
    participant Google
    participant DB as MongoDB

    User->>NextAuth: Click "Login with Google"
    NextAuth->>Google: OAuth Request
    Google-->>User: Consent Screen
    User->>Google: Approves
    Google-->>NextAuth: Success Token
    
    NextAuth->>DB: Upsert User Profile
    DB-->>NextAuth: User Data
    NextAuth-->>User: Create Secure Session (JWT)
```


### 8. Mock Test Lifecycle
**End-to-end flow from generation to performance insights.**

```mermaid
graph TD
    User([User]) -->|1. Setup| Create[Test Creator]
    Create -->|2. Generate JSON| AI[AI Subject Expert]
    AI -->|3. Save Schema| DB[(MongoDB)]
    
    DB -->|4. Serve| FE[Exam Interface]
    FE -->|5. Answers| Submit[Submission Engine]
    
    Submit -->|6. Grade| Evaluator[AI Evaluator]
    Evaluator -->|7. Insights| Analytics[Performance Dashboard]
    Analytics -->|8. Recommend| User

    style AI fill:#f3e8ff,stroke:#9333ea
    style Evaluator fill:#fee2e2,stroke:#ef4444
```

**Value:** Provides instant feedback that usually takes human tutors days to provide.

---

## ⚙️ Low-Level Design (LLD)

### 1. Backend Service Layer Pattern
We utilize a **Service-Oriented Architecture** within a serverless environment to ensure scalability and maintainability.
*   **API Routes (`pages/api/*`) -> Controllers**:
    *   Handle HTTP requests and responses.
    *   Perform input validation (Zod/Joi).
    *   Delegate business logic to the Service Layer.
    *   *Example:* `pages/api/ai/chat.js` validates the user session and forwards the prompt to `lib/ai-providers.js`.
*   **Service Layer (`lib/*`) -> Business Logic**:
    *   Contains the core application logic.
    *   Reusable functions independent of the HTTP layer.
    *   *Example:* `memoryService.js` handles vector embedding and retrieval logic.
*   **Data Access Layer (`models/*`)**:
    *   Mongoose schemas define data structure and validation.
    *   Handles direct MongoDB interactions.

### 2. Frontend Component Architecture
We follow **Atomic Design Principles** and the **Container/Presentational Pattern**.
*   **Smart Containers**: Handle state, side effects, and data fetching (e.g., `ChatInterface.js`).
*   **Dumb Components**: Pure presentation components that receive data via props (e.g., `MessageBubble.js`, `Button.js`).
*   **Custom Hooks (`hooks/*`)**: Encapsulate reusable logic.
    *   `useVoiceInput`: Manages microphone access and Azure Speech SDK integration.
    *   `useChatStream`: Handles Server-Sent Events (SSE) for real-time text generation.

### 3. Database Schema Design (MongoDB)
Our NoSQL schema is designed for flexibility and high read performance.
*   **User Collection**:
    *   `googleId`: Indexed for fast OAuth lookups.
    *   `preferences`: Nested object for learning style settings.
*   **Chat Collection**:
    *   `userId`: Compound index with `createdAt` for efficient history pagination.
    *   `messages`: Array of message objects `{ role, content, timestamp }`.
*   **Memory Collection**:
    *   `embedding`: Vector array for semantic search.
    *   `context`: Text content of the memory.

---

## 🎨 Core Features

### 1. Intelligent Chat Assistant
- Real-time streaming responses
- PYQ context integration
- Memory-enhanced personalization
- Multi-language support
- Voice input/output

### 2. Smart Memory System
- **Explicit:** "Remember that..." commands
- **Automatic:** AI detects important info
- ChatGPT-style memory cards
- Usage tracking & analytics

### 3. Mock Test Suite
- Custom test generation
- AI-powered evaluation
- Multi-language tests
- Detailed performance analysis

### 4. PYQ System
- 10,000+ questions database
- Advanced search & filters
- Pattern analysis
- Topic clustering

### 5. Interview Preparation
- DAF-based question generation
- Mock interview sessions
- Answer evaluation
- Personality assessment

### 6. Essay Writing
- Topic generation
- Structure suggestions
- AI-powered enhancement
- UPSC-pattern evaluation

### 7. Learning Analytics
- Performance tracking
- Progress visualization
- Weak area identification
- Personalized recommendations

---

## 📱 User Interface

### Pages
- **Dashboard:** Overview, today's tasks, recommendations
- **Chat:** Main AI assistant interface
- **Mock Tests:** Create, take, and review tests
- **PYQ Search:** Browse previous year questions
- **Essay Writer:** Compose and evaluate essays
- **Interview Prep:** Practice with AI interviewer
- **Current Affairs:** Daily digest and trending topics
- **Flashcards:** Spaced repetition study cards
- **Settings:** Preferences, memory management
- **Analytics:** Study insights and progress

---

## 🧪 Testing

```bash
# Run tests (if available)
npm test

# Build for production
npm run build

# Start production server
npm start
```

---

## 🚢 Deployment

### Vercel
1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy!

### Manual Deployment
1. Build: `npm run build`
2. Set environment variables
3. Start: `npm start`
4. Configure reverse proxy (nginx/Apache)

### Database Setup
1. Create MongoDB database
2. Update connection string in `.env.local`
3. Database will initialize automatically

---

## 📊 Performance

- **Response Time:** < 3s for AI responses
- **Page Load:** < 2s (optimized)
- **Database Queries:** Indexed, cached
- **Concurrent Users:** Tested up to 100

---

## 🔒 Security

- **Authentication:** Google OAuth via NextAuth
- **Authorization:** Role-based (user/admin)
- **Data Encryption:** HTTPS, encrypted storage
- **GDPR Compliant:** Data export & deletion
- **API Security:** Environment variable protection

---

## 🐛 Troubleshooting

### Common Issues

**Q: MongoDB connection error**
```bash
# Check MongoDB is running
mongod --version

# Verify connection string in .env.local
```

**Q: Azure Speech not working**
```bash
# Check API key and region
# Ensure browser has microphone permission
```

**Q: Build errors**
```bash
# Clear cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

---

## 📞 Support

- **Email:** indicoreai1@gmail.com

---

## 🗺️ Roadmap

### Completed 
- AI Chat with streaming
- Memory system (explicit + automatic)
- Mock tests with AI evaluation
- PYQ database & search
- Interview preparation
- Multi-language support
- Learning analytics

---

**Version:** 2.0  
**Last Updated:** 7 January , 2026
**Status:** Production Ready 

---

## 🌟 Star the Project!

If you find Indicore useful, please give it a ⭐ on GitHub!
