import { TrackManager } from './track.js';
import { GeneticAlgorithm } from './genetic.js';
import { EvolutionChart } from './chart.js';
import { NetworkVisualizer } from './visualizer.js';
import { Vector2D } from './vector.js';

// --- Simulation State ---
let isPlaying = true;
let simulationSpeed = 1;
const maxGenSteps = 900; // Max duration per generation before forcing next
let currentStep = 0;

// Canvas scaling helper
const canvas = document.getElementById('simulation-canvas');
const ctx = canvas.getContext('2d');

let canvasWidth = 800;
let canvasHeight = 500;

// Setup Track and GA Parameters
const trackManager = new TrackManager();
let sensorCount = 5;
let sensorRange = 150;
let populationSize = 100;
let mutationRate = 0.1; // 10%

// Network structure: [inputs, hidden, outputs]
// Inputs: sensorCount + 3 (Relative Target Angle, Target Distance, Car Speed)
// Outputs: 2 (Steer left/right, Accelerate forward/reverse)
let hiddenCount = 8;
let networkLayers = [sensorCount + 3, hiddenCount, 2];

// Instantiate Core Modules
let ga = new GeneticAlgorithm(populationSize, mutationRate, sensorCount, sensorRange, networkLayers);
const chart = new EvolutionChart('chart-canvas');
const visualizer = new NetworkVisualizer('network-canvas');

// Drawing state
let isDrawingWall = false;
let drawStartPoint = null;
let currentMousePos = null;

// --- Initialize App ---
function init() {
    resizeCanvas();
    
    // Load initial track preset (S-Curve)
    trackManager.loadPreset('scurve', canvasWidth, canvasHeight);
    
    // Initialize GA Population
    ga.initializePopulation(trackManager.startPos.x, trackManager.startPos.y);
    
    // Bind UI Controllers
    setupUIEventListeners();
    setupCanvasInputListeners();
    
    // Render initial empty state
    updateUIStats();
    chart.draw(ga.history);
    
    // Set active playing state on UI by default
    isPlaying = true;
    document.getElementById('play-icon').style.display = 'none';
    document.getElementById('pause-icon').style.display = 'block';
    document.getElementById('play-btn-text').textContent = 'Jeda';

    // Run Loop
    requestAnimationFrame(simLoop);
}

// Handle dynamic canvas sizing matching client bounds
function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvasWidth = rect.width;
    canvasHeight = Math.max(450, rect.height); // Min height enforcement
    
    canvas.width = canvasWidth * window.devicePixelRatio;
    canvas.height = canvasHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    trackManager.canvasWidth = canvasWidth;
    trackManager.canvasHeight = canvasHeight;
}

// --- Main Simulation Loop ---
function simLoop() {
    try {
        if (isPlaying) {
            // Run physics steps multiple times per frame for speed multiplication
            for (let step = 0; step < simulationSpeed; step++) {
                updateSimulationPhysics();
                
                // Check if all cars are inactive or generation time is up
                const activeCarsCount = ga.cars.filter(car => !car.damaged && !car.reachedTarget).length;
                
                if (activeCarsCount === 0 || currentStep >= maxGenSteps) {
                    // Auto trigger next generation
                    triggerNextGeneration();
                    break;
                }
            }
        }

        // Render current state to screen
        drawSimulation();
    } catch (error) {
        console.error("Simulation loop error:", error);
    }
    
    // Request next frame (smooth 60 FPS rendering)
    requestAnimationFrame(simLoop);
}

// Run single step of car movements & collision checking
function updateSimulationPhysics() {
    currentStep++;
    
    for (const car of ga.cars) {
        car.update(trackManager.walls, trackManager.targetPos, maxGenSteps);
    }
}

// Transition to the next evolutionary generation
function triggerNextGeneration() {
    try {
        isPlaying = false; // brief pause during evolution math
        
        ga.evolve(trackManager.startPos.x, trackManager.startPos.y, trackManager.targetPos, maxGenSteps);
        
        // Reset positions and steps
        for (const car of ga.cars) {
            car.reset(trackManager.startPos.x, trackManager.startPos.y);
        }
        currentStep = 0;
        
        // Redraw graphs & stats
        chart.draw(ga.history);
        updateUIStats();
    } catch (error) {
        console.error("Evolution error:", error);
    } finally {
        isPlaying = true; // resume automatically
    }
}

// Reset entire GA run
function resetSimulation() {
    isPlaying = false;
    currentStep = 0;
    
    ga = new GeneticAlgorithm(populationSize, mutationRate, sensorCount, sensorRange, networkLayers);
    ga.initializePopulation(trackManager.startPos.x, trackManager.startPos.y);
    
    chart.draw([]);
    updateUIStats();
    
    // Auto restart on reset
    isPlaying = true;
    document.getElementById('play-icon').style.display = 'none';
    document.getElementById('pause-icon').style.display = 'block';
    document.getElementById('play-btn-text').textContent = 'Jeda';
}

// --- Rendering Canvas Logic ---
function drawSimulation() {
    // 1. Clear main canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 2. Draw Start Point & Target Goal
    trackManager.drawStart(ctx);
    trackManager.drawTarget(ctx);
    
    // 3. Draw All Wall Obstacles
    trackManager.drawWalls(ctx);

    // 4. Draw User's Active Drawing Guide Line
    if (isDrawingWall && drawStartPoint && currentMousePos) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(drawStartPoint.x, drawStartPoint.y);
        ctx.lineTo(currentMousePos.x, currentMousePos.y);
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.7)'; // glowing cyan guide
        ctx.lineWidth = 2.0;
        ctx.setLineDash([5, 5]); // dashed guide line
        ctx.stroke();
        ctx.restore();
    }

    // 5. Draw Population of Cars
    // We sort them so the best car is drawn last (on top of others)
    const sortedCars = [...ga.cars].sort((a, b) => {
        if (a.isBest) return 1;
        if (b.isBest) return -1;
        return 0;
    });

    const bestCar = ga.getBestCar(trackManager.targetPos, maxGenSteps);

    for (const car of sortedCars) {
        // Draw sensor rays ONLY for the best car to keep visual uncluttered
        const shouldDrawSensors = (car === bestCar);
        car.draw(ctx, shouldDrawSensors);
    }

    // 6. Draw active neural visualizer side-panel
    if (bestCar && bestCar.brain) {
        visualizer.draw(bestCar.brain, sensorCount);
    }
    
    // 7. Update UI Stats panel
    updateUIStats();
}

// --- Update Stats Display in DOM ---
function updateUIStats() {
    const totalCount = ga.cars.length;
    const damagedCount = ga.cars.filter(car => car.damaged).length;
    const reachedCount = ga.cars.filter(car => car.reachedTarget).length;
    const aliveCount = totalCount - damagedCount - reachedCount;
    
    document.getElementById('stat-gen').textContent = ga.generation;
    document.getElementById('stat-alive').textContent = `${aliveCount}/${totalCount}`;
    document.getElementById('stat-reached').textContent = reachedCount;
    
    // Calculate best fitness in history or currently
    const bestCar = ga.getBestCar(trackManager.targetPos, maxGenSteps);
    const bestFit = bestCar ? Math.round(bestCar.fitness) : 0;
    document.getElementById('stat-best').textContent = bestFit;
}

// --- Setup User Click Canvas Listeners (Drawing & Target Moving) ---
function setupCanvasInputListeners() {
    // Disable right click context menu to support seamless right-click target placing
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Handle touch/mouse position scaling
    const getMouseCoords = (e) => {
        const rect = canvas.getBoundingClientRect();
        return new Vector2D(
            e.clientX - rect.left,
            e.clientY - rect.top
        );
    };

    canvas.addEventListener('mousedown', (e) => {
        const mouse = getMouseCoords(e);
        
        // Right Click or Ctrl+Left Click: Move Target
        if (e.button === 2 || e.ctrlKey) {
            trackManager.targetPos.set(mouse.x, mouse.y);
            return;
        }

        // Left Click: Begin drawing wall rintangan
        if (e.button === 0) {
            isDrawingWall = true;
            drawStartPoint = mouse;
            currentMousePos = mouse;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawingWall) return;
        currentMousePos = getMouseCoords(e);
    });

    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0 && isDrawingWall) {
            const mouse = getMouseCoords(e);
            
            // Only add wall if line is longer than 5 pixels (prevents accidental dots)
            if (drawStartPoint.dist(mouse) > 5) {
                trackManager.addWall(drawStartPoint.x, drawStartPoint.y, mouse.x, mouse.y);
            }
            
            isDrawingWall = false;
            drawStartPoint = null;
            currentMousePos = null;
        }
    });
    
    // If mouse leaves canvas, cancel active drawing
    canvas.addEventListener('mouseleave', () => {
        isDrawingWall = false;
        drawStartPoint = null;
        currentMousePos = null;
    });
}

// --- Bind UI sliders and buttons ---
function setupUIEventListeners() {
    // Play/Pause button
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const playText = document.getElementById('play-btn-text');

    playPauseBtn.addEventListener('click', () => {
        isPlaying = !isPlaying;
        if (isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
            playText.textContent = 'Jeda';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            playText.textContent = 'Mulai';
        }
    });

    // Force Next Gen Button
    document.getElementById('next-gen-btn').addEventListener('click', () => {
        triggerNextGeneration();
    });

    // Reset button
    document.getElementById('reset-btn').addEventListener('click', () => {
        resetSimulation();
    });

    // Clear walls button
    document.getElementById('clear-walls-btn').addEventListener('click', () => {
        trackManager.clearToSandbox();
    });

    // Preset Track Dropdown change
    document.getElementById('track-select').addEventListener('change', (e) => {
        trackManager.loadPreset(e.target.value, canvasWidth, canvasHeight);
        resetSimulation();
    });

    // Speed Slider
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    const speedBadge = document.getElementById('speed-badge-text');
    speedSlider.addEventListener('input', (e) => {
        simulationSpeed = parseInt(e.target.value);
        speedVal.textContent = `${simulationSpeed}x`;
        speedBadge.textContent = `SPEED: ${simulationSpeed}x`;
    });

    // Population Size Slider
    const popSlider = document.getElementById('pop-slider');
    const popVal = document.getElementById('pop-val');
    popSlider.addEventListener('input', (e) => {
        populationSize = parseInt(e.target.value);
        popVal.textContent = populationSize;
        // Trigger automated reset on next interactions
    });

    // Mutation Rate Slider
    const mutSlider = document.getElementById('mut-slider');
    const mutVal = document.getElementById('mut-val');
    mutSlider.addEventListener('input', (e) => {
        mutationRate = parseInt(e.target.value) / 100;
        mutVal.textContent = `${e.target.value}%`;
        ga.mutationRate = mutationRate; // Update rate in real-time
    });

    // Sensor Count Slider (triggger auto reset to avoid matrix shape dimension mismatch)
    const sensorSlider = document.getElementById('sensor-slider');
    const sensorVal = document.getElementById('sensor-val');
    sensorSlider.addEventListener('input', (e) => {
        sensorCount = parseInt(e.target.value);
        sensorVal.textContent = sensorCount;
        networkLayers = [sensorCount + 3, hiddenCount, 2];
        resetSimulation();
    });

    // Sensor Range Slider
    const rangeSlider = document.getElementById('range-slider');
    const rangeVal = document.getElementById('range-val');
    rangeSlider.addEventListener('input', (e) => {
        sensorRange = parseInt(e.target.value);
        rangeVal.textContent = `${sensorRange}px`;
        // update range for all cars in the next gen
        ga.sensorRange = sensorRange;
        for (const car of ga.cars) {
            car.sensorRange = sensorRange;
        }
    });

    // Dynamic resize handler
    window.addEventListener('resize', () => {
        resizeCanvas();
        // Recenter presets based on new sizes
        const currentTrack = document.getElementById('track-select').value;
        trackManager.loadPreset(currentTrack, canvasWidth, canvasHeight);
    });
}

// --- Launch on window load ---
window.onload = init;
