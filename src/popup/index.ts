/**
 * Popup UI JavaScript
 */

// Load and display stats
async function loadStats() {
  try {
    // Get API key status
    const apiKey = await chrome.storage.local.get('promptlayer_api_key');
    const apiKeyStatus = document.getElementById('api-key-status');
    if (apiKeyStatus) {
      apiKeyStatus.textContent = apiKey.promptlayer_api_key ? 'Configured ✓' : 'Not configured';
      apiKeyStatus.style.color = apiKey.promptlayer_api_key ? '#10a37f' : '#ef4444';
    }

    // Get prompts count
    const prompts = await chrome.storage.local.get('promptlayer_prompts');
    const promptsCount = document.getElementById('prompts-count');
    if (promptsCount) {
      promptsCount.textContent = prompts.promptlayer_prompts?.length || 0;
    }

    // Get usage stats
    const stats = await chrome.storage.local.get('promptlayer_stats');
    const statsData = stats.promptlayer_stats || {
      enhancementsPerformed: 0,
      totalApiCalls: 0,
      averageEnhancementTime: 0,
      totalTokensUsed: 0,
      totalCostUSD: 0,
      monthlyCostUSD: 0,
      currentMonth: new Date().toISOString().slice(0, 7),
    };

    // Check if we need to reset monthly cost
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (statsData.currentMonth !== currentMonth) {
      statsData.monthlyCostUSD = 0;
      statsData.currentMonth = currentMonth;
      await chrome.storage.local.set({ promptlayer_stats: statsData });
    }

    const enhancementsCount = document.getElementById('enhancements-count');
    if (enhancementsCount) {
      enhancementsCount.textContent = statsData.enhancementsPerformed || 0;
    }

    const apiCallsCount = document.getElementById('api-calls-count');
    if (apiCallsCount) {
      apiCallsCount.textContent = statsData.totalApiCalls || 0;
    }

    const avgTime = document.getElementById('avg-time');
    if (avgTime) {
      const timeInSeconds = ((statsData.averageEnhancementTime || 0) / 1000).toFixed(1);
      avgTime.textContent = `${timeInSeconds}s`;
    }

    // Display cost information
    const monthlyCost = document.getElementById('monthly-cost');
    if (monthlyCost) {
      monthlyCost.textContent = `$${(statsData.monthlyCostUSD || 0).toFixed(4)}`;
    }

    const totalTokens = document.getElementById('total-tokens');
    if (totalTokens) {
      totalTokens.textContent = (statsData.totalTokensUsed || 0).toLocaleString();
    }

    const totalCost = document.getElementById('total-cost');
    if (totalCost) {
      totalCost.textContent = `$${(statsData.totalCostUSD || 0).toFixed(4)}`;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Open ChatGPT
document.getElementById('open-chatgpt-btn')?.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://chatgpt.com' });
});

// Reset stats
document.getElementById('reset-stats-btn')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to reset all statistics?')) {
    await chrome.storage.local.set({
      promptlayer_stats: {
        enhancementsPerformed: 0,
        promptsSaved: 0,
        mostUsedRole: '',
        totalApiCalls: 0,
        averageEnhancementTime: 0,
        lastResetDate: new Date(),
      },
    });
    loadStats();
  }
});

// Load stats on popup open
document.addEventListener('DOMContentLoaded', loadStats);
