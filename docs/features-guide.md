# Indicore Features - Complete User Guide

## Table of Contents

1. [Core Features](#core-features)
2. [AI Chat Assistant](#ai-chat-assistant)
3. [Mock Test System](#mock-test-system)
4. [PYQ (Previous Year Questions)](#pyq-system)
5. [Essay Writing Tools](#essay-writing-tools)
6. [Interview Preparation](#interview-preparation)
7. [Flashcards & Notes](#flashcards--notes)
8. [Current Affairs](#current-affairs)
9. [Formula Sheets](#formula-sheets)
10. [Memory System](#memory-system)
11. [Personalization](#personalization)
12. [Study Analytics](#study-analytics)
13. [Voice Features](#voice-features)
14. [Translation](#translation)
15. [Bookmarks](#bookmarks)

---

## Core Features

### 🤖 AI Chat Assistant

**What it does:** Intelligent chat interface powered by Perplexity AI that helps with study doubts, concept explanations, and exam preparation.

**Key Features:**
- **Real-time Streaming:** Get AI responses as they're generated
- **PYQ Context:** Automatically searches relevant previous year questions
- **Memory Integration:** Remembers your goals, preferences, and study habits
- **Multi-language:** Chat in 10+ Indian languages
- **Voice Input/Output:** Speak your questions, hear responses

**How to Use:**
1. Navigate to the Chat page
2. Type your question or click the microphone for voice input
3. Get instant, personalized responses
4. Continue the conversation - it remembers context

**API Endpoints:**
- `POST /api/ai/chat` - Send message, get response
- `POST /api/ai/chat-stream` - Get streaming response via SSE
- `WebSocket /api/ai/chat-ws` - Real-time WebSocket chat

**Example Questions:**
```
"Explain the concept of federalism in Indian Constitution"
"Give me 5 PYQs on Indian Economy from last 3 years"
"What are the key differences between Tropical and Temperate climates?"
"Help me create a study plan for Geography Optional"
```

**Smart Features:**
- Automatically saves important information to your memory
- Adapts to your communication style over time
- Suggests related PYQs and study material
- Tracks your topic interests for recommendations

---

### 📝 Mock Test System

**What it does:** Create, take, and analyze full-length or topic-wise mock tests with AI-powered evaluation.

**Key Features:**
- **Custom Test Creation:** Choose subjects, difficulty, and question count
- **AI-Generated Questions:** Fresh questions based on UPSC pattern
- **PYQ Integration:** Option to include real previous year questions
- **Multi-language Support:** Tests in English, Hindi, and other languages
- **Instant Evaluation:** Get detailed performance analysis
- **Answer Explanations:** Learn from AI-generated explanations

**How to Use:**

**Creating a Test:**
1. Go to Mock Tests page
2. Select subject, difficulty level, and number of questions
3. Choose whether to include PYQs
4. Select language preference
5. Click "Generate Test"

**Taking a Test:**
1. Answer questions one by one
2. Use "Save Progress" to pause and resume later
3. Submit when complete
4. View instant results and explanations

**Analyzing Performance:**
1. View overall score and time taken
2. See topic-wise breakdown
3. Review incorrect answers with explanations
4. Get AI-powered improvement suggestions
5. Bookmark difficult questions for revision

**API Endpoints:**
- `POST /api/mock-tests/create` - Create new test
- `GET /api/mock-tests/list` - List your tests
- `GET /api/mock-tests/[id]` - Get specific test
- `POST /api/mock-tests/submit` - Submit answers
- `GET /api/mock-tests/results` - Get results
- `POST /api/mock-tests/analyze` - Get detailed analysis

**Test Types:**
- **Full-length:** 100 questions, 2 hours (UPSC Prelims pattern)
- **Subject-wise:** 25-50 questions per subject
- **Topic-specific:** 10-20 questions on one topic
- **Daily Practice:** Quick 5-10 question sets

---

### 📚 PYQ (Previous Year Questions) System

**What it does:** Comprehensive database of UPSC previous year questions with advanced search, analysis, and pattern recognition.

**Key Features:**
- **10,000+ Questions:** Complete PYQ database from past 15+ years
- **Advanced Search:** Filter by year, subject, topic, difficulty
- **Pattern Analysis:** Identify recurring themes and important topics
- **Most Probable:** AI predicts frequently asked areas
- **Theme Clustering:** Questions grouped by common themes
- **Bookmarking:** Save questions for later practice

**How to Use:**

**Searching PYQs:**
1. Go to PYQ Search page
2. Enter keywords or select filters
3. Filter by:
   - Subject (Polity, History, Geography, etc.)
   - Year range (2010-2024)
   - Difficulty (Easy, Medium, Hard)
   - Question type (MCQ, Descriptive)
4. View results with explanations

**Analyzing Patterns:**
1. Select subject and year range
2. Click "Analyze Patterns"
3. View:
   - Most frequent topics
   - Year-wise trends
   - Topic distribution graphs
   - Recurring questions

**Getting Recommendations:**
1. Based on your weak areas, get suggested PYQs
2. AI identifies topics you should focus on
3. Personalized question sets for practice

**API Endpoints:**
- `POST /api/pyq/search` - Search questions
- `POST /api/pyq/analyze` - Analyze patterns
- `GET /api/pyq/papers` - Get past papers
- `GET /api/pyq/themes` - Get recurring themes
- `GET /api/pyq/most-probable` - Get probable questions

**Search Examples:**
```
"Articles 12-35 of Indian Constitution"
"Green Revolution impact on Indian economy"
"Monsoon system questions from 2015-2023"
"All polity questions with difficulty=hard"
```

**Pro Tips:**
- Solve PYQs by theme rather than chronologically
- Focus on questions repeated across years
- Use "Most Probable" feature before exams
- Bookmark tricky questions for revision

---

### ✍️ Essay Writing Tools

**What it does:** AI-powered essay generation, enhancement, and evaluation to improve your writing skills.

**Key Features:**
- **Topic Generator:** Get relevant UPSC essay topics
- **Outline Creator:** AI generates essay structure
- **Content Enhancement:** Improve your draft with AI suggestions
- **Evaluation:** Get detailed feedback on structure, content, language
- **Examples Database:** Access well-written sample essays
- **Scoring:** Get approximate marks based on UPSC criteria

**How to Use:**

**Generating Topics:**
1. Go to Essay Tools page
2. Click "Generate Topics"
3. Select domain (Polity, Economy, Social, etc.)
4. Get 5-10 relevant topics
5. Choose one to start writing

**Creating Outline:**
1. Enter essay topic
2. Click "Generate Outline"
3. Get structured framework:
   - Introduction points
   - Main arguments
   - Counter-arguments
   - Conclusion
4. Use outline as guide for writing

**Enhancing Your Essay:**
1. Write your essay draft
2. Click "Enhance Essay"
3. AI suggests:
   - Better vocabulary
   - Stronger arguments
   - Improved flow
   - Relevant examples
4. Review and incorporate suggestions

**Getting Evaluation:**
1. Submit completed essay
2. Get detailed feedback on:
   - **Structure:** Introduction, body, conclusion
   - **Content:** Depth, relevance, examples
   - **Language:** Grammar, vocabulary, coherence
   - **Arguments:** Logical flow, persuasiveness
3. View estimated score
4. Get improvement suggestions

**API Endpoints:**
- `POST /api/essay/generate` - Generate topics/outlines
- `POST /api/ai/enhance-essay` - Enhance existing essay
- `POST /api/essay/evaluate` - Get evaluation
- `POST /api/ai/evaluate-exam` - Comprehensive exam evaluation

**Evaluation Criteria (UPSC Pattern):**
1. **Relevance to Topic** (20 points)
2. **Content & Arguments** (40 points)
3. **Language & Expression** (15 points)
4. **Structure & Organization** (15 points)
5. **Originality & Insights** (10 points)

**Essay Types Supported:**
- Philosophical essays
- Political/governance essays
- Economic development essays
- Social issues essays
- Environmental essays
- Science & technology essays

---

### 🎯 Interview Preparation

**What it does:** Comprehensive interview preparation with DAF-based questions, mock interviews, and personality assessment.

**Key Features:**
- **DAF Upload:** Upload your Detailed Application Form (PDF)
- **DAF-based Questions:** Get personalized questions from your background
- **Mock Interviews:** Practice with AI interviewer
- **Answer Evaluation:** Get feedback on your responses
- **Personality Test:** Discover your strengths
- **Session Recording:** Save and review practice sessions

**How to Use:**

**Uploading DAF:**
1. Go to Interview Prep page
2. Click "Upload DAF"
3. Select PDF file
4. AI extracts text automatically
5. Review extracted information

**Generating Questions:**
1. With DAF uploaded, click "Generate Questions"
2. AI creates 50-100 personalized questions based on:
   - Educational background
   - Work experience
   - Hobbies & interests
   - Hometown/state
   - Optional subject
3. Questions categorized by difficulty

**Mock Interview:**
1. Start mock interview session
2. Get questions one by one
3. Record or type your answers
4. Get real-time feedback on:
   - Content quality
   - Communication style
   - Confidence level
   - Improvement areas

**Answer Evaluation:**
1. Provide your answer (text or voice)
2. AI evaluates based on:
   - Relevance (25%)
   - Clarity (25%)
   - Depth (30%)
   - Confidence (20%)
3. Get specific suggestions for improvement

**Personality Assessment:**
1. Complete personality questionnaire
2. Get insights on:
   - Leadership qualities
   - Decision-making style
   - Stress management
   - Communication style
3. Tips to showcase strengths in interview

**API Endpoints:**
- `POST /api/interview/generate-questions` - Generate questions
- `POST /api/interview/evaluate-answer` - Evaluate answer
- `POST /api/interview/daf-question` - DAF-specific Q&A
- `POST /api/interview/personality-test` - Personality assessment
- `POST /api/interview/save-session` - Save interview session
- `GET /api/interview/sessions` - Get past sessions
- `POST /api/contact/extract-daf` - Extract text from DAF PDF

**Question Categories:**
1. **Background:** Education, family, hometown
2. **Current Affairs:** Recent developments, issues
3. **Subject Knowledge:** Optional subject, graduation
4. **Hobbies:** Sports, reading, activities
5. **Ethics:** Dilemma situations, values
6. **Decision-making:** Problem-solving scenarios

---

### 🃏 Flashcards & Notes

**What it does:** Generate smart flashcards from topics or uploaded notes for efficient revision.

**Key Features:**
- **Topic-based Generation:** Create flashcards from any topic
- **PDF Upload:** Extract content from your notes
- **AI-powered Q&A:** Intelligent question-answer pairs
- **Spaced Repetition:** Smart revision scheduling
- **Multiple Formats:** Text, images, diagrams
- **Export:** Download flashcards for offline use

**How to Use:**

**Creating Flashcards from Topic:**
1. Go to Flashcards page
2. Enter topic (e.g., "Fundamental Rights")
3. Select number of cards (10-50)
4. Click "Generate"
5. AI creates question-answer pairs
6. Review and edit if needed

**Creating from PDF Notes:**
1. Click "Upload Notes"
2. Select PDF file
3. AI extracts key concepts
4. Generates flashcards automatically
5. Organized by topics/sections

**Using Flashcards:**
1. View question side
2. Try to recall answer
3. Flip to see answer
4. Mark as:
   - Mastered (won't show again soon)
   - Need practice (show more frequently)
   - Difficult (show very frequently)
5. AI tracks your progress

**API Endpoints:**
- `POST /api/flashcards/generate` - Generate from topic
- `POST /api/notes/upload` - Upload PDF notes
- `POST /api/notes/generate-flashcards` - Create from notes

**Flashcard Types:**
- **Definition:** What is X?
- **Explanation:** Explain the concept of X
- **Comparison:** Difference between X and Y
- **Examples:** Give examples of X
- **Application:** How is X applied in Z?

**Best Practices:**
- Create 10-15 flashcards per topic
- Review daily for spaced repetition
- Focus on weak areas
- Use images for better memory
- Regular revision before exams

---

### 📰 Current Affairs

**What it does:** Stay updated with daily current affairs digest and trending topics relevant to UPSC.

**Key Features:**
- **Daily Digest:** Curated news relevant to UPSC
- **Topic Categorization:** Polity, Economy, International Relations, etc.
- **Trend Analysis:** Identify important recurring issues
- **Question Bank:** Potential UPSC questions from news
- **PDF Export:** Download digest for offline reading
- **Custom Alerts:** Get notifications for preferred topics

**How to Use:**

**Reading Daily Digest:**
1. Go to Current Affairs page
2. View today's digest (auto-generated daily)
3. Read summary of important news
4. Click for detailed analysis
5. See UPSC relevance for each news item

**Exploring Topics:**
1. Filter by category (Polity, Economy, etc.)
2. See all news in that category
3. View trend analysis
4. Get related PYQs

**Getting Questions:**
1. Each news item has "Potential Questions"
2. Practice answering these
3. Bookmarkadifficult questions
4. Review before exam

**Exporting Digest:**
1. Select date range (daily, weekly, monthly)
2. Click "Export PDF"
3. Download formatted digest
4. Print or read offline

**API Endpoints:**
- `POST /api/current-affairs/digest` - Generate digest
- `POST /api/current-affairs/export-pdf` - Export as PDF
- `GET /api/news/fetch` - Fetch latest news
- `GET /api/news/trending` - Get trending topics

**Content Coverage:**
- **National:** Polity, governance, social issues
- **International:** Foreign relations, global issues
- **Economy:** Budget, policies, markets
- **Environment:** Climate, conservation, disasters
- **Science & Tech:** Innovations, space, health
- **Culture:** Art, heritage, sports

---

### 📐 Formula Sheets

**What it does:** Generate comprehensive formula sheets for subjects requiring formulas (Geography, Economy, etc.).

**Key Features:**
- **Auto-generated:** AI creates organized formula lists
- **Subject-wise:** Separate sheets for each subject
- **Topic Categorization:** Formulas grouped by topic
- **Examples:** Each formula with example application
- **PDF Download:** Print-friendly format
- **Quick Reference:** Optimized for last-minute revision

**How to Use:**
1. Go to Formula Sheets page
2. Select subject
3. Click "Generate Formula Sheet"
4. View organized formulas with:
   - Formula name
   - Mathematical expression
   - Variables explanation
   - Example calculation
   - When to use
5. Download PDF for offline use

**API Endpoint:**
- `POST /api/formula-sheets/generate` - Generate formula sheet

**Subjects Covered:**
- **Geography:** Climate formulas, map calculations
- **Economy:** Economic indicators, growth rates
- **Science:** Physics, chemistry basics
- **Statistics:** Data analysis formulas

---

### 🧠 Memory System

**What it does:** Intelligent system that remembers your goals, preferences, and important information to personalize your experience.

**Two Ways to Save:**

**1. Automatic (Smart Extraction):**
- Just chat naturally
- AI detects important information automatically
- Silently saves to your memory
- No commands needed!

**2. Explicit Commands:**
- Say "Remember that..."
- Confirm before saving
- Full control over what's saved

**What Gets Remembered:**
- **Goals:** "I want to become an IPS officer"
- **Exams:** "I'm targeting UPSC 2026"
- **Preferences:** "I prefer studying in the morning"
- **Weak Areas:** "I'm weak in Economics"
- **Strong Areas:** "I'm good at History"
- **Study Habits:** "I take notes while reading"
- **Personal Info:** University, degree, background

**How to Use:**

**Saving Memories:**
```
Just chat:
"I'm preparing for UPSC 2026 and my goal is to become an IAS officer"
→ Auto-saves goal and exam info

Or explicitly:
"Remember that my optional subject is Geography"
→ Asks for confirmation, then saves
```

**Viewing Memories:**
```
In chat:
"What do you remember about me?"
"What are my goals?"
"Show my saved information"

Or in Settings:
Go to Settings → Memory tab → View all
```

**Managing Memories:**
1. Go to Settings → Memory
2. View all saved memories
3. Edit any memory
4. Delete unwanted memories
5. See usage statistics

**API Endpoints:**
- `GET /api/user/memory` - Fetch all memories
- `POST /api/user/memory` - Save new memory
- `PUT /api/user/memory` - Update memory
- `DELETE /api/user/memory` - Delete memory

**Memory Categories:**
- 🎯 **Goal:** Career aspirations
- ❤️ **Preference:** Personal likes/dislikes
- 📚 **Study Habit:** Study patterns
- 📝 **Exam:** Exam-related info
- 📖 **Subject:** Subject knowledge
- 👤 **Personal:** Background info
- 📋 **General:** Other information

**How Memories Are Used:**
- Added to AI context in every chat
- Used to personalize recommendations
- Helps set study goals
- Customizes content difficulty
- Improves essay suggestions
- Tailors interview questions

For detailed guide, see: [Memory Feature Guide](../brain/memory-feature-guide.md)

---

### 🎯 Personalization

**What it does:** Adapts the entire platform to your learning style, preferences, and progress.

**What Gets Personalized:**

**1. Communication Style:**
- Tone (formal/casual/encouraging)
- Response length (concise/detailed)
- Use of examples/analogies
- Step-by-step explanations

**2. Content Recommendations:**
- Based on weak areas
- Aligned with goals
- Considers study patterns
- Matches preferred topics

**3. Study Schedule:**
- Optimal study times
- Break reminders
- Daily goals
- Progress tracking

**4. UI/UX:**
- Theme (light/dark/auto)
- Font size
- Layout preferences
- Notification settings

**How It Works:**

**Learning About You:**
1. Tracks your interactions
2. Analyzes question patterns
3. Monitors topic interests
4. Observes study times
5. Records performance data

**Adapting Responses:**
1. AI adjusts communication style
2. Content matches your level
3. Suggestions based on progress
4. Recommendations get better over time

**Managing Preferences:**
1. Go to Settings → Preferences
2. Customize:
   - UI preferences
   - Study schedule
   - Notifications
   - Language & AI model
3. Changes apply immediately

**API Endpoints:**
- `GET /api/user/preferences` - Get preferences
- `PUT /api/user/preferences` - Update preferences
- `GET /api/user/personalization` - Get personalization data
- `PUT /api/user/personalization` - Update personalization

**Personalization Data:**
- Topic interests & engagement
- Preferred study times
- Question types preference
- Communication style preference
- Content difficulty preference

---

### 📊 Study Analytics

**What it does:** Track your progress, analyze patterns, and get insights to improve your preparation.

**Metrics Tracked:**

**1. Activity Metrics:**
- Total study sessions
- Time spent per subject
- Questions attempted
- Tests taken
- Average session duration

**2. Performance Metrics:**
- Overall accuracy
- Subject-wise scores
- Topic-wise performance
- Improvement trends
- Weak area identification

**3. Engagement Metrics:**
- Daily active use
- Study streak
- Peak productivity hours
- Most studied topics
- Question types preference

**4. Progress Metrics:**
- Learning path completion
- Goals achieved
- Milestones reached
- Improvement rate

**How to Use:**

**Viewing Dashboard:**
1. Go to Dashboard/Analytics
2. See overview:
   - Today's progress
   - Weekly summary
   - Monthly trends
3. Drill down into specific metrics

**Analyzing Performance:**
1. View subject-wise breakdown
2. Identify weak areas
3. Track improvement over time
4. Compare with goals

**Getting Insights:**
1. AI analyzes your data
2. Provides actionable insights:
   - "You perform best in evening sessions"
   - "Economics needs more focus"
   - "Your History accuracy improved 15%"
3. Personalized recommendations

**API Endpoints:**
- `GET /api/user/analytics` - Get study analytics
- `GET /api/user/statistics` - Get user statistics
- `GET /api/metrics/model-usage` - AI usage metrics

**Visual Reports:**
- Line graphs for trends
- Bar charts for comparisons
- Pie charts for distributions
- Heatmaps for activity patterns

---

### 🎤 Voice Features

**What it does:** Complete voice interaction - speak your questions, hear AI responses.

**Features:**

**1. Speech-to-Text:**
- Real-time voice recognition
- Support for English + Indian languages
- Background noise filtering
- Continuous recognition
- Powered by Azure Speech SDK

**2. Text-to-Speech:**
- Natural sounding AI voices
- Multiple voice options
- Speed control
- Language support
- High-quality synthesis

**How to Use:**

**Voice Input:**
1. Click microphone icon in chat
2. Grant microphone permission
3. Speak your question
4. See real-time transcription
5. Submit when done

**Voice Output:**
1. Enable "Read Response" option
2. AI speaks the response
3. Control playback:
   - Play/Pause
   - Speed adjustment
   - Volume control

**Language Support:**
- English (Indian accent)
- Hindi
- Tamil
- Telugu
- Marathi
- Bengali
- Gujarati
- Kannada
- Malayalam
- Punjabi

**API Endpoints:**
- `GET /api/ai/speech-token` - Get Azure Speech token
- `POST /api/ai/speech` - Text-to-speech synthesis

**Technical Details:**
- Uses Azure Cognitive Services
- Client-side recognition (browser)
- Server-side synthesis
- Streaming audio playback

**Pro Tips:**
- Speak clearly and at normal pace
- Use headphones for better recognition
- Minimize background noise
- Check microphone permissions

---

### 🌐 Translation

**What it does:** Translate content between English and 10+ Indian languages.

**Features:**
- Real-time translation
- Context-aware translations
- Domain-specific (UPSC context)
- Bulk translation support
- Quality assurance

**Supported Languages:**
- English ↔ Hindi
- English ↔ Tamil
- English ↔ Telugu
- English ↔ Marathi
- English ↔ Bengali
- English ↔ Gujarati
- English ↔ Kannada
- English ↔ Malayalam
- English ↔ Punjabi
- English ↔ Odia

**Where It's Used:**
1. **Chat:** Chat in your preferred language
2. **Mock Tests:** Take tests in regional languages
3. **Essays:** Write and get feedback in your language
4. **Current Affairs:** Read news in your language
5. **PYQs:** Translate questions on demand

**How to Use:**
1. Select language in settings
2. All content auto-translates
3. Or click "Translate" on specific content
4. Switch languages anytime

**API Endpoint:**
- `POST /api/ai/translate` - Translate text

**Translation Services:**
- Primary: Azure Translator
- Fallback: Google Translate
- Custom: UPSC terminology dictionary

---

### 🔖 Bookmarks

**What it does:** Save and organize important content for quick access and revision.

**What You Can Bookmark:**
- Chat conversations
- PYQs
- Flashcards
- Essays
- News articles
- Mock test questions
- Interview questions

**Features:**
- **Tagging:** Add custom tags
- **Categories:** Auto-categorize by type
- **Search:** Find bookmarks quickly
- **Collections:** Organize into folders
- **Export:** Download for offline use
- **Sharing:** Share with study groups (future)

**How to Use:**

**Creating Bookmarks:**
1. Click bookmark icon on any content
2. Add title (optional)
3. Add tags (optional)
4. Select folder
5. Save

**Viewing Bookmarks:**
1. Go to Bookmarks page
2. Filter by:
   - Type (PYQ, chat, essay, etc.)
   - Tags
   - Date added
3. Click to view content

**Managing Bookmarks:**
1. Edit title/tags
2. Move to different folder
3. Delete unwanted bookmarks
4. Export selected bookmarks

**API Endpoints:**
- `GET /api/user/bookmarks` - List bookmarks
- `POST /api/user/bookmarks` - Add bookmark
- `DELETE /api/user/bookmarks` - Remove bookmark

**Smart Features:**
- Auto-suggest tags
- Duplicate detection
- Usage tracking
- Related content suggestions

---

## Additional Features

### 📤 Data Export (GDPR Compliance)

**What it does:** Export all your data in machine-readable format.

**Exportable Data:**
- User profile
- All conversations
- Mock test history
- Study analytics
- Saved memories
- Bookmarks
- Preferences

**API Endpoint:**
- `GET /api/user/export-data` - Export all data

---

### 🔒 Admin Features

**What it does:** Admin-only tools for system management.

**Features:**
- User management
- Content moderation
- System monitoring
- Error tracking
- Usage analytics

**API Endpoints:**
- `GET /api/admin/users` - Manage users
- `POST /api/monitoring/errors` - Log errors
- `GET /api/analytics/visitor-stats` - View stats

---

## Getting Help

### Frequently Asked Questions

**Q: How do I change my language preference?**
A: Go to Settings → Preferences → Language & AI

**Q: Can I use the platform offline?**
A: Currently, an internet connection is required. Offline mode is planned.

**Q: How is my data secured?**
A: We use encryption, secure authentication, and follow GDPR guidelines.

**Q: Can I delete my account?**
A: Yes, contact support or use the data deletion option in settings.

**Q: How accurate is the AI?**
A: AI responses are highly accurate but should be cross-verified with official sources.

---

**Last Updated:** December 11, 2024  
**Version:** 2.0  
**Need Help?** Contact support or use the in-app chat for assistance.
