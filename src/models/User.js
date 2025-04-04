import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  rawNumber: {
    type: String
  },
  name: {
    type: String,
    required: true,
    unique: true
  },
  age: { type: Number },
  ageCategory: {
    type: String,
    enum: ["Child", "Teen", "Adult"]
  },
  educationLevel: {
    type: String,
    enum: ["Primary", "Secondary", "Degree", "Masters", "PhD"]
  },
  privacyLevel: {
    type: String,
    enum: ["Low", "Medium", "High"]
  },
  currentStep: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });



export const User = mongoose.model("User", userSchema);