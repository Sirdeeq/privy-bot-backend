// models/Chat.js
import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  messages: [
    {
      content: { type: String, required: true },
      isBot: { type: Boolean, required: true },
      timestamp: { type: Date, default: Date.now },
      options: [
        {
          label: String,
          value: String,
        },
      ],
    },
  ],
  topics: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const Chat = mongoose.model("Chat", chatSchema);