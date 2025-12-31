/**
 * Toolbar Injection Logic
 * Handles injection of PromptLayer toolbar into ChatGPT page
 */

import { promptEnhancer } from '../services/promptEnhancer';
import { storageService } from '../services/storage';
import { debounce } from '../utils/helpers';

let toolbarInjected = false;
let shadowRoot: ShadowRoot | null = null;
let themeObserver: MutationObserver | null = null;
let eventCleanupFunctions: (() => void)[] = [];

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
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '0';
    container.style.zIndex = '999999';
    container.style.pointerEvents = 'none';
    container.style.boxSizing = 'border-box';

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
 * Setup settings modal functionality with keyboard accessibility
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

  let previousActiveElement: Element | null = null;

  // Load existing settings
  loadSettings(shadow);

  // Open settings with focus management
  settingsBtn?.addEventListener('click', () => {
    previousActiveElement = shadow.activeElement || document.activeElement;
    settingsModal?.classList.remove('hidden');
    loadSettings(shadow);

    // Focus first input when modal opens
    setTimeout(() => {
      apiKeyInput?.focus();
    }, 100);
  });

  // Close settings and restore focus
  const closeModal = () => {
    settingsModal?.classList.add('hidden');
    // Restore focus to the element that opened the modal
    if (previousActiveElement && previousActiveElement instanceof HTMLElement) {
      previousActiveElement.focus();
    }
  };

  modalClose?.addEventListener('click', closeModal);

  // Close on overlay click
  settingsModal?.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeModal();
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

    // Validate API key format more strictly
    if (!apiKey.startsWith('sk-')) {
      showNotification(shadow, 'error', 'Invalid API key format. Key should start with "sk-"');
      return;
    }

    // Check minimum length (OpenAI keys are typically 48+ characters)
    if (apiKey.length < 40) {
      showNotification(shadow, 'error', 'API key seems too short. Please check your key.');
      return;
    }

    // Check for valid characters (alphanumeric and hyphens)
    if (!/^sk-[A-Za-z0-9_-]+$/.test(apiKey)) {
      showNotification(shadow, 'error', 'API key contains invalid characters.');
      return;
    }

    try {
      // Use storage service for proper encryption
      await storageService.setApiKey(apiKey);
      await storageService.updateSettings({
        model: modelSelect?.value || 'gpt-4o-mini',
        temperature: parseFloat(tempSlider?.value || '0.3'),
        maxTokens: 800,
      });

      showNotification(shadow, 'success', '✓ Settings saved successfully!');
      closeModal();
    } catch (error) {
      console.error('Error saving settings:', error);
      showNotification(shadow, 'error', 'Failed to save settings');
    }
  });

  // Clear API key
  clearApiKeyBtn?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear your API key?')) {
      try {
        await storageService.clearApiKey();
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
    const apiKey = await storageService.getApiKey();
    const settings = await storageService.getSettings();

    const apiKeyInput = shadow.querySelector<HTMLInputElement>('#api-key-input');
    const modelSelect = shadow.querySelector<HTMLSelectElement>('#model-select');
    const tempSlider = shadow.querySelector<HTMLInputElement>('#temperature-slider');
    const tempValue = shadow.querySelector('#temperature-value');

    // Load API key
    if (apiKey && apiKeyInput) {
      apiKeyInput.value = apiKey;
    }

    // Load settings
    if (modelSelect) modelSelect.value = settings.model || 'gpt-4o-mini';
    if (tempSlider) {
      tempSlider.value = settings.temperature?.toString() || '0.3';
      if (tempValue) tempValue.textContent = tempSlider.value;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

/**
 * Setup prompt input character counter with debouncing
 */
function setupPromptInput(shadow: ShadowRoot): void {
  const promptInput = shadow.querySelector<HTMLTextAreaElement>('#prompt-input');
  const charCounter = shadow.querySelector<HTMLElement>('#char-counter');

  if (!promptInput || !charCounter) return;

  // Update character counter immediately for responsive feedback
  const updateCounter = () => {
    const length = promptInput.value.length;
    charCounter.textContent = `${length} / 10000`;
    if (length > 9000) {
      charCounter.style.color = 'var(--pl-danger)';
    } else {
      charCounter.style.color = 'var(--pl-text-secondary)';
    }
  };

  // Use immediate update for better UX (character counter should be instant)
  const handleInput = () => {
    updateCounter();
  };

  promptInput.addEventListener('input', handleInput);

  // Add to cleanup
  eventCleanupFunctions.push(() => {
    promptInput.removeEventListener('input', handleInput);
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
  const librarySearch = shadow.querySelector<HTMLInputElement>('#library-search-input');
  const libraryFilterRole = shadow.querySelector<HTMLSelectElement>('#library-filter-role');
  const librarySort = shadow.querySelector<HTMLSelectElement>('#library-sort');

  enhanceBtn?.addEventListener('click', () => handleEnhance(shadow));
  saveBtn?.addEventListener('click', () => handleSavePrompt(shadow));

  libraryBtn?.addEventListener('click', () => {
    libraryPanel?.classList.toggle('open');
    if (libraryPanel?.classList.contains('open')) {
      loadPromptLibrary(shadow);
    }
  });

  libraryClose?.addEventListener('click', () => {
    libraryPanel?.classList.remove('open');
  });

  // Setup library search and filters with debouncing
  const debouncedLibraryUpdate = debounce(() => loadPromptLibrary(shadow), 300);

  librarySearch?.addEventListener('input', () => {
    debouncedLibraryUpdate();
  });

  libraryFilterRole?.addEventListener('change', () => {
    loadPromptLibrary(shadow);
  });

  librarySort?.addEventListener('change', () => {
    loadPromptLibrary(shadow);
  });
}

/**
 * Handle enhance button click
 */
async function handleEnhance(shadow: ShadowRoot): Promise<void> {
  const promptInput = shadow.querySelector<HTMLTextAreaElement>('#prompt-input');
  const roleSelect = shadow.querySelector<HTMLSelectElement>('#role-select');
  const enhanceBtn = shadow.querySelector<HTMLButtonElement>('#enhance-btn');

  if (!promptInput || !promptInput.value.trim()) {
    showNotification(shadow, 'error', 'Please enter a prompt to enhance');
    return;
  }

  // Check API key
  const result = await chrome.storage.local.get('promptlayer_api_key');
  if (!result.promptlayer_api_key) {
    showNotification(shadow, 'error', 'Please configure your OpenAI API key first');
    return;
  }

  // Show loading state
  const originalText = enhanceBtn?.textContent || 'Enhance';
  if (enhanceBtn) {
    enhanceBtn.disabled = true;
    enhanceBtn.textContent = '⏳ Enhancing...';
  }

  try {
    console.log('[PromptLayer] Starting enhancement...');
    console.log('[PromptLayer] Raw prompt:', promptInput.value);
    console.log('[PromptLayer] Role:', roleSelect?.value);

    const enhanced = await promptEnhancer.enhance({
      rawPrompt: promptInput.value,
      roleId: roleSelect?.value || 'general-assistant',
      context: '',
    });

    console.log('[PromptLayer] Enhancement response:', enhanced);
    console.log('[PromptLayer] Full text:', enhanced.fullText);

    // Use fullText if available, otherwise construct from parts
    const enhancedText =
      enhanced.fullText ||
      `${enhanced.role}\n\n${enhanced.objective}\n\nConstraints:\n${enhanced.constraints.join('\n')}\n\nOutput Format:\n${enhanced.outputFormat}`;

    console.log('[PromptLayer] Final enhanced text:', enhancedText);
    promptInput.value = enhancedText;

    // Update character counter
    const charCounter = shadow.querySelector<HTMLElement>('#char-counter');
    if (charCounter) {
      charCounter.textContent = `${enhancedText.length} / 10000`;
    }

    showNotification(shadow, 'success', '✓ Prompt enhanced successfully!');
  } catch (error: any) {
    console.error('Enhancement error:', error);
    showNotification(shadow, 'error', error.userMessage || 'Failed to enhance prompt');
  } finally {
    if (enhanceBtn) {
      enhanceBtn.disabled = false;
      enhanceBtn.textContent = originalText;
    }
  }
}

/**
 * Handle save prompt
 */
async function handleSavePrompt(shadow: ShadowRoot): Promise<void> {
  const promptInput = shadow.querySelector<HTMLTextAreaElement>('#prompt-input');

  if (!promptInput || !promptInput.value.trim()) {
    showNotification(shadow, 'error', 'No prompt to save');
    return;
  }

  // Prompt for title
  const title = prompt('Enter a title for this prompt:');
  if (!title) return;

  try {
    await storageService.savePrompt({
      id: `prompt_${Date.now()}`,
      title: title.trim(),
      content: promptInput.value,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    });

    showNotification(shadow, 'success', '✓ Prompt saved to library!');
  } catch (error: any) {
    console.error('Save error:', error);
    showNotification(shadow, 'error', error.userMessage || 'Failed to save prompt');
  }
}

/**
 * Load and display prompt library with search and filter
 */
async function loadPromptLibrary(shadow: ShadowRoot): Promise<void> {
  try {
    let prompts = await storageService.getPrompts();

    // Get filter values
    const searchInput = shadow.querySelector<HTMLInputElement>('#library-search-input');
    const filterRole = shadow.querySelector<HTMLSelectElement>('#library-filter-role');
    const sortSelect = shadow.querySelector<HTMLSelectElement>('#library-sort');

    const searchTerm = searchInput?.value.toLowerCase() || '';
    const roleFilter = filterRole?.value || '';
    const sortBy = sortSelect?.value || 'recent';

    // Apply search filter
    if (searchTerm) {
      prompts = prompts.filter(
        (prompt) =>
          prompt.title.toLowerCase().includes(searchTerm) ||
          prompt.content.toLowerCase().includes(searchTerm) ||
          prompt.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Apply role filter (if prompts have category field)
    if (roleFilter) {
      prompts = prompts.filter((prompt) => prompt.category === roleFilter);
    }

    // Apply sorting
    switch (sortBy) {
      case 'recent':
        prompts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'name':
        prompts.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'usage':
        prompts.sort((a, b) => b.usageCount - a.usageCount);
        break;
    }

    const libraryContent = shadow.querySelector('#library-content');
    if (!libraryContent) return;

    if (prompts.length === 0) {
      const emptyMessage =
        searchTerm || roleFilter ? 'No prompts match your filters' : 'No saved prompts yet';
      libraryContent.innerHTML = `<div class="library-empty">
        <p>${emptyMessage}</p>
        ${!searchTerm && !roleFilter ? '<p>Enhance and save prompts to build your library!</p>' : ''}
      </div>`;
      return;
    }

    libraryContent.innerHTML = prompts
      .map(
        (prompt) => `
      <div class="library-item" data-prompt-id="${prompt.id}">
        <div class="library-item-header">
          <strong>${escapeHtml(prompt.title)}</strong>
          <div class="library-item-actions">
            <button class="library-load-btn" data-prompt-id="${prompt.id}" title="Load">📄</button>
            <button class="library-delete-btn" data-prompt-id="${prompt.id}" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="library-item-preview">${escapeHtml(prompt.content.substring(0, 100))}${prompt.content.length > 100 ? '...' : ''}</div>
        <div class="library-item-meta">
          ${new Date(prompt.createdAt).toLocaleDateString()} • Used ${prompt.usageCount} times
        </div>
      </div>
    `
      )
      .join('');

    // Add event listeners
    libraryContent.querySelectorAll('.library-load-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.promptId;
        if (id) loadPromptToInput(shadow, id);
      });
    });

    libraryContent.querySelectorAll('.library-delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.promptId;
        if (id) deletePrompt(shadow, id);
      });
    });
  } catch (error) {
    console.error('Error loading library:', error);
    showNotification(shadow, 'error', 'Failed to load prompt library');
  }
}

/**
 * Load a prompt from library to input
 */
async function loadPromptToInput(shadow: ShadowRoot, promptId: string): Promise<void> {
  try {
    const prompt = await storageService.getPrompt(promptId);

    if (!prompt) {
      showNotification(shadow, 'error', 'Prompt not found');
      return;
    }

    const promptInput = shadow.querySelector<HTMLTextAreaElement>('#prompt-input');
    if (promptInput) {
      promptInput.value = prompt.content;

      // Update character counter
      const charCounter = shadow.querySelector<HTMLElement>('#char-counter');
      if (charCounter) {
        charCounter.textContent = `${prompt.content.length} / 10000`;
      }
    }

    // Update usage stats
    await storageService.updatePrompt(promptId, {
      usageCount: prompt.usageCount + 1,
    });

    // Close library panel
    const libraryPanel = shadow.querySelector('#prompt-library');
    libraryPanel?.classList.remove('open');

    showNotification(shadow, 'success', '✓ Prompt loaded');
  } catch (error) {
    console.error('Error loading prompt:', error);
    showNotification(shadow, 'error', 'Failed to load prompt');
  }
}

/**
 * Delete a prompt from library
 */
async function deletePrompt(shadow: ShadowRoot, promptId: string): Promise<void> {
  if (!confirm('Are you sure you want to delete this prompt?')) return;

  try {
    await storageService.deletePrompt(promptId);

    showNotification(shadow, 'success', '✓ Prompt deleted');
    loadPromptLibrary(shadow); // Refresh library
  } catch (error) {
    console.error('Error deleting prompt:', error);
    showNotification(shadow, 'error', 'Failed to delete prompt');
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

  // Show toolbar when mouse near top of screen
  document.addEventListener('mousemove', (e) => {
    if (e.clientY < 10 && toolbar?.classList.contains('hidden')) {
      toolbar.classList.remove('hidden');
    }
  });

  // Add double-click on header to toggle visibility
  const header = shadow.querySelector('.toolbar-header');
  header?.addEventListener('dblclick', () => {
    toolbar?.classList.toggle('hidden');
  });
}

/**
 * Setup keyboard shortcuts with improved accessibility
 */
function setupKeyboardShortcuts(shadow: ShadowRoot): void {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Check if shortcuts are enabled (TODO: load from settings)
    const ctrlOrCmd = e.ctrlKey || e.metaKey;

    // Don't trigger shortcuts if user is typing in an input/textarea
    const target = e.target as HTMLElement;
    const isInputField =
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    // Ctrl/Cmd + E: Focus enhance button (but not in input fields)
    if (ctrlOrCmd && e.key === 'e' && !isInputField) {
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

    // Ctrl/Cmd + L: Toggle library (but not in input fields)
    if (ctrlOrCmd && e.key === 'l' && !isInputField) {
      e.preventDefault();
      const libraryBtn = shadow.querySelector<HTMLButtonElement>('#library-btn');
      libraryBtn?.click();
    }

    // Escape: Close modals/library
    if (e.key === 'Escape') {
      const library = shadow.querySelector('#prompt-library');
      const settings = shadow.querySelector('#settings-modal');

      // Close in priority order: modals first, then side panels
      if (settings && !settings.classList.contains('hidden')) {
        e.preventDefault();
        settings.classList.add('hidden');
      } else if (library?.classList.contains('open')) {
        e.preventDefault();
        library.classList.remove('open');
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  // Add to cleanup
  eventCleanupFunctions.push(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });
}

/**
 * Detect and apply theme (light/dark)
 */
function applyTheme(shadow: ShadowRoot): void {
  const toolbar = shadow.querySelector('#promptlayer-toolbar');
  if (!toolbar) return;

  // Check ChatGPT's theme by inspecting background color
  const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;

  // Check if background is dark (rgb values < 128)
  const isDarkBg = (bg: string) => {
    const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const [, r, g, b] = match.map(Number);
      return (r + g + b) / 3 < 128;
    }
    return false;
  };

  // Check ChatGPT's theme (look for dark mode class on body/html)
  const chatGPTDark =
    document.documentElement.classList.contains('dark') ||
    document.body.classList.contains('dark') ||
    isDarkBg(htmlBg) ||
    isDarkBg(bodyBg);

  // Check system preference as fallback
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = chatGPTDark || prefersDark;

  toolbar.setAttribute('data-theme', isDark ? 'dark' : 'light');
  console.log('[PromptLayer] Theme applied:', isDark ? 'dark' : 'light');
}

/**
 * Watch for theme changes with debouncing for performance
 */
function watchThemeChanges(shadow: ShadowRoot): void {
  // Debounced theme application to avoid excessive updates
  const debouncedApplyTheme = debounce(() => applyTheme(shadow), 300);

  // Watch for system theme changes
  const handleSystemThemeChange = () => {
    debouncedApplyTheme();
  };

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', handleSystemThemeChange);

  // Watch for ChatGPT theme changes (DOM mutations) with debouncing
  themeObserver = new MutationObserver(() => {
    debouncedApplyTheme();
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  // Add cleanup
  eventCleanupFunctions.push(() => {
    mediaQuery.removeEventListener('change', handleSystemThemeChange);
    if (themeObserver) {
      themeObserver.disconnect();
      themeObserver = null;
    }
  });
}

/**
 * Remove toolbar (cleanup)
 */
export function removeToolbar(): void {
  // Clean up all event listeners
  eventCleanupFunctions.forEach((cleanup) => cleanup());
  eventCleanupFunctions = [];

  // Disconnect theme observer
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }

  // Remove container
  const container = document.getElementById('promptlayer-container');
  if (container) {
    container.remove();
    toolbarInjected = false;
    shadowRoot = null;
  }
}
