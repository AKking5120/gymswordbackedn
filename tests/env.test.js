const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.example") });
const env = require("../config/env");

describe("Environment Configuration", () => {
  test("should validate required environment variables", () => {
    expect(env).toBeDefined();
    expect(env.JWT_SECRET).toBeDefined();
    expect(env.SUPABASE_URL).toBeDefined();
    expect(env.SUPABASE_SERVICE_KEY).toBeDefined();
    expect(env.RAZORPAY_KEY).toBeDefined();
    expect(env.RAZORPAY_SECRET).toBeDefined();
  });

  test("should provide defaults for optional variables", () => {
    expect(env.PORT).toBe(5000);
    expect(env.NODE_ENV).toBe("development");
    expect(env.OTP_EXPIRY).toBe(600);
    expect(env.RATE_LIMIT_WINDOW_MS).toBe(900000);
    expect(env.RATE_LIMIT_MAX).toBe(100);
  });

  test("should parse numeric values correctly", () => {
    expect(typeof env.PORT).toBe("number");
    expect(typeof env.OTP_EXPIRY).toBe("number");
    expect(typeof env.RATE_LIMIT_WINDOW_MS).toBe("number");
    expect(typeof env.RATE_LIMIT_MAX).toBe("number");
  });
});
