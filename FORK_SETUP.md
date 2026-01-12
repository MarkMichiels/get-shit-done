# Fork Setup for get-shit-done

## Step 1: Fork on GitHub

1. Go to: https://github.com/glittercowboy/get-shit-done
2. Click "Fork" (top right)
3. Choose your account (MarkMichiels)
4. Wait for the fork to complete

## Step 2: Configure Remote

After forking, configure the remote:

```bash
cd /home/mark/Repositories/get-shit-done

# Check current remote
git remote -v

# Add your fork as 'fork' remote (or replace 'origin')
git remote add fork https://github.com/MarkMichiels/get-shit-done.git

# Or replace origin if you only want to work with your fork:
# git remote set-url origin https://github.com/MarkMichiels/get-shit-done.git

# Check new remote
git remote -v
```

## Step 3: Create Feature Branch

```bash
# Create new branch for create-issue feature
git checkout -b feature/create-issue-command

# Check status
git status
```

## Step 4: Commit and Push

```bash
# Add new files
git add commands/gsd/create-issue.md
git add README.md

# Commit
git commit -m "feat: add /gsd:create-issue command for creating issues in ISSUES.md"

# Push to your fork
git push -u fork feature/create-issue-command
# Or if you changed origin:
# git push -u origin feature/create-issue-command
```

## Step 5: Create Pull Request (Optional)

1. Go to: https://github.com/MarkMichiels/get-shit-done
2. Click "Compare & pull request"
3. Describe the feature
4. Submit PR to upstream (glittercowboy/get-shit-done)

## Step 6: Keep Upstream in Sync

To get updates from upstream:

```bash
# Add upstream (if you haven't already)
git remote add upstream https://github.com/glittercowboy/get-shit-done.git

# Fetch updates
git fetch upstream

# Merge upstream/main into your branch
git checkout main
git merge upstream/main

# Push to your fork
git push fork main
```

## Workflow for Future Features

```bash
# 1. Update from upstream
git checkout main
git fetch upstream
git merge upstream/main

# 2. Create new feature branch
git checkout -b feature/your-feature-name

# 3. Work on feature
# ... edit files ...

# 4. Commit and push
git add .
git commit -m "feat: description"
git push -u fork feature/your-feature-name

# 5. Create PR on GitHub
```
