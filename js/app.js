/**
 * AeroEvo — Main Orchestrator & Live Analytics HUD
 * Combines simulation environment, neural nets, genetic algs, interactive tools, and custom charts
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Canvas Settings & Contexts ---
  const simCanvas = document.getElementById('simulation-canvas');
  const simCtx = simCanvas.getContext('2d');
  
  const neuralCanvas = document.getElementById('neural-canvas');
  const chartCanvas = document.getElementById('chart-canvas');
  const chartCtx = chartCanvas.getContext('2d');

  // Set logical simulation dimensions (canvas is responsive but internally mapped)
  const simWidth = 800;
  const simHeight = 550;

  // --- Simulation State ---
  let isRunning = false;
  let simSpeed = 1;
  let isInstantMode = false;
  let maxRoundSeconds = 20;
  let maxRoundFrames = maxRoundSeconds * 60; // 60 FPS reference
  let currentFrame = 0;
  
  let populationSize = 100;
  let mutationRate = 0.08;
  let selectionMethod = 'tournament';
  let networkTopology = [7, 8, 6, 2];

  // Starting airfield config
  let runway = { x: 80, y: 275, angle: 0, r: 18 };
  // Target config
  let target = { x: 720, y: 275, r: 16 };

  let population = [];
  let obstacles = [];
  const particles = new ParticleSystem();
  
  const ga = new GeneticAlgorithm();
  const brainVisualizer = new NeuralNetworkVisualizer(neuralCanvas);
  
  // Custom charting states
  let chartHoveredGenIndex = -1;

  // --- Dynamic Drawing Tool State ---
  let activeTool = 'wall'; // 'wall', 'tower', 'eraser', 'target', 'start'
  let isDrawing = false;
  let lastDrawPos = null;
  let isDraggingItem = null; // 'target', 'start'

  // --- UI Elements ---
  const btnPlayPause = document.getElementById('btn-play-pause');
  const btnRestart = document.getElementById('btn-restart');
  const sliderSpeed = document.getElementById('sim-speed');
  const valSpeed = document.getElementById('speed-val');
  const chkInstant = document.getElementById('instant-training');
  
  const toolButtons = document.querySelectorAll('.tool-btn');
  const btnClearObstacles = document.getElementById('btn-clear-obstacles');
  const btnResetLayout = document.getElementById('btn-reset-layout');
  const selectPresets = document.getElementById('map-presets');
  
  const sliderPop = document.getElementById('pop-size');
  const valPop = document.getElementById('pop-size-val');
  const sliderMut = document.getElementById('mutation-rate');
  const valMut = document.getElementById('mut-rate-val');
  const sliderTime = document.getElementById('time-limit');
  const valTime = document.getElementById('time-limit-val');
  const selectSelection = document.getElementById('selection-method');
  
  const inputTopology = document.getElementById('nn-topology');
  const btnApplyTopology = document.getElementById('btn-apply-nn');
  
  const btnSaveBrain = document.getElementById('btn-save-brain');
  const btnLoadBrain = document.getElementById('btn-load-brain');
  const btnClearBrain = document.getElementById('btn-clear-brain');
  const txtStorageStatus = document.getElementById('storage-status');
  
  const chkSensors = document.getElementById('toggle-sensors');
  const chkTrails = document.getElementById('toggle-trails');
  
  const txtHeaderGen = document.getElementById('header-gen');
  const txtHeaderBest = document.getElementById('header-best');
  const txtHeaderSuccess = document.getElementById('header-success-rate');
  
  const txtStatAlive = document.getElementById('stat-alive');
  const txtStatReached = document.getElementById('stat-reached');
  const txtStatTimer = document.getElementById('stat-timer');
  const txtStatBestFit = document.getElementById('stat-best-fit');
  const barTimer = document.getElementById('timer-bar');
  
  const overlayCanvas = document.getElementById('canvas-overlay');
  const overlayMsg = document.getElementById('overlay-msg');
  const overlaySubmsg = document.getElementById('overlay-submsg');

  // --- Initialization Functions ---
  
  function init() {
    setupCanvasDPI(simCanvas, simWidth, simHeight);
    
    // Load presets
    loadPresetMap(selectPresets.value);
    
    // Check saved brains
    updateStorageButtons();
    
    // Setup initial population
    createPopulation();
    
    // Setup event listeners
    setupEventListeners();
    
    // Draw initial idle frame
    drawSimulation();
    brainVisualizer.draw(null);
    renderTrendChart();
  }

  function setupCanvasDPI(canvas, width, height) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }

  function createPopulation(brainsToInject = null) {
    population = [];
    currentFrame = 0;
    
    for (let i = 0; i < populationSize; i++) {
      let brain;
      if (brainsToInject && brainsToInject.length > 0) {
        // Clone from injected brains
        const sourceBrain = brainsToInject[i % brainsToInject.length];
        brain = sourceBrain.clone();
        if (i >= eliteCountForLoad(brainsToInject.length)) {
          // Mutate cloned injectees to preserve evolution diversity
          brain.mutate(mutationRate * 2.5, 0.2); 
        }
      } else {
        // Random initialization
        brain = new NeuralNetwork(networkTopology);
      }
      
      const plane = new Aircraft(runway.x, runway.y, runway.angle, brain);
      population.push(plane);
    }
  }
  
  function eliteCountForLoad(injectedLength) {
    return Math.max(1, Math.floor(populationSize * 0.15));
  }

  // --- Presets Map Builder ---
  function loadPresetMap(presetName) {
    obstacles = [];
    particles.clear();
    
    // Boundary walls are added automatically to keep planes in bound
    const offset = 1;
    // Top
    obstacles.push({ type: 'wall', p1: { x: offset, y: offset }, p2: { x: simWidth - offset, y: offset } });
    // Right
    obstacles.push({ type: 'wall', p1: { x: simWidth - offset, y: offset }, p2: { x: simWidth - offset, y: simHeight - offset } });
    // Bottom
    obstacles.push({ type: 'wall', p1: { x: offset, y: simHeight - offset }, p2: { x: simWidth - offset, y: simHeight - offset } });
    // Left
    obstacles.push({ type: 'wall', p1: { x: offset, y: offset }, p2: { x: offset, y: simHeight - offset } });

    // Reset default runway/target locations
    runway.x = 80;
    runway.y = 275;
    runway.angle = 0;
    target.x = 720;
    target.y = 275;

    if (presetName === 'easy-maze') {
      // Horizontal barriers forcing zigzag
      obstacles.push({ type: 'wall', p1: { x: 0, y: 180 }, p2: { x: 580, y: 180 } });
      obstacles.push({ type: 'wall', p1: { x: 220, y: 370 }, p2: { x: 800, y: 370 } });
    } 
    else if (presetName === 'ring-track') {
      // Oval race course. Center barrier pill
      obstacles.push({ type: 'tower', x: 400, y: 275, r: 85 });
      obstacles.push({ type: 'tower', x: 230, y: 275, r: 50 });
      obstacles.push({ type: 'tower', x: 570, y: 275, r: 50 });
      
      obstacles.push({ type: 'wall', p1: { x: 230, y: 225 }, p2: { x: 570, y: 225 } });
      obstacles.push({ type: 'wall', p1: { x: 230, y: 325 }, p2: { x: 570, y: 325 } });
      
      // Move target and runway to fit ring track
      runway.x = 400; runway.y = 110; runway.angle = 0;
      target.x = 400; target.y = 440;
    } 
    else if (presetName === 'slalom') {
      // Gateway pillars to slalom weave through
      obstacles.push({ type: 'tower', x: 240, y: 130, r: 40 });
      obstacles.push({ type: 'tower', x: 240, y: 420, r: 40 });
      
      obstacles.push({ type: 'tower', x: 400, y: 275, r: 45 });
      
      obstacles.push({ type: 'tower', x: 560, y: 130, r: 40 });
      obstacles.push({ type: 'tower', x: 560, y: 420, r: 40 });
    }
    else if (presetName === 'central-pillar') {
      // Wall splitting center with a tight gateway
      obstacles.push({ type: 'wall', p1: { x: 400, y: 0 }, p2: { x: 400, y: 190 } });
      obstacles.push({ type: 'wall', p1: { x: 400, y: 360 }, p2: { x: 400, y: 550 } });
      obstacles.push({ type: 'tower', x: 400, y: 190, r: 15 });
      obstacles.push({ type: 'tower', x: 400, y: 360, r: 15 });
    }
  }

  // --- Core Engine Loop ---

  function runSimulationLoop() {
    if (!isRunning) return;

    if (isInstantMode) {
      // FAST mode: run entire generation physics calculation instantly in a single frame
      let alive = true;
      while (alive && currentFrame < maxRoundFrames) {
        alive = updateSimulationPhysics();
      }
      
      // Conclude generation immediately
      concludeGeneration();
      
      // Schedule next frame right away
      setTimeout(runSimulationLoop, 2);
      return;
    }

    // NORMAL mode: rendered speed frames
    let genConcluded = false;
    for (let s = 0; s < simSpeed; s++) {
      const alive = updateSimulationPhysics();
      if (!alive || currentFrame >= maxRoundFrames) {
        concludeGeneration();
        genConcluded = true;
        break;
      }
    }

    if (!genConcluded) {
      particles.update();
      drawSimulation();
      
      // Find the best plane currently alive to draw its brain activation
      const bestPlane = getBestAlivePlane();
      if (bestPlane) {
        brainVisualizer.draw(bestPlane.brain);
      } else {
        brainVisualizer.draw(ga.allTimeBestBrain);
      }
      
      requestAnimationFrame(runSimulationLoop);
    } else {
      // Run next cycle
      requestAnimationFrame(runSimulationLoop);
    }
  }

  /**
   * Advances the physics elements
   * @returns {boolean} True if there is at least one active plane alive
   */
  function updateSimulationPhysics() {
    currentFrame++;
    
    let anyAlive = false;
    
    for (const plane of population) {
      if (plane.isDead || plane.reachedTarget) continue;

      plane.updateSensors(obstacles, target);
      plane.update(obstacles, target, maxRoundFrames);

      if (plane.isDead) {
        particles.emitCrash(plane.x, plane.y);
      } else if (plane.reachedTarget) {
        particles.emitSuccess(plane.x, plane.y);
      } else {
        anyAlive = true;
        // Emit engine smoke trail randomly
        if (Math.random() < 0.15 && !isInstantMode) {
          const isBest = (plane === getBestAlivePlane());
          particles.emitExhaust(plane.x, plane.y, plane.angle, isBest);
        }
      }
    }

    // Keep syncing UI statistics
    if (!isInstantMode && currentFrame % 3 === 0) {
      updateLiveStatsUI();
    }

    return anyAlive;
  }

  function concludeGeneration() {
    // 1. Calculate fitness for all agents in the population
    for (const plane of population) {
      plane.calculateFitness(maxRoundFrames);
    }

    // 2. Run Genetic selection + breeding
    const nextBrains = ga.evolve(population, populationSize, mutationRate, selectionMethod, networkTopology);
    
    // 3. Update historic Trend Chart
    renderTrendChart();

    // 4. Update Header Metrics
    txtHeaderGen.textContent = ga.history.length;
    txtHeaderBest.textContent = ga.allTimeBestFitness.toFixed(2);
    
    const lastGenStats = ga.history[ga.history.length - 1];
    if (lastGenStats) {
      txtHeaderSuccess.textContent = `${(lastGenStats.successRate * 100).toFixed(0)}%`;
    }

    // 5. Spawn new generation
    createPopulation(nextBrains);

    // Refresh display
    particles.clear();
    updateLiveStatsUI();
    
    // Render the all-time best brain in the neural canvas as a fallback
    brainVisualizer.draw(ga.allTimeBestBrain);
    
    // Enable load brain button if cached brain just got created
    updateStorageButtons();
  }

  // --- Finder Helpers ---

  function getBestAlivePlane() {
    let best = null;
    let maxFit = -Infinity;

    for (const plane of population) {
      if (plane.isDead) continue;
      
      // Temporary real-time fitness calculation to find active leader
      const dist = Math.sqrt((target.x - plane.x)**2 + (target.y - plane.y)**2);
      const initialDist = plane.initialDistance || 500;
      const progress = initialDist - Math.min(dist, plane.minDistanceReached);
      const currentFit = progress + (plane.survivedTime * 0.05) + (plane.reachedTarget ? 1000 : 0);

      if (currentFit > maxFit) {
        maxFit = currentFit;
        best = plane;
      }
    }
    return best;
  }

  // --- Render Draw Routines ---

  function drawSimulation() {
    simCtx.clearRect(0, 0, simWidth, simHeight);

    // 1. Draw Runway Runway
    drawRunway(simCtx);

    // 2. Draw Target Glowing Orb
    drawTarget(simCtx);

    // 3. Draw Obstacles (Drawn Walls & Pylons)
    drawObstacles(simCtx);

    // 4. Render Particle System
    particles.draw(simCtx);

    // 5. Draw Population of Planes
    const bestPlane = getBestAlivePlane();
    const showTrails = chkTrails.checked;
    
    for (const plane of population) {
      const isBest = (plane === bestPlane);
      // Let aircraft handle its own trails and raycasts rendering
      plane.draw(simCtx, showTrails, isBest);
    }

    // 6. Draw User Interfacing HUD Drawing overlays
    if (isDrawing && activeTool === 'wall' && lastDrawPos) {
      simCtx.save();
      simCtx.strokeStyle = 'rgba(255, 0, 127, 0.6)';
      simCtx.lineWidth = 3;
      simCtx.setLineDash([4, 4]);
      simCtx.beginPath();
      // Temporary guide line shown when drawing
      simCtx.moveTo(lastDrawPos.x, lastDrawPos.y);
      // We don't have mouse coordinates directly here, drawn in mousemove
      simCtx.restore();
    }
  }

  function drawRunway(ctx) {
    ctx.save();
    ctx.translate(runway.x, runway.y);
    ctx.rotate(runway.angle);
    
    // Draw runway dashboard layout
    ctx.shadowBlur = 8;
    ctx.shadowColor = "rgba(0, 240, 255, 0.35)";
    ctx.fillStyle = "rgba(10, 15, 30, 0.7)";
    ctx.strokeStyle = "rgba(0, 240, 255, 0.5)";
    ctx.lineWidth = 1.5;
    
    // Runway rectangle
    ctx.beginPath();
    ctx.rect(-20, -12, 40, 24);
    ctx.fill();
    ctx.stroke();

    // Runway stripes
    ctx.strokeStyle = "rgba(0, 240, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-15, 0); ctx.lineTo(-5, 0);
    ctx.moveTo(5, 0); ctx.lineTo(15, 0);
    ctx.stroke();

    // Direction head
    ctx.fillStyle = "rgba(0, 240, 255, 0.8)";
    ctx.beginPath();
    ctx.moveTo(12, -4); ctx.lineTo(19, 0); ctx.lineTo(12, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawTarget(ctx) {
    ctx.save();
    const pulse = 1.0 + Math.sin(Date.now() * 0.007) * 0.08;
    const r = target.r * pulse;

    // Glowing gradients
    const grad = ctx.createRadialGradient(target.x, target.y, 1, target.x, target.y, r * 1.5);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, '#39ff14');
    grad.addColorStop(0.6, 'rgba(57, 255, 20, 0.25)');
    grad.addColorStop(1, 'rgba(57, 255, 20, 0)');

    ctx.shadowBlur = 12;
    ctx.shadowColor = '#39ff14';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(target.x, target.y, r * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Inner target core rings
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(57, 255, 20, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#39ff14";
    ctx.beginPath();
    ctx.arc(target.x, target.y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawObstacles(ctx) {
    ctx.save();
    for (const obs of obstacles) {
      if (obs.type === 'wall') {
        // Glowing cyan lines (user-drawn barriers)
        ctx.strokeStyle = "rgba(0, 240, 255, 0.8)";
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(0, 240, 255, 0.4)";
        ctx.lineWidth = 3.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(obs.p1.x, obs.p1.y);
        ctx.lineTo(obs.p2.x, obs.p2.y);
        ctx.stroke();
      } 
      else if (obs.type === 'tower') {
        // Glowing dark structure column
        const grad = ctx.createRadialGradient(obs.x, obs.y, obs.r * 0.4, obs.x, obs.y, obs.r);
        grad.addColorStop(0, '#101525');
        grad.addColorStop(0.8, '#0b0d18');
        grad.addColorStop(1, '#ff007f'); // Magenta perimeter ring

        ctx.fillStyle = grad;
        ctx.strokeStyle = 'rgba(255, 0, 127, 0.7)';
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(255, 0, 127, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner HUD details inside tower
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 0, 127, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.r * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 0, 127, 0.1)';
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- Live Metrics UI Synchronizer ---

  function updateLiveStatsUI() {
    const aliveCount = population.filter(p => !p.isDead && !p.reachedTarget).length;
    const reachedCount = population.filter(p => p.reachedTarget).length;
    
    txtStatAlive.textContent = `${aliveCount} / ${populationSize}`;
    txtStatReached.textContent = reachedCount;

    // Timer sync
    const elapsedSeconds = currentFrame / 60;
    txtStatTimer.textContent = `${elapsedSeconds.toFixed(1)}s / ${maxRoundSeconds.toFixed(1)}s`;
    
    // Fill progress bar width percent
    const percent = Math.min(100, (currentFrame / maxRoundFrames) * 100);
    barTimer.style.width = `${percent}%`;

    // Maximum live fitness tracking
    let maxLiveFit = 0;
    for (const plane of population) {
      // Calculate active relative fitness value
      const dist = Math.sqrt((target.x - plane.x)**2 + (target.y - plane.y)**2);
      const initialDist = plane.initialDistance || 500;
      const progress = initialDist - Math.min(dist, plane.minDistanceReached);
      const currentFit = progress + (plane.survivedTime * 0.05) + (plane.reachedTarget ? 1000 : 0);
      
      if (currentFit > maxLiveFit) {
        maxLiveFit = currentFit;
      }
    }
    txtStatBestFit.textContent = maxLiveFit.toFixed(2);
  }

  // --- Real-time Trend Analytics Vector Chart ---

  function renderTrendChart() {
    const dpr = window.devicePixelRatio || 1;
    const rect = chartCanvas.parentNode.getBoundingClientRect();
    chartCanvas.width = rect.width * dpr;
    chartCanvas.height = rect.height * dpr;
    chartCanvas.style.width = `${rect.width}px`;
    chartCanvas.style.height = `${rect.height}px`;
    
    chartCtx.scale(dpr, dpr);
    chartCtx.clearRect(0, 0, rect.width, rect.height);

    const data = ga.history;
    const padL = 30;
    const padB = 22;
    const padT = 10;
    const padR = 10;
    
    const chartW = rect.width - padL - padR;
    const chartH = rect.height - padB - padT;

    // Drawing Grid borders
    chartCtx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    chartCtx.lineWidth = 1;
    chartCtx.strokeRect(padL, padT, chartW, chartH);

    if (data.length === 0) {
      chartCtx.font = "10px Orbitron";
      chartCtx.fillStyle = "#718096";
      chartCtx.textAlign = "center";
      chartCtx.fillText("EVOLUTION DATA RECORD PENDING...", rect.width / 2, rect.height / 2);
      return;
    }

    // Determine scaling metrics
    const genMax = data.length;
    let fitMax = 1.0;
    for (const pt of data) {
      if (pt.maxFitness > fitMax) {
        fitMax = pt.maxFitness;
      }
    }
    // inflate slightly for padding on top
    fitMax *= 1.05;

    // Draw horizontal division helper lines
    chartCtx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    chartCtx.lineWidth = 1;
    chartCtx.setLineDash([2, 4]);
    for (let i = 1; i <= 4; i++) {
      const yVal = padT + chartH - (chartH / 5) * i;
      chartCtx.beginPath();
      chartCtx.moveTo(padL, yVal);
      chartCtx.lineTo(padL + chartW, yVal);
      chartCtx.stroke();

      // Axis labels
      chartCtx.font = "8px Roboto Mono";
      chartCtx.fillStyle = "#718096";
      chartCtx.textAlign = "right";
      chartCtx.setLineDash([]); // temporarily clear dash to draw labels
      chartCtx.fillText(((fitMax / 5) * i).toFixed(0), padL - 6, yVal + 3);
      chartCtx.setLineDash([2, 4]);
    }
    chartCtx.setLineDash([]);

    // Map functions
    const getX = (genIndex) => {
      if (genMax <= 1) return padL + chartW / 2;
      return padL + (chartW / (genMax - 1)) * genIndex;
    };
    
    const getY = (val) => {
      return padL + chartH - (chartH * (val / fitMax));
    };

    // Draw Curves
    // 1. Max Fitness (Magenta)
    chartCtx.beginPath();
    chartCtx.moveTo(getX(0), getY(data[0].maxFitness));
    for (let i = 1; i < data.length; i++) {
      chartCtx.lineTo(getX(i), getY(data[i].maxFitness));
    }
    chartCtx.strokeStyle = "var(--neon-magenta)";
    chartCtx.lineWidth = 2;
    chartCtx.shadowBlur = 4;
    chartCtx.shadowColor = "var(--neon-magenta)";
    chartCtx.stroke();
    chartCtx.shadowBlur = 0;

    // 2. Average Fitness (Cyan)
    chartCtx.beginPath();
    chartCtx.moveTo(getX(0), getY(data[0].avgFitness));
    for (let i = 1; i < data.length; i++) {
      chartCtx.lineTo(getX(i), getY(data[i].avgFitness));
    }
    chartCtx.strokeStyle = "var(--neon-cyan)";
    chartCtx.lineWidth = 1.5;
    chartCtx.shadowBlur = 4;
    chartCtx.shadowColor = "var(--neon-cyan)";
    chartCtx.stroke();
    chartCtx.shadowBlur = 0;

    // 3. Success Rate (Green, scaled 0 to 100% mapped to fitness max)
    chartCtx.beginPath();
    chartCtx.moveTo(getX(0), getY(data[0].successRate * fitMax));
    for (let i = 1; i < data.length; i++) {
      chartCtx.lineTo(getX(i), getY(data[i].successRate * fitMax));
    }
    chartCtx.strokeStyle = "var(--neon-green)";
    chartCtx.lineWidth = 1.5;
    chartCtx.shadowBlur = 4;
    chartCtx.shadowColor = "var(--neon-green)";
    chartCtx.stroke();
    chartCtx.shadowBlur = 0;

    // Draw X-axis label indicators
    chartCtx.font = "8px Roboto Mono";
    chartCtx.fillStyle = "#718096";
    chartCtx.textAlign = "center";
    
    // Initial Gen label
    chartCtx.fillText("G1", getX(0), padT + chartH + 14);
    
    // Intermediate and Last Gen labels
    if (genMax > 1) {
      chartCtx.fillText(`G${genMax}`, getX(genMax - 1), padT + chartH + 14);
      if (genMax > 2) {
        const midIndex = Math.floor(genMax / 2);
        chartCtx.fillText(`G${midIndex + 1}`, getX(midIndex), padT + chartH + 14);
      }
    }

    // Hover interactive panel render overlay
    if (chartHoveredGenIndex >= 0 && chartHoveredGenIndex < data.length) {
      const idx = chartHoveredGenIndex;
      const x = getX(idx);
      const pt = data[idx];

      // Draw hover line vertical
      chartCtx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      chartCtx.lineWidth = 1;
      chartCtx.beginPath();
      chartCtx.moveTo(x, padT);
      chartCtx.lineTo(x, padT + chartH);
      chartCtx.stroke();

      // Small glowing circles at point junctions
      drawChartJunctionCircle(chartCtx, x, getY(pt.maxFitness), "var(--neon-magenta)");
      drawChartJunctionCircle(chartCtx, x, getY(pt.avgFitness), "var(--neon-cyan)");
      drawChartJunctionCircle(chartCtx, x, getY(pt.successRate * fitMax), "var(--neon-green)");

      // Hover Text box card overlay
      drawChartHoverTooltip(chartCtx, x, rect.width, pt);
    }
  }

  function drawChartJunctionCircle(ctx, x, y, color) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowBlur = 5;
    ctx.shadowColor = color;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawChartHoverTooltip(ctx, x, chartWidth, pt) {
    ctx.save();
    
    // Position tooltip left or right depending on side of hover to avoid cutoff
    let boxW = 100;
    let boxH = 68;
    let boxY = 16;
    let boxX = x + 10;
    if (boxX + boxW > chartWidth) {
      boxX = x - boxW - 10;
    }

    ctx.fillStyle = "rgba(10, 12, 22, 0.95)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    
    ctx.beginPath();
    ctx.rect(boxX, boxY, boxW, boxH);
    ctx.fill();
    ctx.stroke();
    
    ctx.shadowBlur = 0;

    // Tooltip Info
    ctx.font = "8px Orbitron";
    ctx.fillStyle = "var(--text-bright)";
    ctx.textAlign = "left";
    ctx.fillText(`GEN ${pt.generation}`, boxX + 6, boxY + 12);

    ctx.font = "7.5px Roboto Mono";
    ctx.fillStyle = "var(--neon-magenta)";
    ctx.fillText(`Max Fit: ${pt.maxFitness}`, boxX + 6, boxY + 26);
    
    ctx.fillStyle = "var(--neon-cyan)";
    ctx.fillText(`Avg Fit: ${pt.avgFitness}`, boxX + 6, boxY + 38);
    
    ctx.fillStyle = "var(--neon-green)";
    ctx.fillText(`Success: ${(pt.successRate * 100).toFixed(0)}%`, boxX + 6, boxY + 50);

    ctx.restore();
  }

  // --- LocalStorage Save/Load Operations ---

  function updateStorageButtons() {
    const saved = localStorage.getItem('aero_evo_best_brain');
    if (saved) {
      btnLoadBrain.classList.remove('disabled');
      btnLoadBrain.disabled = false;
      btnClearBrain.classList.remove('disabled');
      btnClearBrain.disabled = false;
      txtStorageStatus.textContent = "SAVED BRAIN IS DETECTED in browser cache.";
      txtStorageStatus.classList.add('text-glow-cyan');
    } else {
      btnLoadBrain.classList.add('disabled');
      btnLoadBrain.disabled = true;
      btnClearBrain.classList.add('disabled');
      btnClearBrain.disabled = true;
      txtStorageStatus.textContent = "No saved brain detected in browser cache.";
      txtStorageStatus.classList.remove('text-glow-cyan');
    }
  }

  // --- Event Listeners Setup ---

  function setupEventListeners() {
    // 1. Play / Pause simulation
    btnPlayPause.addEventListener('click', () => {
      isRunning = !isRunning;
      if (isRunning) {
        btnPlayPause.innerHTML = '<span class="btn-icon">⏸</span> <span class="btn-text">PAUSE</span>';
        btnPlayPause.classList.add('btn-primary');
        overlayCanvas.classList.add('hidden');
        runSimulationLoop();
      } else {
        btnPlayPause.innerHTML = '<span class="btn-icon">▶</span> <span class="btn-text">RESUME</span>';
        overlayCanvas.classList.remove('hidden');
        overlayMsg.textContent = "SIMULATION PAUSED";
        overlaySubmsg.textContent = "Adjust parameters or draw/erase obstacles on screen!";
      }
    });

    // 2. Restart simulation
    btnRestart.addEventListener('click', () => {
      particles.clear();
      createPopulation();
      updateLiveStatsUI();
      
      if (!isRunning) {
        // Redraw idle setup
        drawSimulation();
      }
    });

    // 3. Engine speed slider
    sliderSpeed.addEventListener('input', () => {
      simSpeed = parseInt(sliderSpeed.value);
      valSpeed.textContent = `${simSpeed}x`;
    });

    // 4. Instant training mode
    chkInstant.addEventListener('change', () => {
      isInstantMode = chkInstant.checked;
      if (isInstantMode) {
        valSpeed.textContent = "MAX / INSTANT";
        sliderSpeed.disabled = true;
        sliderSpeed.classList.add('disabled');
      } else {
        simSpeed = parseInt(sliderSpeed.value);
        valSpeed.textContent = `${simSpeed}x`;
        sliderSpeed.disabled = false;
        sliderSpeed.classList.remove('disabled');
      }
    });

    // 5. Canvas Drawing tools selector
    toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        toolButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTool = btn.dataset.tool;
      });
    });

    // 6. Clear map walls
    btnClearObstacles.addEventListener('click', () => {
      // Retain boundary walls only
      obstacles = obstacles.filter(o => o.type === 'wall' && (
        (o.p1.x === 1 && o.p2.x === simWidth - 1) || 
        (o.p1.y === 1 && o.p2.y === simHeight - 1)
      ));
      particles.clear();
      drawSimulation();
    });

    // 7. Reset obstacles layout to preset map
    btnResetLayout.addEventListener('click', () => {
      loadPresetMap(selectPresets.value);
      drawSimulation();
    });

    // 8. Preset Maps select box changes
    selectPresets.addEventListener('change', () => {
      loadPresetMap(selectPresets.value);
      particles.clear();
      // Auto-restart population on preset map changes to start fresh on that terrain
      createPopulation();
      updateLiveStatsUI();
      drawSimulation();
    });

    // 9. Population Size slider
    sliderPop.addEventListener('input', () => {
      populationSize = parseInt(sliderPop.value);
      valPop.textContent = populationSize;
    });

    // 10. Mutation Rate slider
    sliderMut.addEventListener('input', () => {
      mutationRate = parseInt(sliderMut.value) / 100;
      valMut.textContent = `${sliderMut.value}%`;
    });

    // 11. Max Round time limit slider
    sliderTime.addEventListener('input', () => {
      maxRoundSeconds = parseInt(sliderTime.value);
      maxRoundFrames = maxRoundSeconds * 60;
      valTime.textContent = `${maxRoundSeconds}s`;
    });

    // 12. Selection Method select box changes
    selectSelection.addEventListener('change', () => {
      selectionMethod = selectSelection.value;
    });

    // 13. Apply Topology architecture buttons
    btnApplyTopology.addEventListener('click', () => {
      const topStr = inputTopology.value.trim();
      const parts = topStr.split(',').map(s => parseInt(s.trim()));
      
      // Validation check
      const valid = parts.length > 0 && parts.every(n => !isNaN(n) && n > 0);
      if (valid) {
        // topology starts with 7 inputs, ends with 2 outputs
        networkTopology = [7, ...parts, 2];
        alert(`Neural network topology updated to: 7, ${parts.join(', ')}, 2\nRequires a "RESTART" to apply architecture shifts.`);
      } else {
        alert("Invalid topology configuration. List integers separated by commas. (e.g. 8,6)");
      }
    });

    // 14. Save Brain to local cache
    btnSaveBrain.addEventListener('click', () => {
      const best = ga.allTimeBestBrain;
      if (!best) {
        alert("No brain data recorded yet. Train planes first!");
        return;
      }
      
      const payload = {
        topology: best.topology,
        weights: best.weights,
        biases: best.biases
      };
      
      localStorage.setItem('aero_evo_best_brain', JSON.stringify(payload));
      updateStorageButtons();
      alert("All-Time Best aircraft brain SAVED successfully to browser Cache!");
    });

    // 15. Load Brain from local cache
    btnLoadBrain.addEventListener('click', () => {
      const saved = localStorage.getItem('aero_evo_best_brain');
      if (!saved) return;

      try {
        const payload = JSON.parse(saved);
        
        // Rebuild NeuralNetwork model instance
        const loadedBrain = new NeuralNetwork(payload.topology);
        loadedBrain.weights = payload.weights;
        loadedBrain.biases = payload.biases;

        // Apply topological changes to inputs
        inputTopology.value = payload.topology.slice(1, -1).join(', ');
        networkTopology = [...payload.topology];

        // Seed population with loaded brain clones
        const brains = new Array(populationSize).fill(null).map(() => loadedBrain.clone());
        createPopulation(brains);
        particles.clear();
        
        updateLiveStatsUI();
        drawSimulation();
        alert("Saved aircraft brain INJECTED successfully! Clones and mutated generations are now testing.");
      } catch (err) {
        console.error(err);
        alert("Failed to load brain cache. Format might be corrupted.");
      }
    });

    // 16. Clear Brain local cache
    btnClearBrain.addEventListener('click', () => {
      if (confirm("Are you sure you want to delete the cached brain weights?")) {
        localStorage.removeItem('aero_evo_best_brain');
        updateStorageButtons();
      }
    });

    // --- Interactive Canvas Drag/Drawing Handlers ---

    simCanvas.addEventListener('mousedown', (e) => {
      const pos = getMousePosOnCanvas(simCanvas, e);
      isDrawing = true;

      if (activeTool === 'target') {
        // Check click target collision
        const dist = Math.sqrt((pos.x - target.x)**2 + (pos.y - target.y)**2);
        if (dist < target.r + 10) {
          isDraggingItem = 'target';
        }
      } 
      else if (activeTool === 'start') {
        // Check click airfield runway collision
        const dist = Math.sqrt((pos.x - runway.x)**2 + (pos.y - runway.y)**2);
        if (dist < runway.r + 10) {
          isDraggingItem = 'start';
        }
      } 
      else if (activeTool === 'wall') {
        lastDrawPos = pos;
      } 
      else if (activeTool === 'tower') {
        // Place circle obstacle pylon
        obstacles.push({
          type: 'tower',
          x: pos.x,
          y: pos.y,
          r: 24
        });
        drawSimulation();
      } 
      else if (activeTool === 'eraser') {
        eraseObstaclesAt(pos);
      }
    });

    simCanvas.addEventListener('mousemove', (e) => {
      const pos = getMousePosOnCanvas(simCanvas, e);

      if (isDrawing) {
        if (isDraggingItem === 'target') {
          target.x = Math.max(20, Math.min(simWidth - 20, pos.x));
          target.y = Math.max(20, Math.min(simHeight - 20, pos.y));
          drawSimulation();
        } 
        else if (isDraggingItem === 'start') {
          // Adjust runway location + heading angle relative to drag vector
          const dx = pos.x - runway.x;
          const dy = pos.y - runway.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 15) {
            runway.angle = Math.atan2(dy, dx);
          }
          runway.x = Math.max(20, Math.min(simWidth - 20, pos.x));
          runway.y = Math.max(20, Math.min(simHeight - 20, pos.y));
          drawSimulation();
        } 
        else if (activeTool === 'wall') {
          if (lastDrawPos) {
            // Drag-draw continuous segments
            const dx = pos.x - lastDrawPos.x;
            const dy = pos.y - lastDrawPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Avoid adding tiny micro-segments
            if (dist > 8) {
              obstacles.push({
                type: 'wall',
                p1: { x: lastDrawPos.x, y: lastDrawPos.y },
                p2: { x: pos.x, y: pos.y }
              });
              lastDrawPos = pos;
              drawSimulation();
            }
          }
        } 
        else if (activeTool === 'eraser') {
          eraseObstaclesAt(pos);
        }
      }
    });

    window.addEventListener('mouseup', () => {
      isDrawing = false;
      isDraggingItem = null;
      lastDrawPos = null;
    });

    // --- Interactive Chart Hover Listener ---
    chartCanvas.addEventListener('mousemove', (e) => {
      const rect = chartCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      
      const data = ga.history;
      if (data.length === 0) return;

      const padL = 30;
      const padR = 10;
      const chartW = rect.width - padL - padR;

      // Find closest generation based on X mouse position
      const stepX = chartW / Math.max(1, data.length - 1);
      
      let closestIdx = -1;
      let minDist = Infinity;

      for (let i = 0; i < data.length; i++) {
        const xCoord = padL + stepX * i;
        const d = Math.abs(xCoord - mouseX);
        if (d < minDist) {
          minDist = d;
          closestIdx = i;
        }
      }

      // Check threshold distance
      if (minDist < stepX / 1.6) {
        if (chartHoveredGenIndex !== closestIdx) {
          chartHoveredGenIndex = closestIdx;
          renderTrendChart();
        }
      } else {
        if (chartHoveredGenIndex !== -1) {
          chartHoveredGenIndex = -1;
          renderTrendChart();
        }
      }
    });

    chartCanvas.addEventListener('mouseleave', () => {
      chartHoveredGenIndex = -1;
      renderTrendChart();
    });
  }

  function getMousePosOnCanvas(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
  }

  function eraseObstaclesAt(pos) {
    const eraseRadius = 24;
    let modified = false;

    // Erase circles (towers)
    const initialCirclesLen = obstacles.length;
    obstacles = obstacles.filter(obs => {
      if (obs.type === 'tower') {
        const dist = Math.sqrt((pos.x - obs.x)**2 + (pos.y - obs.y)**2);
        return dist > (obs.r + eraseRadius - 8);
      }
      return true;
    });
    
    if (obstacles.length !== initialCirclesLen) {
      modified = true;
    }

    // Erase segments (walls), retaining boundary walls
    const initialWallsLen = obstacles.length;
    obstacles = obstacles.filter(obs => {
      if (obs.type === 'wall') {
        // Protect outer boundary borders
        const isBoundary = (
          (obs.p1.x === 1 && obs.p2.x === simWidth - 1) || 
          (obs.p1.y === 1 && obs.p2.y === simHeight - 1)
        );
        if (isBoundary) return true;

        // Calculate distance from point to segment
        const dist = pointToSegmentDistance(pos, obs.p1, obs.p2);
        return dist > eraseRadius;
      }
      return true;
    });

    if (obstacles.length !== initialWallsLen) {
      modified = true;
    }

    if (modified) {
      drawSimulation();
    }
  }

  function pointToSegmentDistance(p, a, b) {
    const l2 = (a.x - b.x)**2 + (a.y - b.y)**2;
    if (l2 === 0) return Math.sqrt((p.x - a.x)**2 + (p.y - a.y)**2);
    
    // Project point onto line segment
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    
    const projX = a.x + t * (b.x - a.x);
    const projY = a.y + t * (b.y - a.y);
    
    return Math.sqrt((p.x - projX)**2 + (p.y - projY)**2);
  }

  // --- Run ---
  init();
});
