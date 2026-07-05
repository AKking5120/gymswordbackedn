const { sanitizeInput } = require("../middleware/validate");
const { AppError } = require("../middleware/errorHandler");

describe("Sanitize Input", () => {
  test("should trim whitespace from strings", () => {
    const req = { body: { name: "  test  " } };
    sanitizeInput(req, {}, () => {});
    expect(req.body.name).toBe("test");
  });

  test("should strip HTML tags", () => {
    const req = { body: { name: "<script>alert('xss')</script>hello" } };
    sanitizeInput(req, {}, () => {});
    expect(req.body.name).toBe("hello");
  });

  test("should handle nested objects", () => {
    const req = { body: { user: { name: "  nested  " } } };
    sanitizeInput(req, {}, () => {});
    expect(req.body.user.name).toBe("nested");
  });
});

describe("AppError", () => {
  test("should create error with correct status code", () => {
    const err = new AppError("Not found", 404);
    expect(err.message).toBe("Not found");
    expect(err.statusCode).toBe(404);
    expect(err.isOperational).toBe(true);
  });

  test("should default to 500 status code", () => {
    const err = new AppError("Server error");
    expect(err.statusCode).toBe(500);
  });
});
