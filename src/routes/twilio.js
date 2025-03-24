import express from 'express';
import twilio from 'twilio';
import { User } from '../models/User.js';
import { generateAIResponse } from '../services/openai.js';

const router = express.Router();

// Validate Twilio credentials
const hasTwilioCredentials = process.env.TWILIO_ACCOUNT_SID && 
                           process.env.TWILIO_AUTH_TOKEN && 
                           process.env.TWILIO_PHONE_NUMBER;

let client;
if (hasTwilioCredentials) {
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

const sendWhatsAppMessage = async (to, message, actions = []) => {
  if (!client) {
    console.error('Twilio client not initialized - missing credentials');
    return;
  }

  let messageBody = message;
  
  if (actions.length > 0) {
    messageBody += '\n\nAvailable options:\n';
    actions.forEach(action => {
      messageBody += `\n• ${action.label}`;
    });
    messageBody += '\n\nReply with the option you want to select.';
  }

  try {
    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${to}`,
      body: messageBody
    });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
};

const handleUserStep = async (user, message) => {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.startsWith('topic_') || 
      lowerMessage.includes('security') || 
      lowerMessage.includes('privacy')) {
    const response = await generateAIResponse(user, lowerMessage);
    return response;
  }

  switch (user.currentStep) {
    case 'name':
      user.name = message;
      user.currentStep = 'age';
      await user.save();
      return await generateAIResponse(user);

    case 'age':
      const age = parseInt(message);
      if (isNaN(age)) {
        const ageGroup = message.toLowerCase();
        if (ageGroup.includes('child')) user.ageCategory = 'Child';
        else if (ageGroup.includes('teen')) user.ageCategory = 'Teen';
        else if (ageGroup.includes('adult')) user.ageCategory = 'Adult';
        else return { message: 'Please select a valid age group.', actions: getAgeGroupActions() };
      } else {
        user.age = age;
        user.ageCategory = age <= 12 ? 'Child' : age <= 19 ? 'Teen' : 'Adult';
      }
      user.currentStep = 'education';
      await user.save();
      return await generateAIResponse(user);

    case 'education':
      const education = message.toLowerCase();
      if (!['primary', 'secondary', 'degree', 'master', 'phd'].includes(education)) {
        return { 
          message: 'Please select a valid education level.',
          actions: getEducationActions()
        };
      }
      user.educationLevel = education.charAt(0).toUpperCase() + education.slice(1);
      user.currentStep = 'privacy';
      await user.save();
      return await generateAIResponse(user);

    case 'privacy':
      const privacy = message.toLowerCase();
      if (!['low', 'medium', 'high'].includes(privacy)) {
        return {
          message: 'Please select a valid privacy level (Low/Medium/High).',
          actions: getPrivacyActions()
        };
      }
      user.privacyLevel = privacy.charAt(0).toUpperCase() + privacy.slice(1);
      user.currentStep = 'completed';
      await user.save();
      return await generateAIResponse(user);

    case 'completed':
      return await generateAIResponse(user, message);

    default:
      return await generateAIResponse(user);
  }
};

router.post('/', async (req, res) => {
  try {
    if (!hasTwilioCredentials) {
      return res.status(503).json({ error: 'Twilio service not available - missing credentials' });
    }

    const { From, Body } = req.body;
    const phoneNumber = From.replace('whatsapp:', '');

    let user = await User.findOne({ phoneNumber });
    if (!user) {
      user = await User.create({ 
        phoneNumber,
        currentStep: 'name'
      });
    }

    const response = await handleUserStep(user, Body);
    await sendWhatsAppMessage(phoneNumber, response.message, response.actions);

    res.status(200).send();
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const twilioRouter = router;