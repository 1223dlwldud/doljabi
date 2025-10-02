'use strict';

// Omok (Gomoku) - Board and Stones implementation

/**
 * Configurable constants
 */
const BOARD_SIZE = 15; // 15x15 intersections
const BOARD_MARGIN_CELLS = 1; // visual padding around grid in cells
const STAR_POINTS_15 = [
  [3, 3],
  [3, 11],
  [7, 7],
  [11, 3],
  [11, 11],
];

/**
 * DOM elements
 */
const canvas = document.getElementById('board');
const resetButton = document.getElementById('reset-btn');
const currentPlayerText = document.getElementById('current-player');
const currentDot = document.getElementById('current-dot');

/**
 * Canvas 2D context and DPR scaling helpers
 */
const ctx = canvas.getContext('2d');

function getDevicePixelRatio() {
  return window.devicePixelRatio || 1;
}

function resizeCanvasToDisplaySize() {
  const dpr = getDevicePixelRatio();
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.floor(rect.width);
  const cssHeight = Math.floor(rect.height);
  // Only resize when necessary
  if (canvas.width !== Math.floor(cssWidth * dpr) || canvas.height !== Math.floor(cssHeight * dpr)) {
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

/**
 * Game state
 */
const CELL_EMPTY = 0;
const CELL_BLACK = 1;
const CELL_WHITE = 2;

let currentPlayer = CELL_BLACK;
let boardState = createEmptyBoard();
let lastMove = null; // {x, y}

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => CELL_EMPTY));
}

/**
 * Geometry helpers
 */
function computeLayout() {
  const rect = canvas.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height);
  const totalCells = BOARD_SIZE - 1; // number of gaps between lines
  const margin = Math.max(8, Math.floor(size / 30)); // px margin inside canvas
  const gridSize = size - margin * 2;
  const cellSize = gridSize / totalCells;
  return { margin, size, gridSize, cellSize };
}

function boardToCanvasPoint(ix, iy, layout) {
  const { margin, cellSize } = layout;
  return {
    x: margin + ix * cellSize,
    y: margin + iy * cellSize,
  };
}

function canvasToBoardIndex(x, y, layout) {
  const { margin, cellSize } = layout;
  const ix = Math.round((x - margin) / cellSize);
  const iy = Math.round((y - margin) / cellSize);
  return { ix, iy };
}

function isInsideBoard(ix, iy) {
  return ix >= 0 && ix < BOARD_SIZE && iy >= 0 && iy < BOARD_SIZE;
}

/**
 * Rendering
 */
function drawBoard() {
  resizeCanvasToDisplaySize();
  const layout = computeLayout();
  const { size, margin, gridSize, cellSize } = layout;

  // clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // wooden background (matches CSS behind it but ensures full draw)
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, '#e3c297');
  gradient.addColorStop(1, '#d7b586');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // grid
  ctx.save();
  ctx.translate(0.5, 0.5); // crisp lines
  ctx.strokeStyle = '#433d2b';
  ctx.lineWidth = 1;

  // outer border
  ctx.strokeRect(margin, margin, gridSize, gridSize);

  // grid lines
  for (let i = 0; i < BOARD_SIZE; i++) {
    const p = margin + i * cellSize;
    // horizontal
    ctx.beginPath();
    ctx.moveTo(margin, p);
    ctx.lineTo(margin + gridSize, p);
    ctx.stroke();
    // vertical
    ctx.beginPath();
    ctx.moveTo(p, margin);
    ctx.lineTo(p, margin + gridSize);
    ctx.stroke();
  }

  // star points
  for (const [sx, sy] of STAR_POINTS_15) {
    const { x, y } = boardToCanvasPoint(sx, sy, layout);
    ctx.beginPath();
    ctx.fillStyle = '#2a2416';
    ctx.arc(x, y, Math.max(2, Math.min(4, cellSize * 0.12)), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // stones
  drawStones(layout);

  // last move marker
  if (lastMove) {
    drawLastMoveMarker(lastMove.x, lastMove.y, layout);
  }
}

function drawStones(layout) {
  const { cellSize } = layout;
  const radius = cellSize * 0.42;

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const cell = boardState[y][x];
      if (cell === CELL_EMPTY) continue;

      const { x: cx, y: cy } = boardToCanvasPoint(x, y, layout);
      if (cell === CELL_BLACK) {
        drawStone(cx, cy, radius, '#101010', '#5c5c5c');
      } else if (cell === CELL_WHITE) {
        drawStone(cx, cy, radius, '#f1f1f1', '#cfcfcf');
      }
    }
  }
}

function drawStone(cx, cy, r, baseColor, highlightColor) {
  // subtle shadow
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.08, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fill();
  ctx.restore();

  // stone body
  const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  grad.addColorStop(0, highlightColor);
  grad.addColorStop(1, baseColor);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // rim
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
}

function drawLastMoveMarker(ix, iy, layout) {
  const { x, y } = boardToCanvasPoint(ix, iy, layout);
  const { cellSize } = layout;
  const r = Math.max(2, Math.min(5, cellSize * 0.12));
  ctx.beginPath();
  ctx.fillStyle = '#ff4757';
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Interaction
 */
function handleBoardClick(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const layout = computeLayout();
  const { ix, iy } = canvasToBoardIndex(x, y, layout);

  if (!isInsideBoard(ix, iy)) return;
  if (boardState[iy][ix] !== CELL_EMPTY) return;

  boardState[iy][ix] = currentPlayer;
  lastMove = { x: ix, y: iy };
  togglePlayer();
  drawBoard();
  updateStatus();
}

function togglePlayer() {
  currentPlayer = currentPlayer === CELL_BLACK ? CELL_WHITE : CELL_BLACK;
}

function updateStatus() {
  if (currentPlayer === CELL_BLACK) {
    currentPlayerText.textContent = '흑';
    currentDot.classList.remove('status__dot--white');
    currentDot.classList.add('status__dot--black');
  } else {
    currentPlayerText.textContent = '백';
    currentDot.classList.remove('status__dot--black');
    currentDot.classList.add('status__dot--white');
  }
}

function resetGame() {
  boardState = createEmptyBoard();
  currentPlayer = CELL_BLACK;
  lastMove = null;
  updateStatus();
  drawBoard();
}

/**
 * Setup
 */
function init() {
  updateStatus();
  drawBoard();
  window.addEventListener('resize', drawBoard);
  canvas.addEventListener('click', handleBoardClick);
  resetButton.addEventListener('click', resetGame);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

