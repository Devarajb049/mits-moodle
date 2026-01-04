# Hosting MITS Moodle on Render

This project is now configured for easy deployment on [Render](https://render.com).

## Deployment Steps

1.  **Push to GitHub**:
    *   Initialize a git repository: `git init`
    *   Add files: `git add .`
    *   Commit: `git commit -m "Configure for Render"`
    *   Push to your GitHub repository.

2.  **Create a New Web Service on Render**:
    *   Go to your Render Dashboard and click **"New"** > **"Web Service"**.
    *   Connect your GitHub repository.
    *   Render will automatically detect the `render.yaml` file (Blueprint) or you can set these manually:
        *   **Runtime**: `Node`
        *   **Build Command**: `npm install && npm run build`
        *   **Start Command**: `npm start`
    *   Add Environment Variables (if not using `render.yaml`):
        *   `NODE_VERSION`: `18`
        *   `PORT`: `3000`

3.  **Access your App**:
    *   Once the build is finished, Render will provide a URL (e.g., `mits-moodle.onrender.com`).
    *   The app is fully responsive and will work on all devices (iOS, Android, Windows, Mac).

## Features Added

*   **Express Proxy**: Handles the Moodle server connection (bypassing CORS issues).
*   **Production Server**: Optimized for serving the React frontend.
*   **Premium UI**: Smooth animations, glassmorphism, and responsive sidebar.
*   **Persistence**: Remembers your login and current course across refreshes.
*   **Aesthetics**: Sleek dark mode with Inter typography and micro-animations.
