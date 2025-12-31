# Development Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Extension

#### Development Build (with watch mode)
```bash
npm run dev
```

#### Production Build
```bash
npm run build
```

### 3. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist` folder from this project
5. The extension should now appear in your extensions list

### 4. Test the Extension

1. Navigate to [chatgpt.com](https://chatgpt.com)
2. The PromptLayer toolbar should appear at the top of the page
3. Click the settings icon (⚙️) to configure your OpenAI API key

## Project Structure

```
browser-extension-PromptLayer/
├── src/                          # Source code
│   ├── content/                  # Content scripts (injected into ChatGPT)
│   │   ├── index.ts             # Main content script entry
│   │   └── injectToolbar.ts     # Toolbar injection logic
│   ├── services/                 # Business logic services
│   │   ├── storage.ts           # Chrome storage wrapper
│   │   ├── openaiClient.ts      # OpenAI API client
│   │   ├── promptEnhancer.ts    # Prompt enhancement logic
│   │   └── roleBlueprints.ts    # Role templates
│   ├── ui/                       # UI components
│   │   ├── toolbar.html         # Toolbar HTML
│   │   ├── toolbar.css          # Toolbar styles
│   │   └── toolbar.ts           # Toolbar behavior
│   ├── popup/                    # Extension popup
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── index.ts
│   ├── background/               # Background service worker
│   │   └── index.ts
│   ├── types/                    # TypeScript type definitions
│   │   └── index.ts
│   └── utils/                    # Utility functions
│       └── helpers.ts
├── public/                       # Static assets
│   ├── manifest.json            # Extension manifest (MV3)
│   └── icons/                   # Extension icons
├── dist/                         # Build output (generated)
├── package.json                  # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── webpack.config.js            # Webpack build configuration
└── README.md                    # Main documentation
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Build in development mode with watch |
| `npm run build` | Build for production |
| `npm run clean` | Remove dist folder |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors |
| `npm run format` | Format code with Prettier |
| `npm test` | Run tests |
| `npm run type-check` | Check TypeScript types |

## Development Workflow

### Making Changes

1. **Edit source files** in `src/`
2. **Run dev build**: `npm run dev`
3. **Reload extension** in Chrome:
   - Go to `chrome://extensions/`
   - Click the reload icon on PromptLayer extension
4. **Refresh ChatGPT page** to see changes

### Adding New Features

1. Create new files in appropriate directories
2. Update imports in related files
3. Test locally before committing
4. Update documentation if needed

### Testing

1. **Manual Testing**:
   - Load extension in Chrome
   - Navigate to ChatGPT
   - Test all features manually

2. **Unit Tests** (TODO):
   ```bash
   npm test
   ```

## Debugging

### View Logs

#### Content Script Logs
1. Open ChatGPT page
2. Right-click → Inspect
3. Open Console tab
4. Look for `[PromptLayer]` messages

#### Background Script Logs
1. Go to `chrome://extensions/`
2. Find PromptLayer
3. Click "service worker" link
4. View console in opened DevTools

#### Popup Logs
1. Right-click extension icon
2. Select "Inspect popup"
3. View console

### Common Issues

#### Extension Not Loading
- Check `dist/manifest.json` exists
- Ensure all required files are in `dist/`
- Check console for errors

#### Toolbar Not Appearing
- Verify you're on chatgpt.com or chat.openai.com
- Check console for injection errors
- Try refreshing the page

#### API Errors
- Verify API key is configured
- Check API key is valid
- Ensure you have OpenAI credits

## Building for Production

1. **Clean build**:
   ```bash
   npm run clean
   ```

2. **Production build**:
   ```bash
   npm run build
   ```

3. **Test the build**:
   - Load `dist/` folder in Chrome
   - Test all features thoroughly

4. **Create distribution package**:
   ```bash
   cd dist
   zip -r ../promptlayer-v1.0.0.zip .
   ```

## Code Style

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint with Prettier
- **Formatting**: Prettier with 2-space indentation
- **Imports**: Use absolute paths with `@` aliases

## Git Workflow

1. Create feature branch from `main`
2. Make changes and commit
3. Run linting and type-check
4. Create pull request
5. Merge after review

## Next Steps

See [TASKS.md](TASKS.md) for the full development roadmap and pending tasks.

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/browser-extension-PromptLayer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/browser-extension-PromptLayer/discussions)
