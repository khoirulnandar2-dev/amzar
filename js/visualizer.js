export class NetworkVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Input labels helper mapping
        this.inputLabelsMap = {
            targetAngle: '∠ Target',
            targetDist: '✈ Target',
            speed: '⚡ Speed'
        };
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    /**
     * Draw the neural network diagram to canvas
     * @param {NeuralNetwork} network - The brain of the best car
     * @param {number} sensorCount - Number of sensors of the car
     */
    draw(network, sensorCount) {
        if (!this.canvas || !this.ctx || !network) return;

        const ctx = this.ctx;
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;

        ctx.clearRect(0, 0, width, height);

        const padLeft = 70;
        const padRight = 70;
        const padTop = 30;
        const padBottom = 30;
        
        const graphWidth = width - padLeft - padRight;
        const graphHeight = height - padTop - padBottom;

        // Number of layers
        const layerCount = network.layerSizes.length;
        
        // 1. Calculate positions for every single node in each layer
        const nodePositions = [];
        const nodeActivations = []; // to store neuron values for glow calculations

        for (let l = 0; l < layerCount; l++) {
            const size = network.layerSizes[l];
            const x = padLeft + (l / (layerCount - 1)) * graphWidth;
            const positions = [];
            const activations = [];
            
            // Vertical centering calculation
            for (let i = 0; i < size; i++) {
                let y;
                if (size === 1) {
                    y = padTop + graphHeight / 2;
                } else {
                    y = padTop + (i / (size - 1)) * graphHeight;
                }
                positions.push({ x, y });

                // Read neuron activation values
                if (l === 0) {
                    // Input layer
                    activations.push(network.inputs[i] || 0);
                } else {
                    // Hidden or Output layers
                    activations.push(network.layers[l - 1].activations[i] || 0);
                }
            }
            nodePositions.push(positions);
            nodeActivations.push(activations);
        }

        // 2. Draw Connections (Weights) FIRST
        for (let l = 0; l < layerCount - 1; l++) {
            const currentLayerPos = nodePositions[l];
            const nextLayerPos = nodePositions[l + 1];
            const layerWeights = network.layers[l].weights;
            
            for (let i = 0; i < currentLayerPos.length; i++) {
                const nodeA = currentLayerPos[i];
                const actA = nodeActivations[l][i];

                for (let j = 0; j < nextLayerPos.length; j++) {
                    const nodeB = nextLayerPos[j];
                    const weight = layerWeights[i][j];
                    
                    // Signal is the activation of node A multiplied by connection weight
                    const signal = actA * weight;
                    
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(nodeA.x, nodeA.y);
                    ctx.lineTo(nodeB.x, nodeB.y);
                    
                    // Select connection color based on weight value
                    // Neon Cyan for positive, Neon Magenta for negative
                    if (weight >= 0) {
                        ctx.strokeStyle = `rgba(0, 242, 254, ${0.08 + Math.abs(weight) * 0.6})`;
                    } else {
                        ctx.strokeStyle = `rgba(255, 8, 68, ${0.08 + Math.abs(weight) * 0.6})`;
                    }

                    ctx.lineWidth = Math.abs(weight) * 2.5 + 0.5;
                    ctx.stroke();

                    // Subtle flowing animation dot on active connection paths
                    if (Math.abs(signal) > 0.15) {
                        const pulseRatio = (Date.now() * 0.002) % 1.0;
                        const pulseX = nodeA.x + (nodeB.x - nodeA.x) * pulseRatio;
                        const pulseY = nodeA.y + (nodeB.y - nodeA.y) * pulseRatio;
                        
                        ctx.beginPath();
                        ctx.arc(pulseX, pulseY, 2, 0, Math.PI * 2);
                        ctx.fillStyle = weight >= 0 ? '#00f2fe' : '#ff0844';
                        ctx.shadowColor = weight >= 0 ? '#00f2fe' : '#ff0844';
                        ctx.shadowBlur = 4;
                        ctx.fill();
                    }
                    ctx.restore();
                }
            }
        }

        // 3. Draw Nodes SECOND
        const nodeRadius = 10;
        
        for (let l = 0; l < layerCount; l++) {
            const positions = nodePositions[l];
            const activations = nodeActivations[l];

            for (let i = 0; i < positions.length; i++) {
                const node = positions[i];
                const act = activations[i];
                
                ctx.save();
                
                // Draw background circle
                ctx.beginPath();
                ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
                ctx.fillStyle = '#0f172a'; // Deep slate core
                ctx.fill();

                // Compute node glowing ring style based on activation
                ctx.beginPath();
                ctx.arc(node.x, node.y, nodeRadius - 1, 0, Math.PI * 2);
                
                let glowColor = 'rgba(255, 255, 255, 0.1)';
                let glowStrength = 0;
                
                if (act > 0.05) {
                    glowColor = `rgba(0, 242, 254, ${0.4 + act * 0.6})`; // Glowing Cyan
                    glowStrength = act * 10;
                } else if (act < -0.05) {
                    glowColor = `rgba(255, 8, 68, ${0.4 + Math.abs(act) * 0.6})`; // Glowing Magenta
                    glowStrength = Math.abs(act) * 10;
                }

                ctx.strokeStyle = glowColor;
                ctx.lineWidth = 2.0;
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = glowStrength;
                ctx.stroke();

                // Inside fill showing active intensity
                if (Math.abs(act) > 0.05) {
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, nodeRadius - 5, 0, Math.PI * 2);
                    ctx.fillStyle = act > 0 ? 'rgba(0, 242, 254, 0.7)' : 'rgba(255, 8, 68, 0.7)';
                    ctx.shadowBlur = 0; // reset shadow for core
                    ctx.fill();
                }
                ctx.restore();

                // 4. Draw Labels for Input & Output Layers
                ctx.save();
                ctx.font = '9px "Fira Code", monospace';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.textBaseline = 'middle';

                if (l === 0) {
                    // Input Labels
                    ctx.textAlign = 'right';
                    let labelStr = '';
                    if (i < sensorCount) {
                        labelStr = `Sensor ${i + 1}`;
                    } else if (i === sensorCount) {
                        labelStr = this.inputLabelsMap.targetAngle;
                    } else if (i === sensorCount + 1) {
                        labelStr = this.inputLabelsMap.targetDist;
                    } else if (i === sensorCount + 2) {
                        labelStr = this.inputLabelsMap.speed;
                    }
                    ctx.fillText(labelStr, node.x - 15, node.y);
                } else if (l === layerCount - 1) {
                    // Output Labels
                    ctx.textAlign = 'left';
                    let labelStr = '';
                    if (i === 0) {
                        labelStr = '← ☀ Kemudi ➔';
                    } else if (i === 1) {
                        labelStr = '▲ ⚡ Gas ▼';
                    }
                    ctx.fillText(labelStr, node.x + 15, node.y);
                }
                ctx.restore();
            }
        }
    }
}
