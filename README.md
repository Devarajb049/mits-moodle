# Moodle Course Viewer

A modern, responsive web application to browse courses and materials from the MITS E-Learning Portal.

## Features
- **Login Support**: Log in with credentials to view "My Courses".
  - **Pre-filled Credentials**: Uses `25695A0514` / `Deva@514` by default for demonstration.
- **Browse Categories & Courses**: Navigate through the public course hierarchy.
- **View Materials**: Access files and resources for each course.
- **Offline Handling**: Graceful error handling when the server is unreachable.
- **Download Support**: Direct download links for course materials.
- **Modern UI**: Clean, dark-themed interface with smooth animations.

## Setup & Run

1. **Install Dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Start the Development Server**:
   ```bash
   npm run dev
   ```

3. **Open in Browser**:
   Visit the URL shown in the terminal (usually `http://localhost:5173`).

## Note
This application acts as a proxy to `http://20.0.121.215/`. ensure you have access to this network resource.
If the target server is offline, the application will display an offline message as requested.

### Credentials
For testing:
- **Username**: 25695A0514
- **Password**: Deva@514
