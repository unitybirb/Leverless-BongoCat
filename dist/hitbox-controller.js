"use strict";
// Arcade Bongo Cat Hitbox Mapping and Visualization Tool
// Shows button presses and directional inputs on a hitbox-style controller
/**
 * State object to hold all mutable state
 * Performance improvement: Cache DOM elements to avoid repeated queries
 */
const state = {
    isCalibrating: false,
    currentCalibrationStep: 0,
    calibrationMappings: {},
    calibrationAnimationFrame: null,
    lastCalibrationButtons: [],
    waitingForRelease: false,
    axes: 0,
    stick: 0,
    nEjeX: 0,
    nEjeY: 1,
    invertX: 1,
    invertY: 1,
    gamepad: null,
    x: 0,
    y: 0,
    lastCalibrationInput: null,
    lastCalibrationAxes: [],
    restingCalibrationAxes: [],
    lastMouseMove: Date.now(),
    hideTimeout: null,
    buttonsVisible: true,
    lastArmIndex: -1,
    armReturnTimeout: null,
    previousButtonStates: [],
    lastPressedButtonIndex: -1,
    previousDirectionalStates: { left: false, right: false, up: false, down: false },
    lastPressedDirectional: '',
};
/**
 * Cache DOM elements to improve performance
 */
const domCache = {
    buttons: {},
    directionals: {},
    arms: {},
    calibrationElements: {},
    // Initialize cache
    init() {
        // Cache button elements
        for (let i = 1; i <= 8; i++) {
            this.buttons[`button${i}`] = document.getElementById(`button${i}`);
        }
        // Cache directional elements
        ['up', 'down', 'left', 'right', 'leftup', 'left0', 'left1', 'left2', 'left3', 'rightUp'].forEach(id => {
            this.directionals[id] = document.getElementById(id);
        });
        // Cache arm elements
        for (let i = 1; i <= 8; i++) {
            this.arms[`arm${i}`] = document.getElementById(`arm${i}`);
        }
        // Cache calibration elements
        this.calibrationElements.overlay = document.getElementById('calibration-overlay');
        this.calibrationElements.schematicWrapper = document.getElementById('calibration-schematic-wrapper');
        this.calibrationElements.highlightGroup = document.getElementById('calibration-highlight-group');
        this.calibrationElements.currentButton = document.getElementById('current-button');
        this.calibrationElements.progressFill = document.getElementById('progress-fill');
        this.calibrationElements.progressText = document.getElementById('progress-text');
    }
};
/**
 * Application configuration constants
 */
const CONFIG = {
    version: '1.2.0',
    defaultMappings: {
        vb1: 1, vb2: 2, vb3: 7, vb4: 6, vb5: 0, vb6: 3, vb7: 5, vb8: 4,
        vbUp: 13, vbDown: 12, vbRight: 15, vbLeft: 14
    },
    calibrationTimeout: 30000, // 30 seconds
    autoHideDelay: 5000, // 5 seconds
};
/**
 * Performance and input constants
 */
const INPUT_CONSTANTS = {
    AXIS_THRESHOLD: 0.5, // Threshold for axis input detection
    AXIS_DEADZONE: 0.2, // Deadzone for axis calibration
    MAX_ACTION_BUTTONS: 8, // Maximum number of action buttons
    MIN_GAMEPAD_BUTTONS: 4, // Minimum required gamepad buttons
    MIN_GAMEPAD_AXES: 2, // Minimum required gamepad axes
    MAX_FRAME_TIME: 16.67, // Target frame time (60fps)
    PERF_MONITOR_INTERVAL: 1000, // Performance monitoring interval in ms
};
/**
 * Animation state constants for better performance
 */
const ANIMATION_CONSTANTS = {
    ARM_COUNT: 8,
    DIRECTIONAL_COUNT: 4,
    NEUTRAL_ARM_INDEX: -1,
    NEUTRAL_LEFT_STATE: 0,
    LEFT_UP_STATE: 4,
};
/**
 * Error handling and validation constants
 */
const VALIDATION_CONSTANTS = {
    MAX_RETRY_ATTEMPTS: 3,
    DEBOUNCE_DELAY: 1, // Minimum delay between input processing (1ms to allow 60fps)
    STATE_RESET_DELAY: 100, // Delay before resetting stale state
};
/**
 * Logging utility with different levels
 */
const logger = {
    debug: (message, ...args) => {
        // Only log debug in development (when not minified)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.debug(`[BongoCat Debug] ${message}`, ...args);
        }
    },
    info: (message, ...args) => {
        console.info(`[BongoCat] ${message}`, ...args);
    },
    warn: (message, ...args) => {
        console.warn(`[BongoCat Warning] ${message}`, ...args);
    },
    error: (message, error, ...args) => {
        console.error(`[BongoCat Error] ${message}`, error, ...args);
    }
};
/**
 * Sleep utility function
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Utility: Get gamepad safely with better error handling
 */
function getGamepad() {
    const result = safeSync(() => {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        // Find the first connected gamepad
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad && gamepad.connected) {
                return gamepad;
            }
        }
        return null;
    }, 'Failed to get gamepad', null);
    return result ?? null;
}
/**
 * Enhanced gamepad connection detection
 */
function detectGamepadSupport() {
    return !!(navigator.getGamepads || navigator.webkitGetGamepads);
}
/**
 * Check if gamepad has minimum required inputs
 */
function validateGamepad(gamepad) {
    return gamepad.buttons.length >= 4 && gamepad.axes.length >= 2;
}
/**
 * Handle mouse movement to reset auto-hide timer
 */
function handleMouseMove() {
    state.lastMouseMove = Date.now();
    // Clear existing timeout
    if (state.hideTimeout !== null) {
        clearTimeout(state.hideTimeout);
    }
    // Show config buttons if they were hidden
    if (!state.buttonsVisible) {
        showConfigButtons();
    }
    // Set new timeout to hide after 5 seconds
    state.hideTimeout = window.setTimeout(() => {
        hideConfigButtons();
    }, 5000);
}
/**
 * Show config buttons
 */
function showConfigButtons() {
    state.buttonsVisible = true;
    const resetButton = document.getElementById('reset-button');
    const downloadConfig = document.getElementById('download-config');
    const uploadConfig = document.querySelector('label[for="upload-config"]');
    const colorPickerBtn = document.getElementById('color-picker-btn');
    if (resetButton)
        resetButton.style.opacity = '1';
    if (downloadConfig)
        downloadConfig.style.opacity = '1';
    if (uploadConfig)
        uploadConfig.style.opacity = '1';
    if (colorPickerBtn)
        colorPickerBtn.style.opacity = '1';
}
/**
 * Hide config buttons
 */
function hideConfigButtons() {
    state.buttonsVisible = false;
    const resetButton = document.getElementById('reset-button');
    const downloadConfig = document.getElementById('download-config');
    const uploadConfig = document.querySelector('label[for="upload-config"]');
    const colorPickerBtn = document.getElementById('color-picker-btn');
    if (resetButton)
        resetButton.style.opacity = '0';
    if (downloadConfig)
        downloadConfig.style.opacity = '0';
    if (uploadConfig)
        uploadConfig.style.opacity = '0';
    if (colorPickerBtn)
        colorPickerBtn.style.opacity = '0';
}
/**
 * Utility: Check if a button is pressed
 */
function buttonPressed(b) {
    if (typeof b === "object")
        return b.pressed;
    return b === 1.0;
}
/**
 * Utility: Check if a directional is pressed (button or axis)
 */
function directionalPressed(gp, mappingKey, axisIndex, axisValue) {
    const mapping = buttonMapping[mappingKey];
    // Button-based
    if (typeof mapping === 'number' && buttonPressed(gp.buttons[mapping]))
        return true;
    // Axis-based
    if (typeof axisIndex === 'number' && typeof axisValue === 'number') {
        if (Math.round(gp.axes[axisIndex]) === axisValue)
            return true;
    }
    return false;
}
/**
 * Save calibration to localStorage with error handling
 */
function saveCalibration() {
    safeSync(() => {
        localStorage.setItem(STORAGE_KEYS.CALIBRATION, JSON.stringify(state.calibrationMappings));
        logger.info('Calibration saved successfully');
    }, 'Failed to save calibration');
}
/**
 * Load calibration from localStorage with error handling
 */
function loadCalibration() {
    return safeSync(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.CALIBRATION);
        if (saved) {
            const mappings = JSON.parse(saved);
            Object.keys(mappings).forEach(key => {
                const typedKey = key;
                buttonMapping[typedKey] = mappings[typedKey];
            });
            logger.info('Calibration loaded successfully');
            logger.debug('Loaded button mappings:', buttonMapping);
            return true;
        }
        return false;
    }, 'Failed to load calibration', false) ?? false;
}
/**
 * Update website background color and save to localStorage
 */
function updateBackgroundColor(color) {
    safeSync(() => {
        // Get or create our dynamic style element
        let styleEl = document.getElementById('dynamic-background-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'dynamic-background-style';
            document.head.appendChild(styleEl);
        }
        // Update the style rule to override the CSS file
        styleEl.textContent = `html { background-color: ${color} !important; }`;
        localStorage.setItem(STORAGE_KEYS.BACKGROUND_COLOR, color);
        logger.debug('Background color updated to:', color);
    }, 'Failed to update background color');
}
// Add this to the initialization code to restore saved color
function restoreBackgroundColor() {
    const savedColor = localStorage.getItem(STORAGE_KEYS.BACKGROUND_COLOR) || '#00ff00';
    updateBackgroundColor(savedColor);
    logger.debug('Background color restored:', savedColor);
}
/**
 * Color conversion utilities
 */
function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    v = Math.max(0, Math.min(100, v)) / 100;
    const hi = Math.floor(h / 60) % 6;
    const f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r = 0, g = 0, b = 0;
    switch (hi) {
        case 0:
            r = v;
            g = t;
            b = p;
            break;
        case 1:
            r = q;
            g = v;
            b = p;
            break;
        case 2:
            r = p;
            g = v;
            b = t;
            break;
        case 3:
            r = p;
            g = q;
            b = v;
            break;
        case 4:
            r = t;
            g = p;
            b = v;
            break;
        case 5:
            r = v;
            g = p;
            b = q;
            break;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
function rgbToHsv(r, g, b) {
    r = r / 255;
    g = g / 255;
    b = b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = (max === 0 ? 0 : d / max);
    const v = max;
    if (max !== min) {
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)];
}
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.max(0, Math.min(255, x)).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result)
        return [0, 0, 0];
    return [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ];
}
/**
 * Initialize color picker functionality
 */
function initializeColorPicker() {
    const colorPickerBtn = document.getElementById('color-picker-btn');
    const colorPickerPopup = document.getElementById('color-picker-popup');
    const closeBtn = document.getElementById('close-color-picker');
    const colorSpectrum = document.getElementById('color-spectrum');
    const hueSlider = document.getElementById('hue-slider');
    const previewColor = document.getElementById('preview-color');
    const hexInput = document.getElementById('hex-input');
    const rgbInputs = {
        r: document.getElementById('rgb-r'),
        g: document.getElementById('rgb-g'),
        b: document.getElementById('rgb-b')
    };
    const hsvInputs = {
        h: document.getElementById('hsv-h'),
        s: document.getElementById('hsv-s'),
        v: document.getElementById('hsv-v')
    };
    const cursor = document.getElementById('color-picker-cursor');
    const hueCursor = document.getElementById('hue-cursor');
    const resetBtn = document.getElementById('reset-color');
    const applyBtn = document.getElementById('apply-color');
    let currentHue = 0;
    let currentSaturation = 100;
    let currentValue = 100;
    let isDragging = false;
    let isHueDragging = false;
    // Load saved color
    const savedColor = localStorage.getItem('bongo-cat-bg-color') || '#00ff00';
    const rgb = hexToRgb(savedColor);
    const hsv = rgbToHsv(...rgb);
    currentHue = hsv[0];
    currentSaturation = hsv[1];
    currentValue = hsv[2];
    updateColorDisplay();
    updateBackgroundColor(savedColor); // Use updateBackgroundColor instead of body.style
    function updateColorDisplay() {
        const rgb = hsvToRgb(currentHue, currentSaturation, currentValue);
        const hex = rgbToHex(...rgb);
        // Update spectrum background
        if (colorSpectrum) {
            colorSpectrum.style.background = `linear-gradient(to right, #fff, hsl(${currentHue}, 100%, 50%))`;
        }
        // Update preview
        if (previewColor) {
            previewColor.style.backgroundColor = hex;
        }
        // Update inputs
        if (hexInput)
            hexInput.value = hex;
        if (rgbInputs.r)
            rgbInputs.r.value = rgb[0].toString();
        if (rgbInputs.g)
            rgbInputs.g.value = rgb[1].toString();
        if (rgbInputs.b)
            rgbInputs.b.value = rgb[2].toString();
        if (hsvInputs.h)
            hsvInputs.h.value = currentHue.toString();
        if (hsvInputs.s)
            hsvInputs.s.value = currentSaturation.toString();
        if (hsvInputs.v)
            hsvInputs.v.value = currentValue.toString();
        // Update cursors
        if (cursor) {
            cursor.style.left = `${currentSaturation}%`;
            cursor.style.top = `${100 - currentValue}%`;
        }
        if (hueCursor) {
            hueCursor.style.left = `${(currentHue / 360) * 100}%`;
        }
        // Preview the color using updateBackgroundColor
        updateBackgroundColor(hex);
    }
    function handleSpectrumClick(e) {
        if (!colorSpectrum)
            return;
        const rect = colorSpectrum.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        currentSaturation = x * 100;
        currentValue = (1 - y) * 100;
        updateColorDisplay();
    }
    function handleHueClick(e) {
        if (!hueSlider)
            return;
        const rect = hueSlider.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        currentHue = x * 360;
        updateColorDisplay();
    }
    // Event Listeners
    colorPickerBtn?.addEventListener('click', () => {
        if (colorPickerPopup) {
            colorPickerPopup.style.display = 'block';
            updateColorDisplay();
        }
    });
    // Apply and Reset buttons
    applyBtn?.addEventListener('click', () => {
        const rgb = hsvToRgb(currentHue, currentSaturation, currentValue);
        const hex = rgbToHex(...rgb);
        updateBackgroundColor(hex); // Use updateBackgroundColor instead of localStorage directly
        if (colorPickerPopup) {
            colorPickerPopup.style.display = 'none';
        }
    });
    resetBtn?.addEventListener('click', () => {
        const defaultColor = '#00ff00'; // Changed from '#000000' to bright green
        const rgb = hexToRgb(defaultColor);
        const hsv = rgbToHsv(...rgb);
        currentHue = hsv[0];
        currentSaturation = hsv[1];
        currentValue = hsv[2];
        updateColorDisplay();
    });
    // Close popup when clicking outside
    window.addEventListener('click', (e) => {
        if (colorPickerPopup &&
            !colorPickerPopup.contains(e.target) &&
            e.target !== colorPickerBtn) {
            colorPickerPopup.style.display = 'none';
            // Restore the saved color using updateBackgroundColor
            const savedColor = localStorage.getItem('bongo-cat-bg-color') || '#00ff00';
            updateBackgroundColor(savedColor);
        }
    });
    closeBtn?.addEventListener('click', () => {
        if (colorPickerPopup) {
            colorPickerPopup.style.display = 'none';
            // Restore the saved color using updateBackgroundColor
            const savedColor = localStorage.getItem('bongo-cat-bg-color') || '#00ff00';
            updateBackgroundColor(savedColor);
        }
    });
    colorSpectrum?.addEventListener('mousedown', (e) => {
        isDragging = true;
        handleSpectrumClick(e);
    });
    hueSlider?.addEventListener('mousedown', (e) => {
        isHueDragging = true;
        handleHueClick(e);
    });
    window.addEventListener('mousemove', (e) => {
        if (isDragging)
            handleSpectrumClick(e);
        if (isHueDragging)
            handleHueClick(e);
    });
    window.addEventListener('mouseup', () => {
        isDragging = false;
        isHueDragging = false;
    });
    // Input change handlers
    hexInput?.addEventListener('change', () => {
        const rgb = hexToRgb(hexInput.value);
        const hsv = rgbToHsv(...rgb);
        currentHue = hsv[0];
        currentSaturation = hsv[1];
        currentValue = hsv[2];
        updateColorDisplay();
    });
    Object.values(rgbInputs).forEach(input => {
        input?.addEventListener('change', () => {
            const rgb = [
                parseInt(rgbInputs.r?.value || '0'),
                parseInt(rgbInputs.g?.value || '0'),
                parseInt(rgbInputs.b?.value || '0')
            ];
            const hsv = rgbToHsv(...rgb);
            currentHue = hsv[0];
            currentSaturation = hsv[1];
            currentValue = hsv[2];
            updateColorDisplay();
        });
    });
    Object.values(hsvInputs).forEach(input => {
        input?.addEventListener('change', () => {
            currentHue = parseInt(hsvInputs.h?.value || '0');
            currentSaturation = parseInt(hsvInputs.s?.value || '0');
            currentValue = parseInt(hsvInputs.v?.value || '0');
            updateColorDisplay();
        });
    });
    // Close popup when clicking outside
    window.addEventListener('click', (e) => {
        if (colorPickerPopup &&
            !colorPickerPopup.contains(e.target) &&
            e.target !== colorPickerBtn) {
            colorPickerPopup.style.display = 'none';
            // Restore the saved color using updateBackgroundColor
            const savedColor = localStorage.getItem('bongo-cat-bg-color') || '#00ff00';
            updateBackgroundColor(savedColor);
        }
    });
}
/**
 * Error handling wrapper for async operations
 */
async function safeAsync(operation, errorMessage, fallback) {
    try {
        return await operation();
    }
    catch (error) {
        logger.error(errorMessage, error);
        return fallback;
    }
}
/**
 * Error handling wrapper for sync operations
 */
function safeSync(operation, errorMessage, fallback) {
    try {
        return operation();
    }
    catch (error) {
        logger.error(errorMessage, error);
        return fallback;
    }
}
/**
 * Local storage keys
 */
const STORAGE_KEYS = {
    CALIBRATION: 'bongo-cat-calibration',
    BACKGROUND_COLOR: 'bongo-cat-bg-color',
};
/**
 * Button mapping configuration (default/fallback)
 */
const buttonMapping = {
    vb1: 1, vb2: 2, vb3: 7, vb4: 6, vb5: 0, vb6: 3, vb7: 5, vb8: 4,
    vbUp: 13, vbDown: 12, vbRight: 15, vbLeft: 14 // Swapped Up/Down to fix inversion
};
/**
 * Calibration steps: directionals first, then action buttons (top row 5-8, bottom row 1-4)
 */
const calibrationSteps = [
    { name: 'Left', key: 'vbLeft', description: 'Press the LEFT (red, leftmost) button' },
    { name: 'Down', key: 'vbDown', description: 'Press the DOWN (red, upper middle) button' },
    { name: 'Right', key: 'vbRight', description: 'Press the RIGHT (red, rightmost) button' },
    { name: 'Up', key: 'vbUp', description: 'Press the UP (red, large, bottom) button' },
    { name: 'Button 5', key: 'vb5', description: 'Press the button that corresponds to Button 5 (top row, leftmost)' },
    { name: 'Button 6', key: 'vb6', description: 'Press the button that corresponds to Button 6' },
    { name: 'Button 7', key: 'vb7', description: 'Press the button that corresponds to Button 7' },
    { name: 'Button 8', key: 'vb8', description: 'Press the button that corresponds to Button 8 (top row, rightmost)' },
    { name: 'Button 1', key: 'vb1', description: 'Press the button that corresponds to Button 1 (bottom row, leftmost)' },
    { name: 'Button 2', key: 'vb2', description: 'Press the button that corresponds to Button 2' },
    { name: 'Button 3', key: 'vb3', description: 'Press the button that corresponds to Button 3' },
    { name: 'Button 4', key: 'vb4', description: 'Press the button that corresponds to Button 4 (bottom row, rightmost)' }
];
/**
 * Calibration schematic button positions (SVG coordinates)
 */
const calibrationButtonPositions = [
    { cx: 90, cy: 100 }, // Left
    { cx: 140, cy: 80 }, // Down
    { cx: 190, cy: 100 }, // Right
    { cx: 245, cy: 180 }, // Up
    { cx: 260, cy: 60 }, // 5 (top row, leftmost)
    { cx: 300, cy: 60 }, // 6
    { cx: 340, cy: 60 }, // 7
    { cx: 380, cy: 60 }, // 8 (top row, rightmost)
    { cx: 260, cy: 110 }, // 1 (bottom row, leftmost)
    { cx: 300, cy: 110 }, // 2
    { cx: 340, cy: 110 }, // 3
    { cx: 380, cy: 110 }, // 4 (bottom row, rightmost)
];
/**
 * Map vb keys to calibrationButtonPositions indices for correct highlight
 */
const buttonPositionIndex = {
    vbLeft: 0,
    vbDown: 1,
    vbRight: 2,
    vbUp: 3,
    vb5: 4,
    vb6: 5,
    vb7: 6,
    vb8: 7,
    vb1: 8,
    vb2: 9,
    vb3: 10,
    vb4: 11
};
/**
 * Start calibration process
 */
function startCalibration() {
    state.isCalibrating = true;
    state.currentCalibrationStep = 0;
    state.calibrationMappings = {};
    const gp = getGamepad();
    state.lastCalibrationAxes = gp?.axes?.slice() || [];
    state.restingCalibrationAxes = gp?.axes?.slice() || [];
    // Ensure neutral hands are visible at the start of calibration
    resetArmAndHandVisibility();
    updateCalibrationUI();
    calibrationLoop();
}
/**
 * Update calibration overlay UI and highlight
 */
function updateCalibrationUI() {
    // Hide all overlays
    for (let i = 1; i <= 8; i++) {
        const btn = document.getElementById(`button${i}`);
        if (btn)
            btn.classList.add('invisible');
    }
    ['up', 'down', 'left', 'right'].forEach(id => {
        const el = document.getElementById(id);
        if (el)
            el.classList.add('invisible');
    });
    // Update schematic SVG highlight
    const highlightGroup = document.getElementById('calibration-highlight-group');
    if (!highlightGroup)
        return;
    while (highlightGroup.firstChild)
        highlightGroup.removeChild(highlightGroup.firstChild);
    if (state.currentCalibrationStep >= calibrationSteps.length) {
        finishCalibration();
        return;
    }
    const step = calibrationSteps[state.currentCalibrationStep];
    const progress = (state.currentCalibrationStep / calibrationSteps.length) * 100;
    const currentButton = document.getElementById('current-button');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    if (currentButton)
        currentButton.textContent = step.name;
    if (progressFill)
        progressFill.style.width = progress + '%';
    if (progressText)
        progressText.textContent = `${state.currentCalibrationStep} of ${calibrationSteps.length} buttons mapped`;
    // Draw highlight circle on schematic
    let pos = null;
    if (step.key.startsWith('vb') && buttonPositionIndex.hasOwnProperty(step.key)) {
        pos = calibrationButtonPositions[buttonPositionIndex[step.key]];
    }
    if (pos) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.cx.toString());
        circle.setAttribute('cy', pos.cy.toString());
        circle.setAttribute('r', '28');
        circle.setAttribute('fill', 'yellow');
        circle.setAttribute('fill-opacity', '0.6');
        circle.setAttribute('stroke', '#ff6b6b');
        circle.setAttribute('stroke-width', '4');
        highlightGroup.appendChild(circle);
    }
}
/**
 * Main visualization loop with enhanced performance monitoring
 */
function visualizationLoop() {
    // Performance monitoring
    performanceMonitor.measureFrame();
    const gp = getGamepad();
    if (!gp) {
        state.rAF = requestAnimationFrame(visualizationLoop);
        return;
    }
    // Log when gamepad is detected for the first time
    if (!state.gamepad) {
        logger.info('Gamepad detected, starting visualization');
    }
    // Validate gamepad state and input manager health
    if (!inputStateManager.validateGamepadState(gp) || !inputStateManager.isHealthy()) {
        if (!inputStateManager.isHealthy()) {
            logger.warn('Input state manager unhealthy, resetting...');
            inputStateManager.reset();
        }
        state.rAF = requestAnimationFrame(visualizationLoop);
        return;
    }
    if (state.isCalibrating) {
        handleCalibration(gp);
        state.rAF = requestAnimationFrame(visualizationLoop);
        return;
    }
    // Update button overlays with error handling
    try {
        updateButtonOverlays(gp);
        state.gamepad = gp;
    }
    catch (error) {
        logger.error('Error in visualization loop:', error instanceof Error ? error : new Error(String(error)));
        // Continue the loop even if there's an error
    }
    state.rAF = requestAnimationFrame(visualizationLoop);
}
/**
 * Update all overlays based on gamepad input
 * Performance improvement: Use cached DOM elements and batch DOM updates
 */
function updateButtonOverlays(gp) {
    const updates = [];
    // Process action buttons with better state tracking
    const { pressedButtons, currentButtonStates } = processActionButtons(gp, updates);
    // Process directionals with improved logic
    const { currentDirectionalStates, x, y } = processDirectionals(gp, updates);
    // Update arms with optimized logic
    const armIndex = updateRightArmState(pressedButtons, currentButtonStates);
    // Debug logging for arm state
    if (pressedButtons.length > 0 || armIndex !== -1) {
        logger.debug(`Pressed buttons: ${pressedButtons}, armIndex: ${armIndex}, lastPressed: ${state.lastPressedButtonIndex}`);
    }
    // Update left hand with enhanced state management
    const leftState = updateLeftHandState(currentDirectionalStates);
    // Batch all visual updates
    batchVisualUpdates(updates, x, y, leftState, armIndex);
    // Execute all DOM updates in a single batch for performance
    updates.forEach(update => update());
}
/**
 * Process action buttons and return state information
 */
function processActionButtons(gp, updates) {
    const pressedButtons = [];
    const currentButtonStates = [];
    // Optimized loop with early exit for invalid buttons
    for (let i = 1; i <= ANIMATION_CONSTANTS.ARM_COUNT; i++) {
        const btn = domCache.buttons[`button${i}`];
        if (!btn)
            continue;
        const vbKey = `vb${i}`;
        const mapping = buttonMapping[vbKey];
        let pressed = false;
        // Improved input detection with error handling
        try {
            if (typeof mapping === 'object' && 'axis' in mapping) {
                pressed = gp.axes[mapping.axis] !== undefined &&
                    gp.axes[mapping.axis] > INPUT_CONSTANTS.AXIS_THRESHOLD;
            }
            else if (typeof mapping === 'number' && mapping < gp.buttons.length) {
                pressed = buttonPressed(gp.buttons[mapping]);
            }
            // Debug: log button presses
            if (pressed) {
                logger.debug(`Button ${i} pressed (mapping: ${JSON.stringify(mapping)})`);
            }
        }
        catch (error) {
            logger.warn(`Error processing button ${i}:`, error);
            pressed = false;
        }
        currentButtonStates[i - 1] = pressed;
        if (pressed) {
            pressedButtons.push(i - 1);
        }
        // Track state changes for last pressed detection
        const wasPressed = state.previousButtonStates[i - 1] || false;
        if (pressed && !wasPressed) {
            state.lastPressedButtonIndex = i - 1;
        }
        // Batch DOM update
        updates.push(() => btn.classList.toggle('invisible', !pressed));
    }
    // Update previous button states efficiently
    state.previousButtonStates = currentButtonStates;
    return { pressedButtons, currentButtonStates };
}
/**
 * Process directional inputs with improved logic
 */
function processDirectionals(gp, updates) {
    let x = 0, y = 0;
    const currentDirectionalStates = { left: false, right: false, up: false, down: false };
    try {
        if (state.axes) {
            // Axis-based directional input
            x = Math.round(gp.axes[state.nEjeX] * state.invertX);
            y = Math.round(gp.axes[state.nEjeY] * state.invertY);
            currentDirectionalStates.left = x === -1;
            currentDirectionalStates.right = x === 1;
            currentDirectionalStates.up = y === 1;
            currentDirectionalStates.down = y === -1;
        }
        else {
            // Button-based directional input
            currentDirectionalStates.left = directionalPressed(gp, 'vbLeft', state.nEjeX, -1);
            currentDirectionalStates.right = directionalPressed(gp, 'vbRight', state.nEjeX, 1);
            currentDirectionalStates.up = directionalPressed(gp, 'vbUp', state.nEjeY, 1);
            currentDirectionalStates.down = directionalPressed(gp, 'vbDown', state.nEjeY, -1);
            // Set x,y based on pressed states
            if (currentDirectionalStates.left)
                x = -1;
            if (currentDirectionalStates.right)
                x = 1;
            if (currentDirectionalStates.up)
                y = 1;
            if (currentDirectionalStates.down)
                y = -1;
        }
        // Track directional state changes efficiently
        updateDirectionalStateTracking(currentDirectionalStates);
    }
    catch (error) {
        logger.warn('Error processing directional inputs:', error);
        // Reset to safe state
        x = y = 0;
    }
    return { currentDirectionalStates, x, y };
}
/**
 * Update directional state tracking for last pressed detection
 */
function updateDirectionalStateTracking(currentDirectionalStates) {
    const directionalNames = ['left', 'right', 'up', 'down'];
    directionalNames.forEach(direction => {
        const wasPressed = state.previousDirectionalStates[direction];
        const isPressed = currentDirectionalStates[direction];
        // Check if this direction was just pressed (state change from false to true)
        if (isPressed && !wasPressed) {
            state.lastPressedDirectional = direction;
        }
    });
    // Update previous directional states efficiently (object spread is optimized by V8)
    state.previousDirectionalStates = { ...currentDirectionalStates };
}
/**
 * Update right arm state with enhanced logic
 */
function updateRightArmState(pressedButtons, currentButtonStates) {
    let armIndex = ANIMATION_CONSTANTS.NEUTRAL_ARM_INDEX;
    if (pressedButtons.length > 0) {
        // Use last pressed button if it's still pressed, otherwise use highest numbered
        if (state.lastPressedButtonIndex !== undefined &&
            state.lastPressedButtonIndex !== -1 &&
            pressedButtons.includes(state.lastPressedButtonIndex)) {
            armIndex = state.lastPressedButtonIndex;
        }
        else {
            // Fallback to highest numbered button
            armIndex = Math.max(...pressedButtons);
            state.lastPressedButtonIndex = armIndex;
        }
        state.lastArmIndex = armIndex;
        // Clear any pending timeout
        if (state.armReturnTimeout) {
            clearTimeout(state.armReturnTimeout);
            state.armReturnTimeout = null;
        }
    }
    else {
        // No action buttons pressed - return to neutral immediately
        state.lastArmIndex = ANIMATION_CONSTANTS.NEUTRAL_ARM_INDEX;
        state.lastPressedButtonIndex = ANIMATION_CONSTANTS.NEUTRAL_ARM_INDEX;
        if (state.armReturnTimeout) {
            clearTimeout(state.armReturnTimeout);
            state.armReturnTimeout = null;
        }
    }
    return armIndex;
}
/**
 * Update left hand state with improved directional logic
 */
function updateLeftHandState(currentDirectionalStates) {
    let leftState = ANIMATION_CONSTANTS.NEUTRAL_LEFT_STATE;
    // Get active directionals efficiently
    const activeDirectionals = Object.entries(currentDirectionalStates)
        .filter(([_, isActive]) => isActive)
        .map(([direction, _]) => direction);
    if (activeDirectionals.length > 0) {
        // Use the last pressed directional if it's still active
        let selectedDirection = activeDirectionals[0]; // fallback
        if (state.lastPressedDirectional && activeDirectionals.includes(state.lastPressedDirectional)) {
            selectedDirection = state.lastPressedDirectional;
        }
        else {
            // Update last pressed to the first active directional as fallback
            state.lastPressedDirectional = selectedDirection;
        }
        // Map selected direction to leftState (using a lookup for performance)
        const directionToState = {
            'left': 1,
            'down': 2,
            'right': 3,
            'up': ANIMATION_CONSTANTS.LEFT_UP_STATE
        };
        leftState = directionToState[selectedDirection] || ANIMATION_CONSTANTS.NEUTRAL_LEFT_STATE;
    }
    else {
        // No directionals pressed, reset last pressed
        state.lastPressedDirectional = '';
    }
    return leftState;
}
/**
 * Batch all visual updates for optimal performance
 */
function batchVisualUpdates(updates, x, y, leftState, armIndex) {
    // Cache directional elements once
    const up = domCache.directionals.up;
    const down = domCache.directionals.down;
    const left = domCache.directionals.left;
    const right = domCache.directionals.right;
    const leftUp = domCache.directionals.leftup;
    const left0 = domCache.directionals.left0;
    const left1 = domCache.directionals.left1;
    const left2 = domCache.directionals.left2;
    const left3 = domCache.directionals.left3;
    const rightUp = domCache.directionals.rightUp;
    // Batch directional updates
    if (left && right) {
        updates.push(() => {
            left.classList.toggle('invisible', x !== -1);
            right.classList.toggle('invisible', x !== 1);
        });
    }
    if (up && down) {
        updates.push(() => {
            up.classList.toggle('invisible', y !== -1);
            down.classList.toggle('invisible', y !== 1);
        });
    }
    // Batch left hand updates with optimized element array
    const leftElements = [left0, left1, left2, left3, leftUp];
    leftElements.forEach((el, idx) => {
        if (el) {
            if (el === leftUp) {
                updates.push(() => el.classList.toggle('invisible', leftState !== ANIMATION_CONSTANTS.NEUTRAL_LEFT_STATE));
            }
            else {
                updates.push(() => el.classList.toggle('invisible', leftState !== idx + 1));
            }
        }
    });
    // Batch arm updates with optimized loop
    for (let i = 1; i <= ANIMATION_CONSTANTS.ARM_COUNT; i++) {
        const arm = domCache.arms[`arm${i}`];
        if (arm) {
            const idx = i - 1;
            const shouldBeVisible = idx === armIndex;
            updates.push(() => arm.classList.toggle('invisible', !shouldBeVisible));
            // Debug: log arm visibility changes
            if (shouldBeVisible) {
                logger.debug(`Making arm${i} (idx=${idx}) visible for armIndex=${armIndex}`);
            }
        }
        else {
            logger.warn(`Arm element arm${i} not found in DOM cache`);
        }
    }
    if (rightUp) {
        updates.push(() => rightUp.classList.toggle('invisible', armIndex !== ANIMATION_CONSTANTS.NEUTRAL_ARM_INDEX));
    }
}
/**
 * Calibration polling loop
 */
function calibrationLoop() {
    if (!state.isCalibrating)
        return;
    state.gamepad = getGamepad();
    if (state.gamepad) {
        handleCalibration(state.gamepad);
    }
    state.calibrationAnimationFrame = requestAnimationFrame(calibrationLoop);
}
/**
 * Handle calibration input
 */
function handleCalibration(gp) {
    if (state.waitingForRelease) {
        const input = state.lastCalibrationInput;
        let released = true;
        if (input && typeof input === 'object' && 'axis' in input) {
            const val = gp.axes[input.axis];
            const resting = state.restingCalibrationAxes[input.axis] || 0;
            if (Math.abs(val - resting) > 0.2)
                released = false;
        }
        else if (typeof input === 'number') {
            if (gp.buttons[input]?.pressed)
                released = false;
        }
        if (released) {
            state.waitingForRelease = false;
            state.lastCalibrationInput = null;
            state.restingCalibrationAxes = gp.axes.slice();
        }
        return;
    }
    for (let i = 0; i < gp.buttons.length; i++) {
        if (gp.buttons[i].pressed && !state.lastCalibrationButtons[i]) {
            const step = calibrationSteps[state.currentCalibrationStep];
            state.calibrationMappings[step.key] = i;
            state.lastCalibrationInput = i;
            state.waitingForRelease = true;
            state.currentCalibrationStep++;
            updateCalibrationUI();
            state.lastCalibrationButtons = gp.buttons.map(b => b.pressed);
            state.lastCalibrationAxes = gp.axes.slice();
            state.restingCalibrationAxes = gp.axes.slice();
            return;
        }
    }
    const step = calibrationSteps[state.currentCalibrationStep];
    for (let axisIdx = 0; axisIdx < gp.axes.length; axisIdx++) {
        const val = gp.axes[axisIdx];
        const prev = state.lastCalibrationAxes[axisIdx] || 0;
        if (prev <= 0.5 && val > 0.5) {
            const axisMapping = { axis: axisIdx, direction: 1 };
            state.calibrationMappings[step.key] = axisMapping;
            state.lastCalibrationInput = axisMapping;
            state.waitingForRelease = true;
            state.currentCalibrationStep++;
            updateCalibrationUI();
            state.lastCalibrationButtons = gp.buttons.map(b => b.pressed);
            state.lastCalibrationAxes = gp.axes.slice();
            state.restingCalibrationAxes = gp.axes.slice();
            return;
        }
    }
    state.lastCalibrationButtons = gp.buttons.map(b => b.pressed);
    state.lastCalibrationAxes = gp.axes.slice();
}
/**
 * Finish calibration and save mappings
 */
function finishCalibration() {
    const schematicWrapper = document.getElementById('calibration-schematic-wrapper');
    const overlay = document.getElementById('calibration-overlay');
    if (schematicWrapper)
        schematicWrapper.style.display = 'none';
    if (overlay)
        overlay.style.display = 'none';
    for (let i = 1; i <= 8; i++) {
        const btn = document.getElementById(`button${i}`);
        if (btn) {
            btn.classList.add('invisible');
            btn.style.visibility = '';
            btn.style.opacity = '';
            btn.style.background = '';
            const img = btn.querySelector('img');
            if (img)
                img.classList.remove('calibration-highlight');
        }
    }
    ['up', 'down', 'left', 'right'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('invisible');
            el.style.visibility = '';
            el.style.opacity = '';
            el.style.background = '';
            const img = el.querySelector('img');
            if (img)
                img.classList.remove('calibration-highlight');
        }
    });
    Object.keys(state.calibrationMappings).forEach(key => {
        const typedKey = key;
        buttonMapping[typedKey] = state.calibrationMappings[typedKey];
    });
    saveCalibration();
    state.isCalibrating = false;
    // Clean up calibration animation frame
    if (state.calibrationAnimationFrame !== null) {
        cancelAnimationFrame(state.calibrationAnimationFrame);
        state.calibrationAnimationFrame = null;
    }
    // Reset application state
    resetApplicationState();
    visualizationLoop();
}
/**
 * Skip calibration and start visualization
 */
function skipCalibration() {
    const overlay = document.getElementById('calibration-overlay');
    if (overlay)
        overlay.style.display = 'none';
    state.isCalibrating = false;
    // Clean up calibration animation frame
    if (state.calibrationAnimationFrame !== null) {
        cancelAnimationFrame(state.calibrationAnimationFrame);
        state.calibrationAnimationFrame = null;
    }
    // Reset application state
    resetApplicationState();
    visualizationLoop();
}
/**
 * Gamepad polling fallback
 */
function pollGamepads() {
    const gamepads = navigator.getGamepads
        ? navigator.getGamepads()
        : navigator.webkitGetGamepads
            ? navigator.webkitGetGamepads()
            : [];
    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (gp) {
            if (!state.isCalibrating) {
                visualizationLoop();
            }
            if (state.pollInterval !== undefined) {
                window.clearInterval(state.pollInterval);
                state.pollInterval = undefined;
            }
            break;
        }
    }
}
/**
 * Set up configuration import/export handlers
 */
function setupConfigHandlers() {
    // Download Config button handler
    const downloadConfig = document.getElementById('download-config');
    if (downloadConfig) {
        downloadConfig.addEventListener('click', function () {
            safeSync(() => {
                // Get calibration data
                const calibrationData = localStorage.getItem(STORAGE_KEYS.CALIBRATION) || '{}';
                const calibrationMappings = JSON.parse(calibrationData);
                // Get background color
                const backgroundColor = localStorage.getItem(STORAGE_KEYS.BACKGROUND_COLOR) || '#00ff00';
                // Create comprehensive config object
                const configData = {
                    calibration: calibrationMappings,
                    backgroundColor: backgroundColor,
                    version: CONFIG.version,
                    exportedAt: new Date().toISOString()
                };
                const configJson = JSON.stringify(configData, null, 2);
                const blob = new Blob([configJson], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'bongo-cat-config.json';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
                logger.info('Configuration exported successfully with background color:', backgroundColor);
            }, 'Failed to download configuration');
        });
    }
    // Upload Config button handler
    const uploadConfig = document.getElementById('upload-config');
    if (uploadConfig) {
        uploadConfig.addEventListener('change', function (e) {
            const input = e.target;
            const file = input.files?.[0];
            if (!file)
                return;
            const reader = new FileReader();
            reader.onload = function (evt) {
                safeSync(() => {
                    const result = evt.target?.result;
                    if (typeof result === 'string') {
                        const json = JSON.parse(result);
                        // Check if this is the new format with nested structure
                        if (json.calibration && typeof json.calibration === 'object') {
                            // New format: extract calibration and background color
                            localStorage.setItem(STORAGE_KEYS.CALIBRATION, JSON.stringify(json.calibration));
                            if (json.backgroundColor) {
                                localStorage.setItem(STORAGE_KEYS.BACKGROUND_COLOR, json.backgroundColor);
                                logger.info('Background color imported:', json.backgroundColor);
                            }
                            logger.info('Configuration imported (new format) with version:', json.version || 'unknown');
                        }
                        else {
                            // Legacy format: assume the entire JSON is calibration data
                            localStorage.setItem(STORAGE_KEYS.CALIBRATION, JSON.stringify(json));
                            logger.info('Configuration imported (legacy format)');
                        }
                        alert('Configuration loaded! The page will reload to apply the settings.');
                        location.reload();
                    }
                }, 'Failed to load configuration file');
            };
            reader.readAsText(file);
        });
    }
}
/**
 * Performance monitoring utilities
 */
class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = 0;
        this.fps = 0;
        this.frameTimeSum = 0;
        this.maxFrameTime = 0;
    }
    measureFrame() {
        const currentTime = performance.now();
        if (this.lastTime > 0) {
            const frameTime = currentTime - this.lastTime;
            this.frameTimeSum += frameTime;
            this.maxFrameTime = Math.max(this.maxFrameTime, frameTime);
            this.frameCount++;
            // Update FPS every second
            if (this.frameCount >= 60) {
                this.fps = Math.round(1000 / (this.frameTimeSum / this.frameCount));
                this.frameCount = 0;
                this.frameTimeSum = 0;
                this.maxFrameTime = 0;
                if (this.fps < 30) {
                    logger.warn(`Low FPS detected: ${this.fps}, max frame time: ${this.maxFrameTime.toFixed(2)}ms`);
                }
            }
        }
        this.lastTime = currentTime;
    }
    getFPS() {
        return this.fps;
    }
}
/**
 * Enhanced input state manager with validation and debouncing
 */
class InputStateManager {
    constructor() {
        this.validationErrors = 0;
        this.maxValidationErrors = 10;
    }
    validateGamepadState(gp) {
        try {
            // Basic validation
            if (!gp || !gp.buttons || !gp.axes) {
                this.validationErrors++;
                return false;
            }
            // Check minimum requirements
            if (gp.buttons.length < INPUT_CONSTANTS.MIN_GAMEPAD_BUTTONS ||
                gp.axes.length < INPUT_CONSTANTS.MIN_GAMEPAD_AXES) {
                this.validationErrors++;
                return false;
            }
            // Reset validation errors on successful validation
            this.validationErrors = 0;
            return true;
        }
        catch (error) {
            this.validationErrors++;
            logger.error('Gamepad validation error:', error instanceof Error ? error : new Error(String(error)));
            return false;
        }
    }
    isHealthy() {
        return this.validationErrors < this.maxValidationErrors;
    }
    reset() {
        this.validationErrors = 0;
    }
}
/**
 * Global performance and input monitoring instances
 */
const performanceMonitor = new PerformanceMonitor();
const inputStateManager = new InputStateManager();
/**
 * Initialize the application with better error handling
 */
function initializeApp() {
    logger.info('Initializing Leverless Bongo Cat application');
    try {
        // Check for gamepad support
        if (!detectGamepadSupport()) {
            logger.error('Gamepad API not supported in this browser');
            return;
        }
        // Initialize DOM cache
        domCache.init();
        // Check for reset parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('reset') === '1') {
            localStorage.removeItem(STORAGE_KEYS.CALIBRATION);
            localStorage.removeItem(STORAGE_KEYS.BACKGROUND_COLOR);
            logger.info('Settings reset via URL parameter');
        }
        // Initialize color picker
        initializeColorPicker();
        // Restore saved background color
        restoreBackgroundColor();
        // Initialize auto-hide functionality
        initializeAutoHide();
        // Initialize calibration or start visualization
        initializeCalibrationOrVisualization();
        // Set up event listeners
        setupEventListeners();
        // Initialize gamepad polling if needed
        initializeGamepadPolling();
        logger.info('Application initialized successfully');
    }
    catch (error) {
        logger.error('Failed to initialize application', error);
    }
}
/**
 * Initialize auto-hide functionality
 */
function initializeAutoHide() {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseMove);
    document.addEventListener('keydown', handleMouseMove);
    handleMouseMove(); // Start the timer
}
/**
 * Initialize calibration or start visualization
 */
function initializeCalibrationOrVisualization() {
    if (!loadCalibration()) {
        const wrapper = domCache.calibrationElements.schematicWrapper;
        if (wrapper)
            wrapper.style.display = '';
        startCalibration();
    }
    else {
        const overlay = domCache.calibrationElements.overlay;
        const wrapper = domCache.calibrationElements.schematicWrapper;
        if (overlay)
            overlay.style.display = 'none';
        if (wrapper)
            wrapper.style.display = 'none';
        // Reset visual state when loading from saved calibration
        resetArmAndHandVisibility();
        visualizationLoop();
    }
}
/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Calibration skip button
    const skipButton = document.getElementById('skip-calibration');
    if (skipButton) {
        skipButton.addEventListener('click', skipCalibration);
    }
    // Keyboard shortcut to reset calibration (Ctrl+Shift+R)
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
            safeSync(() => {
                localStorage.removeItem(STORAGE_KEYS.CALIBRATION);
                location.reload();
            }, 'Failed to reset calibration');
        }
    });
    // Reset button
    const resetButton = document.getElementById('reset-button');
    if (resetButton) {
        resetButton.addEventListener('click', function () {
            safeSync(() => {
                localStorage.removeItem(STORAGE_KEYS.CALIBRATION);
                location.reload();
            }, 'Failed to reset application');
        });
    }
    // Config import/export
    setupConfigHandlers();
    // Gamepad event listeners
    setupGamepadEventListeners();
}
/**
 * Set up gamepad event listeners
 */
function setupGamepadEventListeners() {
    window.addEventListener("gamepadconnected", function (e) {
        logger.info('Gamepad connected:', e.gamepad.id);
        const gp = getGamepad();
        if (gp && validateGamepad(gp) && !state.isCalibrating) {
            visualizationLoop();
        }
    });
    window.addEventListener("gamepaddisconnected", function (e) {
        logger.info('Gamepad disconnected:', e.gamepad.id);
        if (state.rAF !== undefined) {
            cancelAnimationFrame(state.rAF);
        }
    });
    // Clean up on page unload
    window.addEventListener('beforeunload', cleanup);
}
/**
 * Initialize gamepad polling for browsers without GamepadEvent
 */
function initializeGamepadPolling() {
    if (!("GamepadEvent" in window)) {
        logger.info('GamepadEvent not supported, using polling fallback');
        state.pollInterval = globalThis.setInterval(pollGamepads, 500);
    }
}
/**
 * Cleanup function to clear timeouts and prevent memory leaks
 */
function cleanup() {
    if (state.armReturnTimeout) {
        clearTimeout(state.armReturnTimeout);
        state.armReturnTimeout = null;
    }
    if (state.hideTimeout) {
        clearTimeout(state.hideTimeout);
        state.hideTimeout = null;
    }
    if (state.rAF) {
        cancelAnimationFrame(state.rAF);
        state.rAF = undefined;
    }
    if (state.calibrationAnimationFrame) {
        cancelAnimationFrame(state.calibrationAnimationFrame);
        state.calibrationAnimationFrame = null;
    }
}
/**
 * Enhanced state reset with performance monitoring
 */
function resetApplicationState() {
    // Reset input state
    state.lastArmIndex = ANIMATION_CONSTANTS.NEUTRAL_ARM_INDEX;
    state.lastPressedButtonIndex = ANIMATION_CONSTANTS.NEUTRAL_ARM_INDEX;
    state.previousButtonStates = [];
    state.lastPressedDirectional = '';
    state.previousDirectionalStates = { left: false, right: false, up: false, down: false };
    // Clear timeouts
    if (state.armReturnTimeout) {
        clearTimeout(state.armReturnTimeout);
        state.armReturnTimeout = null;
    }
    // Reset visual state - make sure default arms and hands are visible
    resetArmAndHandVisibility();
    // Reset performance monitoring
    inputStateManager.reset();
    logger.info('Application state reset successfully');
}
/**
 * Reset arm and hand visibility to default neutral state
 */
function resetArmAndHandVisibility() {
    const neutralArmIndex = ANIMATION_CONSTANTS.NEUTRAL_ARM_INDEX;
    const neutralLeftState = ANIMATION_CONSTANTS.NEUTRAL_LEFT_STATE;
    // Hide all arms (neutralArmIndex = -1 means no arm should be visible)
    for (let i = 1; i <= ANIMATION_CONSTANTS.ARM_COUNT; i++) {
        const arm = domCache.arms[`arm${i}`];
        if (arm) {
            const idx = i - 1;
            arm.classList.toggle('invisible', idx !== neutralArmIndex);
        }
    }
    // Reset left hand to neutral state (leftState = 0)
    // When leftState = 0 (neutral), only leftup should be visible
    const leftElements = [
        { el: domCache.directionals.left0, targetState: 1 },
        { el: domCache.directionals.left1, targetState: 2 },
        { el: domCache.directionals.left2, targetState: 3 },
        { el: domCache.directionals.left3, targetState: 4 },
        { el: domCache.directionals.leftup, isNeutralElement: true }
    ];
    leftElements.forEach(({ el, targetState, isNeutralElement }) => {
        if (el) {
            if (isNeutralElement) {
                // leftup is visible when leftState === NEUTRAL_LEFT_STATE (0)
                const shouldBeVisible = neutralLeftState === ANIMATION_CONSTANTS.NEUTRAL_LEFT_STATE;
                el.classList.toggle('invisible', !shouldBeVisible);
                logger.debug(`Setting leftup visibility: ${shouldBeVisible ? 'visible' : 'invisible'} (neutralLeftState=${neutralLeftState})`);
            }
            else {
                // left0-3 are visible when leftState === their target state
                const shouldBeVisible = neutralLeftState === targetState;
                el.classList.toggle('invisible', !shouldBeVisible);
            }
        }
    });
    // Show right up hand (neutral state)
    // rightUp is visible when armIndex === NEUTRAL_ARM_INDEX (-1)
    if (domCache.directionals.rightUp) {
        const shouldBeVisible = neutralArmIndex === ANIMATION_CONSTANTS.NEUTRAL_ARM_INDEX;
        domCache.directionals.rightUp.classList.toggle('invisible', !shouldBeVisible);
        logger.debug(`Setting rightUp visibility: ${shouldBeVisible ? 'visible' : 'invisible'} (neutralArmIndex=${neutralArmIndex})`);
    }
    logger.info('Arm and hand visibility reset to neutral state');
}
/**
 * Initialize the app when the DOM is ready
 */
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    }
    else {
        // DOM is already loaded
        initializeApp();
    }
}
//# sourceMappingURL=hitbox-controller.js.map