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
// Update your WhatsApp client initialization
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
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      "--disable-notifications",
      "--disable-logging",
      "--disable-dev-tools",
      "--single-process",
      "--no-first-run",
      "--mute-audio",
      "--hide-scrollbars",
      "--ignore-certificate-errors",
    ],
  },
  takeoverOnConflict: true,
  takeoverTimeoutMs: 30000, 
  qrMaxRetries: 10,
  qrTimeoutMs: 120000,
  sessionTimeoutMs: 86400000, 
});

// Helper function to send direct message
async function sendDirectMessage(chatId, messageText) {
  try {
    await whatsappClient.sendMessage(chatId, messageText);
  } catch (error) {
    console.error("Failed to send direct message:", error);
  }
}

// Helper function to send message with fallback
async function sendMessageWithFallback(chatId, message, originalMsg = null) {
  try {
    if (originalMsg) {
      try {
        await originalMsg.reply(message);
        return;
      } catch (replyError) {
        console.log("Reply failed, trying direct send...");
      }
    }
    await whatsappClient.sendMessage(chatId, message);
  } catch (error) {
    console.error("Both reply and direct send failed:", error);
    const text = typeof message === "string" ? message : message.text;
    await sendDirectMessage(chatId, text);
  }
}

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

  try {
    await sendDirectMessage(
      clientPhoneNumber + "@c.us",
      "✅ *Privy Bot is now connected!*\n\nHello! 👋 I'm here to assist you with privacy education. Type 'hi' to get started."
    );
  } catch (error) {
    console.error("Failed to send welcome message:", error);
  }
});

// whatsappClient.on("message", async (msg) => {
//   if (msg.body === "!ping") {
//     try {
//       await msg.reply("pong");
//     } catch (error) {
//       console.error("Failed to reply to ping:", error);
//       await sendDirectMessage(msg.from, "pong");
//     }
//     return;
//   }

//   try {
//     const phoneNumber = msg.from.split("@")[0];
//     const formattedNumber = formatNigerianNumber(phoneNumber);
//     const message = msg.body;

//     if (!formattedNumber || !message) {
//       throw new Error("Invalid message format");
//     }

//     // Find or create user
//     let user = await User.findOne({ phoneNumber: formattedNumber });

//     // Check for greeting message to reset conversation
//     const isGreeting = ["hi", "hello", "hi privy bot", "hey"].includes(
//       message.toLowerCase().trim()
//     );

//     if (!user || isGreeting) {
//       user = await User.findOneAndUpdate(
//         { phoneNumber: formattedNumber },
//         {
//           phoneNumber: formattedNumber,
//           rawNumber: phoneNumber,
//           currentStep: "name",
//           name: null,
//           age: null,
//           ageCategory: null,
//           educationLevel: null,
//           privacyLevel: null,
//         },
//         { upsert: true, new: true, setDefaultsOnInsert: true }
//       );

//       if (isGreeting) {
//         const welcomeMessage =
//           "👋 *Welcome to Privy Bot!*\n\nI'm here to help you learn about privacy and online safety. Let's get started!\n\nWhat's your name?";
//         await sendMessageWithFallback(
//           msg.from,
//           formatWhatsAppResponse({
//             message: welcomeMessage,
//             actions: [],
//           }),
//           msg
//         );
//         return;
//       }
//     }

//     // Process message based on current step
//     const response = await handleUserStep(user, message);
//     console.log("Response", response);
//     const formattedResponse = formatWhatsAppResponse(response);
//     console.log("  Formatted Response", formattedResponse);

//     // Save user changes after processing the step
//     await user.save();

//     await sendMessageWithFallback(msg.from, formattedResponse, msg);
//   } catch (error) {
//     console.error("WhatsApp Message Handling Error:", error);
//     await sendDirectMessage(
//       msg.from,
//       "Sorry, I encountered an error processing your message. Please try again."
//     );
//   }
// });

whatsappClient.on("message", async (msg) => {
  if (msg.body === "!ping") {
    try {
      await msg.reply("pong");
    } catch (error) {
      console.error("Failed to reply to ping:", error);
      await sendDirectMessage(msg.from, "pong");
    }
    return;
  }

  try {
    const phoneNumber = msg.from.split("@")[0];
    const formattedNumber = formatNigerianNumber(phoneNumber);
    const message = msg.body;

    if (!formattedNumber || !message) {
      throw new Error("Invalid message format");
    }

    // Find or create user
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
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      if (isGreeting) {
        const welcomeMessage =
          "👋 *Welcome to Privy Bot!*\n\nI'm here to help you learn about privacy and online safety. Let's get started!\n\nWhat's your name?";
        await sendMessageWithFallback(
          msg.from,
          formatWhatsAppResponse({
            message: welcomeMessage,
            actions: [],
          }),
          msg
        );
        return;
      }
    }

    // Process message based on current step
    const response = await handleUserStep(user, message);
    console.log("Response", response);
    const formattedResponse = formatWhatsAppResponse(response);
    console.log("Formatted Response", formattedResponse);

    // Save user changes after processing the step
    await user.save();

    await sendMessageWithFallback(msg.from, formattedResponse, msg);
  } catch (error) {
    console.error("WhatsApp Message Handling Error:", error);
    await sendDirectMessage(
      msg.from,
      "Sorry, I encountered an error processing your message. Please try again."
    );
  }
});

// Helper function to format Nigerian phone numbers
function formatNigerianNumber(phoneNumber) {
  let cleaned = phoneNumber.replace(/\D/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = "234" + cleaned.substring(1);
  } else if (cleaned.startsWith("234")) {
    cleaned = cleaned.substring(1);
  }

  return cleaned.length === 13 ? cleaned : phoneNumber;
}

function formatWhatsAppResponse(response) {
  let message = response.message;

  if (response.actions && response.actions.length > 0) {
    // Format actions with A, B, C labels
    const actionLetters = ["A", "B", "C", "D", "E"].slice(
      0,
      response.actions.length
    );
    const formattedActions = response.actions.map((action, index) => {
      return `${actionLetters[index]}. ${action.label}`;
    });

    message += "\n\n" + formattedActions.join("\n");
  }

  return message;
}

const handleUserStep = async (user, message) => {
  try {
    console.log("Current Step:", user.currentStep);
    console.log(`Processing step: ${user.currentStep}, Message: ${message}`);

    // Ensure message is a string and trim it
    const userInput =
      typeof message === "string" ? message.trim().toUpperCase() : "";

    switch (user.currentStep) {
      case "name":
        if (!userInput) {
          return { message: "Please provide a valid name." };
        }
        user.name = message.trim();
        user.currentStep = "age";
        await user.save();
        return {
          message: `Nice to meet you, ${
            user.name
          }! Please tell me your age:\n${getAgeGroupOptions()}`,
        };

      case "age":
        const age = parseInt(message);
        const ageMapping = { A: 10, B: 16, C: 25 };
        const selectedAge = isNaN(age) ? ageMapping[userInput] : age;

        if (!selectedAge) {
          return {
            message:
              "Please enter a valid age (or select an age group):\n" +
              getAgeGroupOptions(),
          };
        }

        user.age = selectedAge;
        user.ageCategory =
          user.age <= 12 ? "Child" : user.age <= 19 ? "Teen" : "Adult";
        user.currentStep = "education";
        await user.save();
        return {
          message: "What is your education level?\n" + getEducationOptions(),
        };

      case "education":
        const educationMapping = {
          A: "Primary",
          B: "Secondary",
          C: "Degree",
          D: "Masters",
          E: "PhD",
        };
        const selectedEducation = educationMapping[userInput];

        if (!selectedEducation) {
          return {
            message:
              "Please select a valid education level:\n" +
              getEducationOptions(),
          };
        }

        user.educationLevel = selectedEducation;
        user.currentStep = "privacy";
        await user.save();
        return {
          message:
            "What privacy level would you prefer (Low, Medium, High)?\n" +
            getPrivacyOptions(),
        };

      case "privacy":
        const privacyMapping = { A: "Low", B: "Medium", C: "High" };
        const selectedPrivacy = privacyMapping[userInput];

        if (!selectedPrivacy) {
          return {
            message:
              "Please select a valid privacy level:\n" + getPrivacyOptions(),
          };
        }

        user.privacyLevel = selectedPrivacy;
        user.currentStep = "topic_selection";
        await user.save();
        return {
          message: `Thank you! Based on your ${
            user.privacyLevel
          } privacy level, here are some topics we can discuss:\n${formatTopicOptions(
            getPrivacyTopics(user.privacyLevel)
          )}`,
        };

      case "topic_selection":
        const topics = getPrivacyTopics(user.privacyLevel);
        const actionLetters = ["A", "B", "C", "D", "E"].slice(0, topics.length);
        const selectedIndex = actionLetters.indexOf(userInput);

        if (selectedIndex === -1 || !topics[selectedIndex]) {
          return {
            message: `Please select a valid topic:\n${formatTopicOptions(
              topics
            )}`,
          };
        }

        const selectedTopic = topics[selectedIndex];

        // Update the user with topic information
        const updatedUser = await User.findOneAndUpdate(
          { phoneNumber: user.phoneNumber },
          {
            currentTopic: selectedTopic.value,
            currentTopicLabel: selectedTopic.label,
            currentStep: "in_conversation",
          },
          { new: true }
        );

        const introPrompt = `Provide a 3-sentence introduction about ${selectedTopic.label} for ${user.privacyLevel} privacy level. Focus on practical benefits.`;
        const aiResponse = await generateOllamaResponse(introPrompt);

        return {
          message: `${aiResponse}\n\nReply with:\n1. For step-by-step tutorial\n2. To see platform examples\n3. To change topic`,
        };
      case "in_conversation":
        // First check if we have a valid currentTopic
        const currentUser = await User.findOne({
          phoneNumber: user.phoneNumber,
        });

        if (!currentUser.currentTopic || !currentUser.currentTopicLabel) {
          console.log(
            "No current topic found in DB, returning to topic selection"
          );
          await User.findOneAndUpdate(
            { phoneNumber: user.phoneNumber },
            { currentStep: "topic_selection" }
          );
          return {
            message: `Let's choose a topic first:\n${formatTopicOptions(
              getPrivacyTopics(user.privacyLevel)
            )}`,
          };
        }

        // Log the raw input for debugging
        console.log("Current topic:", user.currentTopicLabel);
        console.log("Raw user input:", message);

        // Normalize input to handle numbers or text
        const normalizedInput =
          typeof message === "string" ? message.trim().toLowerCase() : "";
        console.log("Normalized input:", normalizedInput);

        // Handle tutorial request (1 or "tutorial")
        if (normalizedInput === "1" || normalizedInput.includes("tutorial")) {
          console.log("User requested tutorial for:", user.currentTopicLabel);
          const tutorialPrompt = `Provide a detailed 7-step beginner-friendly tutorial about implementing ${user.currentTopicLabel} for ${user.privacyLevel} privacy. Number each step clearly and include practical tips.`;
          const tutorial = await generateOllamaResponse(tutorialPrompt);
          return {
            message: `🔧 ${user.currentTopicLabel.toUpperCase()} TUTORIAL 🔧\n${tutorial}\n\nReply with:\n1. More detailed tutorial\n2. See platform examples\n3. Change topic`,
          };
        }

        // Handle examples request (2 or "examples")
        if (normalizedInput === "2" || normalizedInput.includes("example")) {
          console.log("User requested examples for:", user.currentTopicLabel);
          const examplesPrompt = `Give 3 specific, practical examples of how ${user.currentTopicLabel} is implemented on Facebook, WhatsApp, and Instagram. For each platform, explain: 1) Where to find the setting, 2) How to enable it, 3) What protection it provides. Use bullet points.`;
          const examples = await generateOllamaResponse(examplesPrompt);
          return {
            message: `📱 ${user.currentTopicLabel.toUpperCase()} EXAMPLES 📱\n${examples}\n\nReply with:\n1. Step-by-step tutorial\n2. More platform examples\n3. Change topic`,
          };
        }

        // Handle topic change request (3 or "change")
        if (
          normalizedInput === "3" ||
          normalizedInput.includes("change") ||
          normalizedInput.includes("topic")
        ) {
          console.log("User requested topic change");
          user.currentStep = "topic_selection";
          user.currentTopic = null;
          user.currentTopicLabel = null;
          await user.save();
          return {
            message: `Okay, let's choose a different topic:\n${formatTopicOptions(
              getPrivacyTopics(user.privacyLevel)
            )}`,
          };
        }

        // If we get here, treat as a question about the current topic
        console.log(
          "Treating input as question about current topic:",
          user.currentTopicLabel
        );
        const questionPrompt = `Answer this question about ${user.currentTopicLabel} for ${user.privacyLevel} privacy level: "${message}" in 2-3 sentences.`;
        const answer = await generateOllamaResponse(questionPrompt);
        return {
          message: `${answer}\n\nReply with:\n1. Step-by-step tutorial\n2. See platform examples\n3. Change topic`,
        };
      default:
        return { message: "Welcome! Please tell me your name to get started." };
    }
  } catch (error) {
    console.error("Error handling user step:", error);
    return {
      message:
        "Sorry, there was an issue processing your response. Please try again.",
    };
  }
};

async function generateOllamaResponse(prompt) {
  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { max_length: 200 },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.statusText}`);
    }

    const data = await response.json();
    let aiResponse =
      data && data.length > 0
        ? data[0].generated_text
        : "No response generated.";

    // Remove the original prompt from the response if present
    if (aiResponse.includes(prompt)) {
      aiResponse = aiResponse.replace(prompt, "").trim();
    }

    return aiResponse;
  } catch (error) {
    console.error("AI generation error:", error);
    return "I'm having trouble generating a response right now. Please try again later with a different question.";
  }
}

// Update getPrivacyTopics to match the web version
function getPrivacyTopics(privacyLevel = "Medium") {
  const topics = {
    Low: [
      {
        label: "Basic Social Media Privacy",
        value: "social media privacy basics",
      },
      { label: "Safe Browsing Habits", value: "safe browsing practices" },
      { label: "Password Security", value: "creating strong passwords" },
      { label: "Public Profile Settings", value: "managing public profile" },
      { label: "Recognizing Scams", value: "identifying online scams" },
    ],
    Medium: [
      {
        label: "Advanced Privacy Settings",
        value: "advanced privacy controls",
      },
      { label: "Two-Factor Authentication", value: "setting up 2FA" },
      { label: "Data Sharing Controls", value: "managing data sharing" },
      { label: "Browser Privacy", value: "browser privacy settings" },
      { label: "App Permissions", value: "managing app permissions" },
    ],
    High: [
      { label: "Encrypted Messaging", value: "using encrypted messaging" },
      { label: "VPN Usage", value: "setting up a VPN" },
      {
        label: "Advanced Security Settings",
        value: "advanced security controls",
      },
      { label: "Data Encryption", value: "encrypting sensitive data" },
      { label: "Privacy-Focused Tools", value: "privacy enhancing tools" },
    ],
  };
  return topics[privacyLevel] || topics["Medium"];
}

function formatTopicOptions(topics) {
  const actionLetters = ["A", "B", "C", "D", "E"].slice(0, topics.length);
  return topics
    .map((topic, index) => `${actionLetters[index]}. ${topic.label}`)
    .join("\n");
}

function getAgeGroupOptions() {
  return ["A. Child (0-12)", "B. Teen (13-19)", "C. Adult (20+)"].join("\n");
}

function getEducationOptions() {
  return [
    "A. Primary",
    "B. Secondary",
    "C. Degree",
    "D. Masters",
    "E. PhD",
  ].join("\n");
}

function getPrivacyOptions() {
  return ["A. Low Privacy", "B. Medium Privacy", "C. High Privacy"].join("\n");
}


let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Enhanced disconnection handler
whatsappClient.on("disconnected", async (reason) => {
  console.log("Client disconnected:", reason);
  connectionStatus = "disconnected";
  clientReady = false;
  clearTimeout(sessionExpiryTimer);

  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    const delay = Math.min(10000 * reconnectAttempts, 60000); // Exponential backoff max 1min
    console.log(`Attempting reconnect in ${delay/1000} seconds...`);
    
    setTimeout(async () => {
      try {
        await whatsappClient.initialize();
        reconnectAttempts = 0;
      } catch (err) {
        console.error("Reconnection failed:", err);
      }
    }, delay);
  } else {
    console.error("Max reconnection attempts reached");
  }
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

    // Find or create user
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

      await sendDirectMessage(
        whatsappNumber,
        formatWhatsAppResponse({
          message: welcomeMessage,
          actions: [],
        }).text
      );

      return res.json({
        status: "welcome_sent",
        response: welcomeMessage,
      });
    }

    // Process user's message
    const response = await handleUserStep(user, message);
    console.log("response", response);
    const formattedResponse = formatWhatsAppResponse(response);
    console.log("formattedResponse", formattedResponse);

    // Send the response
    await sendDirectMessage(whatsappNumber, formattedResponse.text);

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

export const whatsappRouter = router;
