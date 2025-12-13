import axios from 'axios';
import * as cheerio from 'cheerio';

export async function fetchGoogleNewsRSS(query, days = 7) {
    try {
        console.log(`[NewsService] DEBUG: input days=${days}`);

        let validDays = Number(days);
        if (isNaN(validDays)) validDays = 7;

        // Construct time filter string
        let timeFilterString = '';
        if (validDays <= 1) {
            timeFilterString = 'when:24h';
        } else {
            timeFilterString = `when:${validDays}d`;
        }

        console.log(`[NewsService] DEBUG: calculated timeFilter="${timeFilterString}"`);

        // Construct query string part
        const fullQuery = `${query} ${timeFilterString}`;
        console.log(`[NewsService] DEBUG: fullQuery="${fullQuery}"`);

        // Encode
        const encodedQuery = encodeURIComponent(fullQuery);
        console.log(`[NewsService] DEBUG: encodedQuery="${encodedQuery}"`);

        // URI
        const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en`;
        console.log(`[NewsService] Fetching RSS: ${url}`);

        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data, { xmlMode: true });
        const items = [];

        $('item').each((i, elem) => {
            if (i >= 50) return false;

            const title = $(elem).find('title').text();
            const link = $(elem).find('link').text();
            const pubDate = $(elem).find('pubDate').text();
            const description = $(elem).find('description').text()
                .replace(/<[^>]*>/g, '')
                .trim();
            const source = $(elem).find('source').text();

            items.push({
                title,
                link,
                pubDate,
                description,
                source
            });
        });

        console.log(`[NewsService] Fetched ${items.length} items from RSS`);
        return items;

    } catch (error) {
        console.error('[NewsService] Error fetching RSS:', error.message);
        return [];
    }
}
