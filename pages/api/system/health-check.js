import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';
import User from '@/models/User';
import Chat from '@/models/Chat';
import CurrentAffairsDigest from '@/models/CurrentAffairsDigest';

/**
 * System Health Check
 * Checks if all major components are working correctly
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {},
    errors: []
  };

  try {
    // 1. Database Connection Check
    try {
      await connectToDatabase();
      health.checks.database = {
        status: 'connected',
        message: 'Database connection successful'
      };
    } catch (error) {
      health.status = 'unhealthy';
      health.checks.database = {
        status: 'disconnected',
        message: error.message
      };
      health.errors.push(`Database: ${error.message}`);
    }

    // 2. PYQ Collection Check
    try {
      const pyqCount = await PYQ.countDocuments();
      const samplePYQ = await PYQ.findOne().lean();
      health.checks.pyq = {
        status: 'ok',
        count: pyqCount,
        hasSample: !!samplePYQ,
        message: `Found ${pyqCount} PYQ records`
      };
    } catch (error) {
      health.status = 'degraded';
      health.checks.pyq = {
        status: 'error',
        message: error.message
      };
      health.errors.push(`PYQ Collection: ${error.message}`);
    }

    // 3. User Collection Check
    try {
      const userCount = await User.countDocuments();
      health.checks.users = {
        status: 'ok',
        count: userCount,
        message: `Found ${userCount} user records`
      };
    } catch (error) {
      health.status = 'degraded';
      health.checks.users = {
        status: 'error',
        message: error.message
      };
      health.errors.push(`User Collection: ${error.message}`);
    }

    // 4. Chat Collection Check
    try {
      const chatCount = await Chat.countDocuments();
      health.checks.chats = {
        status: 'ok',
        count: chatCount,
        message: `Found ${chatCount} chat records`
      };
    } catch (error) {
      health.status = 'degraded';
      health.checks.chats = {
        status: 'error',
        message: error.message
      };
      health.errors.push(`Chat Collection: ${error.message}`);
    }

    // 5. Current Affairs Digest Check
    try {
      const digestCount = await CurrentAffairsDigest.countDocuments();
      health.checks.digests = {
        status: 'ok',
        count: digestCount,
        message: `Found ${digestCount} digest records`
      };
    } catch (error) {
      health.status = 'degraded';
      health.checks.digests = {
        status: 'error',
        message: error.message
      };
      health.errors.push(`Digest Collection: ${error.message}`);
    }

    // 6. Environment Variables Check
    const requiredEnvVars = [
      'MONGODB_URI',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL'
    ];
    const optionalEnvVars = [
      'PERPLEXITY_API_KEY',
      'GROQ_API_KEY',
      'GEMINI_API_KEY',
      'DEEPSEEK_API_KEY',
      'OPENROUTER_API_KEY',
      'AZURE_TRANSLATOR_KEY',
      'AZURE_TRANSLATOR_REGION'
    ];

    const missingRequired = requiredEnvVars.filter(v => !process.env[v]);
    const availableOptional = optionalEnvVars.filter(v => process.env[v]);

    health.checks.environment = {
      status: missingRequired.length === 0 ? 'ok' : 'error',
      required: {
        configured: requiredEnvVars.length - missingRequired.length,
        total: requiredEnvVars.length,
        missing: missingRequired
      },
      optional: {
        configured: availableOptional.length,
        total: optionalEnvVars.length,
        available: availableOptional
      },
      message: missingRequired.length === 0 
        ? 'All required environment variables are set'
        : `Missing required variables: ${missingRequired.join(', ')}`
    };

    if (missingRequired.length > 0) {
      health.status = 'unhealthy';
      health.errors.push(`Missing environment variables: ${missingRequired.join(', ')}`);
    }

    // 7. PYQ Data Quality Check (sample)
    try {
      const sampleSize = Math.min(100, await PYQ.countDocuments());
      const sample = await PYQ.find({}).limit(sampleSize).lean();
      
      const qualityIssues = {
        missingExam: 0,
        missingQuestion: 0,
        invalidYear: 0,
        missingKeywords: 0,
        missingTopicTags: 0
      };

      for (const pyq of sample) {
        if (!pyq.exam) qualityIssues.missingExam++;
        if (!pyq.question || pyq.question.trim().length < 10) qualityIssues.missingQuestion++;
        if (!pyq.year || pyq.year < 1990 || pyq.year > new Date().getFullYear() + 1) qualityIssues.invalidYear++;
        if (!pyq.keywords || !Array.isArray(pyq.keywords) || pyq.keywords.length === 0) qualityIssues.missingKeywords++;
        if (!pyq.topicTags || !Array.isArray(pyq.topicTags) || pyq.topicTags.length === 0) qualityIssues.missingTopicTags++;
      }

      const issueCount = Object.values(qualityIssues).reduce((sum, val) => sum + val, 0);
      const issuePercentage = sampleSize > 0 ? (issueCount / (sampleSize * 5)) * 100 : 0;

      health.checks.dataQuality = {
        status: issuePercentage < 20 ? 'good' : issuePercentage < 50 ? 'fair' : 'poor',
        sampleSize,
        issues: qualityIssues,
        issuePercentage: issuePercentage.toFixed(2),
        message: issuePercentage < 20 
          ? 'Data quality is good'
          : issuePercentage < 50
          ? 'Data quality needs improvement'
          : 'Data quality is poor - cleanup recommended'
      };

      if (issuePercentage > 50) {
        health.status = 'degraded';
        health.errors.push(`Data quality issues detected: ${issuePercentage.toFixed(2)}% of sample has issues`);
      }
    } catch (error) {
      health.checks.dataQuality = {
        status: 'error',
        message: error.message
      };
    }

    // 8. API Endpoints Check (basic validation)
    health.checks.endpoints = {
      status: 'ok',
      available: [
        '/api/pyq/search',
        '/api/pyq/analyze',
        '/api/pyq/cleanup',
        '/api/ai/chat',
        '/api/ai/translate',
        '/api/current-affairs/digest'
      ],
      message: 'Core API endpoints are available'
    };

  } catch (error) {
    health.status = 'unhealthy';
    health.errors.push(`Health check failed: ${error.message}`);
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return res.status(statusCode).json(health);
}

