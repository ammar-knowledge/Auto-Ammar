import { Application, Context } from 'probot';

const commitMessageRegex = /^(fix|feat|docs|style|refactor|test|chore|perf|ci|build|bump|release|merge|revert|wip|work in progress): .*$/;
const pullRequestTitleRegex = /^(fix|feat|docs|style|refactor|test|chore|perf|ci|build|bump|release|merge|revert|wip|work in progress): .*$/;
const branchTitleRegex = /^(fix|feat|docs|style|refactor|test|chore|perf|ci|build|bump|release|merge|revert|wip|work in progress)\/.*$/;

const app = new Application<Context>();

app.on('push', async (context) => {
  const { payload } = context.payload;
  const { ref, commits } = payload;

  if (ref === 'refs/heads/main' || ref === 'refs/heads/master') {
    for (const commit of commits) {
      const { message } = commit;
      if (!commitMessageRegex.test(message)) {
        await context.github.issues.createComment(context.issue({ body: 'Commit message does not match regex pattern.' }));
      }
    }
  }
});

app.on('pull_request.opened', async (context) => {
  const { payload } = context.payload;
  const { title } = payload.pull_request;

  if (!pullRequestTitleRegex.test(title)) {
    await context.github.issues.createComment(context.issue({ body: 'Pull request title does not match regex pattern.' }));
  }

  const { head } = payload.pull_request;
  const { ref } = head;

  if (!branchTitleRegex.test(ref)) {
    await context.github.issues.createComment(context.issue({ body: 'Branch title does not match regex pattern.' }));
  }
});

app.on('pull_request.labeled', async (context) => {
  const { payload } = context.payload;
  const { label } = payload;

  if (label.name === 'approved') {
    await context.github.pulls.merge(context.pullRequest({ merge_method: 'merge' }));
    await context.github.issues.createComment(context.issue({ body: 'Pull request merged.' }));
  }
});

app.on('issues.opened', async (context) => {
  const { payload } = context.payload;
  const { title } = payload;

  if (title === 'Release new version') {
    const { name } = context.repo();
    const { version } = await context.github.packages.getLatestPackageVersion({
      owner: context.repo().owner,
      repo: context.repo().repo,
      package_type: 'npm',
    });

    await context.github.issues.createComment(context.issue({ body: `The latest version is ${version}.` }));
  } else if (title === 'Deploy') {
    const { name } = context.repo();
    const { html_url } = await context.github.repos.createDeployment({
      owner: context.repo().owner,
      repo: context.repo().repo,
      ref: 'main',
      auto_merge: true,
      required_contexts: [],
    });

    await context.github.issues.createComment(context.issue({ body: `Deployment created: ${html_url}` }));
  }
});

export default app;