import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { callAIWithFallback } from '@/lib/ai-providers';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { dafExtractedText, examType, questionType, count, language } = req.body;

    const sanitizedExamType = examType || 'UPSC';
    const hasDaf = dafExtractedText && dafExtractedText.trim().length > 0;

    // Get user preferences
    const preferences = session.user?.preferences || {};
    const preferredModel = preferences.model || 'sonar-pro';
    const preferredProvider = preferences.provider || 'openai';
    const preferredOpenAIModel = preferences.openAIModel || process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o';

    let systemPrompt;
    let userPrompt;
    let questionsData;

    // Determine which mode: DAF-based or regular interview questions
    if (hasDaf) {
      // MODE 1: DAF-based personalized questions (from DAF modal)
      const sanitizedDafText = dafExtractedText.trim();
      const dafContent = sanitizedDafText.length > 0
        ? sanitizedDafText.substring(0, 4000) + (sanitizedDafText.length > 4000 ? '\n\n... (truncated for context)' : '')
        : '';

      systemPrompt = `You are an expert interview coach specializing in ${sanitizedExamType} interviews. You have access to the candidate's Detailed Application Form (DAF).

**Your Role:**
- Analyze the candidate's DAF content (education, work experience, hobbies, achievements, etc.)
- Generate a list of 5-7 highly relevant, personalized interview questions based on their profile.
- The questions should be challenging but realistic for a ${sanitizedExamType} interview.
- Cover different areas: Hobbies, Education, Work Experience, and Situational questions based on their background.

**DAF Content:**
${dafContent}

**Response Format:**
Return ONLY a numbered list of questions. Do not include introductory or concluding text.
1. [Question 1]
2. [Question 2]
...`;

      userPrompt = `Generate 5-7 personalized interview questions based on the DAF provided above.`;

      // Call AI to generate questions
      const aiResult = await callAIWithFallback(
        [{ role: 'user', content: userPrompt }],
        systemPrompt,
        1000,
        0.7,
        {
          model: preferredModel,
          preferredProvider: preferredProvider,
          openAIModel: preferredOpenAIModel
        }
      );

      const generatedQuestions = aiResult?.content || 'Unable to generate questions at this time. Please try again.';

      return res.status(200).json({
        success: true,
        questions: generatedQuestions,
        message: 'Questions generated based on your DAF'
      });

    } else if (questionType) {
      // MODE 2: Regular interview questions (from main interview page)
      const questionCount = count || 5;

      // Define question type descriptions
      const questionTypeDescriptions = {
        personality: 'personality assessment questions that explore values, motivations, and character traits',
        current_affairs: 'current affairs questions covering recent national and international events, government policies, and socio-economic issues',
        situational: 'situational questions presenting hypothetical scenarios to assess decision-making and problem-solving abilities',
        technical: 'technical questions related to the candidate\'s educational background and optional subjects'
      };

      const typeDescription = questionTypeDescriptions[questionType] || 'general interview questions';

      systemPrompt = `You are an expert interview coach specializing in ${sanitizedExamType} interviews.

**Your Role:**
- Generate ${questionCount} ${typeDescription} for a ${sanitizedExamType} interview.
- Questions should be challenging but realistic for actual ${sanitizedExamType} interviews.
- Each question should be clear, specific, and designed to assess the candidate's knowledge, skills, and suitability.
- For personality questions: Focus on values, ethics, motivations, and character assessment.
- For current affairs: Cover recent events (last 6-12 months), government policies, and socio-economic issues.
- For situational questions: Present realistic scenarios that test decision-making, leadership, and problem-solving.
- For technical questions: Cover the candidate's educational background and relevant subject knowledge.

**Response Format:**
Return a JSON array of question objects. Each object should have:
{
  "question": "The question text",
  "questionType": "${questionType}"
}

Example:
[
  {
    "question": "What motivates you to serve in the civil services?",
    "questionType": "personality"
  }
]`;

      userPrompt = `Generate ${questionCount} ${typeDescription} for ${sanitizedExamType} interview in JSON format.`;

      // Call AI to generate questions
      const aiResult = await callAIWithFallback(
        [{ role: 'user', content: userPrompt }],
        systemPrompt,
        2000,
        0.7,
        {
          model: preferredModel,
          preferredProvider: preferredProvider,
          openAIModel: preferredOpenAIModel
        }
      );

      let generatedContent = aiResult?.content || '[]';

      // Try to parse JSON response
      try {
        // Remove markdown code blocks if present
        generatedContent = generatedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        questionsData = JSON.parse(generatedContent);

        // Validate structure
        if (!Array.isArray(questionsData)) {
          throw new Error('Response is not an array');
        }

        // Ensure each question has required fields
        questionsData = questionsData.map(q => ({
          question: q.question || q.text || 'Question not available',
          questionType: q.questionType || questionType
        }));

      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        // Fallback: try to extract questions from text
        const lines = generatedContent.split('\n').filter(line => line.trim());
        questionsData = lines
          .filter(line => /^\d+\./.test(line.trim()))
          .map(line => ({
            question: line.replace(/^\d+\.\s*/, '').trim(),
            questionType: questionType
          }));
      }

      return res.status(200).json({
        success: true,
        questions: questionsData,
        message: `Generated ${questionsData.length} ${questionType} questions`
      });

    } else {
      // MODE 3: Generic questions when neither DAF nor questionType is provided
      systemPrompt = `You are an expert interview coach specializing in ${sanitizedExamType} interviews.

**Your Role:**
- Generate a list of 5-7 common and important interview questions for ${sanitizedExamType} interviews.
- The questions should be challenging but realistic for a ${sanitizedExamType} interview.
- Cover different areas: Current Affairs, General Knowledge, Ethics, Governance, and Situational questions.
- Focus on questions that are frequently asked in ${sanitizedExamType} interviews.

**Response Format:**
Return ONLY a numbered list of questions. Do not include introductory or concluding text.
1. [Question 1]
2. [Question 2]
...`;

      userPrompt = `Generate 5-7 common and important interview questions for ${sanitizedExamType} interviews.`;

      // Call AI to generate questions
      const aiResult = await callAIWithFallback(
        [{ role: 'user', content: userPrompt }],
        systemPrompt,
        1000,
        0.7,
        {
          model: preferredModel,
          preferredProvider: preferredProvider,
          openAIModel: preferredOpenAIModel
        }
      );

      const generatedQuestions = aiResult?.content || 'Unable to generate questions at this time. Please try again.';

      return res.status(200).json({
        success: true,
        questions: generatedQuestions,
        message: 'Generic questions generated'
      });
    }

  } catch (error) {
    console.error('Error generating questions:', error);
    return res.status(500).json({
      error: 'Failed to generate questions. Please try again later.',
      details: error.message
    });
  }
}
