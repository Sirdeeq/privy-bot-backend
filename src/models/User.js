// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ageCategory: {
    type: String,
    enum: [
      "Child (0-12)",
      "Teen (13-19)",
      "Young Adult (20-30)",
      "Adult (31-50)",
      "Senior (51+)",
    ],
  },
  educationLevel: {
    type: String,
    enum: [
      "Primary School",
      "Secondary School",
      "Bachelor's Degree",
      "Master's Degree",
      "Doctorate/PhD",
    ],
  },
  privacyLevel: {
    type: String,
    enum: ["Low", "Medium", "High"],
  },
  phoneNumber: { type: String },
  currentStep: { type: String },
  currentQuestion: {
    question: String,
    steps: [String],
    currentStepIndex: Number,
  },
  currentQuestions: [
    {
      question: String,
      steps: [String],
    },
  ],
  chats: [{ type: mongoose.Schema.Types.ObjectId, ref: "Chat" }],
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model("User", userSchema);
