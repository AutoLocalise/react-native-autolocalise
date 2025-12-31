module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-community|react-native-web|react-clone-referenced-element)/)",
  ],
  setupFilesAfterEnv: ["@testing-library/jest-dom"],
  testMatch: ["**/__tests__/**/*.[jt]sx", "**/__tests__/**/*.[jt]s", "**/?(*.)+(spec|test).[tj]sx", "**/?(*.)+(spec|test).[tj]s"],
  testPathIgnorePatterns: ["/dist/", "/node_modules/", "/\\.yalc/", "\\.d\\.ts$"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
