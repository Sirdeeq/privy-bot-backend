import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

class TokenManager {
  constructor() {
    this.currentToken = {
      value: process.env.META_ACCESS_TOKEN,
      expiresAt: null,
      lastValidated: null,
      lastError: null,
    };
    this.TOKEN_REFRESH_BUFFER = 3600;
  }

  async ensureValidToken() {
    if (
      !this.currentToken.value ||
      (this.currentToken.expiresAt && this.currentToken.expiresAt <= new Date())
    ) {
      await this.refreshToken();
    }
    return this.currentToken.value;
  }

  async validateAndUpdateToken() {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/debug_token?input_token=${this.currentToken.value}&access_token=${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
      );

      const data = response.data.data;

      if (!data.is_valid) {
        throw new Error("Token is invalid");
      }

      this.currentToken = {
        value: this.currentToken.value,
        expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null,
        lastValidated: new Date(),
        lastError: null,
      };

      return true;
    } catch (error) {
      this.currentToken.lastError = error.message;
      console.error("Token validation failed:", error.message);
      return false;
    }
  }

  async getValidToken() {
    // First validation
    if (!this.currentToken.lastValidated) {
      const isValid = await this.validateAndUpdateToken();
      if (!isValid) throw new Error("Initial token validation failed");
    }

    // Check expiration with buffer
    if (this.willExpireSoon()) {
      console.log("Token nearing expiration, attempting refresh...");
      await this.refreshToken();
    }

    return this.currentToken.value;
  }

  async refreshToken() {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${this.currentToken.value}`
      );

      this.currentToken = {
        value: response.data.access_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
        lastValidated: new Date(),
        lastError: null,
      };

      console.log("Token refreshed successfully");
      return true;
    } catch (error) {
      this.currentToken.lastError = error.message;
      console.error("Token refresh failed:", error.message);

      // Fall back to existing token if not expired
      if (
        this.currentToken.expiresAt &&
        this.currentToken.expiresAt > new Date()
      ) {
        console.log("Using existing token until expiration");
        return true;
      }
      throw new Error("Token refresh failed and token is expired");
    }
  }

  startMonitoring() {
    // Check token every 30 minutes
    this.monitorInterval = setInterval(async () => {
      try {
        await this.validateAndUpdateToken();
      } catch (error) {
        console.error("Token monitoring failed:", error.message);
      }
    }, 1800000);
  }

  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
  }

  willExpireSoon() {
    return (
      this.currentToken.expiresAt &&
      new Date(
        this.currentToken.expiresAt.getTime() - this.TOKEN_REFRESH_BUFFER * 1000
      ) < new Date()
    );
  }

  getTokenInfo() {
    return {
      value: this.currentToken.value
        ? "***" + this.currentToken.value.slice(-4)
        : null,
      expiresAt: this.currentToken.expiresAt,
      lastValidated: this.currentToken.lastValidated,
      lastError: this.currentToken.lastError,
    };
  }

  getLastError() {
    return this.currentToken.lastError;
  }
}

export default TokenManager;
