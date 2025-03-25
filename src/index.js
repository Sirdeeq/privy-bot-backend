import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { twilioRouter } from './routes/twilio.js';
import { webRouter } from './routes/web.js';
import { whatsappRouter } from './routes/whatsappClient.js';

// Load environment variables before any other code
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'PORT',
  'MONGODB_URI',
  'OPENAI_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for web routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Connect to MongoDB
connectDB();

// Routes
app.use('/api', webRouter);
app.use('/api/whatsapp/', whatsappRouter)

// Only enable Twilio webhook if credentials are provided
const hasTwilioCredentials = process.env.TWILIO_ACCOUNT_SID && 
                           process.env.TWILIO_AUTH_TOKEN && 
                           process.env.TWILIO_PHONE_NUMBER;

if (hasTwilioCredentials) {
  app.use('/webhook', twilioRouter);
  console.log('Twilio webhook route enabled');
} else {
  console.log('Twilio webhook route disabled - missing credentials');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});