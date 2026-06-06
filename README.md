# Space Marine: Servo Skull Tracker

## Overview
This project is a lightweight, responsive web application designed to help players track their progress collecting Servo Skulls in the game *Warhammer 40,000: Space Marine*. It provides a clean checklist broken down by chapter, detailing the location, ID, and audio log name for each collectible.

## Features
- **Persistent Tracking:** Uses the browser's `localStorage` to save your progress automatically. You can close the tab and return later without losing your checkmarks.
- **Offline Capable:** Implements a Service Worker (`service-worker.js`) and a Web Manifest, making it a Progressive Web App (PWA). Once loaded, it can work entirely offline.
- **Global Progress Bar:** Visual indicator of total completion across all chapters.
- **Responsive Design:** Dark-themed UI that is easy on the eyes and works seamlessly on both desktop and mobile devices.

## Reflection
This project served as an excellent exercise in building a functional, zero-dependency web application. By avoiding heavy frontend frameworks, it highlights the power and capabilities of modern vanilla JavaScript, CSS, and HTML5.

**Key Takeaways:**
- **Data Structure:** Refactoring the initial raw string checklist into a structured object array (with specific `id`, `audio_log`, and `location` keys) drastically improved the readability of both the code and the final UI.
- **State Management:** Managing state with `localStorage` required careful structuring of the save keys (e.g., `ch{X}-item{Y}`) to ensure that user data remains consistent across sessions. 
- **Progressive Web App Mechanics:** Integrating the Service Worker reinforced how caching strategies (like Cache-First) can significantly improve user experience. It ensures the tracker is accessible even if the user drops their internet connection while playing the game.

## Tech Stack
- **HTML5:** Semantic structure, native `<details>`/`<summary>` accordions, and PWA manifest linking.
- **CSS3:** Custom styling with Flexbox and native `<progress>` element customization.
- **Vanilla JavaScript:** DOM manipulation, event handling, JSON data handling, and state persistence.
- **Service Worker API:** For resource caching and offline support.

## How to Run
1. Clone the repository or download the source files.
2. Open `index.html` in any modern web browser.
3. *(Optional)* To fully test the Service Worker and PWA installation features, serve the directory using a local web server. For example:
   ```bash
   python -m http.server 8000
   ```
   or 
   ```bash
   npx serve
   ```

## Future Improvements
- Add image thumbnails for each collectible location.
- Implement "Expand All" and "Collapse All" functionality for chapter dropdowns.
- Add an Export/Import feature to allow users to back up their save data or move it to another device.