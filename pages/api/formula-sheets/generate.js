import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import FormulaSheet from '@/models/FormulaSheet';
import { callAIWithFallback } from '@/lib/ai-providers';

export default async function handler(req, res) {
  // Feature temporarily disabled - keeping codebase for future use
  return res.status(503).json({ 
    error: 'Formula Sheets feature is currently under maintenance. Please check back later.',
    maintenance: true,
    message: 'This feature is temporarily disabled but will be available soon.'
  });

  /* COMMENTED OUT - Feature temporarily disabled
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const preferences = session.user?.preferences || {};
    const preferredModel = preferences.model || 'sonar-pro';
    const preferredProvider = preferences.provider || 'perplexity';
    const excludedProviders = preferences.excludedProviders || [];

    const { subject, topic, type = 'formula' } = req.body;

    if (!subject) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    await connectToDatabase();

    // Check if formula sheet already exists
    const existing = await FormulaSheet.findOne({
      subject,
      topic: topic || null,
      type,
      generatedBy: session.user.id
    });

    if (existing) {
      return res.status(200).json({
        formulaSheet: existing,
        cached: true
      });
    }

    const systemPrompt = `You are an expert educational content creator specializing in competitive exam preparation (UPSC, PCS, SSC). Your task is to create comprehensive study materials including formula sheets, concept maps, and quick reference guides.

**Requirements:**
- Content must be accurate and exam-relevant
- Use clear, concise language
- Include examples where applicable
- Organize information logically
- Focus on high-yield topics for competitive exams`;

    let userPrompt = '';

    if (type === 'formula') {
      userPrompt = `Create a comprehensive formula sheet for ${subject}${topic ? ` - ${topic}` : ''}.

Include:
1. All important formulas with clear notation
2. Description/meaning of each formula
3. Variable definitions
4. Example applications
5. Related concepts

Format as JSON with this structure:
{
  "formulas": [
    {
      "formula": "formula notation",
      "description": "what this formula calculates/represents",
      "variables": [
        {"symbol": "variable symbol", "meaning": "what it means"}
      ],
      "example": "example calculation or application",
      "subject": "${subject}",
      "topic": "${topic || 'general'}"
    }
  ]
}`;
    } else if (type === 'concept_map') {
      userPrompt = `Create a concept map for ${subject}${topic ? ` - ${topic}` : ''}.

A concept map should show relationships between concepts. Include:
1. Main concepts as nodes
2. Relationships between concepts as edges
3. Hierarchical structure
4. Key connections

Format as JSON:
{
  "conceptMap": {
    "nodes": [
      {"id": "node1", "label": "Concept Name", "type": "main|sub|detail", "description": "brief description", "connections": ["node2", "node3"]}
    ],
    "edges": [
      {"from": "node1", "to": "node2", "label": "relationship type"}
    ]
  }
}`;
    } else if (type === 'quick_reference') {
      userPrompt = `Create a quick reference guide for ${subject}${topic ? ` - ${topic}` : ''}.

Include:
1. Key concepts and definitions
2. Important facts and figures
3. Quick tips and mnemonics
4. Common mistakes to avoid
5. Exam-relevant points

Format as JSON:
{
  "quickReference": {
    "sections": [
      {
        "title": "Section Title",
        "content": "Brief overview",
        "items": ["Key point 1", "Key point 2"]
      }
    ]
  }
}`;
    }

    let parsedContent;
    try {
      const aiResult = await callAIWithFallback(
        [{ role: 'user', content: userPrompt }],
        systemPrompt,
        2000,
        0.6,
        {
          model: preferredModel,
          preferredProvider,
          excludeProviders: excludedProviders
        }
      );

      const aiResponse = aiResult?.content || '';

      try {
        // Try to extract JSON from response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // Fallback: create structure from text
        parsedContent = null;
      }
    } catch (aiError) {
      console.warn('AI generation failed for formula sheet, using fallback content:', aiError?.message);
      parsedContent = null;
    }

    if (!parsedContent) {
      if (type === 'formula') {
        parsedContent = {
          formulas: [
            {
              formula: subject.toLowerCase().includes('math') ? 'A = πr²' : 'GDP = C + I + G + (X − M)',
              description: subject.toLowerCase().includes('math')
                ? 'Area of a circle where r is the radius.'
                : 'Gross Domestic Product equals total consumption, investment, government spending, and net exports.',
              variables: subject.toLowerCase().includes('math')
                ? [
                    { symbol: 'A', meaning: 'Area of the circle' },
                    { symbol: 'r', meaning: 'Radius of the circle' }
                  ]
                : [
                    { symbol: 'C', meaning: 'Private consumption' },
                    { symbol: 'I', meaning: 'Gross investment' },
                    { symbol: 'G', meaning: 'Government expenditure' },
                    { symbol: 'X', meaning: 'Exports' },
                    { symbol: 'M', meaning: 'Imports' }
                  ],
              example: subject.toLowerCase().includes('math')
                ? 'If r = 7 cm, A = π × 7² = 153.94 cm².'
                : 'If consumption is 50 lakh crore, investment 20 lakh crore, government spending 15 lakh crore, exports 10 lakh crore, and imports 8 lakh crore, GDP = 50 + 20 + 15 + (10 − 8) = 87 lakh crore.',
              topic: topic || 'Core Concepts'
            }
          ]
        };
      } else if (type === 'concept_map') {
        parsedContent = {
          conceptMap: {
            nodes: [
              {
                id: 'root',
                label: topic || subject,
                type: 'main',
                description: `Core themes of ${topic || subject}`,
                connections: ['key1', 'key2']
              },
              {
                id: 'key1',
                label: 'Key Principles',
                type: 'sub',
                description: 'Foundational ideas and definitions',
                connections: ['detail1']
              },
              {
                id: 'key2',
                label: 'Applications',
                type: 'sub',
                description: 'Practical or exam relevant applications',
                connections: []
              },
              {
                id: 'detail1',
                label: 'Important Facts',
                type: 'detail',
                description: 'Frequently asked facts and figures',
                connections: []
              }
            ],
            edges: [
              { from: 'root', to: 'key1', label: 'defines' },
              { from: 'root', to: 'key2', label: 'leads to' },
              { from: 'key1', to: 'detail1', label: 'includes' }
            ]
          }
        };
      } else {
        parsedContent = {
          quickReference: {
            sections: [
              {
                title: 'Key Takeaways',
                content: `High-yield points for ${topic || subject}`,
                items: [
                  'Focus on recent syllabus updates and past year trends.',
                  'Revise core definitions and conceptual clarity.',
                  'Note down numerical data, indices and schemes relevant to the topic.'
                ]
              },
              {
                title: 'Exam Tips',
                content: 'Pointers to maximise recall during the exam',
                items: [
                  'Create flashcards for daily revision.',
                  'Relate concepts with current affairs for better retention.',
                  'Practice at least three previous year questions on this topic.'
                ]
              }
            ]
          }
        };
      }
    }

    const formulaSheetData = {
      title: `${subject}${topic ? ` - ${topic}` : ''} ${type === 'formula' ? 'Formula Sheet' : type === 'concept_map' ? 'Concept Map' : 'Quick Reference'}`,
      subject,
      topic: topic || null,
      type,
      content: parsedContent,
      generatedBy: session.user.id,
      tags: [subject, topic].filter(Boolean)
    };

    const formulaSheet = await FormulaSheet.create(formulaSheetData);

    return res.status(200).json({
      formulaSheet,
      cached: false
    });
  } catch (error) {
    console.error('Error generating formula sheet:', error);
    return res.status(500).json({ error: 'Failed to generate formula sheet', details: error.message });
  }
  */ // End of commented section
}

