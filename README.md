<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/54facbc9-49d4-4639-a950-4f774998bb02

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key.
3. For video generation, ensure you have a paid Google Cloud project and set `VERTEX_PROJECT_ID` and `VERTEX_PROJECT_NUMBER` in [.env.local](.env.local).
4. Run the app:
   `npm run dev`
