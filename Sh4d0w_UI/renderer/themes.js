// themes.js
// Theme definitions for Shadow UI
// By: NathanGr33n

const themes = {
  shadow: {
    name: 'Shadow (Default)',
    colors: {
      bg0: '#0d0e10',
      bg1: '#14161a',
      bg2: '#1b1e25',
      fg: '#f2f4f6',
      muted: '#b9c2cb',
      accent: '#E95420',
      accent2: '#F06A2C',
      special: '#2C001E',
      grid: '#232832',
    },
    terminal: {
      background: '#0a0b0d',
      foreground: '#e8e9eb',
      cursor: '#e8e9eb',
      black: '#0a0b0d',
      brightBlack: '#15181e',
      white: '#e8e9eb',
      brightWhite: '#ffffff',
    }
  },
  
  matrix: {
    name: 'Matrix',
    colors: {
      bg0: '#0a0f0a',
      bg1: '#0f140f',
      bg2: '#141a14',
      fg: '#00ff41',
      muted: '#00aa2b',
      accent: '#00ff41',
      accent2: '#00dd38',
      special: '#003311',
      grid: '#1a2a1a',
    },
    terminal: {
      background: '#000000',
      foreground: '#00ff41',
      cursor: '#00ff41',
      black: '#000000',
      brightBlack: '#003311',
      white: '#00ff41',
      brightWhite: '#00ff88',
    }
  },

  cyberpunk: {
    name: 'Cyberpunk',
    colors: {
      bg0: '#0a0a14',
      bg1: '#12121f',
      bg2: '#1a1a2e',
      fg: '#ff00ff',
      muted: '#aa88ff',
      accent: '#00ffff',
      accent2: '#ff00ff',
      special: '#2d0050',
      grid: '#2a2a3e',
    },
    terminal: {
      background: '#0a0a14',
      foreground: '#ff00ff',
      cursor: '#00ffff',
      black: '#0a0a14',
      brightBlack: '#2d0050',
      white: '#ff00ff',
      brightWhite: '#ffffff',
    }
  },

  dracula: {
    name: 'Dracula',
    colors: {
      bg0: '#1e1f29',
      bg1: '#282a36',
      bg2: '#343746',
      fg: '#f8f8f2',
      muted: '#6272a4',
      accent: '#ff79c6',
      accent2: '#bd93f9',
      special: '#44475a',
      grid: '#44475a',
    },
    terminal: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      black: '#21222c',
      brightBlack: '#6272a4',
      white: '#f8f8f2',
      brightWhite: '#ffffff',
    }
  },

  nord: {
    name: 'Nord',
    colors: {
      bg0: '#2e3440',
      bg1: '#3b4252',
      bg2: '#434c5e',
      fg: '#eceff4',
      muted: '#d8dee9',
      accent: '#88c0d0',
      accent2: '#81a1c1',
      special: '#4c566a',
      grid: '#4c566a',
    },
    terminal: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#d8dee9',
      black: '#3b4252',
      brightBlack: '#4c566a',
      white: '#e5e9f0',
      brightWhite: '#eceff4',
    }
  },

  gruvbox: {
    name: 'Gruvbox Dark',
    colors: {
      bg0: '#1d2021',
      bg1: '#282828',
      bg2: '#3c3836',
      fg: '#ebdbb2',
      muted: '#a89984',
      accent: '#fe8019',
      accent2: '#fabd2f',
      special: '#504945',
      grid: '#504945',
    },
    terminal: {
      background: '#282828',
      foreground: '#ebdbb2',
      cursor: '#ebdbb2',
      black: '#282828',
      brightBlack: '#928374',
      white: '#ebdbb2',
      brightWhite: '#fbf1c7',
    }
  },

  monokai: {
    name: 'Monokai',
    colors: {
      bg0: '#1e1e1e',
      bg1: '#272822',
      bg2: '#3e3d32',
      fg: '#f8f8f2',
      muted: '#75715e',
      accent: '#f92672',
      accent2: '#66d9ef',
      special: '#49483e',
      grid: '#49483e',
    },
    terminal: {
      background: '#272822',
      foreground: '#f8f8f2',
      cursor: '#f8f8f0',
      black: '#272822',
      brightBlack: '#75715e',
      white: '#f8f8f2',
      brightWhite: '#f9f8f5',
    }
  },

  light: {
    name: 'Light Mode',
    colors: {
      bg0: '#ffffff',
      bg1: '#f5f5f5',
      bg2: '#e8e8e8',
      fg: '#1a1a1a',
      muted: '#6a6a6a',
      accent: '#0066cc',
      accent2: '#0052a3',
      special: '#d0d0d0',
      grid: '#d8d8d8',
    },
    terminal: {
      background: '#ffffff',
      foreground: '#1a1a1a',
      cursor: '#1a1a1a',
      black: '#1a1a1a',
      brightBlack: '#6a6a6a',
      white: '#d0d0d0',
      brightWhite: '#ffffff',
    }
  },

  highContrast: {
    name: 'High Contrast',
    colors: {
      bg0: '#000000',
      bg1: '#0a0a0a',
      bg2: '#1a1a1a',
      fg: '#ffffff',
      muted: '#c0c0c0',
      accent: '#ffff00',
      accent2: '#00ffff',
      special: '#333333',
      grid: '#333333',
    },
    terminal: {
      background: '#000000',
      foreground: '#ffffff',
      cursor: '#ffff00',
      black: '#000000',
      brightBlack: '#808080',
      white: '#ffffff',
      brightWhite: '#ffffff',
    }
  }
};

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = themes;
}
