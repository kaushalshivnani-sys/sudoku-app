# Sudoku — standalone Android app

This is a standalone, ad-free Sudoku app project with 6×6 (2×3 boxes) and 9×9 (3×3 boxes), Easy/Medium/Hard, pencil notes, hints, undo, erase, conflict highlighting, sound, vibration, pause, timer, and local autosave.

## Build an APK without installing Android Studio locally
1. Create a new GitHub repository named `sudoku-app`.
2. Upload the contents of this folder to the repository (including the `.github` folder).
3. Open the repository's **Actions** tab and run **Build Sudoku APK** (or push to `main`).
4. Open the completed workflow run and download the `sudoku-debug-apk` artifact.
5. Extract `app-debug.apk` from the downloaded artifact and install it on your Android phone. If prompted, allow your browser/file manager to install unknown apps.

The workflow builds a debug APK using GitHub-hosted Android build tools. This initial build is unsigned for Play Store release but can be installed manually for testing.

## Local development
`npm install`, `npm run build`, `npx cap add android`, `npx cap sync android`.
