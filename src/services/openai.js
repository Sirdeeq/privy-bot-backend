import OpenAI from "openai";
import dotenv from "dotenv";

// Ensure environment variables are loaded
dotenv.config();

// Validate OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    "OpenAI API key is required. Please add OPENAI_API_KEY to your .env file"
  );
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

// export const generateAIResponse = async (user, action = null) => {
//   let prompt = "";
//   let actions = [];

//   if (
//     !user.currentStep ||
//     user.currentStep === "name" ||
//     !user.name ||
//     user.name === "Guest"
//   ) {
//     return {
//       message:
//         "Welcome! Before we begin, please note that we prioritize your privacy. We only collect essential information to provide personalized guidance. Your data is securely stored and never shared. Please tell me your name to get started.",
//       actions: [],
//     };
//   }

//   // if (!user.name || user.name === "Guest") {
//   //   return {
//   //     // message: "Welcome! Before we begin, please note that we prioritize your privacy. We only collect essential information to provide personalized guidance. Your data is securely stored and never shared. Please tell me your name to get started.",
//   //     message: "Whats your name",
//   //     actions: [{ label: "Enter Your Name", value: "enter_name", input: true }],
//   //   };
//   // }

//   if (user.currentStep === "age") {
//     return {
//       message: "Please select your age group:",
//       actions: getAgeGroupActions(),
//     };
//   }

//   if (user.currentStep === "education") {
//     return {
//       message: "What's your education level?",
//       actions: getEducationActions(),
//     };
//   }

//   if (user.currentStep === "privacy") {
//     return {
//       message:
//         "Choose your privacy preference. This helps us tailor our recommendations:\n\nLow: Basic online safety tips\nMedium: Enhanced privacy features\nHigh: Advanced security measures",
//       actions: getPrivacyActions(),
//     };
//   }

//   try {
//     if (action && action.startsWith("topic_")) {
//       prompt = `Generate a detailed but concise response about ${action.replace(
//         "topic_",
//         ""
//       )}
//                 for a ${user.ageCategory} user with ${
//         user.educationLevel
//       } education
//                 and ${user.privacyLevel} privacy preference.
//                 Keep the response friendly and educational.`;
//     } else {
//       prompt = `Generate a personalized greeting for ${user.name}, who is a ${user.ageCategory}
//                 with ${user.educationLevel} education and ${user.privacyLevel} privacy preference.
//                 Include a brief explanation of how their data is protected and why we collect minimal information.
//                 Keep it friendly and concise.`;
//     }

//     const completion = await openai.chat.completions.create({
//       messages: [{ role: "user", content: prompt }],
//       model: "gpt-3.5-turbo",
//       max_tokens: 200,
//       temperature: 0.7,
//     });

//     // Add privacy topics as conversation starters
//     const privacyTopics = getPrivacyTopics(user.privacyLevel);

//     return {
//       message: completion.choices[0].message.content,
//       actions: [
//         ...privacyTopics,
//         { label: "Update Profile", value: "update_profile" },
//       ],
//     };
//   } catch (error) {
//     console.error("OpenAI API Error:", error);
//     return {
//       message:
//         "I apologize, but I'm having trouble generating a response right now. Please try again later.",
//       actions: [
//         { label: "Try Again", value: "retry" },
//         { label: "Update Profile", value: "update_profile" },
//       ],
//     };
//   }
// };

export const generateAIResponse = async (user, action = null) => {
  let prompt = "";
  let actions = [];

  // Step 1: Ask for the user's name if not provided
  if (!user.name || user.name.trim() === "") {
    return {
      message:
        "Welcome! Before we begin, please note that we prioritize your privacy. We only collect essential information to provide personalized guidance. Your data is securely stored and never shared. Please tell me your name to get started.",
      actions: [{ label: "Enter Your Name", value: "enter_name", input: true }],
    };
  }

  // Step 2: Ask for the user's age group
  if (user.currentStep === "age") {
    return {
      message:
        "Nice to meet you, " + user.name + "! Please select your age group:",
      actions: getAgeGroupActions(),
    };
  }

  // Step 3: Ask for the user's education level
  if (user.currentStep === "education") {
    return {
      message: "What's your education level?",
      actions: getEducationActions(),
    };
  }

  // Step 4: Ask for the user's privacy preference
  if (user.currentStep === "privacy") {
    return {
      message:
        "Choose your privacy preference. This helps us tailor our recommendations:\n\nLow: Basic online safety tips\nMedium: Enhanced privacy features\nHigh: Advanced security measures",
      actions: getPrivacyActions(),
    };
  }

  // Step 5: Generate a personalized greeting or topic-based response
  try {
    if (action && action.startsWith("topic_")) {
      prompt = `Generate a detailed but concise response about ${action.replace(
        "topic_",
        ""
      )} 
                for a ${user.ageCategory} user with ${
        user.educationLevel
      } education 
                and ${user.privacyLevel} privacy preference. 
                Keep the response friendly and educational.`;
    } else {
      prompt = `Generate a personalized greeting for ${user.name}, who is a ${user.ageCategory} 
                with ${user.educationLevel} education and ${user.privacyLevel} privacy preference.
                Include a brief explanation of how their data is protected and why we collect minimal information.
                Keep it friendly and concise.`;
    }

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
      max_tokens: 200,
      temperature: 0.7,
    });

    // Add privacy topics as conversation starters
    const privacyTopics = getPrivacyTopics(user.privacyLevel);

    return {
      message: completion.choices[0].message.content,
      actions: [
        ...privacyTopics,
        { label: "Update Profile", value: "update_profile" },
      ],
    };
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return {
      message:
        "I apologize, but I'm having trouble generating a response right now. Please try again later.",
      actions: [
        { label: "Try Again", value: "retry" },
        { label: "Update Profile", value: "update_profile" },
      ],
    };
  }
};
