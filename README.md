# Leverless Bongo Cat 1.1.0

A web-based leverless controller visualization tool that displays real-time input from game controllers, designed for use as a browser source in OBS (Open Broadcaster Software).

## Quick Start

### Option 1: Use GitHub Pages (No Download Required)
For quick and easy access without any setup, visit:
https://unitybirb.github.io/Leverless-BongoCat/

This version includes the default Bongo Cat setup and is perfect if you don't need customization.

### Option 2: Download for Local Use/Customization
If you want to customize the project or run it locally:

1. Download the latest release from the [Releases page](https://github.com/unitybirb/Leverless-BongoCat/releases)
2. Extract the ZIP file
3. Open `hitbox-bongocat.html` in your browser

That's it! No server or installation required.

## Technical Details

### TypeScript Implementation
- Strict type checking for improved code reliability
- Interface definitions for all major types:
  - `ButtonMappings`: Controller button mapping configuration
  - `CalibrationStep`: Step-by-step calibration process
  - `AppState`: Application state management
  - `AxisMapping`: Gamepad axis configuration
- Non-module architecture for direct browser use
- Comprehensive type definitions for the Gamepad API

### Designed for use as a browser source in OBS (Open Broadcaster Software).

## Features

- **NEW in 1.1.0**: Customizable background color with full HSV/RGB/Hex color picker

- **Real-time Controller Input Visualization**: Displays button presses and directional inputs from game controllers
- **Universal Controller Support**: Works with any controller that supports the Gamepad API, including:
  - Leverless controllers (Hitbox, Mixbox, etc.)
  - Standard gamepads
  - Arcade sticks
  - XInput devices
- **Calibration System**: Interactive calibration process to map your specific controller layout
- **OBS Integration**: Designed to work seamlessly as a browser source in OBS
- **Responsive Design**: Adapts to different screen sizes and aspect ratios
- **Configurable**: Save and load calibration settings
- **Auto-Hide Interface**: Config buttons automatically fade out after 5 seconds of inactivity for a cleaner interface

## File Structure

```
leverless-bongo-cat/
├── hitbox-bongocat.html      # Main HTML file
├── hitbox-controller.ts      # TypeScript source for controller logic
├── tsconfig.json            # TypeScript configuration
├── dist/                    # Compiled JavaScript output
│   └── hitbox-controller.js # Compiled controller logic
├── styles.css               # Styling
└── resources/
    └── img/
        └── bongocat/
            ├── base/        # Button and directional overlays
            ├── arms/        # Arm animation frames
            ├── left/        # Left hand hitbox overlays
            └── right/       # Right hand hitbox overlays
```

## Downloading the Project

### Option 1: Clone the Repository (Recommended for Developers)

If you have Git installed and want to contribute or stay updated with the latest changes:

```bash
git clone https://github.com/unitybirb/leverless-bongo-cat.git
cd leverless-bongo-cat
```

### Option 2: Download Release

For users who want a stable version:

1. Go to the [Releases page](https://github.com/unitybirb/leverless-bongo-cat/releases)
2. Click on the latest release (e.g., "v1.0.1")
3. Download the source code ZIP file
4. Extract the ZIP file to your desired location

### Option 3: Download ZIP from Main Branch

For the latest development version:

1. Go to the main repository page
2. Click the green "Code" button
3. Select "Download ZIP"
4. Extract the ZIP file to your desired location

## Setup Instructions

### 1. Basic Setup
1. Open `hitbox-bongocat.html` in a web browser
2. Connect your controller
3. Follow the calibration process when prompted

### 2. OBS Integration
1. In OBS, add a new "Browser Source"
2. Set the URL to the local path of `hitbox-bongocat.html`
3. Set the width and height as needed (recommended: 612x354 or scaled proportionally)
4. Enable "Control audio via OBS" if you want audio feedback

### 3. Controller Calibration
The tool will automatically prompt for calibration when first used:

1. **Button Calibration**: Press each button when prompted
2. **Axis Calibration**: Move each axis to its extremes when prompted
3. **Trigger Calibration**: Pull triggers fully when prompted

The calibration supports:
- Standard buttons (0-15)
- Axes (0-5) with directional mapping
- Triggers as action buttons
- Mixed button/axis configurations

## Controls

### Calibration Management
- **Reset**: Clears all calibration data and restarts the process
- **Save/Load**: Persists your calibration settings in browser storage
- **Download/Upload**: Export/import calibration files for sharing or backup

## Troubleshooting

### Controller Not Detected
1. Ensure your controller is connected and recognized by your system
2. Try refreshing the page
3. Check browser permissions for gamepad access
4. Test in a different browser (Chrome recommended)

### Calibration Issues
1. Make sure to release buttons/axes between calibration steps
2. For triggers, pull them fully and release completely
3. If calibration skips steps, try resetting and starting over
4. Check that your controller is sending the expected inputs

### OBS Issues
1. **Chromium Limitations**: OBS uses Chromium which has limited Gamepad API support
   - Solution: Use XInput mode or gamepad-to-keyboard mappers
   - Alternative: Use Firefox for testing, then capture the window
2. **No Input Detection**: Ensure the browser source is active and focused

### Browser Compatibility
- **Chrome/Chromium**: Full support
- **Firefox**: Full support

## Technical Details

### Gamepad API Support
The tool uses the Web Gamepad API to detect controller inputs:
- Button states (pressed/released)
- Axis values (-1.0 to 1.0)
- Trigger values (0.0 to 1.0)

### Calibration Storage
Calibration data is stored in browser localStorage:
- Button mappings
- Axis mappings with thresholds
- Trigger configurations
- Custom button assignments

## Customization

### Adding New Controllers
1. Follow the calibration process
2. The tool automatically adapts to your controller's button/axis layout
3. Save your configuration for future use

### Visual Customization
- Modify `styles.css` for appearance changes
- Replace images in `resources/img/bongocat/` for visual themes
- Adjust HTML structure in `hitbox-bongocat.html` for layout changes

## Development Setup

### Prerequisites
- Node.js and npm installed
- TypeScript compiler (`npm install -g typescript`)

### Building the Project
1. Install dependencies:
```bash
npm install
```

2. Compile TypeScript:
```bash
npx tsc
```

The TypeScript compiler will watch for changes and recompile automatically. The compiled JavaScript will be output to the `dist` directory.

### Running the Project
Simply open `hitbox-bongocat.html` in your browser. The project is designed to work without a server, using only client-side code.

For development:
1. Make changes to `hitbox-controller.ts`
2. TypeScript will automatically compile to `dist/hitbox-controller.js`
3. Refresh your browser to see changes

### Project Structure
- `hitbox-controller.ts`: Main TypeScript source code
- `dist/hitbox-controller.js`: Compiled JavaScript (do not edit directly)
- `tsconfig.json`: TypeScript configuration
  - Configured for non-module output
  - Targets ES2015+ features
  - Strict type checking enabled

## Version History

### 1.1.0
- Added customizable background color with full HSV/RGB/Hex color picker
- Complete refactor from JavaScript to TypeScript for improved maintainability and type safety
- New build system using TypeScript compiler
- Updated project structure with separate source and distribution directories

### 1.0.1
- Added auto-hide functionality for config buttons (Reset, Download Config, Upload Config)
- Config buttons fade out completely after 5 seconds of inactivity
- Smooth 0.5-second transitions for polished user experience
- Immediate visibility restoration on any user interaction (mouse movement, clicks, keyboard input)

### 1.0.0
- Reorganized file structure for better maintainability
- Improved calibration system with axis support
- Enhanced OBS compatibility
- Added configuration management features
- Translated all code to English
- Removed debug code and unused files

## License

This project is open source and available under the MIT License.

## Acknowledgments

This project is based on the original [Arcade-Bongo-Cat](https://github.com/ROMthesheep/Arcade-Bongo-Cat) repository by ROMthesheep.

## Support

For issues, questions, or feature requests, please open an issue on the project repository.

## OBS Setup

### For GitHub Pages Version
1. In OBS, add a new "Browser" source
2. Set the URL to: `https://unitybirb.github.io/Leverless-BongoCat/`
3. Set Width: 612 and Height: 354
4. Click "OK" to add the source

### For Local Version
1. In OBS, add a new "Browser" source
2. Enable "Local file" checkbox
3. Click "Browse" and select your `hitbox-bongocat.html` file
4. Set Width: 612 and Height: 354
5. Click "OK" to add the source

### Configuring in OBS
- To customize settings: Right-click the browser source and select "Interact"
- The config buttons appear at the top-right when you hover over the source
- Buttons auto-hide after 5 seconds of inactivity
- You can calibrate your controller, adjust the background color, and save/load configurations