import axios from "axios";
import dotenv from "dotenv";
import TokenManager from "./tokenManager.js";

dotenv.config();
class WhatsAppService {
  constructor() {
    this.tokenManager = new TokenManager();
    this.META_API_VERSION = process.env.META_API_VERSION || "v18.0";
    this.PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
    this.baseUrl = `https://graph.facebook.com/${this.META_API_VERSION}/${this.PHONE_NUMBER_ID}`;
    this.rateLimit = {
      lastRequest: null,
      count: 0,
    };
  }

  async sendMessage(phoneNumber, message, buttons = null) {
    try {
      const token = await this.tokenManager.getValidToken();
      const payload = this.buildPayload(phoneNumber, message, buttons);

      this.checkRateLimit();

      const response = await axios.post(`${this.baseUrl}/messages`, payload, {
        headers: this.getHeaders(token),
      });

      return response.data;
    } catch (error) {
      this.handleApiError(error);
    }
  }

  buildPayload(phoneNumber, message, buttons) {
    const formattedNumber = this.formatNumber(phoneNumber);
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedNumber,
    };

    if (buttons) {
      payload.type = "interactive";
      payload.interactive = {
        type: "button",
        body: { text: message },
        action: { buttons: this.buildButtons(buttons) },
      };
    } else {
      payload.type = "text";
      payload.text = { body: message };
    }

    return payload;
  }

  buildButtons(buttons) {
    return buttons.map((btn, index) => ({
      type: "reply",
      reply: {
        id: `btn_${index}`,
        title: btn.label,
      },
    }));
  }

  getHeaders(token) {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  checkRateLimit() {
    const now = Date.now();
    if (this.rateLimit.lastRequest && now - this.rateLimit.lastRequest < 1000) {
      this.rateLimit.count++;
      if (this.rateLimit.count > 5) {
        throw new Error("Rate limit exceeded - too many requests");
      }
    } else {
      this.rateLimit.count = 0;
    }
    this.rateLimit.lastRequest = now;
  }

  handleApiError(error) {
    const errorData = error.response?.data?.error || {};

    if (errorData.code === 190) {
      throw new Error("Invalid or expired access token");
    } else if (errorData.code === 80007) {
      throw new Error("Temporary API limit reached");
    } else if (errorData.code === 429) {
      throw new Error(
        "Rate limit exceeded - please wait before sending more messages"
      );
    } else {
      console.error("WhatsApp API Error:", errorData);
      throw new Error(errorData.message || "Failed to send WhatsApp message");
    }
  }

  formatNumber(phoneNumber) {
    let cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.startsWith("0")) cleaned = "234" + cleaned.substring(1);
    if (cleaned.startsWith("234")) cleaned = cleaned.substring(1);
    return cleaned.length === 13 ? cleaned : phoneNumber;
  }
}

export default WhatsAppService;
