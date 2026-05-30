const appContainer = document.getElementById('app-container');
const watermarkImage = document.getElementById('watermark-image');
const selectImageBtn = document.getElementById('select-image-btn');
const opacitySlider = document.getElementById('opacity-slider');
const closeBtn = document.getElementById('close-btn');
const resizeHandle = document.getElementById('resize-handle');
const lockBtn = document.getElementById('lock-btn');
const opacityValue = document.getElementById('opacity-value');
const lockedBadge = document.getElementById('locked-badge');

const state = {
  imagePath: null,
  opacity: 1,
  locked: false,
};

let isResizing = false;
let resizePointerId = null;
let initialMouseX = 0;
let initialMouseY = 0;
let initialWidth = 0;
let initialHeight = 0;
let pendingResize = null;
let resizeRaf = 0;
let opacityRaf = 0;
let pendingOpacity = null;

function setNoImageUi(isNoImage) {
  if (!appContainer) return;
  appContainer.classList.toggle('no-image', isNoImage);
}

function setLockedUi(locked) {
  state.locked = locked;
  if (appContainer) appContainer.classList.toggle('locked', locked);
  if (lockBtn) lockBtn.setAttribute('aria-pressed', locked ? 'true' : 'false');
  if (lockBtn) lockBtn.textContent = locked ? '🔒' : '🔓';
  if (lockedBadge) lockedBadge.setAttribute('aria-hidden', locked ? 'false' : 'true');
}

function setImageFromPath(imagePath) {
  state.imagePath = imagePath || null;
  if (state.imagePath) {
    watermarkImage.src = window.electronAPI.toFileUrl(state.imagePath);
    setNoImageUi(false);
  } else {
    watermarkImage.src = '';
    setNoImageUi(true);
  }
}

function setOpacityUi(opacity) {
  state.opacity = opacity;
  watermarkImage.style.opacity = String(opacity);
  if (opacitySlider) opacitySlider.value = String(opacity);
  if (opacityValue) opacityValue.textContent = `${Math.round(opacity * 100)}%`;
}

// Load last used state on startup
async function loadInitialSettings() {
  const appState = await window.electronAPI.getState();

  setLockedUi(Boolean(appState?.locked));
  const nextOpacity = Number(appState?.opacity);
  setOpacityUi(Number.isFinite(nextOpacity) ? nextOpacity : 1);
  setImageFromPath(appState?.imagePath || null);

  // Ensure main process stays in sync (it clamps opacity & applies it to the window).
  window.electronAPI.setOpacity(state.opacity);

  window.electronAPI.onLockedChanged((locked) => {
    setLockedUi(locked);
  });
}

selectImageBtn.addEventListener('click', async () => {
  const imagePath = await window.electronAPI.selectImage();
  if (imagePath) {
    setImageFromPath(imagePath);
  } else if (!state.imagePath) {
    setNoImageUi(true);
  }
});

opacitySlider.addEventListener('input', (event) => {
  const nextOpacity = Number(event.target.value);
  if (!Number.isFinite(nextOpacity)) return;
  pendingOpacity = nextOpacity;
  setOpacityUi(nextOpacity);
  if (opacityRaf) return;
  opacityRaf = window.requestAnimationFrame(() => {
    opacityRaf = 0;
    if (pendingOpacity == null) return;
    window.electronAPI.setOpacity(pendingOpacity);
    pendingOpacity = null;
  });
});

closeBtn.addEventListener('click', () => {
  window.electronAPI.closeApp();
});

// --- Resizing Logic --- //
resizeHandle.addEventListener('pointerdown', async (e) => {
  if (state.locked) return;
  e.preventDefault();
  e.stopPropagation();

  isResizing = true;
  resizePointerId = e.pointerId;
  resizeHandle.setPointerCapture(resizePointerId);
  initialMouseX = e.screenX;
  initialMouseY = e.screenY;

  const bounds = await window.electronAPI.getWindowBounds();
  initialWidth = bounds?.width ?? appContainer.offsetWidth;
  initialHeight = bounds?.height ?? appContainer.offsetHeight;
});

window.addEventListener('pointermove', (e) => {
  if (!isResizing || e.pointerId !== resizePointerId) return;
  e.preventDefault();

  const deltaX = e.screenX - initialMouseX;
  const deltaY = e.screenY - initialMouseY;

  const nextWidth = Math.max(140, initialWidth + deltaX);
  const nextHeight = Math.max(90, initialHeight + deltaY);

  pendingResize = { width: nextWidth, height: nextHeight };
  if (resizeRaf) return;
  resizeRaf = window.requestAnimationFrame(() => {
    resizeRaf = 0;
    if (!pendingResize) return;
    window.electronAPI.resizeWindow(pendingResize.width, pendingResize.height);
    pendingResize = null;
  });
});

function stopResize() {
  isResizing = false;
  resizePointerId = null;
  pendingResize = null;
  if (resizeRaf) {
    window.cancelAnimationFrame(resizeRaf);
    resizeRaf = 0;
  }
}

window.addEventListener('pointerup', (e) => {
  if (!isResizing || e.pointerId !== resizePointerId) return;
  stopResize();
});

window.addEventListener('pointercancel', (e) => {
  if (!isResizing || e.pointerId !== resizePointerId) return;
  stopResize();
});

// Drag & drop image file onto the overlay to set it.
appContainer.addEventListener('dragover', (e) => {
  if (state.locked) return;
  e.preventDefault();
});

appContainer.addEventListener('drop', async (e) => {
  if (state.locked) return;
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  const filePath = file?.path;
  if (typeof filePath !== 'string' || filePath.length === 0) return;
  const saved = await window.electronAPI.setImagePath(filePath);
  setImageFromPath(saved);
});

if (lockBtn) {
  lockBtn.addEventListener('click', () => {
    window.electronAPI.setLocked(!state.locked);
  });
}

// Initial load
loadInitialSettings();
