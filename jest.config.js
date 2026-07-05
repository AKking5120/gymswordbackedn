module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  setupFiles: ["./tests/setup.js"],
  collectCoverageFrom: [
    "config/**/*.js",
    "middleware/**/*.js",
    "utils/**/*.js",
    "services/**/*.js",
    "!node_modules",
  ],
};
