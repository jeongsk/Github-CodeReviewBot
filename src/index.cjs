const core = require("@actions/core");
const { run } = require("@probot/adapter-github-actions");
const app = require("./app");

run(app).catch((error) => {
  core.setFailed(`💥 Release drafter failed with error: ${error.message}`);
});
