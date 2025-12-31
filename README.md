# PromptLayer 🚀

**In-context Prompt Intelligence Layer for ChatGPT**

Transform rough ideas into structured, professional prompts directly inside ChatGPT — no backend required, just your OpenAI API key.

---

## 📖 Overview

PromptLayer is a Chrome browser extension that injects a powerful prompt intelligence toolbar directly into ChatGPT. It helps you create, enhance, manage, and reuse high-quality prompts using AI-powered enhancement and role-based templates.

### ✨ Key Features

- **🎯 In-Context Integration** - Works seamlessly inside ChatGPT, no context switching
- **🤖 AI-Powered Enhancement** - Transform rough ideas into structured, deterministic prompts
- **👥 Role-Based Blueprints** - Pre-configured templates for Engineers, Writers, SEO/AEO, and PMs
- **📚 Prompt Library** - Save, version, and reuse your best prompts locally
- **🔐 Privacy First** - BYOK (Bring Your Own Key), no cloud servers, all data stays local
- **♿ Accessible** - Full keyboard navigation and screen reader support
- **🎨 Smart UI** - Auto-theme matching (light/dark), collapsible toolbar, minimal interference

---

## 🎯 Use Cases

- **Software Engineers** - Generate precise technical documentation, code review prompts, and debug requests
- **SEO/AEO/GEO Practitioners** - Create consistent content optimization prompts
- **Content Writers** - Structure creative briefs with specific tone and style requirements
- **Product Managers** - Draft user stories, feature specs, and stakeholder communications
- **Power Users** - Anyone who wants consistent, reusable, high-quality ChatGPT interactions

---

## 🚀 Getting Started

### Prerequisites

- Chrome browser (or Chromium-based: Edge, Brave, Arc)
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
- ChatGPT access (Free or Plus account)

### Installation

#### From Chrome Web Store (Recommended)

1. Visit [PromptLayer on Chrome Web Store](#) _(Coming soon)_
2. Click "Add to Chrome"
3. Pin the extension for easy access

#### Manual Installation (Development)

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/browser-extension-PromptLayer.git
   cd browser-extension-PromptLayer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist` folder

### Initial Setup

1. Navigate to [chatgpt.com](https://chatgpt.com)
2. The PromptLayer toolbar will appear at the top
3. Click the "⚙️ Settings" icon
4. Enter your OpenAI API key
5. Select your preferred model (default: `gpt-4o-mini`)
6. Start enhancing prompts!

---

## 💡 How to Use

### Basic Workflow

1. **Select a Role** - Choose from Engineer, Writer, SEO, or PM blueprints
2. **Enter Your Prompt** - Type your rough idea or paste existing text
3. **Enhance** - Click "✨ Enhance" (or press `Ctrl/Cmd + E`)
4. **Review** - See the structured, improved prompt with clear sections
5. **Use or Save** - Insert into ChatGPT or save to your library

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + E` | Enhance current prompt |
| `Ctrl/Cmd + S` | Save prompt to library |
| `Ctrl/Cmd + L` | Toggle prompt library |
| `Escape` | Close dialogs/library |

### Role Blueprints

#### 🛠️ Engineer
- Focus: Technical precision, structured output
- Use for: Code documentation, architecture decisions, debugging

#### ✍️ Writer
- Focus: Tone, style, audience awareness
- Use for: Blog posts, marketing copy, creative content

#### 📊 SEO/AEO/GEO
- Focus: Search optimization, keyword integration, EEAT
- Use for: Content briefs, meta descriptions, topical authority

#### 📋 Product Manager
- Focus: Clarity, stakeholder alignment, action items
- Use for: User stories, PRDs, feature specs

---

## 📚 Prompt Library

### Features

- **Search & Filter** - Find prompts by title, role, or tags
- **Version Control** - Track changes, rollback to previous versions
- **One-Click Insert** - Instantly use saved prompts in ChatGPT
- **Import/Export** - Backup your prompts as JSON
- **Metadata** - Track usage count, last used, creation date

### Organization Tips

- Use **tags** for project categorization (`#product-launch`, `#docs`, `#marketing`)
- Create **templates** for recurring tasks
- **Version** prompts as they evolve with your needs
- **Export** weekly for backup safety

---

## 🔐 Privacy & Security

PromptLayer is designed with privacy as a core principle:

- ✅ **No Backend** - Zero external servers (except OpenAI API)
- ✅ **Local Storage** - All prompts stored in your browser only
- ✅ **Encrypted Keys** - API keys encrypted in Chrome storage
- ✅ **No Telemetry** - We don't track, collect, or sell your data
- ✅ **Open Source** - Audit the code yourself

### API Key Safety

- Keys are stored encrypted locally
- Never logged or transmitted anywhere except OpenAI
- You can clear/reset your key anytime
- Rate limiting prevents accidental overuse

---

## 🛠️ Development

### Tech Stack

- **Manifest V3** - Modern Chrome extension architecture
- **TypeScript** - Type-safe development
- **React** _(Optional)_ - For complex UI components
- **Tailwind CSS** - Utility-first styling
- **OpenAI API** - GPT-4o-mini for enhancements

### Project Structure

```
browser-extension-PromptLayer/
├── extension/
│   ├── manifest.json          # MV3 manifest
│   ├── content/               # Content scripts
│   │   └── injectToolbar.js
│   ├── ui/                    # UI components
│   │   ├── toolbar.html
│   │   ├── toolbar.css
│   │   └── toolbar.js
│   ├── services/              # Business logic
│   │   ├── openaiClient.ts
│   │   ├── promptEnhancer.ts
│   │   ├── roleBlueprints.ts
│   │   └── storage.ts
│   └── assets/                # Icons, images
├── src/                       # Source TypeScript
├── dist/                      # Built extension
├── tests/                     # Unit & integration tests
├── PRD.md                     # Product requirements
├── TASKS.md                   # Development roadmap
└── README.md                  # You are here
```

### Build Commands

```bash
# Install dependencies
npm install

# Development build (with watch)
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run type-check
```

### Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [TASKS.md](TASKS.md) for development priorities.

---

## 📋 Roadmap

### ✅ MVP (Current Focus)

- [x] ChatGPT page injection
- [x] Prompt enhancement engine
- [x] Role-based blueprints
- [x] Local prompt library
- [x] Import/export functionality

### 🚧 Post-MVP

- [ ] Custom role creation wizard
- [ ] Prompt quality scoring
- [ ] Side-by-side diff view
- [ ] Cloud sync (optional)
- [ ] Team collaboration features
- [ ] Multi-language support
- [ ] Integration with Claude, Gemini

See [TASKS.md](TASKS.md) for detailed timeline.

---

## 🐛 Troubleshooting

### Extension not appearing?

- Refresh the ChatGPT page (`Ctrl/Cmd + R`)
- Check if extension is enabled in `chrome://extensions/`
- Try disabling other ChatGPT extensions temporarily

### Enhancement not working?

- Verify your API key is correct (Settings → API Key)
- Check your OpenAI account has available credits
- Look for error messages in the toolbar notification area

### Prompts not saving?

- Check Chrome storage quota (unlikely to hit limit)
- Try exporting prompts and reimporting
- Clear browser cache and reload extension

### UI looks broken?

- Ensure you're using a supported browser (Chrome 88+)
- Disable other ChatGPT UI-modifying extensions
- Reset toolbar position (Settings → Reset UI)

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- OpenAI for the GPT API
- The ChatGPT community for inspiration
- All contributors and beta testers

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/browser-extension-PromptLayer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/browser-extension-PromptLayer/discussions)
- **Email**: support@promptlayer.dev _(Coming soon)_

---

**Made with ❤️ by developers who love great prompts**

Star ⭐ this repo if you find it useful!
