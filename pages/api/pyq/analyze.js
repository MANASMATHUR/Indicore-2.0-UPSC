import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';
import pyqAnalysisService from '@/lib/pyqAnalysisService';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { questionId, questionText } = req.body;

    if (!questionId && !questionText) {
      return res.status(400).json({ 
        error: 'Either questionId or questionText is required' 
      });
    }

    await connectToDatabase();

    let question;
    if (questionId) {
      question = await PYQ.findById(questionId).lean();
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }
    } else {
      // Find question by text (approximate match)
      question = await PYQ.findOne({
        question: { $regex: questionText.substring(0, 100), $options: 'i' }
      }).lean();
      
      if (!question) {
        // If question not found, analyze the provided text anyway
        const analysis = await pyqAnalysisService.analyzeQuestion(
          null,
          questionText,
          '',
          [],
          ''
        );
        return res.status(200).json({
          question: questionText,
          ...analysis,
          note: 'Question not found in database, analysis based on text only'
        });
      }
    }

    // Check if analysis already exists
    if (question.keywords && question.keywords.length > 0 && 
        question.analysis && question.analysis.length > 0) {
      // Get similar questions
      const similarQuestions = await pyqAnalysisService.findSimilarQuestions(
        question._id.toString(),
        question.topicTags || [],
        question.keywords || [],
        question.theme || '',
        5
      );

      return res.status(200).json({
        questionId: question._id.toString(),
        question: question.question,
        year: question.year,
        paper: question.paper,
        exam: question.exam,
        topicTags: question.topicTags || [],
        keywords: question.keywords || [],
        analysis: question.analysis,
        similarQuestions: similarQuestions.map(q => ({
          id: q._id.toString(),
          question: q.question.substring(0, 150) + (q.question.length > 150 ? '...' : ''),
          year: q.year,
          paper: q.paper,
          exam: q.exam,
          topicTags: q.topicTags || []
        })),
        cached: true
      });
    }

    // Perform analysis
    const analysis = await pyqAnalysisService.analyzeQuestion(
      question._id.toString(),
      question.question,
      question.answer || '',
      question.topicTags || [],
      question.theme || ''
    );

    // Update the question with analysis results
    await PYQ.findByIdAndUpdate(question._id, {
      $set: {
        keywords: analysis.keywords,
        topicTags: analysis.topicTags,
        analysis: analysis.analysis,
        updatedAt: new Date()
      }
    });

    return res.status(200).json({
      questionId: question._id.toString(),
      question: question.question,
      year: question.year,
      paper: question.paper,
      exam: question.exam,
      topicTags: analysis.topicTags,
      keywords: analysis.keywords,
      analysis: analysis.analysis,
      similarQuestions: analysis.similarQuestions,
      cached: false
    });

  } catch (error) {
    console.error('PYQ analysis API error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze question',
      message: error.message 
    });
  }
}

