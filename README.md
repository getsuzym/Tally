# Tally — Bill Splitter

Tally is a lightweight static front-end app to split bills fairly between participants. It's built with plain HTML, CSS, and JavaScript (Vue 3) and can be hosted on GitHub Pages.

## Features

- Add and remove participants (`people`)
- Add, remove and share dishes among participants (`dishes`)
- Calculate totals by even split or by dishes (tax & tip applied)
- Receipt OCR integration (uses Tesseract.js via CDN) to suggest dish names

## Development

Prerequisites: Node.js and npm (for running tests). The app itself is static and doesn't require a server.

Install dev dependencies (Jest is used for unit tests):

```powershell
npm install
```

Run tests:

```powershell
npm test
```

Run tests in watch mode:

```powershell
npm run test:watch
```

## Project Structure

- `index.html` — main static page
- `css/styles.css` — styling
- `js/app.js` — application logic (Vue 3)
- `js/app.test.js` — Jest test suite
- `.github/workflows/deploy-pages.yml` — GitHub Actions workflow to deploy to GitHub Pages

## Deployment (GitHub Pages)

This repository includes a GitHub Actions workflow that publishes the repository root to the `gh-pages` branch using `peaceiris/actions-gh-pages@v3` on every push to `main`.

Quick steps to deploy:

1. Push your code to the `main` branch:

```powershell
git add .
git commit -m "Prepare site for deployment"
git push origin main
```

2. The workflow will run and publish the site to the `gh-pages` branch. After a successful run, enable GitHub Pages in the repository Settings → Pages (if it isn't already) and select the `gh-pages` branch as the source.

3. Your site will be available at:

```
https://<your-username>.github.io/<repo>/
```

If you prefer Pages to serve from `main` root, you can change the workflow or set Pages source manually in repository settings.

## Notes

- OCR: `Tesseract.js` is loaded from CDN in `index.html`. For accurate OCR in production you may want to run server-side OCR or improve image preprocessing.
- This is a static front-end application; if you later add server-side features (authentication, persistence), consider hosting platforms like Vercel, Netlify, or Heroku.

## License

This project is available under the MIT license (add LICENSE file if needed).

---

If you want, I can also:

- Automatically enable GitHub Pages to serve from `gh-pages` using the GitHub API (requires a token), or
- Watch the Actions run and report status and the final Pages URL.
