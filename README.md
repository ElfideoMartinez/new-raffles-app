This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## GitHub sign-in for this repository

Use a separate GitHub CLI profile for `ElfideoMartinez/new-raffles-app` so a default login for another repository cannot cause a 403 on push. Run these commands in a subshell or a dedicated terminal; do not change the global Git credential helper.

```bash
export GH_CONFIG_DIR="$HOME/.config/gh/repo-profiles/elfideomartinez-new-raffles-app"
unset GH_TOKEN GITHUB_TOKEN # Do not let an inherited token override this profile.
gh api user --jq .login
gh repo view ElfideoMartinez/new-raffles-app --json viewerPermission --jq .viewerPermission
```

For this setup, expect `ElfideoMartinez` and `ADMIN`. `WRITE` or `MAINTAIN` also allows a collaborator to push. If the profile is missing or expired, create it and run:

```bash
mkdir -p -m 700 "$GH_CONFIG_DIR"
gh auth login --hostname github.com --git-protocol https --web --skip-ssh-key
```

Complete the device prompt in GitHub while signed in to the intended account, wait for the CLI to finish, then repeat the identity and permission checks. A browser success page alone does not verify which CLI profile was authorized. If asked whether to authenticate Git globally with these credentials, decline; use the per-command helper below instead.

Push the reviewed feature branch from its clean worktree. With the same `GH_CONFIG_DIR` still exported:

```bash
git -c credential.https://github.com.helper= \
    -c 'credential.https://github.com.helper=!gh auth git-credential' \
    push -u origin HEAD
```

The empty helper entry clears the inherited GitHub helper for this command only. Use this same profile with `gh pr` commands. After pushing, compare the branch SHA on GitHub with `git rev-parse HEAD`. Do not push a dirty or divergent local `main`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
