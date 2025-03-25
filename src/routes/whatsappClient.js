import express from "express";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import { User } from "../models/User.js";
import fetch from "node-fetch";
import fs from "fs";
import _ from "lodash";

const router = express.Router();

// Ensure session directory exists
const sessionPath = "./sessions";
if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath, { recursive: true });
}

// State variables
let qrData = null;
let clientReady = false;
let clientPhoneNumber = null;
let whatsappDeepLink = null;
let connectionStatus = "disconnected";
let lastQrGenerated = null;
let sessionExpiryTimer = null;

// Initialize WhatsApp client
const whatsappClient = new Client({
  authStrategy: new LocalAuth({
    clientId: "privy-bot",
    dataPath: sessionPath,
    restartOnAuthFail: true,
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  },
  takeoverOnConflict: true,
  takeoverTimeoutMs: 5000,
  qrMaxRetries: 5,
  qrTimeoutMs: 60000,
});

// QR Code Handler
whatsappClient.on("qr", (qr) => {
  qrData = qr;
  lastQrGenerated = Date.now();
  connectionStatus = "authenticating";
  whatsappDeepLink = `https://wa.me/?text=${encodeURIComponent(
    "Connect to Privy Bot"
  )}`;
  qrcode.generate(qr, { small: true });
  console.log("QR CODE RECEIVED");

  // Reset QR Code if not scanned
  clearTimeout(sessionExpiryTimer);
  sessionExpiryTimer = setTimeout(() => {
    if (connectionStatus === "authenticating") {
      console.log("QR code expired, retrying...");
      qrData = null;
      connectionStatus = "disconnected";
      whatsappClient.initialize().catch(console.error);
    }
  }, 180000);
});

// Client Ready Handler
whatsappClient.on("ready", async () => {
  console.log("WhatsApp client is ready!");
  connectionStatus = "connected";
  clientReady = true;
  clientPhoneNumber = whatsappClient.info.wid.user;
  whatsappDeepLink = `https://wa.me/${clientPhoneNumber}`;
  qrData = null;
  clearTimeout(sessionExpiryTimer);

  // Send welcome message once linked
  try {
    await whatsappClient.sendMessage(
      clientPhoneNumber + "@c.us",
      "✅ *Privy Bot is now connected!*\n\nHello! 👋 I'm here to assist you with privacy education. Type 'hi' to get started."
    );
  } catch (error) {
    console.error("Failed to send welcome message:", error);
  }
});

// Disconnection Handler
whatsappClient.on("disconnected", (reason) => {
  console.log("Client disconnected:", reason);
  connectionStatus = "disconnected";
  clientReady = false;
  clearTimeout(sessionExpiryTimer);
  setTimeout(() => whatsappClient.initialize().catch(console.error), 5000);
});

// Authentication Failure Handler
whatsappClient.on("auth_failure", (msg) => {
  console.error("Authentication failure:", msg);
  connectionStatus = "failed";
  clearTimeout(sessionExpiryTimer);
});

// Handle Unexpected Errors
whatsappClient.on("error", (err) => {
  console.error("WhatsApp Client Error:", err);
  connectionStatus = "disconnected";
});

// Initialize Client
(async () => {
  try {
    await whatsappClient.initialize();
  } catch (err) {
    console.error("Initialization error:", err);
    connectionStatus = "failed";
  }
})();

// API Endpoints
router.get("/status", (req, res) => {
  res.json({
    status: connectionStatus,
    phoneNumber: clientPhoneNumber,
    qrCode: qrData,
    deepLink: whatsappDeepLink,
    ready: clientReady,
    timestamp: new Date().toISOString(),
    qrGenerated: lastQrGenerated,
  });
});

router.get("/health", (req, res) => {
  res.json({
    status: connectionStatus,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
});

router.post("/reconnect", async (req, res) => {
  try {
    await whatsappClient.initialize();
    res.json({ status: "reconnecting" });
  } catch (err) {
    res.status(500).json({
      error: "Reconnection failed",
      details: err.message,
    });
  }
});

// Main message handling endpoint
// router.post("/send", async (req, res) => {
//   try {
//     if (!clientReady) {
//       return res.status(503).json({
//         error: "WhatsApp client not ready",
//         qrCode: qrData,
//         deepLink: whatsappDeepLink,
//       });
//     }

//     const { phoneNumber, message } = req.body;
//     if (!phoneNumber || !message) {
//       return res.status(400).json({
//         error: "Phone number and message are required"
//       });
//     }

//     const formattedNumber = formatNigerianNumber(phoneNumber);
//     const whatsappNumber = `${formattedNumber}@c.us`;

//     let user = await User.findOne({ phoneNumber: formattedNumber });

//     if (!user) {
//       user = await User.create({
//         phoneNumber: formattedNumber,
//         rawNumber: phoneNumber,
//         currentStep: "name",
//       });
//     }

//     // Check if message is "hi" or similar to start conversation
//     if (_.isMatch(message.toLowerCase(), ["hi", "hello", "hi privy bot", "hey"])) {
//       user.currentStep = "name";
//       await user.save();

//       const welcomeMessage = "👋 *Welcome to Privy Bot!*\n\nI'm here to help you learn about privacy and online safety. Let's get started!\n\nWhat's your name?";

//       await whatsappClient.sendMessage(
//         whatsappNumber,
//         formatWhatsAppResponse({
//           message: welcomeMessage,
//           actions: []
//         })
//       );

//       return res.json({
//         status: "welcome_sent",
//         response: welcomeMessage
//       });
//     }

//     const response = await handleUserStep(user, message);
//     await whatsappClient.sendMessage(
//       whatsappNumber,
//       formatWhatsAppResponse(response)
//     );

//     res.json({
//       status: "message_sent",
//       response: response.message,
//       options: response.actions,
//     });
//   } catch (error) {
//     console.error("API Error:", error);
//     res.status(500).json({
//       error: "Failed to send message",
//       details: error.message
//     });
//   }
// });

// [Previous imports remain the same...]

// Main message handling endpoint - UPDATED VERSION
router.post("/send", async (req, res) => {
  try {
    if (!clientReady) {
      return res.status(503).json({
        error: "WhatsApp client not ready",
        qrCode: qrData,
        deepLink: whatsappDeepLink,
      });
    }

    const { phoneNumber, message } = req.body;
    if (!phoneNumber || !message) {
      return res.status(400).json({
        error: "Phone number and message are required",
      });
    }

    const formattedNumber = formatNigerianNumber(phoneNumber);
    const whatsappNumber = `${formattedNumber}@c.us`;

    // Find or create user - UPDATED TO HANDLE NEW CONVERSATIONS
    let user = await User.findOne({ phoneNumber: formattedNumber });

    // Check for greeting message to reset conversation
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

    // Handle greeting to start fresh conversation
    if (isGreeting) {
      const welcomeMessage =
        "👋 *Welcome to Privy Bot!*\n\nI'm here to help you learn about privacy and online safety. Let's get started!\n\nWhat's your name?";

      await whatsappClient.sendMessage(
        whatsappNumber,
        formatWhatsAppResponse({
          message: welcomeMessage,
          actions: [],
        })
      );

      return res.json({
        status: "welcome_sent",
        response: welcomeMessage,
      });
    }

    // Process user's message in the conversation flow
    const response = await handleUserStep(user, message);
    const formattedResponse = formatWhatsAppResponse(response);

    // Send the response with proper buttons
    await whatsappClient.sendMessage(whatsappNumber, formattedResponse);

    res.json({
      status: "message_sent",
      response: response.message,
      options: response.actions,
    });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      error: "Failed to send message",
      details: error.message,
    });
  }
});

// [Rest of your code remains the same...]

// Helper function to format Nigerian phone numbers
function formatNigerianNumber(phoneNumber) {
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, "");

  // Check if number starts with 0 and convert to 234
  if (cleaned.startsWith("0")) {
    cleaned = "234" + cleaned.substring(1);
  }

  // If it starts with +234, remove the +
  if (cleaned.startsWith("234")) {
    cleaned = cleaned.substring(1);
  }

  // Ensure it's now 13 digits (234 + 10 digits)
  if (cleaned.length === 13) {
    return cleaned;
  }

  return phoneNumber; // fallback to original if formatting fails
}

// Format WhatsApp responses with buttons
function formatWhatsAppResponse(response) {
  let message = response.message;

  if (response.actions && response.actions.length > 0) {
    const buttons = response.actions.map((action) => ({
      buttonId: action.value,
      buttonText: { displayText: action.label },
      type: 1,
    }));

    message += "\n\n" + response.actions.map((a) => `- ${a.label}`).join("\n");

    return {
      text: message,
      buttons: buttons,
      headerType: 1,
    };
  }

  return message;
}

// Conversation handler
const handleUserStep = async (user, message) => {
  if (user.currentStep === "completed") {
    const prompt = `As a privacy education assistant, respond to ${user.name} (${user.ageCategory}, ${user.educationLevel}, ${user.privacyLevel} privacy) about: "${message}". 
    - Keep it concise (3-4 sentences)
    - Tailor it to their privacy level
    - Provide educational value
    - Use simple language for children if needed
    - Include one follow-up question or suggestion`;

    const aiResponse = await generateOllamaResponse(prompt);
    return {
      message: aiResponse,
      actions: getPrivacyTopics(user.privacyLevel),
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
};

// Generate AI response using Ollama
async function generateOllamaResponse(prompt) {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3",
        prompt: prompt,
        stream: false,
      }),
    });

    const data = await response.json();
    return data.response.trim();
  } catch (error) {
    console.error("AI generation error:", error);
    return "I'm having trouble generating a response right now. Please try again later with a different question.";
  }
}

// Action helpers
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

export const whatsappRouter = router;
