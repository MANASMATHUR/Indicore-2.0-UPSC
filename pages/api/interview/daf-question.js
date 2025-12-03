import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import formidable from 'formidable';
import fs from 'fs';
import { callAIWithFallback } from '@/lib/ai-providers';

// Disable default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let dafFile = null;
  try {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);

    const examType = Array.isArray(fields.examType) ? fields.examType[0] : fields.examType;
    const customQuestion = Array.isArray(fields.customQuestion) ? fields.customQuestion[0] : fields.customQuestion;
    const dafExtractedText = Array.isArray(fields.dafExtractedText) ? fields.dafExtractedText[0] : fields.dafExtractedText;
    dafFile = Array.isArray(files.dafFile) ? files.dafFile[0] : files.dafFile;

    // Validate input
    if (!customQuestion || !customQuestion.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!dafExtractedText || !dafExtractedText.trim()) {
      return res.status(400).json({ error: 'DAF content is required. Please upload your DAF file.' });
    }

    // Get user preferences
    const preferences = session.user?.preferences || {};
    const preferredModel = preferences.model || 'sonar-pro';
    const preferredProvider = preferences.provider || 'openai';
    const preferredOpenAIModel = preferences.openAIModel || process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o-mini';

    // Create system prompt with DAF context
    const sanitizedDafText = dafExtractedText.trim();
    const dafContent = sanitizedDafText.length > 0
      ? sanitizedDafText.substring(0, 3000) + (sanitizedDafText.length > 3000 ? '\n\n... (truncated for context)' : '')
      : 'No DAF content provided';
    
    const systemPrompt = `You are an expert interview coach specializing in ${sanitizedExamType} interviews. You have access to the candidate's Detailed Application Form (DAF) and need to provide personalized, customized answers based on their specific profile.

**Your Role:**
- Analyze the candidate's DAF content (education, work experience, hobbies, achievements, etc.)
- Provide answers that are specifically tailored to their background
- Help them prepare for questions that interviewers might ask based on their DAF
- Give practical, actionable advice relevant to their profile

**DAF Content:**
${dafContent}

**Response Guidelines:**
- Be specific to the candidate's profile mentioned in the DAF
- Reference their hobbies, education, work experience when relevant
- Provide realistic interview questions they might face
- Give detailed, exam-appropriate answers
- Connect their background to administrative/service contexts
- Be encouraging and supportive`;

    const userPrompt = `Based on the candidate's DAF provided above, please answer the following question:

"${sanitizedQuestion}"

Provide a comprehensive, personalized answer that:
1. References specific details from their DAF when relevant
2. Gives practical, actionable advice
3. Helps them prepare for their ${sanitizedExamType} interview
4. Is tailored to their unique background and profile`;

    // Call AI to generate customized answer
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

    const customizedAnswer = aiResult?.content || 'Unable to generate answer at this time. Please try again.';

    // Clean up uploaded file
    if (dafFile && dafFile.filepath && fs.existsSync(dafFile.filepath)) {
      fs.unlinkSync(dafFile.filepath);
    }

    return res.status(200).json({
      success: true,
      answer: customizedAnswer,
      message: 'Customized answer generated based on your DAF'
    });

  } catch (error) {
    console.error('Error processing DAF question:', error);
    
    // Clean up uploaded file on error
    try {
      if (dafFile && dafFile.filepath && fs.existsSync(dafFile.filepath)) {
        fs.unlinkSync(dafFile.filepath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up file:', cleanupError);
    }
    
    return res.status(500).json({
      error: 'Failed to process your question. Please try again later.',
      details: error.message
    });
  }
}

