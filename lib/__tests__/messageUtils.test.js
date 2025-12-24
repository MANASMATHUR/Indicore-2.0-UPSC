import { describe, it, expect } from '@jest/globals';
import { stripMarkdown, supportedLanguages } from '../messageUtils';

describe('Message Utils', () => {
    describe('stripMarkdown', () => {
        it('should remove bold and italics', () => {
            expect(stripMarkdown('**Bold** and *Italic*')).toBe('Bold and Italic');
        });

        it('should remove headers', () => {
            expect(stripMarkdown('# Header')).toBe('Header');
            expect(stripMarkdown('### Subheader')).toBe('Subheader');
        });

        it('should remove links', () => {
            expect(stripMarkdown('[Link](http://example.com)')).toBe('Link');
        });

        it('should handle code blocks', () => {
            expect(stripMarkdown('Here is `code`')).toBe('Here is code');
        });

        it('should handle empty input', () => {
            expect(stripMarkdown('')).toBe('');
            expect(stripMarkdown(null)).toBe('');
        });
    });

    describe('supportedLanguages', () => {
        it('should contain major Indian languages', () => {
            const codes = supportedLanguages.map(l => l.code);
            expect(codes).toContain('hi');
            expect(codes).toContain('mr');
            expect(codes).toContain('ta');
        });

        it('should have correct structure', () => {
            supportedLanguages.forEach(lang => {
                expect(lang).toHaveProperty('code');
                expect(lang).toHaveProperty('name');
            });
        });
    });
});
