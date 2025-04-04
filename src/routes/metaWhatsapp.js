import express from "express";
import { User } from "../models/User.js";
import axios from "axios";
import _ from "lodash";
import dotenv from 'dotenv';
import TokenManager from "../services/tokenManager.js";
import WhatsAppService from "../services/whatsappService.js";

// Load environment variables
dotenv.config();

const router = express.Router();

// Initialize services
const tokenManager = new TokenManager();
const whatsappService = new WhatsAppService();

// Hugging Face Configuration
const HF_API_URL = process.env.HF_API_URL || "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1";
const HF_API_KEY = process.env.HF_API_KEY;

// Start token monitoring
tokenManager.startMonitoring();

// ======================
// TESTING ENDPOINTS
// ======================

router.get("/test/token", async (req, res) => {
  try {
    const isValid = await tokenManager.validateAndUpdateToken();
    const tokenInfo = tokenManager.getTokenInfo();
    
    res.json({
      status: "success",
      tokenValid: isValid,
      tokenInfo: {
        expiresAt: tokenInfo.expiresAt,
        lastValidated: tokenInfo.lastValidated,
        willExpireSoon: tokenManager.willExpireSoon()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

router.post("/test/send", async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({
        error: "Phone number and message are required"
      });
    }

    const result = await WhatsAppService.sendMessage(
      phoneNumber, 
      `🔧 TEST MESSAGE: ${message}`
    );

    res.json({
      status: "success",
      messageId: result.messages?.[0]?.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
      details: error.response?.data || null
    });
  }
});

router.post("/test/conversation", async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const testNumber = phoneNumber || process.env.TEST_NUMBER;
    
    if (!testNumber) {
      return res.status(400).json({
        error: "Phone number is required"
      });
    }

    const steps = [
      { message: "hi", expected: "Welcome to Privy Bot" },
      { message: "John", expected: "Nice to meet you, John" },
      { message: "25", expected: "What is your education level" },
      { message: "degree", expected: "What privacy level" },
      { message: "medium", expected: "Thank you! Based on your Medium privacy level" }
    ];

    const results = [];
    
    for (const step of steps) {
      const response = await whatsappService.sendMessage(
        testNumber,
        step.message
      );
      
      results.push({
        step: step.message,
        status: "sent",
        messageId: response.messages?.[0]?.id
      });
    }

    res.json({
      status: "success",
      steps: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

// ======================
// MAIN APPLICATION ENDPOINTS
// ======================

router.get("/status", async (req, res) => {
  try {
    const tokenStatus = await tokenManager.validateAndUpdateToken();
    
    res.json({
      status: tokenStatus ? "connected" : "disconnected",
      tokenValid: tokenStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

router.get("/health", async (req, res) => {
  try {
    const healthChecks = {
      tokenValid: await tokenManager.validateAndUpdateToken(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      lastError: tokenManager.getLastError(),
      willExpireSoon: tokenManager.willExpireSoon()
    };

    const healthy = healthChecks.tokenValid && !healthChecks.willExpireSoon;
    
    res.status(healthy ? 200 : 503).json({
      status: healthy ? "healthy" : "unhealthy",
      ...healthChecks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.post("/send", async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({
        error: "Phone number and message are required"
      });
    }

    const formattedNumber = formatNigerianNumber(phoneNumber);
    let user = await User.findOne({ phoneNumber: formattedNumber });

    const isGreeting = ["hi", "hello", "hi privy bot", "hey"].includes(
      message.toLowerCase().trim()
    );

    if (!user || isGreeting) {
      user = await User.findOneAndUpdate(
        { phoneNumber: formattedNumber },
        {
          phoneNumber: formattedNumber,
          rawNumber: phoneNumber,
          currentStep: "name",
          name: null,
          age: null,
          ageCategory: null,
          educationLevel: null,
          privacyLevel: null,
        },
        { upsert: true, new: true }
      );
    }

    if (isGreeting) {
      const welcomeMessage = "👋 *Welcome to Privy Bot!*\n\nI'm here to help you learn about privacy and online safety. Let's get started!\n\nWhat's your name?";
      await whatsappService.sendMessage(phoneNumber, welcomeMessage);
      return res.json({ status: "welcome_sent" });
    }

    const response = await handleUserStep(user, message);
    await whatsappService.sendMessage(phoneNumber, response.message, response.actions);

    res.json({
      status: "message_sent",
      currentStep: user.currentStep,
      response: response.message
    });
  } catch (error) {
    console.error("API Error:", error);
    
    const statusCode = error.message.includes("token") ? 401 : 500;
    
    res.status(statusCode).json({
      error: "Failed to send message",
      details: error.message,
      solution: statusCode === 401 ? 
        "Check server logs and update Facebook access token if needed" : 
        "Please try again later"
    });
  }
});

// ======================
// HELPER FUNCTIONS
// ======================

function formatNigerianNumber(phoneNumber) {
  let cleaned = phoneNumber.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = "234" + cleaned.substring(1);
  if (cleaned.startsWith("234")) cleaned = cleaned.substring(1);
  return cleaned.length === 13 ? cleaned : phoneNumber;
}

async function handleUserStep(user, message) {
  if (user.currentStep === "completed") {
    const prompt = `<s>[INST] As a privacy education assistant, respond to ${user.name} (${user.ageCategory}, ${user.educationLevel}, ${user.privacyLevel} privacy) about: "${message}". 
    - Keep it concise (3-4 sentences)
    - Tailor it to their privacy level
    - Provide educational value
    - Use simple language for children if needed
    - Include one follow-up question or suggestion [/INST]>`;

    const aiResponse = await generateHFResponse(prompt);
    return {
      message: aiResponse,
      actions: getPrivacyTopics(user.privacyLevel)
    };
  }

  switch (user.currentStep) {
    case "name":
      user.name = message;
      user.currentStep = "age";
      await user.save();
      return {
        message: `Nice to meet you, ${message}! Please tell me your age:`,
        actions: getAgeGroupActions(),
      };

    case "age":
      const age = parseInt(message);
      if (isNaN(age)) {
        return {
          message: "Please enter a valid age (or select an age group):",
          actions: getAgeGroupActions(),
        };
      }
      user.age = age;
      user.ageCategory = age <= 12 ? "Child" : age <= 19 ? "Teen" : "Adult";
      user.currentStep = "education";
      await user.save();
      return {
        message: "What is your education level?",
        actions: getEducationActions(),
      };

    case "education":
      const educationLevel = message.toLowerCase();
      if (
        !["primary", "secondary", "degree", "master", "phd"].some((term) =>
          educationLevel.includes(term)
        )
      ) {
        return {
          message: "Please select a valid education level:",
          actions: getEducationActions(),
        };
      }
      user.educationLevel = message;
      user.currentStep = "privacy";
      await user.save();
      return {
        message: "What privacy level would you prefer (Low, Medium, High)?",
        actions: getPrivacyActions(),
      };

    case "privacy":
      const privacyLevel = message.toLowerCase();
      if (!["low", "medium", "high"].includes(privacyLevel)) {
        return {
          message: "Please select a valid privacy level:",
          actions: getPrivacyActions(),
        };
      }
      user.privacyLevel =
        privacyLevel.charAt(0).toUpperCase() + privacyLevel.slice(1);
      user.currentStep = "completed";
      await user.save();
      return {
        message: `Thank you! Based on your ${user.privacyLevel} privacy level, here are some topics we can discuss:`,
        actions: getPrivacyTopics(user.privacyLevel),
      };

    default:
      return {
        message: "Welcome! Please tell me your name to get started.",
        actions: [],
      };
  }
}

async function generateHFResponse(prompt) {
  try {
    const response = await axios.post(
      HF_API_URL,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 200,
          return_full_text: false,
          temperature: 0.7,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data[0]?.generated_text?.trim() || "I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("AI generation error:", error.response?.data || error.message);
    return "I'm having trouble generating a response right now. Please try again later with a different question.";
  }
}

function getAgeGroupActions() {
  return [
    { label: "Child (0-12)", value: "child" },
    { label: "Teen (13-19)", value: "teen" },
    { label: "Adult (20+)", value: "adult" },
  ];
}

function getEducationActions() {
  return [
    { label: "Primary School", value: "primary" },
    { label: "Secondary School", value: "secondary" },
    { label: "College Degree", value: "degree" },
    { label: "Master's Degree", value: "master" },
    { label: "PhD", value: "phd" },
  ];
}

function getPrivacyActions() {
  return [
    { label: "Low Privacy", value: "low" },
    { label: "Medium Privacy", value: "medium" },
    { label: "High Privacy", value: "high" },
  ];
}

function getPrivacyTopics(privacyLevel) {
  const topics = {
    Low: [
      { label: "Basic Online Safety", value: "basic safety" },
      { label: "Public Profile Tips", value: "public profile" },
    ],
    Medium: [
      { label: "Data Protection", value: "data protection" },
      { label: "Digital Footprint", value: "digital footprint" },
    ],
    High: [
      { label: "Advanced Security", value: "advanced security" },
      { label: "Encryption Basics", value: "encryption" },
    ],
  };
  return topics[privacyLevel] || topics["Medium"];
}

export const metaWhatsappRouter = router;