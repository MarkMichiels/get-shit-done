# Fork Setup voor get-shit-done

## Stap 1: Fork op GitHub

1. Ga naar: https://github.com/glittercowboy/get-shit-done
2. Klik op "Fork" (rechtsboven)
3. Kies je account (MarkMichiels)
4. Wacht tot de fork klaar is

## Stap 2: Remote aanpassen

Na het forken, pas de remote aan:

```bash
cd /home/mark/Repositories/get-shit-done

# Check huidige remote
git remote -v

# Voeg je fork toe als 'fork' remote (of vervang 'origin')
git remote add fork https://github.com/MarkMichiels/get-shit-done.git

# Of vervang origin als je alleen met je fork wilt werken:
# git remote set-url origin https://github.com/MarkMichiels/get-shit-done.git

# Check nieuwe remote
git remote -v
```

## Stap 3: Branch maken voor feature

```bash
# Maak nieuwe branch voor create-issue feature
git checkout -b feature/create-issue-command

# Check status
git status
```

## Stap 4: Committen en pushen

```bash
# Voeg nieuwe file toe
git add commands/gsd/create-issue.md
git add README.md

# Commit
git commit -m "feat: add /gsd:create-issue command for creating issues in ISSUES.md"

# Push naar je fork
git push -u fork feature/create-issue-command
# Of als je origin hebt aangepast:
# git push -u origin feature/create-issue-command
```

## Stap 5: Pull Request maken (optioneel)

1. Ga naar: https://github.com/MarkMichiels/get-shit-done
2. Klik op "Compare & pull request"
3. Beschrijf de feature
4. Submit PR naar upstream (glittercowboy/get-shit-done)

## Stap 6: Upstream sync houden

Om updates van upstream te krijgen:

```bash
# Voeg upstream toe (als je dat nog niet hebt)
git remote add upstream https://github.com/glittercowboy/get-shit-done.git

# Haal updates op
git fetch upstream

# Merge upstream/main in je branch
git checkout main
git merge upstream/main

# Push naar je fork
git push fork main
```

## Workflow voor toekomstige features

```bash
# 1. Update van upstream
git checkout main
git fetch upstream
git merge upstream/main

# 2. Maak nieuwe feature branch
git checkout -b feature/your-feature-name

# 3. Werk aan feature
# ... edit files ...

# 4. Commit en push
git add .
git commit -m "feat: description"
git push -u fork feature/your-feature-name

# 5. PR maken op GitHub
```
