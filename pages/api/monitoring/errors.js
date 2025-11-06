import { NextApiRequest, NextApiResponse } from 'next';

const errorLog = [];
const performanceMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  averageResponseTime: 0,
  errorsByType: {},
  requestsByEndpoint: {}
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    return handleErrorReporting(req, res);
  }

  if (req.method === 'GET') {
    return handleMetricsRequest(req, res);
  }

  return res.status(405).json({ 
    error: 'Method not allowed',
    code: 'METHOD_NOT_ALLOWED'
  });
}

async function handleErrorReporting(req, res) {
  try {
    const {
      id,
      timestamp,
      message,
      stack,
      severity,
      context,
      userAgent,
      url,
      sessionId
    } = req.body;

    if (!id || !timestamp || !message || !severity) {
      return res.status(400).json({
        error: 'Missing required error fields',
        code: 'VALIDATION_ERROR'
      });
    }

    const sanitizedError = {
      id: String(id).substring(0, 100),
      timestamp: new Date(timestamp).toISOString(),
      message: String(message).substring(0, 1000),
      stack: stack ? String(stack).substring(0, 5000) : null,
      severity: ['error', 'warning', 'info'].includes(severity) ? severity : 'error',
      context: context || {},
      userAgent: String(userAgent).substring(0, 500),
      url: String(url).substring(0, 500),
      sessionId: String(sessionId).substring(0, 100),
      receivedAt: new Date().toISOString()
    };

    errorLog.unshift(sanitizedError);
    if (errorLog.length > 1000) {
      errorLog.pop();
    }

    performanceMetrics.failedRequests++;
    performanceMetrics.errorsByType[severity] = (performanceMetrics.errorsByType[severity] || 0) + 1;

    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 ${severity.toUpperCase()}: ${sanitizedError.message}`);
      console.error('Error ID:', sanitizedError.id);
      console.error('Context:', sanitizedError.context);
      console.error('Stack:', sanitizedError.stack);
      console.groupEnd();
    }

    if (process.env.NODE_ENV === 'production') {
      // await sendToMonitoringService(sanitizedError);
    }

    res.status(200).json({
      success: true,
      errorId: sanitizedError.id,
      timestamp: sanitizedError.receivedAt
    });

  } catch (error) {
    console.error('Error reporting failed:', error);
    res.status(500).json({
      error: 'Failed to report error',
      code: 'REPORTING_ERROR'
    });
  }
}

async function handleMetricsRequest(req, res) {
  try {
    const { type = 'all' } = req.query;

    const response = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    };

    switch (type) {
      case 'errors':
        response.errors = {
          total: errorLog.length,
          recent: errorLog.slice(0, 10),
          bySeverity: performanceMetrics.errorsByType
        };
        break;

      case 'performance':
        response.performance = {
          totalRequests: performanceMetrics.totalRequests,
          successfulRequests: performanceMetrics.successfulRequests,
          failedRequests: performanceMetrics.failedRequests,
          successRate: performanceMetrics.totalRequests > 0 
            ? (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100 
            : 0,
          averageResponseTime: performanceMetrics.averageResponseTime,
          requestsByEndpoint: performanceMetrics.requestsByEndpoint
        };
        break;

      case 'health':
        response.health = {
          status: 'healthy',
          checks: {
            memory: process.memoryUsage().heapUsed < 100 * 1024 * 1024, // Less than 100MB
            uptime: process.uptime() > 0,
            errors: errorLog.filter(e => e.severity === 'error').length < 10
          }
        };
        break;

      default:
        response.errors = {
          total: errorLog.length,
          recent: errorLog.slice(0, 5),
          bySeverity: performanceMetrics.errorsByType
        };
        response.performance = {
          totalRequests: performanceMetrics.totalRequests,
          successfulRequests: performanceMetrics.successfulRequests,
          failedRequests: performanceMetrics.failedRequests,
          successRate: performanceMetrics.totalRequests > 0 
            ? (performanceMetrics.successfulRequests / performanceMetrics.totalRequests) * 100 
            : 0,
          averageResponseTime: performanceMetrics.averageResponseTime
        };
        response.health = {
          status: 'healthy',
          uptime: process.uptime()
        };
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Metrics request failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      code: 'METRICS_ERROR'
    });
  }
}

export function updatePerformanceMetrics(endpoint, responseTime, success) {
  performanceMetrics.totalRequests++;
  if (success) {
    performanceMetrics.successfulRequests++;
  } else {
    performanceMetrics.failedRequests++;
  }

  const totalTime = performanceMetrics.averageResponseTime * (performanceMetrics.totalRequests - 1) + responseTime;
  performanceMetrics.averageResponseTime = totalTime / performanceMetrics.totalRequests;

  if (!performanceMetrics.requestsByEndpoint[endpoint]) {
    performanceMetrics.requestsByEndpoint[endpoint] = { total: 0, successful: 0, failed: 0 };
  }
  performanceMetrics.requestsByEndpoint[endpoint].total++;
  if (success) {
    performanceMetrics.requestsByEndpoint[endpoint].successful++;
  } else {
    performanceMetrics.requestsByEndpoint[endpoint].failed++;
  }
}

export { performanceMetrics };
