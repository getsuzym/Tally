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
Tally is a single-page static web application for fairly splitting bills among participants.

This page demonstrates the core user-facing features:

- Add and remove participants.
- Add dishes, assign sharers for each dish, and remove dishes.
- Calculate per-person totals using an even split or by dishes, with tax and tip applied.
- Suggest dish names via client-side OCR (Tesseract.js) when uploading a receipt image.

The app is a client-side Vue 3 application and does not require a server to run.

Visit `index.html` to interact with the app in your browser.

