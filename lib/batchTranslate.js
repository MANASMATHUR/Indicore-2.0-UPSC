import { translateText } from '@/pages/api/ai/translate';

/**
 * Batch translate multiple texts concurrently
 * @param {Array} items - Array of {text, field} objects to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code  
 * @param {boolean} isStudyMaterial - Whether this is study material
 * @returns {Promise<Object>} Map of field -> translated text
 */
export async function batchTranslate(items, sourceLang, targetLang, isStudyMaterial = false) {
    if (!items || items.length === 0) return {};
    if (sourceLang === targetLang) {
        return items.reduce((acc, item) => {
            acc[item.field] = item.text;
            return acc;
        }, {});
    }

    // Translate all items in parallel
    const translations = await Promise.allSettled(
        items.map(async (item) => {
            try {
                const translated = await translateText(item.text, sourceLang, targetLang, isStudyMaterial);
                return { field: item.field, text: translated };
            } catch (error) {
                console.warn(`Translation failed for ${item.field}:`, error.message);
                return { field: item.field, text: item.text }; // Fallback to original
            }
        })
    );

    // Build result map
    return translations.reduce((acc, result) => {
        if (result.status === 'fulfilled' && result.value) {
            acc[result.value.field] = result.value.text;
        }
        return acc;
    }, {});
}

/**
 * Batch translate array of questions for mock tests
 * @param {Array} questions - Array of question objects
 * @param {string} targetLang - Target language code
 * @returns {Promise<Array>} Translated questions
 */
export async function batchTranslateQuestions(questions, targetLang) {
    if (!questions || questions.length === 0) return questions;
    if (targetLang === 'en') return questions;

    console.log(`Batch translating ${questions.length} questions to ${targetLang}...`);

    // Collect all texts to translate
    const translationItems = [];
    questions.forEach((q, idx) => {
        if (q.question) translationItems.push({ text: q.question, field: `q${idx}_question` });
        if (q.explanation) translationItems.push({ text: q.explanation, field: `q${idx}_explanation` });
        if (q.subject) translationItems.push({ text: q.subject, field: `q${idx}_subject` });
        if (q.topic) translationItems.push({ text: q.topic, field: `q${idx}_topic` });
        if (q.options && Array.isArray(q.options)) {
            q.options.forEach((opt, optIdx) => {
                translationItems.push({ text: opt, field: `q${idx}_option${optIdx}` });
            });
        }
    });

    // Batch translate
    const translated = await batchTranslate(translationItems, 'en', targetLang, true);

    // Apply translations back to questions
    return questions.map((q, idx) => {
        const translatedQ = { ...q };
        if (translated[`q${idx}_question`]) translatedQ.question = translated[`q${idx}_question`];
        if (translated[`q${idx}_explanation`]) translatedQ.explanation = translated[`q${idx}_explanation`];
        if (translated[`q${idx}_subject`]) translatedQ.subject = translated[`q${idx}_subject`];
        if (translated[`q${idx}_topic`]) translatedQ.topic = translated[`q${idx}_topic`];

        if (q.options && Array.isArray(q.options)) {
            translatedQ.options = q.options.map((opt, optIdx) =>
                translated[`q${idx}_option${optIdx}`] || opt
            );
            // Update correctAnswer to match translated option
            if (q.correctAnswer && q.options.includes(q.correctAnswer)) {
                const originalIndex = q.options.indexOf(q.correctAnswer);
                translatedQ.correctAnswer = translatedQ.options[originalIndex];
            }
        }

        return translatedQ;
    });
}
