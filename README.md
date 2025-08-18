# Shadow UI (Sh4d0w_UI)

A grayscale Electron dashboard with terminal integration and real-time system monitoring.

![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.3-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

## 🌟 Features

- **Live Terminal Integration**: Real terminal backed by your system shell (bash/zsh/pwsh) via `@homebridge/node-pty-prebuilt-multiarch`
- **Real-time System Monitoring**: 
  - CPU load and usage
  - Memory consumption
  - Network throughput
  - Disk usage statistics
  - Temperature monitoring (when available)
  - Battery status (when available)
- **Sleek UI Design**: Grayscale theme inspired by eDEX-UI with modern styling
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Responsive Interface**: Adaptive panels and layouts

## 📋 Prerequisites

- **Node.js**: Version 20 LTS or higher
- **npm**: Latest version
- **Operating System**: Windows, macOS, or Linux

## 🚀 Quick Start

### Installation
```bash
cd Sh4d0w_UI
npm install
```

### Development
```bash
npm start
```

### Building for Production
```bash
# Build for current platform
npm run pack

# Build distributable
npm run dist
```

## 🔧 Project Structure

```
Sh4d0w_UI/
├── main.js              # Main Electron process
├── preload.js           # Preload script for security
├── package.json         # Project configuration
├── renderer/
│   ├── index.html       # Main UI
│   ├── renderer.js      # UI logic and system monitoring
│   ├── styles.css       # Main styles
│   └── styles-paranoid-ubuntu.css  # Alternative theme
└── README.md           # This file
```

## Technology Stack

- **Electron**: Desktop application framework
- **Node.js**: Runtime environment
- **@homebridge/node-pty-prebuilt-multiarch**: Terminal emulation
- **electron-store**: Data persistence
- **systeminformation**: System monitoring

## System Requirements

### Windows
- Windows 10 or later
- Visual C++ Redistributable (usually included)

### macOS
- macOS 10.14 or later
- Xcode Command Line Tools (if building from source)

### Linux
- Ubuntu 18.04+ / Debian 10+ / CentOS 8+ or equivalent
- Build essentials: `sudo apt install build-essential`
- Python 3 for native modules

## Troubleshooting

### Fresh Installation (Windows)
If you encounter issues with prebuilt binaries:

```powershell
# Clean install
rmdir /s /q node_modules 2>$null
del package-lock.json yarn.lock pnpm-lock.yaml 2>$null
npm install
npm start
```

### Common Issues

1. **Node-pty build errors**: Ensure you have Node.js 20 LTS installed
2. **Font rendering issues**: Adjust `fontSize` and container sizing in `renderer.js`
3. **Permission errors**: Run with appropriate permissions for system monitoring

## Configuration

The application uses `electron-store` for persistent configuration. Settings are automatically saved and restored between sessions.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Commit your changes: `git commit -am 'Add some feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [eDEX-UI](https://github.com/GitSquared/edex-ui)
- Built with [Electron](https://electronjs.org/)
- Terminal integration via [@homebridge/node-pty-prebuilt-multiarch](https://www.npmjs.com/package/@homebridge/node-pty-prebuilt-multiarch)

## Version History

- **v0.1.3**: Current version with enhanced system monitoring
- Previous versions focused on basic terminal integration

---

**Shadow UI** - A modern take on retro-futuristic terminal interfaces.
