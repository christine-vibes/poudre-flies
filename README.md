# Poudre River Fly Report PWA

A Progressive Web App that shows the latest fly fishing recommendations for the Cache La Poudre River, with images of recommended flies. Works offline so you can check recommendations while you're at the river with no signal!

## Features

- 📱 **Add to Home Screen** - Works like a native app on iPhone/Android
- 📴 **Offline Support** - All data and images cached for offline use
- 🔄 **Auto-Updates** - GitHub Action fetches fresh data twice daily
- 🎣 **Fly Images** - See what the recommended flies look like
- 📊 **Current Conditions** - Flow rates and fishing conditions

## Quick Setup (5 minutes)

### Step 1: Create Your GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name it `poudre-flies` (or whatever you like)
3. Make it **Public** (required for free GitHub Pages)
4. Click **Create repository**

### Step 2: Upload These Files

**Option A: Using GitHub's web interface (easiest)**

1. On your new repo page, click **"uploading an existing file"**
2. Drag and drop ALL the files from this folder
3. Make sure to include the `.github` folder (you may need to show hidden files)
4. Click **Commit changes**

**Option B: Using Git command line**

```bash
cd poudre-flies-pwa
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/poudre-flies.git
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. Go to your repo's **Settings** tab
2. Click **Pages** in the left sidebar
3. Under "Source", select **GitHub Actions**
4. That's it! GitHub will auto-detect the static files

### Step 4: Create a Simple GitHub Pages Workflow

Create a new file at `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Pages
        uses: actions/configure-pages@v4
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      
      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
```

### Step 5: Enable GitHub Actions

1. Go to your repo's **Actions** tab
2. Click **"I understand my workflows, go ahead and enable them"**
3. The update script will run automatically

### Step 6: Access Your PWA

After a few minutes, your app will be live at:
```
https://YOUR_USERNAME.github.io/poudre-flies/
```

## Adding to iPhone Home Screen

1. Open the URL in Safari
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **Add**

Now it works just like a regular app!

## How It Works

1. **GitHub Action** runs twice daily (6 AM and 2 PM Mountain Time)
2. It scrapes St. Peter's Fly Shop website for the latest report
3. It fetches fly images from their product collections
4. Updates are committed to `data.json`
5. GitHub Pages serves the updated content
6. The PWA's service worker caches everything for offline use

## Manual Update

To trigger an update manually:
1. Go to **Actions** tab in your repo
2. Click **"Update Fishing Report"** workflow
3. Click **"Run workflow"**

## Customization

### Change Update Schedule

Edit `.github/workflows/update-report.yml` and modify the cron schedule:
```yaml
schedule:
  - cron: '0 12 * * *'  # 6 AM Mountain (UTC-6)
  - cron: '0 20 * * *'  # 2 PM Mountain
```

### Add More Rivers

The scraper can be extended for other rivers. Edit `update-report.js` to add more river report URLs from St. Peter's.

## Troubleshooting

**Images not loading?**
- The first time you open the app, images are fetched and cached
- You need to be online for the initial load
- Once cached, they'll work offline

**Data not updating?**
- Check the Actions tab for any failed runs
- Make sure GitHub Actions is enabled
- Try running the workflow manually

**PWA not installing?**
- Make sure you're using Safari on iOS (Chrome doesn't support PWA install on iOS)
- The site must be served over HTTPS (GitHub Pages does this automatically)

## Files Included

```
├── index.html          # Main PWA interface
├── manifest.json       # PWA manifest for home screen install
├── sw.js              # Service worker for offline caching
├── data.json          # Fly data (auto-updated)
├── update-report.js   # Node.js scraper script
├── icon-192.png       # App icon (you need to add this)
├── icon-512.png       # Large app icon (you need to add this)
├── .github/
│   └── workflows/
│       └── update-report.yml  # Automated update workflow
└── README.md          # This file
```

## Creating App Icons

You'll need to create two PNG icons:
- `icon-192.png` (192x192 pixels)
- `icon-512.png` (512x512 pixels)

A simple fly fishing icon or the St. Peter's logo works great. You can use any image editor or an online tool like [favicon.io](https://favicon.io/).

---

Data sourced from [St. Peter's Fly Shop](https://stpetes.com/) in Fort Collins, CO.
