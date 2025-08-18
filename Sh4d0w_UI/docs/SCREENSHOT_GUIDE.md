# Shadow UI Screenshot Guide

This guide will help you capture professional screenshots for the README.

## How to Take Screenshots

### 1. Start the Application
```bash
cd Sh4d0w_UI
npm start
```

### 2. Recommended Screenshots

#### Main Terminal View (`terminal.png`)
- **Size**: 1200x800 pixels recommended
- **Content**: Show the terminal with some commands running
- **Commands to run before screenshot**:
  ```bash
  ls -la
  ps aux | head -10
  echo "Shadow UI Terminal Demo"
  neofetch  # if available
  ```

#### System Monitoring View (`monitoring.png`)
- **Size**: 1200x800 pixels recommended  
- **Content**: Focus on the system monitoring panels
- **What to show**:
  - CPU usage graphs
  - Memory statistics
  - Network throughput
  - Disk usage bars
  - Temperature readings (if available)

#### Full Dashboard (`dashboard.png`)
- **Size**: 1400x900 pixels (full window)
- **Content**: Complete application interface
- **What to include**:
  - All panels visible
  - Terminal with some output
  - System stats populated
  - Clock showing current time

#### Alternative Theme (`theme-paranoid-ubuntu.png`)
- **Size**: 1200x800 pixels recommended
- **Content**: Application using the alternative theme
- **Note**: Switch theme in application settings

## Screenshot Tips

### Technical Settings
- **Format**: PNG (best quality, supports transparency)
- **DPI**: 96 DPI minimum, 144 DPI preferred for high-quality displays
- **Color**: Full color (24-bit or 32-bit)

### Composition
- Ensure the application window is clean and uncluttered
- Close unnecessary background applications
- Use a clean desktop background
- Position the window centrally on screen

### Content Preparation
1. **Terminal Content**: Run interesting but safe commands that showcase functionality
2. **System Load**: Open a few applications to show realistic system usage
3. **Time**: Take screenshots when system stats are active and interesting

### Windows-Specific Instructions
1. Use **Windows + Shift + S** for Snipping Tool
2. Or use **Print Screen** key and paste into Paint
3. Alternative: Use **Alt + Print Screen** to capture just the active window

## File Naming Convention

Save screenshots with these exact names in `docs/screenshots/`:
- `terminal.png` - Main terminal interface
- `monitoring.png` - System monitoring focus
- `dashboard.png` - Full application view
- `theme-paranoid-ubuntu.png` - Alternative theme
- `startup.png` - Application loading (optional)

## After Taking Screenshots

1. **Optimize file sizes**: Use tools like TinyPNG or similar to compress without quality loss
2. **Verify quality**: Ensure text is readable and interface elements are clear
3. **Update README**: Uncomment the screenshot lines in README.md
4. **Commit changes**: Add screenshots to git and commit

```bash
git add docs/screenshots/*.png
git commit -m "docs: add application screenshots"
git push origin Master
```

## Troubleshooting

### If the app won't start:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm start
```

### If system stats aren't showing:
- Wait 2-3 seconds after startup for data to populate
- Try running some CPU-intensive tasks in the background

### If fonts look wrong:
- Ensure you have a good monospace font installed
- Check that Windows has proper font rendering enabled
