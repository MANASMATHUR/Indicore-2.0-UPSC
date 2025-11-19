'use strict';

const MAX_METRIC_ENTRIES = 200;
const metricsBuffer = [];

export function recordModelMetric({
  provider = 'openai',
  model = 'gpt-4o',
  promptTokens = 0,
  completionTokens = 0,
  totalTokens = null,
  durationMs = 0,
  error = null
} = {}) {
  const entry = {
    provider,
    model,
    promptTokens,
    completionTokens,
    totalTokens: totalTokens ?? (promptTokens || 0) + (completionTokens || 0),
    durationMs,
    error: error ? String(error).slice(0, 200) : null,
    timestamp: Date.now()
  };
  metricsBuffer.push(entry);
  if (metricsBuffer.length > MAX_METRIC_ENTRIES) {
    metricsBuffer.shift();
  }
}

export function getMetricsSummary() {
  if (metricsBuffer.length === 0) {
    return {
      totalCalls: 0,
      avgLatencyMs: 0,
      avgTokens: 0,
      lastUpdated: null,
      providerBreakdown: []
    };
  }

  const totalCalls = metricsBuffer.length;
  const totalLatency = metricsBuffer.reduce((sum, m) => sum + (m.durationMs || 0), 0);
  const totalTokens = metricsBuffer.reduce((sum, m) => sum + (m.totalTokens || 0), 0);

  const providerMap = new Map();
  metricsBuffer.forEach((m) => {
    const key = `${m.provider}:${m.model}`;
    if (!providerMap.has(key)) {
      providerMap.set(key, {
        provider: m.provider,
        model: m.model,
        calls: 0,
        totalLatency: 0,
        totalTokens: 0,
        errors: 0
      });
    }
    const info = providerMap.get(key);
    info.calls += 1;
    info.totalLatency += m.durationMs || 0;
    info.totalTokens += m.totalTokens || 0;
    if (m.error) info.errors += 1;
  });

  const providerBreakdown = Array.from(providerMap.values()).map((info) => ({
    ...info,
    avgLatencyMs: info.calls ? Math.round(info.totalLatency / info.calls) : 0,
    avgTokens: info.calls ? Math.round(info.totalTokens / info.calls) : 0
  }));

  return {
    totalCalls,
    avgLatencyMs: Math.round(totalLatency / totalCalls),
    avgTokens: Math.round(totalTokens / totalCalls),
    lastUpdated: new Date(metricsBuffer[metricsBuffer.length - 1].timestamp).toISOString(),
    providerBreakdown
  };
}

