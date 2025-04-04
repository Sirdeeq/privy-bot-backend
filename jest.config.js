export default {
    testEnvironment: "node",
    transform: {
      "^.+\\.js$": "babel-jest", // Use Babel to transpile ESM to CommonJS
    },
    moduleNameMapper: {
      "^(\\.{1,2}/.*)\\.js$": "$1", // Map .js files to their ESM equivalents
    },
    setupFiles: ["dotenv/config"], // Load environment variables
    setupFilesAfterEnv: ["./jest.setup.js"], // Run jest.setup.js after the test environment is set up
    extensionsToTreatAsEsm: [], // Do not explicitly include `.js`
    globals: {
      "ts-jest": {
        useESM: true, // Enable ESM support for TypeScript (if applicable)
      },
    },
    verbose: true,
  };