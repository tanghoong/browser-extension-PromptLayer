/**
 * Toolbar Injection Logic
 * Handles injection of PromptLayer toolbar into ChatGPT page
 */

import { promptEnhancer } from '../services/promptEnhancer';
import { storageService } from '../services/storage';
import {
  getAllRoleBlueprints,
  getRoleBlueprint,
  createCustomRole,
  updateRole,
  deleteRole,
  duplicateRole,
  exportRoles,
  importRoles,
  ROLE_CATEGORIES,
} from '../services/roleBlueprints';
import { debounce, generateId } from '../utils/helpers';
import { logger } from '../utils/logger';
import { validateApiKey, validatePromptTitle } from '../utils/validation';
import type { RoleBlueprint, RoleCategory, SuggestedRole } from '../types';

// Constants
const MAX_PROMPT_TITLE_LENGTH = 200;

// Type definitions
type NotificationType = 'success' | 'error' | 'warning' | 'info';

let toolbarInjected = false;
let shadowRoot: ShadowRoot | null = null;
let themeObserver: MutationObserver | null = null;
let eventCleanupFunctions: (() => void)[] = [];
let currentSuggestedRole: SuggestedRole | null = null;

/**
 * Create and inject the toolbar
 */
export async function injectToolbar(): Promise<void> {
  // Prevent duplicate injection
  if (toolbarInjected) {
    logger.log('Toolbar already injected');
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
    logger.log('Toolbar injected successfully');
  } catch (error) {
    logger.error('Failed to inject toolbar:', error);
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
    logger.error('Toolbar element not found');
    return;
  }

  try {
    // Check if first-time user
    const isFirstTime = await checkFirstTimeUser();

    // Collapse toolbar by default
    toolbar.classList.add('collapsed');

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
    setupOverlay(shadow);
    setupRoleManager(shadow);
    setupRolePreview(shadow);
    setupRoleSuggestion(shadow);
    setupRolePromptDisplay(shadow);

    // Populate role dropdown
    await populateRoleDropdown(shadow);

    // Detect and apply theme
    applyTheme(shadow);

    // Watch for theme changes
    watchThemeChanges(shadow);
  } catch (error) {
    logger.error('Failed to initialize toolbar features:', error);
    // Show user-friendly error notification with retry and close options
    const notificationArea = shadow.querySelector('#notification-area');
    if (notificationArea) {
      const notification = document.createElement('div');
      notification.className = 'notification error';

      const message = document.createElement('span');
      message.textContent =
        'PromptLayer failed to initialize some features. You can retry or refresh the page.';
      notification.appendChild(message);

      // Add more specific error information when available
      if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof (error as Error).message === 'string'
      ) {
        const details = document.createElement('span');
        details.className = 'notification-details';
        details.textContent = ' Details: ' + (error as Error).message;
        notification.appendChild(details);
      }

      // Add Retry action button
      const retryButton = document.createElement('button');
      retryButton.className = 'notification-action retry';
      retryButton.textContent = 'Retry';
      notification.appendChild(retryButton);

      // Add Close button to allow manual dismissal
      const closeButton = document.createElement('button');
      closeButton.className = 'notification-close';
      closeButton.textContent = '×';
      notification.appendChild(closeButton);

      notificationArea.appendChild(notification);

      const autoDismissTimeout = window.setTimeout(() => {
        notification.remove();
      }, 10000); // Extended to 10 seconds for user to read and act

      retryButton.addEventListener('click', () => {
        window.clearTimeout(autoDismissTimeout);
        notification.remove();
        initializeToolbar(shadow).catch((retryError) => {
          logger.error('Retrying toolbar initialization failed:', retryError);
        });
      });

      closeButton.addEventListener('click', () => {
        window.clearTimeout(autoDismissTimeout);
        notification.remove();
      });
    }
  }
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
    logger.error('Error checking first-time user:', error);
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
    const toggleInputBtn = shadow.querySelector('#toggle-input-btn');
    if (toggleInputBtn) {
      toggleInputBtn.classList.add('active');
    }
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
  const modalClose = shadow.querySelector('#settings-modal .modal-close');
  const saveSettingsBtn = shadow.querySelector('#save-settings-btn');
  const clearApiKeyBtn = shadow.querySelector('#clear-api-key-btn');
  const toggleApiKeyBtn = shadow.querySelector('#toggle-api-key');
  const apiKeyInput = shadow.querySelector<HTMLInputElement>('#api-key-input');
  const tempSlider = shadow.querySelector<HTMLInputElement>('#temperature-slider');
  const tempValue = shadow.querySelector('#temperature-value');

  let previousActiveElement: Element | null = null;

  // Open settings with focus management
  settingsBtn?.addEventListener('click', () => {
    // Store reference to the settings button for focus restoration
    previousActiveElement = settingsBtn as Element;
    showOverlay(shadow);
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
    hideOverlay(shadow);
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

    // Validate API key with comprehensive checks
    const validation = validateApiKey(apiKey);
    if (!validation.valid) {
      showNotification(shadow, 'error', validation.error || 'Invalid API key');
      return;
    }

    try {
      // Use storage service for proper encryption with validated key
      await storageService.setApiKey(validation.sanitized!);
      await storageService.updateSettings({
        model: modelSelect?.value || 'gpt-4o-mini',
        temperature: parseFloat(tempSlider?.value || '0.3'),
        maxTokens: 800,
      });

      showNotification(shadow, 'success', '✓ Settings saved successfully!');
      closeModal();
    } catch (error) {
      logger.error('Error saving settings:', error);
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
        logger.error('Error clearing API key:', error);
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
    logger.error('Error loading settings:', error);
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
    const isOpen = libraryPanel?.classList.contains('open');
    if (isOpen) {
      libraryPanel?.classList.remove('open');
      libraryBtn.classList.remove('active');
      hideOverlay(shadow);
    } else {
      showOverlay(shadow);
      libraryPanel?.classList.add('open');
      libraryBtn.classList.add('active');
      loadPromptLibrary(shadow);
    }
  });

  // Library close button - properly closes the panel
  libraryClose?.addEventListener('click', () => {
    libraryPanel?.classList.remove('open');
    libraryBtn?.classList.remove('active');
    hideOverlay(shadow);
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
    logger.debug('Starting enhancement...');
    logger.debug('Raw prompt:', promptInput.value);
    logger.debug('Role:', roleSelect?.value);

    const enhanced = await promptEnhancer.enhance({
      rawPrompt: promptInput.value,
      roleId: roleSelect?.value || 'engineer',
      context: '',
    });

    logger.debug('Enhancement response:', enhanced);
    logger.debug('Full text:', enhanced.fullText);

    // Use fullText if available, otherwise construct from parts
    const enhancedText =
      enhanced.fullText ||
      `${enhanced.role}\n\n${enhanced.objective}\n\nConstraints:\n${enhanced.constraints.join('\n')}\n\nOutput Format:\n${enhanced.outputFormat}`;

    logger.debug('Final enhanced text:', enhancedText);
    promptInput.value = enhancedText;

    // Update character counter
    const charCounter = shadow.querySelector<HTMLElement>('#char-counter');
    if (charCounter) {
      charCounter.textContent = `${enhancedText.length} / 10000`;
    }

    showNotification(shadow, 'success', '✓ Prompt enhanced successfully!');

    // Check for AI role suggestion (confidence > 50%)
    if (enhanced.suggestedRole && enhanced.suggestedRole.confidence > 0.5) {
      logger.debug('AI suggests new role:', enhanced.suggestedRole);
      showRoleSuggestion(shadow, enhanced.suggestedRole);
    }
  } catch (error: unknown) {
    logger.error('Enhancement error:', error);
    const errorMessage =
      error instanceof Error && 'userMessage' in error
        ? (error as { userMessage?: string }).userMessage
        : 'Failed to enhance prompt';
    showNotification(shadow, 'error', errorMessage || 'Failed to enhance prompt');
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

  // Prompt for title with validation
  const title = prompt('Enter a title for this prompt:');
  if (!title) return;

  // Validate and sanitize title
  const titleValidation = validatePromptTitle(title, MAX_PROMPT_TITLE_LENGTH);
  if (!titleValidation.valid) {
    showNotification(shadow, 'error', titleValidation.error || 'Invalid title');
    return;
  }

  try {
    await storageService.savePrompt({
      id: `prompt_${generateId()}`,
      title: titleValidation.sanitized!,
      content: promptInput.value.trim(),
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
    });

    showNotification(shadow, 'success', '✓ Prompt saved to library!');
  } catch (error: unknown) {
    logger.error('Save error:', error);
    const errorMessage =
      error instanceof Error && 'userMessage' in error
        ? (error as { userMessage?: string }).userMessage
        : 'Failed to save prompt';
    showNotification(shadow, 'error', errorMessage || 'Failed to save prompt');
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

    // Apply role filter (only if category is defined and matches)
    if (roleFilter) {
      prompts = prompts.filter(
        (prompt) => prompt.category !== undefined && prompt.category === roleFilter
      );
    }

    // Apply sorting with error handling for date parsing
    switch (sortBy) {
      case 'recent':
        prompts.sort((a, b) => {
          try {
            const timeA = new Date(a.createdAt).getTime();
            const timeB = new Date(b.createdAt).getTime();
            return timeB - timeA; // Most recent first
          } catch {
            return 0; // Keep original order if dates are invalid
          }
        });
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
    logger.error('Error loading library:', error);
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
    const libraryBtn = shadow.querySelector('#library-btn');
    libraryPanel?.classList.remove('open');
    libraryBtn?.classList.remove('active');

    showNotification(shadow, 'success', '✓ Prompt loaded');
  } catch (error) {
    logger.error('Error loading prompt:', error);
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
    logger.error('Error deleting prompt:', error);
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
 * Show notification with XSS protection
 */
function showNotification(shadow: ShadowRoot, type: NotificationType, message: string): void {
  const notificationArea = shadow.querySelector('#notification-area');
  if (!notificationArea) return;

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;

  // Create span element and set textContent to prevent XSS
  const span = document.createElement('span');
  span.textContent = message;
  notification.appendChild(span);

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
  const toolbar = shadow.querySelector('#promptlayer-toolbar');
  const toggleHandle = shadow.querySelector('#toggle-handle');
  const toggleInputBtn = shadow.querySelector('#toggle-input-btn');

  // Toggle handle - shows toolbar when clicked (when hidden)
  toggleHandle?.addEventListener('click', () => {
    if (toolbar?.classList.contains('hidden')) {
      toolbar.classList.remove('hidden');
      toggleHandle.classList.add('hidden');
    }
  });

  // Toggle input area button - collapses/expands the content area with active state
  toggleInputBtn?.addEventListener('click', () => {
    const isCollapsed = toolbar?.classList.contains('collapsed');
    toolbar?.classList.toggle('collapsed');
    toggleInputBtn.classList.toggle('active');

    // Show overlay when expanded, hide when collapsed
    if (isCollapsed) {
      showOverlay(shadow);
    } else {
      hideOverlay(shadow);
    }
  });

  // Show toolbar when mouse near top of screen (if hidden)
  document.addEventListener('mousemove', (e) => {
    if (e.clientY < 10 && toolbar?.classList.contains('hidden')) {
      toolbar.classList.remove('hidden');
      toggleHandle?.classList.add('hidden');
    }
  });

  // Double-click on header to hide toolbar completely
  const header = shadow.querySelector('.toolbar-header');
  header?.addEventListener('dblclick', () => {
    toolbar?.classList.add('hidden');
    toggleHandle?.classList.remove('hidden');
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
      const libraryBtn = shadow.querySelector('#library-btn');
      const settings = shadow.querySelector('#settings-modal');

      // Close in priority order: modals first, then side panels
      if (settings && !settings.classList.contains('hidden')) {
        e.preventDefault();
        settings.classList.add('hidden');
      } else if (library?.classList.contains('open')) {
        e.preventDefault();
        library.classList.remove('open');
        libraryBtn?.classList.remove('active');
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
  logger.debug('Theme applied:', isDark ? 'dark' : 'light');
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
 * Setup overlay click-to-dismiss behavior
 */
function setupOverlay(shadow: ShadowRoot): void {
  const overlay = shadow.querySelector('#promptlayer-overlay');

  overlay?.addEventListener('click', () => {
    hideOverlay(shadow);
    // Close any open modals/panels
    closeAllModals(shadow);
  });
}

/**
 * Show the blur overlay
 */
function showOverlay(shadow: ShadowRoot): void {
  const overlay = shadow.querySelector('#promptlayer-overlay');
  overlay?.classList.remove('hidden');
}

/**
 * Hide the blur overlay
 */
function hideOverlay(shadow: ShadowRoot): void {
  const overlay = shadow.querySelector('#promptlayer-overlay');
  overlay?.classList.add('hidden');
}

/**
 * Close all open modals and panels
 */
function closeAllModals(shadow: ShadowRoot): void {
  const toolbar = shadow.querySelector('#promptlayer-toolbar');
  const toggleInputBtn = shadow.querySelector('#toggle-input-btn');

  // Close settings modal
  const settingsModal = shadow.querySelector('#settings-modal');
  settingsModal?.classList.add('hidden');

  // Close role manager modal
  const roleManagerModal = shadow.querySelector('#role-manager-modal');
  roleManagerModal?.classList.add('hidden');

  // Close library panel
  const libraryPanel = shadow.querySelector('#prompt-library');
  const libraryBtn = shadow.querySelector('#library-btn');
  libraryPanel?.classList.remove('open');
  libraryBtn?.classList.remove('active');

  // Collapse toolbar input if expanded
  if (!toolbar?.classList.contains('collapsed')) {
    toolbar?.classList.add('collapsed');
    toggleInputBtn?.classList.remove('active');
  }
}

/**
 * Populate role dropdown with all roles (custom + defaults)
 */
async function populateRoleDropdown(shadow: ShadowRoot): Promise<void> {
  const roleSelect = shadow.querySelector<HTMLSelectElement>('#role-select');
  if (!roleSelect) return;

  try {
    const allRoles = await getAllRoleBlueprints();

    // Group roles by category
    const rolesByCategory: Record<string, RoleBlueprint[]> = {};
    allRoles.forEach((role) => {
      const category = role.category || 'other';
      if (!rolesByCategory[category]) {
        rolesByCategory[category] = [];
      }
      rolesByCategory[category].push(role);
    });

    // Clear existing options
    roleSelect.innerHTML = '';

    // Add options grouped by category
    const categoryOrder: RoleCategory[] = [
      'technical',
      'creative',
      'business',
      'marketing',
      'research',
      'education',
      'other',
    ];

    categoryOrder.forEach((category) => {
      const roles = rolesByCategory[category];
      if (!roles || roles.length === 0) return;

      const optgroup = document.createElement('optgroup');
      optgroup.label = `${ROLE_CATEGORIES[category].emoji} ${ROLE_CATEGORIES[category].label}`;

      roles.forEach((role) => {
        const option = document.createElement('option');
        option.value = role.id;
        option.textContent = `${role.emoji || ''} ${role.name}${!role.isDefault ? ' ⭐' : ''}`;
        option.dataset.roleId = role.id;
        optgroup.appendChild(option);
      });

      roleSelect.appendChild(optgroup);
    });

    logger.debug('Role dropdown populated with', allRoles.length, 'roles');
  } catch (error) {
    logger.error('Error populating role dropdown:', error);
  }
}

/**
 * Setup role prompt display - shows system prompt when role is selected
 */
function setupRolePromptDisplay(shadow: ShadowRoot): void {
  const roleSelect = shadow.querySelector<HTMLSelectElement>('#role-select');
  const rolePromptDisplay = shadow.querySelector('#role-prompt-display');
  const rolePromptText = shadow.querySelector('#role-prompt-text');

  const updateRolePrompt = async () => {
    if (!roleSelect || !rolePromptDisplay || !rolePromptText) return;

    const selectedRoleId = roleSelect.value;
    const role = await getRoleBlueprint(selectedRoleId);

    if (!role) {
      rolePromptDisplay.classList.remove('visible');
      return;
    }

    // Display the system prompt
    rolePromptText.textContent = role.systemPrompt;
    rolePromptDisplay.classList.add('visible');
  };

  // Update on role selection change
  roleSelect?.addEventListener('change', updateRolePrompt);

  // Initial update
  updateRolePrompt();
}

/**
 * Setup role preview functionality
 */
function setupRolePreview(shadow: ShadowRoot): void {
  const roleSelect = shadow.querySelector<HTMLSelectElement>('#role-select');
  const previewBtn = shadow.querySelector('#role-preview-btn');
  const previewTooltip = shadow.querySelector('#role-preview-tooltip');

  let previewTimeout: ReturnType<typeof setTimeout> | null = null;

  const showPreview = async () => {
    if (!roleSelect || !previewTooltip) return;

    const selectedRoleId = roleSelect.value;
    const role = await getRoleBlueprint(selectedRoleId);

    if (!role) {
      previewTooltip.classList.add('hidden');
      return;
    }

    // Populate preview
    const emojiEl = shadow.querySelector('#role-preview-emoji');
    const nameEl = shadow.querySelector('#role-preview-name');
    const categoryEl = shadow.querySelector('#role-preview-category');
    const descEl = shadow.querySelector('#role-preview-description');
    const depthEl = shadow.querySelector('#role-preview-depth');
    const styleEl = shadow.querySelector('#role-preview-style');

    if (emojiEl) emojiEl.textContent = role.emoji || '📋';
    if (nameEl) nameEl.textContent = role.name;
    if (categoryEl) {
      categoryEl.textContent = ROLE_CATEGORIES[role.category]?.label || role.category;
      categoryEl.className = 'role-category-badge';
    }
    if (descEl) descEl.textContent = role.description;
    if (depthEl) depthEl.textContent = `Depth: ${role.thinkingDepth}`;
    if (styleEl) styleEl.textContent = `Style: ${role.outputStyle}`;

    previewTooltip.classList.remove('hidden');
  };

  const hidePreview = () => {
    if (previewTimeout) {
      clearTimeout(previewTimeout);
      previewTimeout = null;
    }
    previewTooltip?.classList.add('hidden');
  };

  // Preview button click
  previewBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (previewTooltip?.classList.contains('hidden')) {
      await showPreview();
    } else {
      hidePreview();
    }
  });

  // Hide on click outside
  shadow.addEventListener('click', (e) => {
    if (
      !(e.target as Element)?.closest('#role-preview-tooltip') &&
      !(e.target as Element)?.closest('#role-preview-btn')
    ) {
      hidePreview();
    }
  });

  // Update preview when selection changes
  roleSelect?.addEventListener('change', () => {
    if (!previewTooltip?.classList.contains('hidden')) {
      showPreview();
    }
  });
}

/**
 * Setup role manager modal
 */
function setupRoleManager(shadow: ShadowRoot): void {
  const rolesBtn = shadow.querySelector('#roles-btn');
  const roleManagerModal = shadow.querySelector('#role-manager-modal');
  const roleManagerClose = shadow.querySelector('#role-manager-close');
  const tabBtns = shadow.querySelectorAll('.tab-btn');
  const roleForm = shadow.querySelector<HTMLFormElement>('#role-form');
  const roleFormCancel = shadow.querySelector('#role-form-cancel');
  const exportBtn = shadow.querySelector('#export-roles-btn');
  const importBrowseBtn = shadow.querySelector('#import-browse-btn');
  const importFileInput = shadow.querySelector<HTMLInputElement>('#import-file-input');
  const importDropZone = shadow.querySelector('#import-drop-zone');

  // Open role manager
  rolesBtn?.addEventListener('click', () => {
    showOverlay(shadow);
    roleManagerModal?.classList.remove('hidden');
    loadRolesList(shadow);
  });

  // Close role manager
  const closeRoleManager = () => {
    roleManagerModal?.classList.add('hidden');
    hideOverlay(shadow);
    resetRoleForm(shadow);
  };

  roleManagerClose?.addEventListener('click', closeRoleManager);

  // Tab switching
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = (btn as HTMLElement).dataset.tab;
      if (!tabId) return;

      // Update active tab button
      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // Show corresponding content
      shadow.querySelectorAll('.tab-content').forEach((content) => {
        content.classList.remove('active');
      });
      shadow.querySelector(`#${tabId}`)?.classList.add('active');

      // Reset form when switching to create tab
      if (tabId === 'create-role') {
        resetRoleForm(shadow);
      }
    });
  });

  // Role form submission
  roleForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleRoleFormSubmit(shadow);
  });

  // Cancel form
  roleFormCancel?.addEventListener('click', () => {
    resetRoleForm(shadow);
    // Switch to roles list tab
    tabBtns.forEach((b) => b.classList.remove('active'));
    shadow.querySelector('[data-tab="roles-list"]')?.classList.add('active');
    shadow.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    shadow.querySelector('#roles-list')?.classList.add('active');
  });

  // Search and filter roles
  const rolesSearch = shadow.querySelector<HTMLInputElement>('#roles-search');
  const categoryFilter = shadow.querySelector<HTMLSelectElement>('#roles-category-filter');

  const debouncedSearch = debounce(() => loadRolesList(shadow), 300);

  rolesSearch?.addEventListener('input', debouncedSearch);
  categoryFilter?.addEventListener('change', () => loadRolesList(shadow));

  // Export roles
  exportBtn?.addEventListener('click', async () => {
    try {
      const includeDefaults =
        shadow.querySelector<HTMLInputElement>('#export-include-defaults')?.checked || false;
      const jsonData = await exportRoles(includeDefaults);

      // Download file
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `promptlayer-roles-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showNotification(shadow, 'success', '✓ Roles exported successfully!');
    } catch (error) {
      logger.error('Export error:', error);
      showNotification(shadow, 'error', 'Failed to export roles');
    }
  });

  // Import roles - browse button
  importBrowseBtn?.addEventListener('click', () => {
    importFileInput?.click();
  });

  // Import roles - file input change
  importFileInput?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      await handleRoleImport(shadow, file);
    }
  });

  // Import roles - drag and drop
  importDropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    importDropZone.classList.add('drag-over');
  });

  importDropZone?.addEventListener('dragleave', () => {
    importDropZone.classList.remove('drag-over');
  });

  importDropZone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    importDropZone.classList.remove('drag-over');

    const file = (e as DragEvent).dataTransfer?.files?.[0];
    if (file && file.type === 'application/json') {
      await handleRoleImport(shadow, file);
    } else {
      showNotification(shadow, 'error', 'Please drop a JSON file');
    }
  });
}

/**
 * Load and display roles list
 */
async function loadRolesList(shadow: ShadowRoot): Promise<void> {
  const rolesContent = shadow.querySelector('#roles-list-content');
  if (!rolesContent) return;

  try {
    let roles = await getAllRoleBlueprints();

    // Apply search filter
    const searchInput = shadow.querySelector<HTMLInputElement>('#roles-search');
    const searchTerm = searchInput?.value.toLowerCase() || '';

    if (searchTerm) {
      roles = roles.filter(
        (role) =>
          role.name.toLowerCase().includes(searchTerm) ||
          role.description.toLowerCase().includes(searchTerm)
      );
    }

    // Apply category filter
    const categoryFilter = shadow.querySelector<HTMLSelectElement>('#roles-category-filter');
    const selectedCategory = categoryFilter?.value || '';

    if (selectedCategory) {
      roles = roles.filter((role) => role.category === selectedCategory);
    }

    // Sort: custom roles first, then defaults
    roles.sort((a, b) => {
      if (a.isDefault === b.isDefault) return a.name.localeCompare(b.name);
      return a.isDefault ? 1 : -1;
    });

    if (roles.length === 0) {
      rolesContent.innerHTML = `
        <div class="roles-empty">
          <div class="roles-empty-icon">📋</div>
          <p>No roles found</p>
        </div>
      `;
      return;
    }

    rolesContent.innerHTML = roles
      .map(
        (role) => `
      <div class="role-card ${role.isDefault ? 'default' : ''}" data-role-id="${role.id}">
        <div class="role-card-emoji">${role.emoji || '📋'}</div>
        <div class="role-card-content">
          <div class="role-card-header">
            <span class="role-card-name">${escapeHtml(role.name)}</span>
            <span class="role-category-badge">${ROLE_CATEGORIES[role.category]?.label || role.category}</span>
            ${role.isDefault ? '<span class="badge-default">Default</span>' : ''}
          </div>
          <div class="role-card-description">${escapeHtml(role.description)}</div>
        </div>
        <div class="role-card-actions">
          <button class="duplicate-btn" data-role-id="${role.id}" title="Duplicate">📋</button>
          ${
            !role.isDefault
              ? `
            <button class="edit-btn" data-role-id="${role.id}" title="Edit">✏️</button>
            <button class="delete-btn" data-role-id="${role.id}" title="Delete">🗑️</button>
          `
              : ''
          }
        </div>
      </div>
    `
      )
      .join('');

    // Add event listeners to role cards
    rolesContent.querySelectorAll('.duplicate-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const roleId = (e.target as HTMLElement).dataset.roleId;
        if (roleId) {
          await handleDuplicateRole(shadow, roleId);
        }
      });
    });

    rolesContent.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const roleId = (e.target as HTMLElement).dataset.roleId;
        if (roleId) {
          await handleEditRole(shadow, roleId);
        }
      });
    });

    rolesContent.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const roleId = (e.target as HTMLElement).dataset.roleId;
        if (roleId) {
          await handleDeleteRole(shadow, roleId);
        }
      });
    });
  } catch (error) {
    logger.error('Error loading roles:', error);
    rolesContent.innerHTML = '<div class="roles-empty"><p>Error loading roles</p></div>';
  }
}

/**
 * Handle role form submission (create/edit)
 */
async function handleRoleFormSubmit(shadow: ShadowRoot): Promise<void> {
  const formId = shadow.querySelector<HTMLInputElement>('#role-form-id');
  const formName = shadow.querySelector<HTMLInputElement>('#role-form-name');
  const formEmoji = shadow.querySelector<HTMLInputElement>('#role-form-emoji');
  const formCategory = shadow.querySelector<HTMLSelectElement>('#role-form-category');
  const formDescription = shadow.querySelector<HTMLInputElement>('#role-form-description');
  const formSystemPrompt = shadow.querySelector<HTMLTextAreaElement>('#role-form-system-prompt');
  const formDepth = shadow.querySelector<HTMLSelectElement>('#role-form-depth');
  const formOutputStyle = shadow.querySelector<HTMLInputElement>('#role-form-output-style');
  const formConstraints = shadow.querySelector<HTMLTextAreaElement>('#role-form-constraints');

  const roleId = formId?.value || '';
  const name = formName?.value.trim() || '';
  const emoji = formEmoji?.value.trim() || '';
  const category = (formCategory?.value || 'other') as RoleCategory;
  const description = formDescription?.value.trim() || '';
  const systemPrompt = formSystemPrompt?.value.trim() || '';
  const thinkingDepth = (formDepth?.value || 'medium') as 'shallow' | 'medium' | 'deep';
  const outputStyle = formOutputStyle?.value.trim() || 'Custom';
  const constraints =
    formConstraints?.value
      .split('\n')
      .map((c) => c.trim())
      .filter((c) => c) || [];

  // Validation
  if (!name || !description || !systemPrompt) {
    showNotification(shadow, 'error', 'Please fill in all required fields');
    return;
  }

  try {
    if (roleId) {
      // Update existing role
      await updateRole(roleId, {
        name,
        emoji,
        category,
        description,
        systemPrompt,
        thinkingDepth,
        outputStyle,
        constraints,
      });
      showNotification(shadow, 'success', '✓ Role updated successfully!');
    } else {
      // Create new role
      await createCustomRole(name, description, systemPrompt, category, {
        thinkingDepth,
        outputStyle,
        constraints,
        emoji,
      });
      showNotification(shadow, 'success', '✓ Role created successfully!');
    }

    // Refresh UI
    await loadRolesList(shadow);
    await populateRoleDropdown(shadow);
    resetRoleForm(shadow);

    // Switch to roles list tab
    shadow.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    shadow.querySelector('[data-tab="roles-list"]')?.classList.add('active');
    shadow.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    shadow.querySelector('#roles-list')?.classList.add('active');
  } catch (error) {
    logger.error('Role form error:', error);
    showNotification(shadow, 'error', 'Failed to save role');
  }
}

/**
 * Reset role form to default state
 */
function resetRoleForm(shadow: ShadowRoot): void {
  const form = shadow.querySelector<HTMLFormElement>('#role-form');
  const submitBtn = shadow.querySelector('#role-form-submit');

  form?.reset();
  (shadow.querySelector('#role-form-id') as HTMLInputElement).value = '';
  if (submitBtn) submitBtn.textContent = 'Create Role';
}

/**
 * Handle edit role - populate form with role data
 */
async function handleEditRole(shadow: ShadowRoot, roleId: string): Promise<void> {
  const role = await getRoleBlueprint(roleId);
  if (!role || role.isDefault) return;

  // Populate form
  (shadow.querySelector('#role-form-id') as HTMLInputElement).value = role.id;
  (shadow.querySelector('#role-form-name') as HTMLInputElement).value = role.name;
  (shadow.querySelector('#role-form-emoji') as HTMLInputElement).value = role.emoji || '';
  (shadow.querySelector('#role-form-category') as HTMLSelectElement).value = role.category;
  (shadow.querySelector('#role-form-description') as HTMLInputElement).value = role.description;
  (shadow.querySelector('#role-form-system-prompt') as HTMLTextAreaElement).value =
    role.systemPrompt;
  (shadow.querySelector('#role-form-depth') as HTMLSelectElement).value = role.thinkingDepth;
  (shadow.querySelector('#role-form-output-style') as HTMLInputElement).value = role.outputStyle;
  (shadow.querySelector('#role-form-constraints') as HTMLTextAreaElement).value =
    role.constraints.join('\n');

  // Update submit button text
  const submitBtn = shadow.querySelector('#role-form-submit');
  if (submitBtn) submitBtn.textContent = 'Update Role';

  // Switch to create/edit tab
  shadow.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  shadow.querySelector('[data-tab="create-role"]')?.classList.add('active');
  shadow.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
  shadow.querySelector('#create-role')?.classList.add('active');
}

/**
 * Handle duplicate role
 */
async function handleDuplicateRole(shadow: ShadowRoot, roleId: string): Promise<void> {
  try {
    const newRole = await duplicateRole(roleId);
    if (newRole) {
      showNotification(shadow, 'success', '✓ Role duplicated successfully!');
      await loadRolesList(shadow);
      await populateRoleDropdown(shadow);
    }
  } catch (error) {
    logger.error('Duplicate error:', error);
    showNotification(shadow, 'error', 'Failed to duplicate role');
  }
}

/**
 * Handle delete role
 */
async function handleDeleteRole(shadow: ShadowRoot, roleId: string): Promise<void> {
  if (!confirm('Are you sure you want to delete this role?')) return;

  try {
    const success = await deleteRole(roleId);
    if (success) {
      showNotification(shadow, 'success', '✓ Role deleted successfully!');
      await loadRolesList(shadow);
      await populateRoleDropdown(shadow);
    } else {
      showNotification(shadow, 'error', 'Cannot delete default roles');
    }
  } catch (error) {
    logger.error('Delete error:', error);
    showNotification(shadow, 'error', 'Failed to delete role');
  }
}

/**
 * Handle role import from file
 */
async function handleRoleImport(shadow: ShadowRoot, file: File): Promise<void> {
  const importStatus = shadow.querySelector('#import-status');

  try {
    const text = await file.text();
    const strategyInput = shadow.querySelector<HTMLInputElement>(
      'input[name="import-strategy"]:checked'
    );
    const strategy = (strategyInput?.value || 'merge') as 'replace' | 'merge';

    const result = await importRoles(text, strategy);

    // Show status
    if (importStatus) {
      importStatus.classList.remove('hidden', 'error');
      importStatus.classList.add('success');
      importStatus.innerHTML = `
        <strong>Import Complete!</strong><br>
        Imported: ${result.imported} | Skipped: ${result.skipped}
        ${result.errors.length > 0 ? `<br>Errors: ${result.errors.join(', ')}` : ''}
      `;
    }

    // Refresh UI
    await loadRolesList(shadow);
    await populateRoleDropdown(shadow);

    showNotification(shadow, 'success', `✓ Imported ${result.imported} roles!`);
  } catch (error) {
    logger.error('Import error:', error);
    if (importStatus) {
      importStatus.classList.remove('hidden', 'success');
      importStatus.classList.add('error');
      importStatus.textContent = 'Failed to import roles. Please check the file format.';
    }
    showNotification(shadow, 'error', 'Failed to import roles');
  }
}

/**
 * Setup AI role suggestion toast
 */
function setupRoleSuggestion(shadow: ShadowRoot): void {
  const addBtn = shadow.querySelector('#suggestion-add-btn');
  const dismissBtn = shadow.querySelector('#suggestion-dismiss-btn');
  const toast = shadow.querySelector('#role-suggestion-toast');

  addBtn?.addEventListener('click', async () => {
    if (currentSuggestedRole) {
      try {
        await createCustomRole(
          currentSuggestedRole.name,
          currentSuggestedRole.description,
          generateSystemPromptFromSuggestion(currentSuggestedRole),
          currentSuggestedRole.category,
          {
            thinkingDepth: 'medium',
            outputStyle: 'Custom',
            constraints: [],
            emoji: ROLE_CATEGORIES[currentSuggestedRole.category]?.emoji || '📋',
          }
        );

        showNotification(shadow, 'success', `✓ Added "${currentSuggestedRole.name}" role!`);
        await populateRoleDropdown(shadow);
        toast?.classList.add('hidden');
        currentSuggestedRole = null;
      } catch (error) {
        logger.error('Failed to add suggested role:', error);
        showNotification(shadow, 'error', 'Failed to add role');
      }
    }
  });

  dismissBtn?.addEventListener('click', () => {
    toast?.classList.add('hidden');
    currentSuggestedRole = null;
  });
}

/**
 * Show AI role suggestion toast
 */
function showRoleSuggestion(shadow: ShadowRoot, suggestedRole: SuggestedRole): void {
  currentSuggestedRole = suggestedRole;

  const toast = shadow.querySelector('#role-suggestion-toast');
  const suggestionText = shadow.querySelector('#suggestion-text');

  if (suggestionText) {
    suggestionText.textContent = `Add "${suggestedRole.name}" (${ROLE_CATEGORIES[suggestedRole.category]?.label || suggestedRole.category}) - ${suggestedRole.reason}`;
  }

  toast?.classList.remove('hidden');

  // Auto-dismiss after 15 seconds
  setTimeout(() => {
    toast?.classList.add('hidden');
  }, 15000);
}

/**
 * Generate a basic system prompt from a suggested role
 */
function generateSystemPromptFromSuggestion(suggestion: SuggestedRole): string {
  return `You are an expert prompt engineer specializing in ${suggestion.name.toLowerCase()} tasks.

Your goal is to transform rough prompts into well-structured prompts that:
- ${suggestion.reason}
- Provide clear, actionable guidance
- Optimize for quality results in this domain

Structure every enhanced prompt with these sections:
1. ROLE: Define the AI's expertise and perspective
2. OBJECTIVE: State the specific goal
3. CONSTRAINTS: List requirements and limitations
4. OUTPUT FORMAT: Specify the desired output structure

Focus on clarity, precision, and domain-specific best practices.`;
}

/**
 * Remove toolbar (cleanup)
 */
export function removeToolbar(): void {
  // Clean up all event listeners with error handling
  eventCleanupFunctions.forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      logger.warn('Cleanup function failed:', error);
    }
  });
  eventCleanupFunctions = [];

  // Disconnect theme observer
  if (themeObserver) {
    try {
      themeObserver.disconnect();
    } catch (error) {
      logger.warn('Theme observer disconnect failed:', error);
    }
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
