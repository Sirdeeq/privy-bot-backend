import { jest } from '@jest/globals';
import axios from 'axios';
import TokenManager from './tokenManager.js';

// Mock axios properly for ESM
axios.get = jest.fn();

describe('TokenManager', () => {
  let tokenManager;

  beforeEach(() => {
    tokenManager = new TokenManager();
    process.env.META_APP_ID = 'test_app_id';
    process.env.META_APP_SECRET = 'test_app_secret';
  });

  test('should validate token successfully', async () => {
    axios.get.mockResolvedValue({
      data: {
        data: {
          is_valid: true,
          expires_at: Math.floor(Date.now() / 1000) + 3600
        }
      }
    });

    const isValid = await tokenManager.validateAndUpdateToken();
    expect(isValid).toBe(true);
  });

  test('should refresh token when nearing expiration', async () => {
    tokenManager.currentToken = {
      value: 'test_token',
      expiresAt: new Date(Date.now() + 1800 * 1000),
      lastValidated: new Date(),
      lastError: null
    };

    axios.get.mockResolvedValue({
      data: {
        access_token: 'new_token',
        expires_in: 3600
      }
    });

    await tokenManager.getValidToken();
    expect(tokenManager.currentToken.value).toBe('new_token');
  });
});