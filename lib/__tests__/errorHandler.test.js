import errorHandler from '../errorHandler';

describe('errorHandler', () => {
    beforeEach(() => {
        // Clear any previous mocks
        jest.clearAllMocks();
    });

    describe('handleChatError', () => {
        test('should handle network errors', () => {
            const error = new Error('Network error');
            error.name = 'NetworkError';

            const result = errorHandler.handleChatError(error, {
                messageLength: 50,
                user: 'test@example.com'
            });

            expect(result.userMessage).toContain('network');
            expect(result.requiresAuth).toBe(false);
        });

        test('should detect authentication errors', () => {
            const error = new Error('Unauthorized');
            error.status = 401;

            const result = errorHandler.handleChatError(error, {
                messageLength: 50,
                user: 'test@example.com'
            });

            expect(result.requiresAuth).toBe(true);
            expect(result.userMessage).toContain('authentication');
        });

        test('should handle timeout errors', () => {
            const error = new Error('Request timeout');
            error.name = 'AbortError';

            const result = errorHandler.handleChatError(error, {
                messageLength: 50,
                user: 'test@example.com'
            });

            expect(result.userMessage).toContain('timeout');
        });

        test('should handle rate limit errors', () => {
            const error = new Error('Too many requests');
            error.status = 429;

            const result = errorHandler.handleChatError(error, {
                messageLength: 50,
                user: 'test@example.com'
            });

            expect(result.userMessage).toContain('rate limit');
        });

        test('should provide generic message for unknown errors', () => {
            const error = new Error('Unknown error');

            const result = errorHandler.handleChatError(error, {
                messageLength: 50,
                user: 'test@example.com'
            });

            expect(result.userMessage).toBeDefined();
            expect(typeof result.userMessage).toBe('string');
        });
    });

    describe('logError', () => {
        test('should not throw when logging errors', () => {
            const error = new Error('Test error');

            expect(() => {
                errorHandler.logError(error, {
                    type: 'test_error',
                    user: 'test@example.com'
                }, 'error');
            }).not.toThrow();
        });
    });
});
