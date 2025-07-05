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
  // Auto-hide functionality
  lastMouseMove: Date.now(),
  hideTimeout: null,
  buttonsVisible: true,
};

/**
 * Button mapping configuration (default/fallback)
 */
const buttonMapping = {
  vb1: 1, vb2: 2, vb3: 7, vb4: 6, vb5: 0, vb6: 3, vb7: 5, vb8: 4,
  vbUp: 13, vbDown: 12, vbRight: 15, vbLeft: 14  // Swapped Up/Down to fix inversion
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
  {cx:90, cy:100},    // Left
  {cx:140, cy:80},    // Down
  {cx:190, cy:100},   // Right
  {cx:245, cy:180},   // Up
  {cx:260, cy:60},    // 5 (top row, leftmost)
  {cx:300, cy:60},    // 6
  {cx:340, cy:60},    // 7
  {cx:380, cy:60},    // 8 (top row, rightmost)
  {cx:260, cy:110},   // 1 (bottom row, leftmost)
  {cx:300, cy:110},   // 2
  {cx:340, cy:110},   // 3
  {cx:380, cy:110},   // 4 (bottom row, rightmost)
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
  if (state.hideTimeout) {
    clearTimeout(state.hideTimeout);
  }
  
  // Show config buttons if they were hidden
  if (!state.buttonsVisible) {
    showConfigButtons();
  }
  
  // Set new timeout to hide after 5 seconds
  state.hideTimeout = setTimeout(() => {
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
  
  if (resetButton) resetButton.style.opacity = '1';
  if (downloadConfig) downloadConfig.style.opacity = '1';
  if (uploadConfig) uploadConfig.style.opacity = '1';
}

/**
 * Hide config buttons
 */
function hideConfigButtons() {
  state.buttonsVisible = false;
  const resetButton = document.getElementById('reset-button');
  const downloadConfig = document.getElementById('download-config');
  const uploadConfig = document.querySelector('label[for="upload-config"]');
  
  if (resetButton) resetButton.style.opacity = '0';
  if (downloadConfig) downloadConfig.style.opacity = '0';
  if (uploadConfig) uploadConfig.style.opacity = '0';
}

/**
 * Utility: Check if a button is pressed
 * @param {GamepadButton|number} b
 * @returns {boolean}
 */
function buttonPressed(b) {
  if (typeof b === "object") return b.pressed;
  return b === 1.0;
}

/**
 * Utility: Check if a directional is pressed (button or axis)
 * @param {Gamepad} gp
 * @param {string} mappingKey
 * @param {number} axisIndex
 * @param {number} axisValue
 * @returns {boolean}
 */
function directionalPressed(gp, mappingKey, axisIndex, axisValue) {
  // Button-based
  if (buttonPressed(gp.buttons[buttonMapping[mappingKey]])) return true;
  // Axis-based
  if (typeof axisIndex === 'number' && typeof axisValue === 'number') {
    if (Math.round(gp.axes[axisIndex]) === axisValue) return true;
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
 * @returns {boolean}
 */
function loadCalibration() {
  const saved = localStorage.getItem('bongo-cat-calibration');
  if (saved) {
    const mappings = JSON.parse(saved);
    Object.keys(mappings).forEach(key => {
      buttonMapping[key] = mappings[key];
    });
    return true;
  }
  return false;
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
    if (btn) btn.classList.add('invisible');
  }
  ['up','down','left','right'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('invisible');
  });

  // Update schematic SVG highlight
  const highlightGroup = document.getElementById('calibration-highlight-group');
  while (highlightGroup.firstChild) highlightGroup.removeChild(highlightGroup.firstChild);

  if (state.currentCalibrationStep >= calibrationSteps.length) {
    finishCalibration();
    return;
  }

  const step = calibrationSteps[state.currentCalibrationStep];
  const progress = (state.currentCalibrationStep / calibrationSteps.length) * 100;
  document.getElementById('current-button').textContent = step.name;
  document.getElementById('progress-fill').style.width = progress + '%';
  document.getElementById('progress-text').textContent = `${state.currentCalibrationStep} of ${calibrationSteps.length} buttons mapped`;

  // Draw highlight circle on schematic
  let pos = null;
  if (step.key.startsWith('vb') && buttonPositionIndex.hasOwnProperty(step.key)) {
    pos = calibrationButtonPositions[buttonPositionIndex[step.key]];
  }
  if (pos) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pos.cx);
    circle.setAttribute('cy', pos.cy);
    circle.setAttribute('r', 28);
    circle.setAttribute('fill', 'yellow');
    circle.setAttribute('fill-opacity', '0.6');
    circle.setAttribute('stroke', '#ff6b6b');
    circle.setAttribute('stroke-width', '4');
    highlightGroup.appendChild(circle);
  }
}

/**
 * Calibration polling loop
 */
function calibrationLoop() {
  if (!state.isCalibrating) return;
  state.gamepad = getGamepad();
  if (state.gamepad) {
    handleCalibration(state.gamepad);
  }
  state.calibrationAnimationFrame = requestAnimationFrame(calibrationLoop);
}

/**
 * Handle calibration input
 * @param {Gamepad} gp
 */
function handleCalibration(gp) {
  // Wait for the last used input to be released/neutral before accepting the next input
  if (state.waitingForRelease) {
    const input = state.lastCalibrationInput;
    let released = true;
    if (input && typeof input === 'object' && input.axis !== undefined) {
      // Axis input: check axis is back near resting value
      const val = gp.axes[input.axis];
      const resting = state.restingCalibrationAxes ? state.restingCalibrationAxes[input.axis] : 0;
      if (Math.abs(val - resting) > 0.2) released = false;
    } else if (typeof input === 'number') {
      // Button input: check button is released
      if (gp.buttons[input] && gp.buttons[input].pressed) released = false;
    }
    if (released) {
      state.waitingForRelease = false;
      state.lastCalibrationInput = null;
      // Update resting axes for next step
      state.restingCalibrationAxes = gp.axes.slice();
    }
    return;
  }
  // Only accept a button press if it was not pressed in the previous frame
  for (let i = 0; i < gp.buttons.length; i++) {
    if (gp.buttons[i].pressed && !state.lastCalibrationButtons[i]) {
      // Button pressed, map it to current step
      const step = calibrationSteps[state.currentCalibrationStep];
      state.calibrationMappings[step.key] = i;
      state.lastCalibrationInput = i;
      state.waitingForRelease = true;
      state.currentCalibrationStep++;
      updateCalibrationUI();
      state.lastCalibrationButtons = gp.buttons.map(b => b.pressed);
      state.lastCalibrationAxes = gp.axes.slice();
      // Update resting axes for next step
      state.restingCalibrationAxes = gp.axes.slice();
      return;
    }
  }
  // Axis-based calibration for any action button (edge-triggered)
  const step = calibrationSteps[state.currentCalibrationStep];
  for (let axisIdx = 0; axisIdx < gp.axes.length; axisIdx++) {
    const val = gp.axes[axisIdx];
    const prev = (state.lastCalibrationAxes && state.lastCalibrationAxes.length > 0)
      ? state.lastCalibrationAxes[axisIdx]
      : 0; // treat as neutral if undefined
    // Only accept if previous was <= 0.5 and now crossed above 0.5
    if (prev <= 0.5 && val > 0.5) {
      state.calibrationMappings[step.key] = {axis: axisIdx, direction: 1};
      state.lastCalibrationInput = {axis: axisIdx, direction: 1};
      state.waitingForRelease = true;
      state.currentCalibrationStep++;
      updateCalibrationUI();
      state.lastCalibrationButtons = gp.buttons.map(b => b.pressed);
      state.lastCalibrationAxes = gp.axes.slice();
      state.restingCalibrationAxes = gp.axes.slice();
      return;
    }
  }
  // Save current button and axis states for next frame
  state.lastCalibrationButtons = gp.buttons.map(b => b.pressed);
  state.lastCalibrationAxes = gp.axes.slice();
}

/**
 * Finish calibration and save mappings
 */
function finishCalibration() {
  document.getElementById('calibration-schematic-wrapper').style.display = 'none';
  document.getElementById('calibration-overlay').style.display = 'none';
  for (let i = 1; i <= 8; i++) {
    const btn = document.getElementById(`button${i}`);
    if (btn) {
      btn.classList.add('invisible');
      btn.style.visibility = '';
      btn.style.opacity = '';
      btn.style.background = '';
      const img = btn.querySelector('img');
      if (img) img.classList.remove('calibration-highlight');
    }
  }
  ['up','down','left','right'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('invisible');
      el.style.visibility = '';
      el.style.opacity = '';
      el.style.background = '';
      const img = el.querySelector('img');
      if (img) img.classList.remove('calibration-highlight');
    }
  });
  // Apply the calibrated mappings
  Object.keys(state.calibrationMappings).forEach(key => {
    buttonMapping[key] = state.calibrationMappings[key];
  });
  saveCalibration();
  state.isCalibrating = false;
  if (state.calibrationAnimationFrame) cancelAnimationFrame(state.calibrationAnimationFrame);
  visualizationLoop();
}

/**
 * Skip calibration and start visualization
 */
function skipCalibration() {
  document.getElementById('calibration-overlay').style.display = 'none';
  state.isCalibrating = false;
  if (state.calibrationAnimationFrame) cancelAnimationFrame(state.calibrationAnimationFrame);
  visualizationLoop();
}

/**
 * Main visualization loop (requestAnimationFrame)
 */
function visualizationLoop() {
  const gp = getGamepad();
  if (!gp) return;
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
 * Update all overlays (action buttons, directionals, arms) based on gamepad input
 * @param {Gamepad} gp
 */
function updateButtonOverlays(gp) {
  // Action buttons
  for (let i = 1; i <= 8; i++) {
    const btn = document.getElementById(`button${i}`);
    if (!btn) continue;
    const vbKey = `vb${i}`;
    const mapping = buttonMapping[vbKey];
    let pressed = false;
    if (typeof mapping === 'object' && mapping.axis !== undefined) {
      pressed = gp.axes[mapping.axis] !== undefined && gp.axes[mapping.axis] > 0.5;
    } else {
      pressed = buttonPressed(gp.buttons[mapping]);
    }
    if (pressed) {
      btn.classList.remove('invisible');
    } else {
      btn.classList.add('invisible');
    }
  }

  // --- Directional overlays ---
  // Directional overlay elements (up, down, left, right)
  const up = document.getElementById('up');
  const down = document.getElementById('down');
  const left = document.getElementById('left');
  const right = document.getElementById('right');
  // Left hand overlays (hitbox/fightstick)
  const leftUp = document.getElementById('leftup');
  const left0 = document.getElementById('left0');
  const left1 = document.getElementById('left1');
  const left2 = document.getElementById('left2');
  const left3 = document.getElementById('left3');
  // Right hand overlays (arms)
  const br = [
    document.getElementById('arm1'),
    document.getElementById('arm2'),
    document.getElementById('arm3'),
    document.getElementById('arm4'),
    document.getElementById('arm5'),
    document.getElementById('arm6'),
    document.getElementById('arm7'),
    document.getElementById('arm8')
  ];
  const rightUp = document.getElementById('rightUp');

  // Directional state
  let x = 0, y = 0;
  if (state.axes) {
    // Axes-based input
    x = Math.round(gp.axes[state.nEjeX] * state.invertX);
    y = Math.round(gp.axes[state.nEjeY] * state.invertY);
  } else {
    // Button-based input
    if (directionalPressed(gp, 'vbLeft', state.nEjeX, -1)) x = -1;
    if (directionalPressed(gp, 'vbRight', state.nEjeX, 1)) x = 1;
    if (directionalPressed(gp, 'vbUp', state.nEjeY, 1)) y = 1;
    if (directionalPressed(gp, 'vbDown', state.nEjeY, -1)) y = -1;
  }

  // Show/hide direction overlays
  if (x === -1) {
    left.classList.remove('invisible');
    right.classList.add('invisible');
  } else if (x === 1) {
    left.classList.add('invisible');
    right.classList.remove('invisible');
  } else {
    left.classList.add('invisible');
    right.classList.add('invisible');
  }
  if (y === -1) {
    up.classList.remove('invisible');  // Up
    down.classList.add('invisible');
  } else if (y === 1) {
    up.classList.add('invisible');
    down.classList.remove('invisible');   // Down
  } else {
    up.classList.add('invisible');
    down.classList.add('invisible');
  }

  // Show/hide left hand overlays (hitbox)
  // Only one of left0-left3 or leftUp is visible at a time
  let leftState = 0;
  if (x === -1 && y === 0) leftState = 1;  // Left
  else if (x === 0 && y === -1) leftState = 2;  // Up
  else if (x === 1 && y === 0) leftState = 3;  // Right
  else if (x === 0 && y === 1) leftState = 4;  // Down
  // Reset all
  [left0, left1, left2, left3, leftUp].forEach(el => el && el.classList.add('invisible'));
  switch (leftState) {
    case 1: left0 && left0.classList.remove('invisible'); break;  // Left
    case 2: left1 && left1.classList.remove('invisible'); break;  // Up
    case 3: left2 && left2.classList.remove('invisible'); break;  // Right
    case 4: left3 && left3.classList.remove('invisible'); break;  // Down
    default: leftUp && leftUp.classList.remove('invisible'); break;
  }

  // --- Arm overlays (right hand) ---
  // Show the arm corresponding to the first pressed action button (1-8), supporting axis-mapped triggers
  let armIndex = -1;
  for (let i = 1; i <= 8; i++) {
    const vbKey = `vb${i}`;
    const mapping = buttonMapping[vbKey];
    let pressed = false;
    if (typeof mapping === 'object' && mapping.axis !== undefined) {
      pressed = gp.axes[mapping.axis] !== undefined && gp.axes[mapping.axis] > 0.5;
    } else {
      pressed = buttonPressed(gp.buttons[mapping]);
    }
    if (pressed) {
      armIndex = i - 1;
      break;
    }
  }
  br.forEach((el, idx) => el && el.classList.toggle('invisible', idx !== armIndex));
  // Show rightUp if no arm is active
  if (rightUp) rightUp.classList.toggle('invisible', armIndex !== -1);
}

/**
 * DOMContentLoaded: Initialize calibration or game
 */
document.addEventListener('DOMContentLoaded', function() {
  // Check for reset parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('reset') === '1') {
    localStorage.removeItem('bongo-cat-calibration');
    console.log('Calibration reset!');
  }
  
  // Initialize auto-hide functionality
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mousedown', handleMouseMove);
  document.addEventListener('keydown', handleMouseMove);
  
  // Start the auto-hide timer
  handleMouseMove();
  
  if (!loadCalibration()) {
    document.getElementById('calibration-schematic-wrapper').style.display = '';
    startCalibration();
  } else {
    document.getElementById('calibration-overlay').style.display = 'none';
    document.getElementById('calibration-schematic-wrapper').style.display = 'none';
    visualizationLoop();
  }
  document.getElementById('skip-calibration').addEventListener('click', skipCalibration);
  
  // Keyboard shortcut to reset calibration (Ctrl+Shift+R)
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      localStorage.removeItem('bongo-cat-calibration');
      location.reload();
    }
  });
  
  // Reset button click handler
  document.getElementById('reset-button').addEventListener('click', function() {
    localStorage.removeItem('bongo-cat-calibration');
    location.reload();
  });

  // Download Config button handler
  document.getElementById('download-config').addEventListener('click', function() {
    const data = localStorage.getItem('bongo-cat-calibration') || '{}';
    const blob = new Blob([data], {type: 'application/json'});
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

  // Upload Config button handler
  document.getElementById('upload-config').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const json = JSON.parse(evt.target.result);
        localStorage.setItem('bongo-cat-calibration', JSON.stringify(json));
        alert('Calibration loaded! Reloading...');
        location.reload();
      } catch (err) {
        alert('Invalid calibration file.');
      }
    };
    reader.readAsText(file);
  });
});

window.addEventListener("gamepadconnected", function () {
  var gp = navigator.getGamepads()[0];
  if (!state.isCalibrating) {
    visualizationLoop();
  }
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

window.addEventListener("gamepaddisconnected", function () {
  console.log("Waiting for gamepad.");

  cancelAnimationFrame(state.rAF);
});

if (!("GamepadEvent" in window)) {
  // No gamepad events available, poll instead.
  var interval = setInterval(pollGamepads, 500);
}

function pollGamepads() {
  var gamepads = navigator.getGamepads
    ? navigator.getGamepads()
    : navigator.webkitGetGamepads
    ? navigator.webkitGetGamepads
    : [];
  for (var i = 0; i < gamepads.length; i++) {
    var gp = gamepads[i];
    if (gp) {
      if (!state.isCalibrating) {
        visualizationLoop();
      }
      clearInterval(interval);
    }
  }
} 