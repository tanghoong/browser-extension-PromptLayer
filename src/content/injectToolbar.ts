/**
 * Toolbar Injection Logic
 * Handles injection of PromptLayer toolbar into ChatGPT page
 */

let toolbarInjected = false;
let shadowRoot: ShadowRoot | null = null;

/**
 * Create and inject the toolbar
 */
export async function injectToolbar(): Promise<void> {
  // Prevent duplicate injection
  if (toolbarInjected) {
    console.log('[PromptLayer] Toolbar already injected');
    return;
  }

  try {
    // Create container for shadow DOM
    const container = document.createElement('div');
    container.id = 'promptlayer-container';
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.zIndex = '999999';
    container.style.pointerEvents = 'none'; // Allow clicks to pass through container

    // Create shadow root for CSS isolation
    shadowRoot = container.attachShadow({ mode: 'open' });

    // Load toolbar HTML
    const toolbarHTML = await loadToolbarHTML();
    const toolbarCSS = await loadToolbarCSS();

    // Create wrapper div inside shadow DOM
    const wrapper = document.createElement('div');
    wrapper.style.pointerEvents = 'auto'; // Re-enable pointer events for toolbar content
    wrapper.innerHTML = `
      <style>${toolbarCSS}</style>
      ${toolbarHTML}
    `;

    shadowRoot.appendChild(wrapper);

    // Insert container at the beginning of body
    document.body.insertBefore(container, document.body.firstChild);

    // Initialize toolbar behavior
    await initializeToolbar(shadowRoot);

    toolbarInjected = true;
    console.log('[PromptLayer] Toolbar injected successfully');
  } catch (error) {
    console.error('[PromptLayer] Failed to inject toolbar:', error);
    throw error;
  }
}

/**
 * Load toolbar HTML from extension
 */
async function loadToolbarHTML(): Promise<string> {
  const url = chrome.runtime.getURL('toolbar.html');
  const response = await fetch(url);
  return response.text();
}

/**
 * Load toolbar CSS from extension
 */
async function loadToolbarCSS(): Promise<string> {
  const url = chrome.runtime.getURL('toolbar.css');
  const response = await fetch(url);
  return response.text();
}

/**
 * Initialize toolbar behavior and event listeners
 */
async function initializeToolbar(shadow: ShadowRoot): Promise<void> {
  const toolbar = shadow.querySelector('#promptlayer-toolbar');
  if (!toolbar) {
    console.error('[PromptLayer] Toolbar element not found');
    return;
  }

  // Check if first-time user
  const isFirstTime = await checkFirstTimeUser();
  
  // Collapse toolbar by default
  toolbar.classList.add('collapsed');
  const collapseBtn = shadow.querySelector('#collapse-btn');
  if (collapseBtn) {
    collapseBtn.textContent = '▼';
  }

  // Show welcome message for first-time users
  if (isFirstTime) {
    setTimeout(() => showWelcomeMessage(shadow), 1000);
  }

  // Setup event listeners
  setupCollapseBehavior(shadow);
  setupKeyboardShortcuts(shadow);
  setupSettings(shadow);
  setupPromptInput(shadow);
  setupButtons(shadow);
  
  // Detect and apply theme
  applyTheme(shadow);
  
  // Watch for theme changes
  watchThemeChanges(shadow);
}

/**
 * Check if this is the user's first time using the extension
 */
async function checkFirstTimeUser(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get('promptlayer_first_time');
    if (result.promptlayer_first_time === undefined) {
      // Mark as seen
      await chrome.storage.local.set({ promptlayer_first_time: false });
      return true;
    }
    return false;
  } catch (error) {
    console.error('[PromptLayer] Error checking first-time user:', error);
    return false;
  }
}

/**
 * Show welcome message for first-time users
 */
function showWelcomeMessage(shadow: ShadowRoot): void {
  const toolbar = shadow.querySelector('#promptlayer-toolbar');
  if (!toolbar) return;

  // Create welcome notification
  const welcome = document.createElement('div');
  welcome.className = 'welcome-message';
  welcome.innerHTML = `
    <div class="welcome-content">
      <h3>👋 Welcome to PromptLayer!</h3>
      <p>Click the toolbar below to get started with prompt enhancement.</p>
      <button class="btn btn-primary" id="welcome-expand-btn">Show Toolbar</button>
      <button class="btn-close" id="welcome-close-btn">×</button>
    </div>
  `;

  toolbar.appendChild(welcome);

  // Add event listeners
  const expandBtn = welcome.querySelector('#welcome-expand-btn');
  const closeBtn = welcome.querySelector('#welcome-close-btn');
  
  expandBtn?.addEventListener('click', () => {
    toolbar.classList.remove('collapsed');
    const collapseBtn = shadow.querySelector('#collapse-btn');
    if (collapseBtn) collapseBtn.textContent = '▲';
    welcome.remove();
  });

  closeBtn?.addEventListener('click', () => {
    welcome.remove();
  });

  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (welcome.parentNode) {
      welcome.remove();
    }
  }, 10000);
}

/**
 * Setup settings modal functionality
 */
function setupSettings(shadow: ShadowRoot): void {
  const settingsBtn = shadow.querySelector('#settings-btn');
  const settingsModal = shadow.querySelector('#settings-modal');
  const modalClose = shadow.querySelector('.modal-close');
  const saveSettingsBtn = shadow.querySelector('#save-settings-btn');
  const clearApiKeyBtn = shadow.querySelector('#clear-api-key-btn');
  const toggleApiKeyBtn = shadow.querySelector('#toggle-api-key');
  const apiKeyInput = shadow.querySelector<HTMLInputElement>('#api-key-input');
  const tempSlider = shadow.querySelector<HTMLInputElement>('#temperature-slider');
  const tempValue = shadow.querySelector('#temperature-value');

  // Load existing settings
  loadSettings(shadow);

  // Open settings
  settingsBtn?.addEventListener('click', () => {
    settingsModal?.classList.remove('hidden');
    loadSettings(shadow);
  });

  // Close settings
  modalClose?.addEventListener('click', () => {
    settingsModal?.classList.add('hidden');
  });

  // Close on overlay click
  settingsModal?.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add('hidden');
    }
  });

  // Toggle API key visibility
  toggleApiKeyBtn?.addEventListener('click', () => {
    if (apiKeyInput) {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
      toggleApiKeyBtn.textContent = apiKeyInput.type === 'password' ? '👁️' : '🙈';
    }
  });

  // Update temperature display
  tempSlider?.addEventListener('input', () => {
    if (tempValue && tempSlider) tempValue.textContent = tempSlider.value;
  });

  // Save settings
  saveSettingsBtn?.addEventListener('click', async () => {
    const apiKey = apiKeyInput?.value.trim();
    const modelSelect = shadow.querySelector<HTMLSelectElement>('#model-select');

    if (!apiKey) {
      showNotification(shadow, 'error', 'Please enter your OpenAI API key');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      showNotification(shadow, 'warning', 'API key should start with "sk-"');
    }

    try {
      await chrome.storage.local.set({
        promptlayer_api_key: btoa(apiKey), // Simple encoding
        promptlayer_settings: {
          model: modelSelect?.value || 'gpt-4o-mini',
          temperature: parseFloat(tempSlider?.value || '0.3'),
          maxTokens: 800,
        }
      });

      showNotification(shadow, 'success', '✓ Settings saved successfully!');
      settingsModal?.classList.add('hidden');
    } catch (error) {
      console.error('Error saving settings:', error);
      showNotification(shadow, 'error', 'Failed to save settings');
    }
  });

  // Clear API key
  clearApiKeyBtn?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear your API key?')) {
      try {
        await chrome.storage.local.remove('promptlayer_api_key');
        if (apiKeyInput) apiKeyInput.value = '';
        showNotification(shadow, 'success', 'API key cleared');
      } catch (error) {
        console.error('Error clearing API key:', error);
        showNotification(shadow, 'error', 'Failed to clear API key');
      }
    }
  });
}

/**
 * Load settings from storage
 */
async function loadSettings(shadow: ShadowRoot): Promise<void> {
  try {
    const result = await chrome.storage.local.get(['promptlayer_api_key', 'promptlayer_settings']);
    
    const apiKeyInput = shadow.querySelector<HTMLInputElement>('#api-key-input');
    const modelSelect = shadow.querySelector<HTMLSelectElement>('#model-select');
    const tempSlider = shadow.querySelector<HTMLInputElement>('#temperature-slider');
    const tempValue = shadow.querySelector('#temperature-value');

    // Load API key
    if (result.promptlayer_api_key && apiKeyInput) {
      try {
        apiKeyInput.value = atob(result.promptlayer_api_key);
      } catch {
        apiKeyInput.value = result.promptlayer_api_key;
      }
    }

    // Load settings
    if (result.promptlayer_settings) {
      const settings = result.promptlayer_settings;
      if (modelSelect) modelSelect.value = settings.model || 'gpt-4o-mini';
      if (tempSlider) {
        tempSlider.value = settings.temperature?.toString() || '0.3';
        if (tempValue) tempValue.textContent = tempSlider.value;
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

/**
 * Setup prompt input character counter
 */
function setupPromptInput(shadow: ShadowRoot): void {
  const promptInput = shadow.querySelector<HTMLTextAreaElement>('#prompt-input');
  const charCounter = shadow.querySelector<HTMLElement>('#char-counter');

  promptInput?.addEventListener('input', () => {
    const length = promptInput.value.length;
    if (charCounter) {
      charCounter.textContent = `${length} / 10000`;
      if (length > 9000) {
        charCounter.style.color = 'var(--pl-danger)';
      } else {
        charCounter.style.color = 'var(--pl-text-secondary)';
      }
    }
  });
}

/**
 * Setup other buttons
 */
function setupButtons(shadow: ShadowRoot): void {
  const enhanceBtn = shadow.querySelector('#enhance-btn');
  const saveBtn = shadow.querySelector('#save-btn');
  const libraryBtn = shadow.querySelector('#library-btn');
  const libraryPanel = shadow.querySelector('#prompt-library');
  const libraryClose = shadow.querySelector('.library-close');

  enhanceBtn?.addEventListener('click', () => {
    showNotification(shadow, 'info', 'Enhancement feature coming soon! Configure your API key first.');
  });

  saveBtn?.addEventListener('click', () => {
    showNotification(shadow, 'info', 'Save feature coming soon!');
  });

  libraryBtn?.addEventListener('click', () => {
    libraryPanel?.classList.toggle('open');
  });

  libraryClose?.addEventListener('click', () => {
    libraryPanel?.classList.remove('open');
  });
}

/**
 * Show notification
 */
function showNotification(shadow: ShadowRoot, type: string, message: string): void {
  const notificationArea = shadow.querySelector('#notification-area');
  if (!notificationArea) return;

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `<span>${message}</span>`;
  notification.style.opacity = '0';

  notificationArea.appendChild(notification);

  // Fade in
  requestAnimationFrame(() => {
    notification.style.transition = 'opacity 0.3s ease';
    notification.style.opacity = '1';
  });

  // Auto-remove after 4 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

/**
 * Setup collapse/expand behavior
 */
function setupCollapseBehavior(shadow: ShadowRoot): void {
  const collapseBtn = shadow.querySelector('#collapse-btn');
  const toolbar = shadow.querySelector('#promptlayer-toolbar');

  if (collapseBtn && toolbar) {
    collapseBtn.addEventListener('click', () => {
      toolbar.classList.toggle('collapsed');
      const isCollapsed = toolbar.classList.contains('collapsed');
      collapseBtn.textContent = isCollapsed ? '▼' : '▲';
    });
  }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts(shadow: ShadowRoot): void {
  document.addEventListener('keydown', (e) => {
    // Check if shortcuts are enabled (TODO: load from settings)
    const ctrlOrCmd = e.ctrlKey || e.metaKey;

    // Ctrl/Cmd + E: Focus enhance button
    if (ctrlOrCmd && e.key === 'e') {
      e.preventDefault();
      const enhanceBtn = shadow.querySelector<HTMLButtonElement>('#enhance-btn');
      enhanceBtn?.click();
    }

    // Ctrl/Cmd + S: Save prompt
    if (ctrlOrCmd && e.key === 's') {
      e.preventDefault();
      const saveBtn = shadow.querySelector<HTMLButtonElement>('#save-btn');
      saveBtn?.click();
    }

    // Ctrl/Cmd + L: Toggle library
    if (ctrlOrCmd && e.key === 'l') {
      e.preventDefault();
      const libraryBtn = shadow.querySelector<HTMLButtonElement>('#library-btn');
      libraryBtn?.click();
    }

    // Escape: Close modals/library
    if (e.key === 'Escape') {
      const library = shadow.querySelector('#prompt-library');
      const settings = shadow.querySelector('#settings-modal');
      if (library?.classList.contains('open')) {
        library.classList.remove('open');
      }
      if (settings?.classList.contains('open')) {
        settings.classList.remove('open');
      }
    }
  });
}

/**
 * Detect and apply theme (light/dark)
 */
function applyTheme(shadow: ShadowRoot): void {
  const toolbar = shadow.querySelector('#promptlayer-toolbar');
  if (!toolbar) return;

  // Check system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Check ChatGPT's theme (look for dark mode class on body/html)
  const chatGPTDark = document.documentElement.classList.contains('dark') ||
                      document.body.classList.contains('dark');

  const isDark = chatGPTDark || prefersDark;
  
  toolbar.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

/**
 * Watch for theme changes
 */
function watchThemeChanges(shadow: ShadowRoot): void {
  // Watch for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyTheme(shadow);
  });

  // Watch for ChatGPT theme changes (DOM mutations)
  const observer = new MutationObserver(() => {
    applyTheme(shadow);
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

/**
 * Remove toolbar (cleanup)
 */
export function removeToolbar(): void {
  const container = document.getElementById('promptlayer-container');
  if (container) {
    container.remove();
    toolbarInjected = false;
    shadowRoot = null;
  }
}
