import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    default: null,
  },
  age: {
    type: Number,
    default: null,
  },
  ageCategory: {
    type: String,
    enum: ['Child', 'Teen', 'Adult', null],
    default: null,
  },
  educationLevel: {
    type: String,
    enum: ['Primary', 'Secondary', 'Degree', null],
    default: null,
  },
  privacyLevel: {
    type: String,
    enum: ['Low', 'Medium', 'High', null],
    default: null,
  },
  currentStep: {
    type: String,
    enum: ['name', 'age', 'education', 'privacy', 'completed'],
    default: 'name',
  },
}, {
  timestamps: true,
});

export const User = mongoose.model('User', userSchema);