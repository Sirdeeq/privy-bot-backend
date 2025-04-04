import { jest } from '@jest/globals';
import axios from 'axios';
import WhatsAppService from './whatsappService.js';

// Create manual mock for TokenManager
class MockTokenManager {
  constructor() {
    this.getValidToken = jest.fn().mockResolvedValue('valid_token');
    this.currentToken = { value: 'valid_token' };
  }
}

jest.mock('./tokenManager.js', () => MockTokenManager);

describe('WhatsAppService', () => {
  let whatsappService;

  beforeEach(() => {
    whatsappService = new WhatsAppService();
    process.env.META_API_VERSION = 'v18.0';
    process.env.PHONE_NUMBER_ID = 'test_phone_number_id';
    axios.post = jest.fn();
  });

  test('should send message successfully', async () => {
    axios.post.mockResolvedValue({ data: { messages: [{ id: 'wamid.test' }] } });
    
    const result = await whatsappService.sendMessage('2348123456789', 'Test');
    expect(result.messages[0].id).toBe('wamid.test');
  });
});