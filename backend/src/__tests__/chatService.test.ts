import { ApiProvider } from '@prisma/client';
import { buildChatHistory, parseProvider } from '../services/chatService';

describe('ChatService', () => {
  describe('parseProvider', () => {
    it('should parse valid provider strings', () => {
      expect(parseProvider('openai')).toBe(ApiProvider.OPENAI);
      expect(parseProvider('OPENAI')).toBe(ApiProvider.OPENAI);
      expect(parseProvider('gemini')).toBe(ApiProvider.GEMINI);
      expect(parseProvider('GEMINI')).toBe(ApiProvider.GEMINI);
      expect(parseProvider('claude')).toBe(ApiProvider.CLAUDE);
      expect(parseProvider('CLAUDE')).toBe(ApiProvider.CLAUDE);
    });

    it('should return null for invalid provider strings', () => {
      expect(parseProvider('invalid')).toBeNull();
      expect(parseProvider('')).toBeNull();
      expect(parseProvider(undefined)).toBeNull();
      expect(parseProvider('anthropic')).toBeNull();
    });

    it('should trim whitespace', () => {
      expect(parseProvider('  openai  ')).toBe(ApiProvider.OPENAI);
      expect(parseProvider('\tgemini\n')).toBe(ApiProvider.GEMINI);
    });
  });

  describe('buildChatHistory', () => {
    it('should return provided messages if they exist', () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const result = buildChatHistory({
        userId: 'user-123',
        messages,
        provider: ApiProvider.OPENAI,
        model: 'gpt-4',
      });

      expect(result).toEqual(messages);
    });

    it('should create message from single message string', () => {
      const result = buildChatHistory({
        userId: 'user-123',
        message: 'Hello, how are you?',
        messages: [],
        provider: ApiProvider.OPENAI,
        model: 'gpt-4',
      });

      expect(result).toEqual([{ role: 'user', content: 'Hello, how are you?' }]);
    });

    it('should prioritize messages over single message', () => {
      const messages = [{ role: 'user', content: 'Prioritized' }];
      
      const result = buildChatHistory({
        userId: 'user-123',
        message: 'Should be ignored',
        messages,
        provider: ApiProvider.OPENAI,
        model: 'gpt-4',
      });

      expect(result).toEqual(messages);
    });

    it('should throw error when neither message nor messages provided', () => {
      expect(() => buildChatHistory({
        userId: 'user-123',
        messages: [],
        provider: ApiProvider.OPENAI,
        model: 'gpt-4',
      })).toThrow('Message is required');
    });

    it('should handle empty messages array with no message', () => {
      expect(() => buildChatHistory({
        userId: 'user-123',
        messages: [],
        provider: ApiProvider.OPENAI,
        model: 'gpt-4',
      })).toThrow('Message is required');
    });
  });
});
