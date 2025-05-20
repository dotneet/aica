# Developer's Guide

## GitHub Actions Development Guide

To develop with GitHub Actions, you need to have a good understanding of the related environment variables.
The following package sources and official documentation are helpful references.

- [@actions/core](https://github.com/actions/toolkit/tree/main/packages/core)
- [@actions/github](https://github.com/actions/toolkit/blob/main/packages/github)
- [@actions/github/context.ts](https://github.com/actions/toolkit/blob/main/packages/github/src/context.ts)
- [Official Document about environment variables](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables)

### prepare paylaod and .env

To run `actions-runner.ts` locally, prepare a `payload.json` file and an `.env` file.

payload.json example

```json
{
  "repository": {
    "owner": {
      "login": "dotneet"
    },
    "full_name": "dotneet/aica",
    "name": "aica"
  },
  "pull_request": {
    "number": 2
  },
  "issue": {
    "number": 2
  }
}
```

.env example

```
GITHUB_TOKEN=your_github_token

CI=true
GITHUB_ACTIONS=true
GITHUB_BASE_REF=main
GITHUB_API_URL=https://api.github.com
GITHUB_SERVER_URL=https://github.com
GITHUB_EVENT_NAME=pull_request
GITHUB_REPOSITORY=dotneet/aica
GITHUB_REPOSITORY_OWNER=dotneet
GITHUB_EVENT_PATH=path/to/payload.json
```
