module.exports = {
  transform: {
    "^.+\\.jsx?$": "babel-jest"
  },
  moduleFileExtensions: ["js", "json", "jsx", "ts", "tsx", "node"],
  moduleDirectories: ["node_modules", "web/js"],
  moduleNameMapper: {
  },
  testEnvironment: "jsdom"
};