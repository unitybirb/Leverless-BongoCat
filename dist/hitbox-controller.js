"use strict";
// Arcade Bongo Cat Hitbox Mapping and Visualization Tool
// Shows button presses and directional inputs on a hitbox-style controller
/**
 * State object to hold all mutable state
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
 * Sleep utility function
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Utility: Get gamepad safely
 */
function getGamepad() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    return gamepads[0] || null;
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
 * Save calibration to localStorage
 */
function saveCalibration() {
    localStorage.setItem('bongo-cat-calibration', JSON.stringify(state.calibrationMappings));
}
/**
 * Load calibration from localStorage
 */
function loadCalibration() {
    const saved = localStorage.getItem('bongo-cat-calibration');
    if (saved) {
        const mappings = JSON.parse(saved);
        Object.keys(mappings).forEach(key => {
            const typedKey = key;
            buttonMapping[typedKey] = mappings[typedKey];
        });
        return true;
    }
    return false;
}
/**
 * Update website background color and save to localStorage
 */
function updateBackgroundColor(color) {
    // Get or create our dynamic style element
    let styleEl = document.getElementById('dynamic-background-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dynamic-background-style';
        document.head.appendChild(styleEl);
    }
    // Update the style rule to override the CSS file
    styleEl.textContent = `html { background-color: ${color} !important; }`;
    localStorage.setItem('bongo-cat-bg-color', color);
}
// Add this to the initialization code to restore saved color
function restoreBackgroundColor() {
    const savedColor = localStorage.getItem('bongo-cat-bg-color') || '#00ff00';
    updateBackgroundColor(savedColor);
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
 * Start calibration process
 */
function startCalibration() {
    state.isCalibrating = true;
    state.currentCalibrationStep = 0;
    state.calibrationMappings = {};
    const gp = getGamepad();
    state.lastCalibrationAxes = gp?.axes?.slice() || [];
    state.restingCalibrationAxes = gp?.axes?.slice() || [];
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
 * Main visualization loop
 */
function visualizationLoop() {
    const gp = getGamepad();
    if (!gp)
        return;
    if (state.isCalibrating) {
        handleCalibration(gp);
        return;
    }
    // Update button overlays
    updateButtonOverlays(gp);
    state.gamepad = gp;
    state.rAF = requestAnimationFrame(visualizationLoop);
}
/**
 * Update all overlays based on gamepad input
 */
function updateButtonOverlays(gp) {
    // Action buttons
    for (let i = 1; i <= 8; i++) {
        const btn = document.getElementById(`button${i}`);
        if (!btn)
            continue;
        const vbKey = `vb${i}`;
        const mapping = buttonMapping[vbKey];
        let pressed = false;
        if (typeof mapping === 'object' && 'axis' in mapping) {
            pressed = gp.axes[mapping.axis] !== undefined && gp.axes[mapping.axis] > 0.5;
        }
        else if (typeof mapping === 'number') {
            pressed = buttonPressed(gp.buttons[mapping]);
        }
        btn.classList.toggle('invisible', !pressed);
    }
    // Directional overlays
    const up = document.getElementById('up');
    const down = document.getElementById('down');
    const left = document.getElementById('left');
    const right = document.getElementById('right');
    const leftUp = document.getElementById('leftup');
    const left0 = document.getElementById('left0');
    const left1 = document.getElementById('left1');
    const left2 = document.getElementById('left2');
    const left3 = document.getElementById('left3');
    const br = Array.from({ length: 8 }, (_, i) => document.getElementById(`arm${i + 1}`));
    const rightUp = document.getElementById('rightUp');
    // Directional state
    let x = 0, y = 0;
    if (state.axes) {
        x = Math.round(gp.axes[state.nEjeX] * state.invertX);
        y = Math.round(gp.axes[state.nEjeY] * state.invertY);
    }
    else {
        if (directionalPressed(gp, 'vbLeft', state.nEjeX, -1))
            x = -1;
        if (directionalPressed(gp, 'vbRight', state.nEjeX, 1))
            x = 1;
        if (directionalPressed(gp, 'vbUp', state.nEjeY, 1))
            y = 1;
        if (directionalPressed(gp, 'vbDown', state.nEjeY, -1))
            y = -1;
    }
    // Update visibility based on state
    if (left && right) {
        left.classList.toggle('invisible', x !== -1);
        right.classList.toggle('invisible', x !== 1);
    }
    if (up && down) {
        up.classList.toggle('invisible', y !== -1);
        down.classList.toggle('invisible', y !== 1);
    }
    // Update left hand overlays
    let leftState = 0;
    if (x === -1 && y === 0)
        leftState = 1;
    else if (x === 0 && y === -1)
        leftState = 2;
    else if (x === 1 && y === 0)
        leftState = 3;
    else if (x === 0 && y === 1)
        leftState = 4;
    // Update left hand overlays - show correct state
    [left0, left1, left2, left3, leftUp].forEach((el, idx) => {
        if (el) {
            if (el === leftUp) {
                // leftUp is the resting state, show when no direction is pressed
                el.classList.toggle('invisible', leftState !== 0);
            }
            else {
                // Other states show when their corresponding direction is pressed
                el.classList.toggle('invisible', leftState !== idx + 1);
            }
        }
    });
    // Update arm overlays
    let armIndex = -1;
    for (let i = 1; i <= 8; i++) {
        const vbKey = `vb${i}`;
        const mapping = buttonMapping[vbKey];
        let pressed = false;
        if (typeof mapping === 'object' && 'axis' in mapping) {
            pressed = gp.axes[mapping.axis] !== undefined && gp.axes[mapping.axis] > 0.5;
        }
        else if (typeof mapping === 'number') {
            pressed = buttonPressed(gp.buttons[mapping]);
        }
        if (pressed) {
            armIndex = i - 1;
            break;
        }
    }
    br.forEach((el, idx) => {
        if (el)
            el.classList.toggle('invisible', idx !== armIndex);
    });
    if (rightUp) {
        rightUp.classList.toggle('invisible', armIndex === -1 ? false : true);
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
    if (state.calibrationAnimationFrame !== null) {
        cancelAnimationFrame(state.calibrationAnimationFrame);
    }
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
    if (state.calibrationAnimationFrame !== null) {
        cancelAnimationFrame(state.calibrationAnimationFrame);
    }
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
 * Initialize the application
 */
function initializeApp() {
    // Check for reset parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === '1') {
        localStorage.removeItem('bongo-cat-calibration');
        localStorage.removeItem('bongo-cat-bg-color');
        console.log('Settings reset!');
    }
    // Initialize color picker
    initializeColorPicker();
    // Restore saved background color
    restoreBackgroundColor();
    // Initialize auto-hide functionality
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseMove);
    document.addEventListener('keydown', handleMouseMove);
    // Start the auto-hide timer
    handleMouseMove();
    if (!loadCalibration()) {
        const wrapper = document.getElementById('calibration-schematic-wrapper');
        if (wrapper)
            wrapper.style.display = '';
        startCalibration();
    }
    else {
        const overlay = document.getElementById('calibration-overlay');
        const wrapper = document.getElementById('calibration-schematic-wrapper');
        if (overlay)
            overlay.style.display = 'none';
        if (wrapper)
            wrapper.style.display = 'none';
        visualizationLoop();
    }
    // Set up button click handlers
    const skipButton = document.getElementById('skip-calibration');
    if (skipButton) {
        skipButton.addEventListener('click', skipCalibration);
    }
    // Keyboard shortcut to reset calibration (Ctrl+Shift+R)
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
            localStorage.removeItem('bongo-cat-calibration');
            location.reload();
        }
    });
    // Reset button click handler
    const resetButton = document.getElementById('reset-button');
    if (resetButton) {
        resetButton.addEventListener('click', function () {
            localStorage.removeItem('bongo-cat-calibration');
            location.reload();
        });
    }
    // Download Config button handler
    const downloadConfig = document.getElementById('download-config');
    if (downloadConfig) {
        downloadConfig.addEventListener('click', function () {
            const data = localStorage.getItem('bongo-cat-calibration') || '{}';
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bongo-cat-calibration.json';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
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
                try {
                    const result = evt.target?.result;
                    if (typeof result === 'string') {
                        const json = JSON.parse(result);
                        localStorage.setItem('bongo-cat-calibration', JSON.stringify(json));
                        alert('Calibration loaded! Reloading...');
                        location.reload();
                    }
                }
                catch (err) {
                    alert('Invalid calibration file.');
                }
            };
            reader.readAsText(file);
        });
    }
    // Set up gamepad event listeners
    window.addEventListener("gamepadconnected", function () {
        const gp = navigator.getGamepads()[0];
        if (!state.isCalibrating) {
            visualizationLoop();
        }
    });
    window.addEventListener("gamepaddisconnected", function () {
        console.log("Waiting for gamepad.");
        if (state.rAF !== undefined) {
            cancelAnimationFrame(state.rAF);
        }
    });
    // Initialize gamepad polling if needed
    if (!("GamepadEvent" in window)) {
        state.pollInterval = globalThis.setInterval(pollGamepads, 500);
    }
}
//# sourceMappingURL=hitbox-controller.js.map