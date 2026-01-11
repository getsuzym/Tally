# Tally — Bill Splitter

This is a static front-end app (HTML/CSS/JS) that can be hosted on GitHub Pages.

Quick deployment steps:

1. Ensure you have a GitHub repository and the `main` branch.
2. Commit and push this project to the repository root.

Commands to run from the project root (Windows PowerShell):

```powershell
git add .
git commit -m "Add GitHub Pages workflow and README for deployment"
git push origin main
```

3. The included GitHub Actions workflow `.github/workflows/deploy-pages.yml` will deploy the site to GitHub Pages on every push to `main`.

4. After the workflow completes, your site will be available at:

```
https://<your-username>.github.io/<repo>/
```

If you prefer manual Pages setup, go to the repository Settings → Pages and set the source to `gh-pages` branch or `main` branch `/ (root)` as desired.
