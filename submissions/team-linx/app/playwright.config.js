const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  webServer: {
    command: "npx --yes serve . -l 3456",
    url: "http://localhost:3456/index.html",
    reuseExistingServer: true,
  },
});
