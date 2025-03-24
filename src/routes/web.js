import express from 'express';
import { User } from '../models/User.js';
import { generateAIResponse } from '../services/openai.js';

const router = express.Router();

// Get user profile
router.get('/user/:phoneNumber', async (req, res) => {
  try {
    const user = await User.findOne({ phoneNumber: req.params.phoneNumber });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update user
router.post('/user', async (req, res) => {
  try {
    const { phoneNumber, name, age, educationLevel, privacyLevel } = req.body;
    
    let user = await User.findOne({ phoneNumber });
    if (!user) {
      user = new User({ phoneNumber });
    }

    // Update user fields if provided
    if (name) user.name = name;
    if (age) {
      user.age = age;
      user.ageCategory = age <= 12 ? 'Child' : age <= 19 ? 'Teen' : 'Adult';
    }
    if (educationLevel) user.educationLevel = educationLevel;
    if (privacyLevel) user.privacyLevel = privacyLevel;

    // Update current step based on provided information
    if (!user.name && name) user.currentStep = 'age';
    else if (!user.age && age) user.currentStep = 'education';
    else if (!user.educationLevel && educationLevel) user.currentStep = 'privacy';
    else if (!user.privacyLevel && privacyLevel) user.currentStep = 'completed';

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get AI response
router.post('/chat', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    let user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const response = await generateAIResponse(user, message);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const webRouter = router;