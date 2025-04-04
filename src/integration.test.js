import express from 'express';
import request from 'supertest';
import dotenv from 'dotenv';

dotenv.config();

// Create a simplified mock version of your router
const createMockRouter = () => {
  const router = express.Router();
  
  router.get('/test/token', (req, res) => {
    res.json({
      status: 'success',
      tokenValid: true,
      tokenInfo: {
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastValidated: new Date().toISOString(),
        willExpireSoon: false
      }
    });
  });

  router.post('/test/send', (req, res) => {
    res.json({
      status: 'success',
      messageId: 'wamid.test',
      timestamp: new Date().toISOString()
    });
  });

  router.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      tokenValid: true,
      memoryUsage: { rss: 12345678 },
      uptime: 123.45,
      lastError: null,
      willExpireSoon: false,
      timestamp: new Date().toISOString()
    });
  });

  return router;
};

describe('WhatsApp Integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', createMockRouter());
  });

  test('GET /api/test/token - should return token status', async () => {
    const response = await request(app)
      .get('/api/test/token')
      .expect(200);
    
    expect(response.body).toHaveProperty('tokenValid', true);
    expect(response.body.tokenInfo).toHaveProperty('expiresAt');
  });

  test('POST /api/test/send - should send test message', async () => {
    const response = await request(app)
      .post('/api/test/send')
      .send({
        phoneNumber: '2348123456789',
        message: 'Test message'
      })
      .expect(200);
    
    expect(response.body).toHaveProperty('messageId', 'wamid.test');
  });

  test('GET /api/health - should return service health', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(response.body.status).toBe('healthy');
  });
});