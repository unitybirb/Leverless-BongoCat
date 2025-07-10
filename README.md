# Leverless Bongo Cat 1.1.0

A web-based visualization tool that displays real-time input from leverless controllers, designed for use as a browser source in OBS (Open Broadcaster Software).

## Quick Start Options

### Option 1: Use GitHub Pages (Instant Access)
For immediate use with default settings:
1. Visit: https://unitybirb.github.io/Leverless-BongoCat/
2. Connect your controller
3. Follow the calibration prompts

Perfect for:
- Quick testing
- Default setup
- No download needed

### Option 2: Download for Local Use/Customization
For custom settings and local use:

1. Download the latest release from the [Releases page](https://github.com/unitybirb/leverless-bongo-cat/releases)
2. Extract the ZIP file
3. Open `hitbox-bongocat.html` in your browser
4. Connect your controller
5. Follow the calibration prompts

## OBS Setup

### Using GitHub Pages Version
1. In OBS, add a new "Browser" source
2. Set the URL to: `https://unitybirb.github.io/Leverless-BongoCat/`
3. Set Width: 612 and Height: 354
4. Click "OK"

### Using Local Version
1. In OBS, add a new "Browser" source
2. Enable "Local file" checkbox
3. Click "Browse" and select your `hitbox-bongocat.html`
4. Set Width: 612 and Height: 354
5. Click "OK"

### Configuring in OBS
- Right-click the browser source and select "Interact" to access settings
- Config buttons appear at top-right on hover
- Buttons auto-hide after 5 seconds
- Calibrate controller, adjust background color, and save/load configs

## Features

- **NEW in 1.1.0**: Customizable background color with full HSV/RGB/Hex color picker
- **Real-time Controller Input Visualization**: Shows button presses and directional inputs
- **Universal Controller Support**: Works with any leverless device
- **Smart Calibration**: Interactive process to map your specific controller
- **Config Management**: Save, load, import, and export your settings
- **Auto-Hide Interface**: Clean interface with auto-hiding config buttons

## Troubleshooting

### Controller Not Detected?
1. Check controller connection
2. Refresh the page
3. Verify browser gamepad permissions
4. Try a different browser (Chrome recommended)

### Calibration Issues?
1. Release buttons/axes between steps
2. Pull triggers fully and release completely
3. If steps skip, try resetting
4. Test controller inputs separately

### OBS Issues?
1. **Browser Source**: Make sure it's active and focused
2. **No Inputs**: Try XInput mode or window capture
3. **Size Issues**: Use 612x354 or maintain aspect ratio

## Advanced Usage

### Customization
- Modify background color via color picker
- Save/load controller configurations
- Export/import settings for backup or sharing

### Development
Prerequisites:
- Node.js and npm
- TypeScript (`npm install -g typescript`)

Building:
```bash
npm install
npx tsc
```

## Technical Details

### Implementation
- TypeScript with strict type checking
- Non-module architecture for direct browser use
- Comprehensive Gamepad API integration
- Local storage for settings persistence

### File Structure
```
leverless-bongo-cat/
├── index.html              # Main HTML file
├── hitbox-controller.ts    # TypeScript source
├── tsconfig.json           # TypeScript config
├── dist/                   # Compiled output
├── styles.css              # Styling
└── resources/img/          # Image assets
```

## Version History

### 1.1.0
- Added HSV/RGB/Hex color picker
- TypeScript refactor
- New build system
- Improved project structure

### 1.0.1
- Auto-hiding config buttons
- Smooth transitions
- Better user experience

### 1.0.0
- Initial release
- Calibration system
- Configuration management

## Support and Credits

- **Issues/Questions**: Open an issue on GitHub
- **Original Project**: Based on [Arcade-Bongo-Cat](https://github.com/ROMthesheep/Arcade-Bongo-Cat)
- **License**: MIT

For detailed development information, see the [GitHub repository](https://github.com/unitybirb/leverless-bongo-cat).