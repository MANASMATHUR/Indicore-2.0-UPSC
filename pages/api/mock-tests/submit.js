import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import MockTest from '@/models/MockTest';
import MockTestResult from '@/models/MockTestResult';
import User from '@/models/User';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { testId, answers, timeSpent, startedAt } = req.body;

    if (!testId || !answers) {
      return res.status(400).json({ error: 'Test ID and answers are required' });
    }

    await connectToDatabase();

    const test = await MockTest.findById(testId);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    const answersArray = Array.isArray(answers) ? answers : [];
    const answersMap = new Map();
    answersArray.forEach((answer, idx) => {
      const questionIndex = typeof answer?.questionIndex === 'number' ? answer.questionIndex : idx;
      if (typeof questionIndex === 'number') {
        answersMap.set(questionIndex, {
          ...answer,
          selectedAnswer: answer?.selectedAnswer ?? null,
          textAnswer: answer?.textAnswer ?? null
        });
      }
    });

    let correctAnswers = 0;
    let wrongAnswers = 0;
    let unattempted = 0;
    let totalMarks = 0;
    const answerDetails = [];
    const subjectWise = {};
    const topicWise = {};

    test.questions.forEach((question, index) => {
      const userAnswer = answersMap.get(index) || null;
      const isSubjective = question.questionType === 'subjective';
      const isUnattempted = !userAnswer || (!userAnswer.selectedAnswer && !userAnswer.textAnswer);
      const isCorrect = !isSubjective && userAnswer && userAnswer.selectedAnswer === question.correctAnswer;

      if (isSubjective) {
        // For subjective questions, we can't auto-grade, so mark as attempted
        if (!isUnattempted) {
          // Subjective answers are saved but not auto-graded
          // They would need manual evaluation or AI-based evaluation
          correctAnswers++; // Count as attempted
          totalMarks += question.marks || 10; // Award full marks (or could be evaluated later)
        } else {
          unattempted++;
        }
      } else {
        // MCQ questions - auto-grade
        if (isUnattempted) {
          unattempted++;
        } else if (isCorrect) {
          correctAnswers++;
          totalMarks += question.marks || 1;
        } else {
          wrongAnswers++;
          totalMarks -= question.negativeMarks || 0.33;
        }
      }

      // Subject-wise tracking
      const subject = question.subject || 'General';
      if (!subjectWise[subject]) {
        subjectWise[subject] = { total: 0, correct: 0, wrong: 0, marks: 0 };
      }
      subjectWise[subject].total++;
      if (isSubjective) {
        if (!isUnattempted) {
          subjectWise[subject].correct++;
          subjectWise[subject].marks += question.marks || 10;
        }
      } else {
        if (isCorrect) {
          subjectWise[subject].correct++;
          subjectWise[subject].marks += question.marks || 1;
        } else if (!isUnattempted) {
          subjectWise[subject].wrong++;
          subjectWise[subject].marks -= question.negativeMarks || 0.33;
        }
      }

      // Topic-wise tracking
      const topic = question.topic || 'General';
      if (!topicWise[topic]) {
        topicWise[topic] = { total: 0, correct: 0, wrong: 0, marks: 0 };
      }
      topicWise[topic].total++;
      if (isSubjective) {
        if (!isUnattempted) {
          topicWise[topic].correct++;
          topicWise[topic].marks += question.marks || 10;
        }
      } else {
        if (isCorrect) {
          topicWise[topic].correct++;
          topicWise[topic].marks += question.marks || 1;
        } else if (!isUnattempted) {
          topicWise[topic].wrong++;
          topicWise[topic].marks -= question.negativeMarks || 0.33;
        }
      }

      answerDetails.push({
        questionId: question._id || question.id || index,
        questionIndex: index,
        questionType: question.questionType || 'mcq',
        selectedAnswer: userAnswer?.selectedAnswer || null,
        textAnswer: userAnswer?.textAnswer || null,
        isCorrect: isSubjective ? null : isCorrect, // null for subjective (needs evaluation)
        timeSpent: userAnswer?.timeSpent || 0,
        correctAnswer: isSubjective ? null : (question.correctAnswer || null),
        marksObtained: isSubjective
          ? (isUnattempted ? 0 : (question.marks || 10)) // Full marks for subjective (or evaluate later)
          : (isCorrect ? (question.marks || 1) : (!isUnattempted ? -(question.negativeMarks || 0.33) : 0))
      });
    });

    const percentage = (totalMarks / test.totalMarks) * 100;

    const resultData = {
      userId: session.user.id,
      testId,
      testTitle: test.title,
      examType: test.examType,
      paperType: test.paperType,
      answers: answerDetails,
      totalQuestions: test.totalQuestions,
      correctAnswers,
      wrongAnswers,
      unattempted,
      marksObtained: totalMarks,
      totalMarks: test.totalMarks,
      percentage: Math.max(0, percentage),
      timeSpent: timeSpent || 0,
      subjectWisePerformance: Object.entries(subjectWise).map(([subject, data]) => ({
        subject,
        ...data
      })),
      topicWisePerformance: Object.entries(topicWise).map(([topic, data]) => ({
        topic,
        ...data
      })),
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      finishedAt: new Date()
    };

    const result = await MockTestResult.create(resultData);

    // Update User statistics and personalization
    try {
      const user = await User.findById(session.user.id);
      if (user) {
        // Initialize performanceMetrics if not exists
        if (!user.performanceMetrics) user.performanceMetrics = {};
        if (!user.performanceMetrics.mockTestPerformance) {
          user.performanceMetrics.mockTestPerformance = {
            totalTests: 0,
            averageScore: 0,
            bestScore: 0,
            improvementTrend: 'stable'
          };
        }

        const mtPerf = user.performanceMetrics.mockTestPerformance;
        const oldTotal = mtPerf.totalTests || 0;
        const oldAvg = mtPerf.averageScore || 0;

        mtPerf.totalTests = oldTotal + 1;
        mtPerf.averageScore = Math.round(((oldAvg * oldTotal) + resultData.percentage) / (oldTotal + 1));
        mtPerf.bestScore = Math.max(mtPerf.bestScore || 0, resultData.percentage);

        // Improvement Trend
        if (oldTotal > 0) {
          if (resultData.percentage > oldAvg + 5) mtPerf.improvementTrend = 'improving';
          else if (resultData.percentage < oldAvg - 5) mtPerf.improvementTrend = 'declining';
          else mtPerf.improvementTrend = 'stable';
        }

        // Update overall study statistics
        if (!user.statistics) user.statistics = {};
        user.statistics.totalQuestions = (user.statistics.totalQuestions || 0) + test.totalQuestions;
        user.statistics.lastStudyDate = new Date();

        // Personalization: Weak Areas
        if (!user.profile) user.profile = { personalization: { recommendations: { weakAreas: [] } } };
        if (!user.profile.personalization) user.profile.personalization = { recommendations: { weakAreas: [] } };
        if (!user.profile.personalization.recommendations) user.profile.personalization.recommendations = { weakAreas: [] };

        const weakAreas = user.profile.personalization.recommendations.weakAreas || [];
        resultData.topicWisePerformance.forEach(topicData => {
          const accuracy = (topicData.correct / topicData.total) * 100;
          if (accuracy < 50) {
            // Topic is a weak area
            const existingIdx = weakAreas.findIndex(wa => wa.topic === topicData.topic);
            if (existingIdx > -1) {
              weakAreas[existingIdx].identifiedAt = new Date();
            } else {
              weakAreas.push({
                topic: topicData.topic,
                identifiedAt: new Date(),
                improvementSuggestions: [`Review basic concepts of ${topicData.topic}`, `Practice more ${topicData.topic} PYQs`]
              });
            }
          }
        });

        // Keep only top 5 weak areas
        user.profile.personalization.recommendations.weakAreas = weakAreas
          .sort((a, b) => b.identifiedAt - a.identifiedAt)
          .slice(0, 5);

        await user.save();
      }
    } catch (userUpdateError) {
      console.error('Error updating user stats after test submission:', userUpdateError);
      // Non-blocking: we still return the result
    }

    return res.status(200).json({ result });
  } catch (error) {
    console.error('Error submitting test:', error);
    return res.status(500).json({ error: 'Failed to submit test', details: error.message });
  }
}

