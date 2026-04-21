import { githubBlob, githubIssue, githubPr, githubPrChanges, githubRepo } from './rules/github.ts'

export function github(options: { token?: string | Promise<string | undefined> | undefined } = {}) {
  return {
    [githubRepo.key]: githubRepo({ token: options.token }),
    [githubBlob.key]: githubBlob(),
    [githubIssue.key]: githubIssue({ token: options.token }),
    [githubPrChanges.key]: githubPrChanges(),
    [githubPr.key]: githubPr({ token: options.token }),
  }
}
