import { callAIWithFallback } from '@/lib/ai-providers';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question, theme, relatedQuestions = [], paper } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const relatedQuestionsText = relatedQuestions.length > 0
      ? `\n\nRelated questions in the same theme:\n${relatedQuestions.map((q, idx) => `${idx + 1}. ${q.question || q}`).join('\n')}`
      : '';

    const systemPrompt = `You are an expert UPSC Mains answer writing coach specializing in competitive exam preparation. Your task is to help students break down questions, develop structure, and identify reusable examples and arguments that can be applied across multiple questions in the same theme.

**EXAM-FOCUSED EXPERTISE:**
- **Question Analysis**: Break down UPSC Mains questions into logical, exam-relevant sub-parts aligned with GS paper requirements
- **Answer Structure**: Develop comprehensive answer structures following UPSC marking scheme and examiner expectations
- **Content Reproducibility**: Identify examples, case studies, and arguments that can be reused across similar questions in the same theme
- **Syllabus Alignment**: Ensure all content aligns with UPSC syllabus and previous year question patterns
- **Time Management**: Provide realistic time allocation based on question complexity and word count requirements

**UPSC ANSWER WRITING STANDARDS (EXAM-FOCUSED):**
- **Introduction (10-15% of word count)**: 
  - Context setting with current relevance
  - Clear thesis statement
  - Brief outline of approach
  - Connect to broader themes in syllabus
  
- **Main Body (70-80%)**: 
  - Structured arguments with multiple perspectives
  - Recent, relevant examples (last 2-3 years preferred)
  - Constitutional provisions, government schemes, policies
  - Data and statistics where relevant
  - Balanced analysis (pros/cons, challenges/opportunities)
  - Link to GS paper themes (e.g., GS-2: Governance, GS-3: Economy)
  
- **Conclusion (10-15%)**: 
  - Synthesis of key arguments
  - Forward-looking approach
  - Policy recommendations or way forward
  - Connect back to introduction

**EXAM-RELEVANT CONTENT REQUIREMENTS:**
- Use examples from recent government schemes, policies, and initiatives
- Include constitutional articles, amendments, and judicial interpretations
- Reference current affairs (last 2-3 years) relevant to the question
- Provide data, statistics, and facts that examiners value
- Include diverse perspectives: government, civil society, experts, international
- Link to related topics in UPSC syllabus for comprehensive coverage

**Response Format:**
Provide a JSON response with the following structure:
{
  "subParts": [
    {
      "title": "Sub-part title",
      "description": "What needs to be covered in this sub-part",
      "wordCount": "Approximate word count for this section"
    }
  ],
  "structure": {
    "introduction": "How to structure the introduction",
    "mainBody": [
      {
        "section": "Section title",
        "content": "What to cover in this section",
        "examples": ["Example 1", "Example 2"]
      }
    ],
    "conclusion": "How to structure the conclusion"
  },
  "reusableExamples": [
    {
      "example": "Example name or description",
      "applicability": "How this example can be used across different questions in this theme",
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }
  ],
  "reusableArguments": [
    {
      "argument": "Argument or perspective",
      "applicability": "How this argument can be applied to different questions",
      "supportingExamples": ["Example 1", "Example 2"]
    }
  ],
  "keyPoints": [
    "Important point 1",
    "Important point 2"
  ],
  "wordCount": "Total recommended word count (150 or 250)",
  "timeAllocation": "Recommended time allocation in minutes"
}`;

    const userPrompt = `Analyze the following UPSC Mains question and provide a comprehensive breakdown:

**Question:** ${question}

**Theme:** ${theme || 'Not specified'}

**Paper:** ${paper || 'Not specified'}${relatedQuestionsText}

**Task:**
1. Break down the question into logical sub-parts that need to be addressed
2. Develop a comprehensive answer structure (Introduction, Main Body, Conclusion)
3. Identify examples and case studies that can be reused across other questions in the same theme
4. Identify key arguments and perspectives that can be applied to similar questions
5. Provide a word count recommendation (150 or 250 words) based on the question type
6. Suggest time allocation for writing this answer

Focus on creating content that is:
- **Reproducible**: Examples and arguments that can be used across multiple questions in the same theme
- **Comprehensive**: Covers all aspects of the question
- **Structured**: Clear organization for effective answer writing
- **UPSC-appropriate**: Meets UPSC Mains answer writing standards`;

    const aiResponse = await callAIWithFallback(
      [{ role: 'user', content: userPrompt }],
      systemPrompt,
      4000,
      0.7
    );
    const response = aiResponse.content;

    let analysis;
    try {
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1]);
      } else {
        analysis = JSON.parse(response);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      analysis = {
        rawResponse: response,
        subParts: extractSubParts(response),
        structure: extractStructure(response),
        reusableExamples: extractExamples(response),
        reusableArguments: extractArguments(response),
        keyPoints: extractKeyPoints(response)
      };
    }

    return res.status(200).json({
      ok: true,
      analysis,
      question,
      theme,
      paper
    });
  } catch (error) {
    console.error('Question analysis error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Failed to analyze question',
      message: error.message
    });
  }
}

function extractSubParts(text) {
  const subParts = [];
  const lines = text.split('\n');
  let currentPart = null;

  for (const line of lines) {
    if (line.match(/^\d+[\.\)]\s*(.+)/) || line.match(/^[-*]\s*(.+)/)) {
      if (currentPart) subParts.push(currentPart);
      currentPart = { title: line.replace(/^\d+[\.\)]\s*|^[-*]\s*/, ''), description: '' };
    } else if (currentPart && line.trim()) {
      currentPart.description += line.trim() + ' ';
    }
  }
  if (currentPart) subParts.push(currentPart);

  return subParts.length > 0 ? subParts : [{ title: 'Main Analysis', description: text.substring(0, 200) }];
}

function extractStructure(text) {
  return {
    introduction: extractSection(text, /introduction/i) || 'Set context and provide thesis statement',
    mainBody: extractMainBodySections(text),
    conclusion: extractSection(text, /conclusion/i) || 'Synthesize key points and provide forward-looking approach'
  };
}

function extractSection(text, pattern) {
  const match = text.match(new RegExp(`${pattern.source}[\\s\\S]{0,500}`, 'i'));
  return match ? match[0].substring(0, 300) : null;
}

function extractMainBodySections(text) {
  const sections = [];
  const lines = text.split('\n');
  let currentSection = null;

  for (const line of lines) {
    if (line.match(/main body|body|analysis/i) && !currentSection) {
      currentSection = { section: 'Main Analysis', content: '', examples: [] };
    } else if (currentSection) {
      if (line.match(/example|case study/i)) {
        const exampleMatch = line.match(/(?:example|case study)[\s:]+(.+)/i);
        if (exampleMatch) currentSection.examples.push(exampleMatch[1]);
      } else {
        currentSection.content += line + ' ';
      }
    }
  }

  return sections.length > 0 ? sections : [{ section: 'Main Body', content: text.substring(0, 300), examples: [] }];
}

function extractExamples(text) {
  const examples = [];
  const examplePattern = /(?:example|case study)[\s:]+(.+?)(?:\.|$)/gi;
  let match;

  while ((match = examplePattern.exec(text)) !== null) {
    examples.push({
      example: match[1].trim(),
      applicability: 'Can be used across questions in this theme',
      keyPoints: []
    });
  }

  return examples.length > 0 ? examples : [];
}

function extractArguments(text) {
  const arguments_ = [];
  const argumentPattern = /(?:argument|perspective|viewpoint)[\s:]+(.+?)(?:\.|$)/gi;
  let match;

  while ((match = argumentPattern.exec(text)) !== null) {
    arguments_.push({
      argument: match[1].trim(),
      applicability: 'Can be applied to similar questions',
      supportingExamples: []
    });
  }

  return arguments_.length > 0 ? arguments_ : [];
}

function extractKeyPoints(text) {
  const points = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.match(/^\d+[\.\)]\s*(.+)/) || line.match(/^[-*]\s*(.+)/)) {
      const point = line.replace(/^\d+[\.\)]\s*|^[-*]\s*/, '').trim();
      if (point.length > 10 && point.length < 200) {
        points.push(point);
      }
    }
  }

  return points.length > 0 ? points.slice(0, 10) : ['Review the question carefully', 'Structure your answer logically'];
}


