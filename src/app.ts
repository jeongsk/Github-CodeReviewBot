import { Context, Probot } from "probot";
import Chatbot, { ChatbotConfig } from "./chatbot";

const MAX_PATCH_COUNT = process.env.MAX_PATCH_LENGTH
  ? +process.env.MAX_PATCH_LENGTH
  : Infinity;

interface RepoContext {
  owner: string;
  repo: string;
}

export default (app: Probot) => {
  const getEnvironmentConfig = (): ChatbotConfig => ({
    apiKey: process.env.LAAS_API_KEY || "",
    project: process.env.LAAS_PROJECT || "WANTED_NBD",
    hash:
      process.env.LAAS_HASH ||
      "d12ebc01ecb9003d05eed343589cb2f92a6e6eddccf8890281f32b1e9f327fc1",
    baseURL:
      process.env.LAAS_BASE_URL || "https://api-laas.wanted.co.kr/api/preset/",
  });

  const loadChat = async (context: Context): Promise<Chatbot | null> => {
    const config = getEnvironmentConfig();
    if (config.apiKey) {
      return new Chatbot(config);
    }

    const repo = context.repo();

    try {
      const apiKey = await getApiKey(context, repo);
      return apiKey ? new Chatbot({ ...config, apiKey }) : null;
    } catch (error) {
      await createErrorComment(context, repo);
      return null;
    }
  };

  const getApiKey = async (
    context: Context,
    repo: RepoContext
  ): Promise<string | null> => {
    const requestParams = {
      owner: repo.owner,
      repo: repo.repo,
      name: "LAAS_API_KEY",
    };

    const [variableResponse, secretResponse] = await Promise.all([
      context.octokit.request(
        "GET /repos/{owner}/{repo}/actions/variables/{name}",
        requestParams
      ),
      context.octokit.request(
        "GET /repos/{owner}/{repo}/actions/secrets/{name}",
        requestParams
      ),
    ]);

    const variableData = variableResponse.data as { value?: string };
    const secretData = secretResponse.data as { value?: string };

    return variableData?.value || secretData?.value || null;
  };

  const createErrorComment = async (
    context: Context,
    repo: RepoContext
  ): Promise<void> => {
    try {
      await context.octokit.issues.createComment({
        ...repo,
        issue_number: context.pullRequest().pull_number,
        body: `현재 이 리포지토리의 Variables/Secrets 설정에 LAAS_API_KEY 값이 누락되어 있습니다. 해당 값들을 설정해주시면 감사하겠습니다.`,
      });
    } catch (error) {
      console.error("Failed to create error comment:", error);
    }
  };

  const isValidPullRequest = (pullRequest: any): boolean => {
    return pullRequest.state !== "closed" && !pullRequest.locked;
  };

  const hasTargetLabel = (
    pullRequest: any,
    targetLabel: string | undefined
  ): boolean => {
    if (!targetLabel) return true;
    return pullRequest.labels.some((label: any) => label.name === targetLabel);
  };

  const getChangedFiles = async (
    context: Context,
    repo: RepoContext,
    pullRequest: any
  ): Promise<any[]> => {
    const { data } = await context.octokit.repos.compareCommits({
      ...repo,
      base: pullRequest.base.sha,
      head: pullRequest.head.sha,
    });

    let { files, commits } = data;

    if (
      (context.payload as any).action === "synchronize" &&
      commits.length >= 2
    ) {
      files = await getFilesFromLastCommit(context, repo, commits);
    }

    const ignoreList = (process.env.IGNORE || "").split("\n").filter(Boolean);
    return (
      files?.filter((file: any) => !ignoreList.includes(file.filename)) || []
    );
  };

  const getFilesFromLastCommit = async (
    context: Context,
    repo: RepoContext,
    commits: any[]
  ): Promise<any[]> => {
    const { data } = await context.octokit.repos.compareCommits({
      ...repo,
      base: commits[commits.length - 2].sha,
      head: commits[commits.length - 1].sha,
    });
    return data.files || [];
  };

  const reviewFile = async (
    context: Context,
    chat: Chatbot,
    file: any,
    repo: RepoContext,
    pullRequest: any,
    commitSha: string
  ): Promise<void> => {
    const patch = file.patch || "";
    if (file.status !== "modified" && file.status !== "added") return;
    if (!patch || patch.length > MAX_PATCH_COUNT) {
      console.log(`${file.filename} skipped caused by its diff is too large`);
      return;
    }

    try {
      const res = await chat.codeReview(patch);
      if (res) {
        await context.octokit.pulls.createReviewComment({
          ...repo,
          pull_number: pullRequest.number,
          commit_id: commitSha,
          path: file.filename,
          body: res,
          position: patch.split("\n").length - 1,
        });
      }
    } catch (e) {
      console.error(`review ${file.filename} failed`, e);
    }
  };

  app.on(
    ["pull_request.opened", "pull_request.synchronize"],
    async (context) => {
      console.time("gpt cost");
      const repo = context.repo();
      const chat = await loadChat(context);

      if (!chat) {
        console.log("Chat initialization failed");
        return "no chat";
      }

      const pullRequest = context.payload.pull_request;

      if (!isValidPullRequest(pullRequest)) {
        console.log("Invalid event payload");
        return "invalid event payload";
      }

      if (!hasTargetLabel(pullRequest, process.env.TARGET_LABEL)) {
        console.log("No target label attached");
        return "no target label attached";
      }

      const changedFiles = await getChangedFiles(context, repo, pullRequest);

      if (!changedFiles.length) {
        console.log("No change found");
        return "no change";
      }

      const lastCommitSha = context.payload.pull_request.head.sha;

      await Promise.all(
        changedFiles.map((file) =>
          reviewFile(context, chat, file, repo, pullRequest, lastCommitSha)
        )
      );

      console.timeEnd("gpt cost");
      console.info("Successfully reviewed", pullRequest.html_url);

      return "success";
    }
  );
};
