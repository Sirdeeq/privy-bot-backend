import express from "express";
import fetch from "node-fetch"; 
import { Chat } from "../models/Chat.js";
import dotenv from 'dotenv';
import { User } from "../models/User.js";


dotenv.config();

const router = express.Router();

// Ollama configuration
// const OLLAMA_API_URL = "http://localhost:11434/api/generate";

const OLLAMA_API_URL =
  "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1";
const HF_API_KEY = process.env.HF_API_KEY;
// Default Ollama URL

router.get("/user/:name", async (req, res) => {
  try {
    const user = await User.findOne({ name: req.params.name });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});


router.post("/user", async (req, res) => {
  try {
    const { name, age, educationLevel, privacyLevel, currentStep } = req.body;

    // Find or create user
    let user = await User.findOneAndUpdate(
      { name },
      {
        $set: {
          age,
          educationLevel,
          privacyLevel,
          currentStep
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    res.json(user);
  } catch (error) {
    console.error("Error saving user:", error);
    res.status(500).json({
      error: "Internal server error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

router.post("/generate", async (req, res) => {
  try {
    const { name, ageCategory, educationLevel, privacyLevel, message } =
      req.body;

    const prompt = `As a privacy education assistant, respond to ${name} (${ageCategory}, ${educationLevel}, ${privacyLevel} privacy) about: "${message}". Keep it concise (3-4 sentences) and educational.`;

    const response = await fetch(OLLAMA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_length: 200 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.statusText}`);
    }

    const data = await response.json();

    let aiResponse =
      data && data.length > 0
        ? data[0].generated_text
        : "No response generated.";

    // **Fix: Remove the original prompt from the response**
    if (aiResponse.includes(prompt)) {
      aiResponse = aiResponse.replace(prompt, "").trim();
    }

    res.json({
      message: aiResponse,
      actions: privacyLevel ? getPrivacyTopics(privacyLevel) : [],
    });
  } catch (error) {
    console.error("Generate error:", error);
    res.status(500).json({
      message:
        "I apologize, but I'm having trouble generating a response right now.",
      actions: [
        { label: "Try Again", value: "retry" },
        { label: "Contact Support", value: "support" },
      ],
    });
  }
});

router.get("/history/:username", async (req, res) => {
  try {
    // First find the user by their username
    const user = await User.findOne({ username: req.params.username });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Then find chats using the user's ObjectId
    const chats = await Chat.find({ userId: user._id })
      .sort({ "messages.timestamp": 1 }) // Sort by message timestamp
      .limit(100);

    if (!chats || chats.length === 0) {
      return res.status(200).json({ data: [] });
    }

    // Flatten all messages from all chat documents
    const allMessages = chats.flatMap((chat) =>
      chat.messages.map((message) => ({
        content: message.content,
        isBot: message.isBot,
        timestamp: message.timestamp,
        options: message.options,
      }))
    );

    res.json({
      data: allMessages,
    });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// New endpoint to generate reports
router.get("/report", async (req, res) => {
  try {
    // Get report parameters with defaults
    const days = parseInt(req.query.days) || 30;
    const limit = parseInt(req.query.limit) || 5;
    const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get total number of users
    const totalUsers = await User.countDocuments();

    // Get all privacy levels used by users
    const privacyLevels = await User.distinct("privacyLevel");

    // Get topic coverage statistics
    const topicCoverage = {};
    const allTopics = [];

    privacyLevels.forEach((level) => {
      const topics = getPrivacyTopics(level);
      allTopics.push(...topics.map((t) => t.value));
      topicCoverage[level] = {
        level,
        topics: topics.map((t) => t.label),
        count: topics.length,
      };
    });

    // Get most discussed topics from actual chats
    const discussedTopics = await Chat.aggregate([
      { $match: { createdAt: { $gte: dateThreshold } } },
      { $unwind: "$topics" },
      { $match: { topics: { $in: allTopics } } },
      { $group: { _id: "$topics", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    // Map discussed topics to their full information
    const popularTopics = discussedTopics.map((topic) => {
      let topicInfo = {};
      Object.values(getPrivacyTopics())
        .flat()
        .forEach((t) => {
          if (t.value === topic._id) topicInfo = t;
        });
      return {
        ...topicInfo,
        discussionCount: topic.count,
      };
    });

    // Get AI recommendations based on topic popularity
    const recommendations = popularTopics.map((topic) => ({
      topic: topic.label,
      recommendation: generateTopicRecommendation(topic.value),
      priority:
        topic.discussionCount > 10
          ? "High"
          : topic.discussionCount > 5
            ? "Medium"
            : "Low",
    }));

    // Get user engagement metrics
    const engagement = await Chat.aggregate([
      { $match: { createdAt: { $gte: dateThreshold } } },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: { $size: "$messages" } },
          activeUsers: { $addToSet: "$userId" },
        },
      },
      {
        $project: {
          avgMessagesPerUser: {
            $divide: ["$totalMessages", { $size: "$activeUsers" }],
          },
          activeUserCount: { $size: "$activeUsers" },
        },
      },
    ]);

    res.json({
      success: true,
      reportPeriod: `${days} days`,
      totalUsers,
      topicCoverage: Object.values(topicCoverage),
      popularTopics,
      recommendations,
      engagement: engagement[0] || {
        avgMessagesPerUser: 0,
        activeUserCount: 0,
      },
      generatedAt: new Date(),
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Helper function to generate AI recommendations for topics
function generateTopicRecommendation(topicValue) {
  const recommendations = {
    "social media privacy basics": [
      "Review your privacy settings on all social platforms monthly",
      "Limit personal information in your public profiles",
      "Be cautious about what you share in public posts",
    ],
    "safe browsing practices": [
      "Use HTTPS everywhere extension",
      "Regularly clear cookies and cache",
      "Avoid clicking on suspicious links",
    ],
    // Add recommendations for all other topics...
    "using encrypted messaging": [
      "Switch to Signal or WhatsApp for sensitive conversations",
      "Verify security codes with important contacts",
      "Disable cloud backups for sensitive chats",
    ],
  };

  return (
    recommendations[topicValue] || [
      "Review your privacy settings regularly",
      "Consider upgrading your security practices",
      "Stay informed about new privacy features",
    ]
  );
}

// Privacy topics structure
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

// // Helper function (same as before)
// function getPrivacyTopics(privacyLevel) {
//   const topics = {
//     Low: [
//       { label: "Basic Online Safety", value: "topic_basic_safety" },
//       { label: "Public Profile Tips", value: "topic_public_profile" },
//     ],
//     Medium: [
//       { label: "Data Protection", value: "topic_data_protection" },
//       { label: "Digital Footprint", value: "topic_digital_footprint" },
//     ],
//     High: [
//       { label: "Advanced Security", value: "topic_advanced_security" },
//       { label: "Encryption Basics", value: "topic_encryption" },
//     ],
//   };
//   return topics[privacyLevel] || topics["Medium"];
// }

export const webRouter = router;
