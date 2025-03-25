import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OpenAI API key is required. Please add OPENAI_API_KEY to your .env file");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// services/openaiService.ts
export const generateAIResponse = async (user, action = null) => {
  try {
    // Handle onboarding steps first
    if (!user.name || user.name.trim() === "") {
      return {
        message: "Welcome! Please tell me your name to get started.",
        actions: [{ label: "Enter Your Name", value: "enter_name", input: true }],
      };
    }

    if (user.currentStep === 'age') {
      return {
        message: `Nice to meet you, ${user.name}! Please select your age group:`,
        actions: getAgeGroupActions(),
      };
    }

    if (user.currentStep === 'education') {
      return {
        message: "What's your education level?",
        actions: getEducationActions(),
      };
    }

    if (user.currentStep === 'privacy') {
      return {
        message: "Choose your privacy preference: Low, Medium, or High.",
        actions: getPrivacyActions(),
      };
    }

    // Handle regular conversation
    let prompt = "";
    if (action) {
      // If it's a specific topic request
      if (action.startsWith("topic_")) {
        prompt = `Explain ${action.replace("topic_", "")} to ${user.name}, a ${user.age} with ${user.educationLevel} education level, 
                  focusing on ${user.privacyLevel} privacy level. Keep it concise (3-4 sentences) and friendly.`;
      } else {
        // Handle other actions
        prompt = `Respond to ${user.name}'s request about "${action}". 
                  User details: Age ${user.age}, Education ${user.educationLevel}, 
                  Privacy preference ${user.privacyLevel}. Keep response under 200 characters.`;
      }
    } else {
      // Generic response for any input
      prompt = `Respond to this message from ${user.name} (${user.age}, ${user.educationLevel} education, 
                ${user.privacyLevel} privacy preference): "${action}". 
                Keep it friendly and under 200 characters.`;
    }

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
      max_tokens: 200,
      temperature: 0.7,
    });

    const responseText = completion.choices[0].message.content;

    // Return appropriate actions based on context
    if (user.privacyLevel) {
      return {
        message: responseText,
        actions: [
          ...getPrivacyTopics(user.privacyLevel),
          { label: "Update Profile", value: "update_profile" }
        ]
      };
    }

    return {
      message: responseText,
      actions: []
    };

  } catch (error) {
    console.error("OpenAI API Error:", error);
    return {
      message: "I apologize, but I'm having trouble generating a response right now. Please try again later.",
      actions: [
        { label: "Try Again", value: "retry" },
        { label: "Update Profile", value: "update_profile" },
      ],
    };
  }
};
const getAgeGroupActions = () => [
  { label: "Child (0-12)", value: "age_child" },
  { label: "Teen (13-19)", value: "age_teen" },
  { label: "Young Adult (20-30)", value: "age_young_adult" },
  { label: "Adult (31-50)", value: "age_adult" },
  { label: "Senior (51+)", value: "age_senior" },
];

const getEducationActions = () => [
  { label: "Primary School", value: "edu_primary" },
  { label: "Secondary School", value: "edu_secondary" },
  { label: "Bachelor's Degree", value: "edu_bachelor" },
  { label: "Master's Degree", value: "edu_master" },
  { label: "Doctorate/PhD", value: "edu_phd" },
];

const getPrivacyActions = () => [
  { label: "Low Privacy", value: "privacy_low" },
  { label: "Medium Privacy", value: "privacy_medium" },
  { label: "High Privacy", value: "privacy_high" },
];

const getPrivacyTopics = (privacyLevel) => {
  const topics = {
    Low: [
      { label: "Basic Online Safety", value: "topic_basic_safety" },
      { label: "Public Profile Tips", value: "topic_public_profile" },
    ],
    Medium: [
      { label: "Data Protection", value: "topic_data_protection" },
      { label: "Digital Footprint", value: "topic_digital_footprint" },
    ],
    High: [
      { label: "Advanced Security", value: "topic_advanced_security" },
      { label: "Encryption Basics", value: "topic_encryption" },
    ],
  };
  return topics[privacyLevel] || topics["Medium"];
};