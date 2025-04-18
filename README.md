# AI-Powered Privacy Education Bot

A WhatsApp and Web-based chatbot that provides personalized privacy education using AI. The bot adapts its responses based on the user's age, education level, and privacy preferences.

## Features

- Personalized privacy education using OpenAI GPT-3.5
- Multi-channel support (WhatsApp and Web API)
- User profile management
- Adaptive content based on user characteristics
- Optional WhatsApp integration via Twilio

## Environment Variables

Create a `.env` file with the following variables:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
OPENAI_API_KEY=your_openai_api_key

# Optional Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_whatsapp_number
```

### Required Variables
- `PORT`: Server port number
- `MONGODB_URI`: MongoDB connection string
- `OPENAI_API_KEY`: OpenAI API key for GPT-3.5

### Optional Variables (for WhatsApp support)
- `TWILIO_ACCOUNT_SID`: Twilio Account SID
- `TWILIO_AUTH_TOKEN`: Twilio Auth Token
- `TWILIO_PHONE_NUMBER`: Twilio WhatsApp number

## API Endpoints

### Web API Routes

#### 1. Get User Profile
```http
GET /api/user/:phoneNumber
```

Response:
```json
{
  "phoneNumber": "+1234567890",
  "name": "John Doe",
  "age": 25,
  "ageCategory": "Adult",
  "educationLevel": "Degree",
  "privacyLevel": "Medium",
  "currentStep": "completed"
}
```

#### 2. Create/Update User
```http
POST /api/user
```

Request Body:
```json
{
  "phoneNumber": "+1234567890",
  "name": "John Doe",
  "age": 25,
  "educationLevel": "Degree",
  "privacyLevel": "Medium"
}
```

Response:
```json
{
  "phoneNumber": "+1234567890",
  "name": "John Doe",
  "age": 25,
  "ageCategory": "Adult",
  "educationLevel": "Degree",
  "privacyLevel": "Medium",
  "currentStep": "completed"
}
```

#### 3. Get AI Response
```http
POST /api/chat
```

Request Body:
```json
{
  "phoneNumber": "+1234567890",
  "message": "Tell me about data protection"
}
```

Response:
```json
{
  "message": "AI-generated response about data protection",
  "actions": [
    {
      "label": "Data Protection",
      "value": "topic_data_protection"
    },
    {
      "label": "Digital Footprint",
      "value": "topic_digital_footprint"
    }
  ]
}
```

### WhatsApp Webhook (Optional)

#### 1. Receive WhatsApp Messages
```http
POST /webhook
```

Request Body (from Twilio):
```json
{
  "From": "whatsapp:+1234567890",
  "Body": "Hello"
}
```

## Components

### 1. User Model
- Stores user profiles and preferences
- Manages user interaction state
- Fields:
  - `phoneNumber`: Unique identifier
  - `name`: User's name
  - `age`: Numeric age
  - `ageCategory`: Child/Teen/Adult
  - `educationLevel`: Primary/Secondary/Degree
  - `privacyLevel`: Low/Medium/High
  - `currentStep`: Tracks onboarding progress

### 2. OpenAI Integration
- Uses GPT-3.5-turbo model
- Generates personalized responses
- Adapts content based on user profile
- Focuses on privacy and security topics

### 3. Web API
- RESTful endpoints for user management
- Chat interface for AI interactions
- Profile management endpoints

### 4. WhatsApp Integration (Optional)
- Uses Twilio for WhatsApp messaging
- Interactive chat experience
- Handles user onboarding
- Manages conversation flow

### 5. Action System
- Provides interactive options to users
- Different actions based on conversation context
- Categories:
  - Age group selection
  - Education level selection
  - Privacy preference selection
  - Topic-specific actions

## Testing Guide

### 1. User Creation Flow
```json
// Step 1: Create user
POST /api/user
{
  "phoneNumber": "+1234567890",
  "name": "John Doe"
}

// Step 2: Update age
POST /api/user
{
  "phoneNumber": "+1234567890",
  "age": 25
}

// Step 3: Update education
POST /api/user
{
  "phoneNumber": "+1234567890",
  "educationLevel": "Degree"
}

// Step 4: Set privacy level
POST /api/user
{
  "phoneNumber": "+1234567890",
  "privacyLevel": "Medium"
}
```

### 2. Chat Interaction
```json
// Ask about privacy topic
POST /api/chat
{
  "phoneNumber": "+1234567890",
  "message": "topic_data_protection"
}

// General question
POST /api/chat
{
  "phoneNumber": "+1234567890",
  "message": "How can I protect my online privacy?"
}
```

## Security Features

- MongoDB connection security
- Environment variable protection
- Optional WhatsApp integration
- Input validation
- Error handling
- CORS enabled for web routes#   p r i v y - b o t - b a c k e n d  
 