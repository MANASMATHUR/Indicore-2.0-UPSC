import { validateInput, validateSecurity } from '../validation';

describe('validateInput', () => {
    describe('chatMessage validation', () => {
        test('should accept valid chat message', () => {
            const result = validateInput('chatMessage', 'What is federalism in India?');
            expect(result.isValid).toBe(true);
            expect(result.value).toBe('What is federalism in India?');
            expect(result.errors).toHaveLength(0);
        });

        test('should reject empty message', () => {
            const result = validateInput('chatMessage', '');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContainEqual(
                expect.objectContaining({
                    field: 'chatMessage',
                    code: 'REQUIRED',
                })
            );
        });

        test('should reject message exceeding max length', () => {
            const longMessage = 'a'.repeat(10001);
            const result = validateInput('chatMessage', longMessage);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContainEqual(
                expect.objectContaining({
                    code: 'MAX_LENGTH',
                })
            );
        });

        test('should trim whitespace from message', () => {
            const result = validateInput('chatMessage', '  Hello  ');
            expect(result.value).toBe('Hello');
        });
    });

    describe('email validation', () => {
        test('should accept valid email', () => {
            const result = validateInput('email', 'user@example.com');
            expect(result.isValid).toBe(true);
            expect(result.value).toBe('user@example.com');
        });

        test('should reject invalid email format', () => {
            const result = validateInput('email', 'invalid-email');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContainEqual(
                expect.objectContaining({
                    code: 'INVALID_FORMAT',
                })
            );
        });

        test('should normalize email to lowercase', () => {
            const result = validateInput('email', 'User@Example.COM');
            expect(result.value).toBe('user@example.com');
        });
    });

    describe('multilingualText validation', () => {
        test('should accept English text', () => {
            const result = validateInput('multilingualText', 'Hello World');
            expect(result.isValid).toBe(true);
        });

        test('should accept Hindi text', () => {
            const result = validateInput('multilingualText', 'नमस्ते दुनिया');
            expect(result.isValid).toBe(true);
        });

        test('should accept mixed language text', () => {
            const result = validateInput('multilingualText', 'Hello नमस्ते');
            expect(result.isValid).toBe(true);
        });
    });
});

describe('validateSecurity', () => {
    test('should accept safe input', () => {
        const result = validateSecurity('What is the Indian Constitution?');
        expect(result.isValid).toBe(true);
    });

    test('should detect potential XSS attacks', () => {
        const result = validateSecurity('<script>alert("xss")</script>');
        expect(result.isValid).toBe(false);
        expect(result.threats).toContain('XSS');
    });

    test('should detect potential SQL injection', () => {
        const result = validateSecurity("1' OR '1'='1");
        expect(result.isValid).toBe(false);
        expect(result.threats).toContain('SQL_INJECTION');
    });

    test('should detect suspicious patterns', () => {
        const result = validateSecurity('javascript:void(0)');
        expect(result.isValid).toBe(false);
    });

    test('should accept normal special characters', () => {
        const result = validateSecurity('What is Article 370? How does it affect J&K?');
        expect(result.isValid).toBe(true);
    });
});
