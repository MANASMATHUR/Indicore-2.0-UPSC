import FactUnit from '@/models/FactUnit';
import connectToDatabase from './mongodb';
import examKnowledge from './exam-knowledge';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

class IntelligenceService {
    /**
     * Search for relevant Fact-Units based on a user query
     */
    async getRelevantFacts(query, limit = 5) {
        try {
            await connectToDatabase();

            // Perform a text search and filter by maturity/verification
            // We prioritize verified facts with high maturity
            const facts = await FactUnit.find(
                { $text: { $search: query } },
                { score: { $meta: "textScore" } }
            )
                .sort({ score: { $meta: "textScore" }, maturity: -1, verified: -1 })
                .limit(limit)
                .lean();

            return facts;
        } catch (error) {
            console.error('[IntelligenceService] Error fetching facts:', error);
            return [];
        }
    }

    /**
     * Summarize raw text into Fact-Units using LLM
     */
    async distillTextToFacts(text, sourceInfo = {}) {
        const prompt = `
      Extract key, verifiable facts for UPSC/PCS/SSC preparation from the following text.
      Each fact must be atomized (one specific piece of information).
      Provide metadata like GS Paper (GS1, GS2, GS3, GS4), Subject, and Topic.
      
      Text: "${text}"
      
      Output format: JSON array of objects with keys: statement, gsPaper, subject, topic, maturityEstimate(0-100).
    `;

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            });

            const data = JSON.parse(response.choices[0].message.content);
            const factData = data.facts || data.operations || [];

            const savedFacts = [];
            for (const item of factData) {
                const fact = await FactUnit.create({
                    statement: item.statement,
                    gsPaper: item.gsPaper,
                    subject: item.subject,
                    topic: item.topic,
                    maturity: item.maturityEstimate || 50,
                    source: sourceInfo.link || sourceInfo.name,
                    sourceType: sourceInfo.type || 'News',
                    verified: false
                });
                savedFacts.push(fact);
            }

            return savedFacts;
        } catch (error) {
            console.error('[IntelligenceService] Distillation error:', error);
            return [];
        }
    }

    /**
     * One-time task: Distill ExamKnowledge.js into the DB
     */
    async bootstrapFromKnowledgeBase() {
        // This would iterate over examKnowledge and create FactUnits
        console.log('[IntelligenceService] Bootstrapping from ExamKnowledge.js...');
        // Implementation details...
    }
}

const intelligenceService = new IntelligenceService();
export default intelligenceService;
