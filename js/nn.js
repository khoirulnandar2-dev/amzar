/**
 * AeroEvo — Artificial Neural Network Engine
 * Handles feedforward network modeling, genetics operations, and canvas visualization
 */

// Helper to generate Gaussian random variables (Box-Muller transform)
function randomGaussian(mean = 0, stdDev = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return num * stdDev + mean;
}

class NeuralNetwork {
  /**
   * @param {Array<number>} topology Array of neuron counts for each layer, e.g. [7, 8, 6, 2]
   */
  constructor(topology) {
    this.topology = [...topology];
    this.weights = [];
    this.biases = [];
    this.activations = []; // To store real-time node outputs for visualization

    // Initialize weights and biases
    for (let i = 0; i < this.topology.length - 1; i++) {
      const inputs = this.topology[i];
      const outputs = this.topology[i + 1];

      // Xavier/He initialization: standard deviation of sqrt(2/inputs)
      const std = Math.sqrt(2.0 / inputs);

      // Weights matrix of size (outputs x inputs)
      const layerWeights = [];
      for (let j = 0; j < outputs; j++) {
        const row = [];
        for (let k = 0; k < inputs; k++) {
          row.push(randomGaussian(0, std));
        }
        layerWeights.push(row);
      }
      this.weights.push(layerWeights);

      // Biases array of size (outputs)
      const layerBiases = [];
      for (let j = 0; j < outputs; j++) {
        layerBiases.push(0.01); // small initial biases
      }
      this.biases.push(layerBiases);
    }
  }

  /**
   * Feedforward input values through the neural architecture
   * @param {Array<number>} inputArray Array of input features
   * @returns {Array<number>} Array of output values
   */
  feedForward(inputArray) {
    if (inputArray.length !== this.topology[0]) {
      console.warn("Input size mismatch with network topology");
      return new Array(this.topology[this.topology.length - 1]).fill(0);
    }

    this.activations = [];
    let currentActivations = [...inputArray];
    this.activations.push(currentActivations);

    // Run inputs through all layers
    for (let i = 0; i < this.weights.length; i++) {
      const layerWeights = this.weights[i];
      const layerBiases = this.biases[i];
      const nextActivations = [];

      const isOutputLayer = (i === this.weights.length - 1);

      for (let j = 0; j < layerWeights.length; j++) {
        let sum = layerBiases[j];
        for (let k = 0; k < layerWeights[j].length; k++) {
          sum += currentActivations[k] * layerWeights[j][k];
        }

        // Apply activation function
        if (isOutputLayer) {
          // Output 0: Steering (-1 to +1) -> Tanh
          // Output 1: Speed (0 to 1) -> Sigmoid
          if (j === 0) {
            nextActivations.push(Math.tanh(sum));
          } else {
            nextActivations.push(1.0 / (1.0 + Math.exp(-sum)));
          }
        } else {
          // Hidden layers -> Tanh
          nextActivations.push(Math.tanh(sum));
        }
      }

      currentActivations = nextActivations;
      this.activations.push(currentActivations);
    }

    return currentActivations;
  }

  /**
   * Performs deep clone copy of this network
   * @returns {NeuralNetwork}
   */
  clone() {
    const copy = new NeuralNetwork(this.topology);
    
    // Copy weights
    for (let i = 0; i < this.weights.length; i++) {
      for (let j = 0; j < this.weights[i].length; j++) {
        for (let k = 0; k < this.weights[i][j].length; k++) {
          copy.weights[i][j][k] = this.weights[i][j][k];
        }
      }
    }
    
    // Copy biases
    for (let i = 0; i < this.biases.length; i++) {
      for (let j = 0; j < this.biases[i].length; j++) {
        copy.biases[i][j] = this.biases[i][j];
      }
    }

    return copy;
  }

  /**
   * Merges weights/biases with a partner network (Uniform Crossover)
   * @param {NeuralNetwork} partner The other parent network
   * @returns {NeuralNetwork} Combined offspring network
   */
  crossover(partner) {
    const offspring = new NeuralNetwork(this.topology);

    // Cross weights
    for (let i = 0; i < this.weights.length; i++) {
      for (let j = 0; j < this.weights[i].length; j++) {
        for (let k = 0; k < this.weights[i][j].length; k++) {
          if (Math.random() < 0.5) {
            offspring.weights[i][j][k] = this.weights[i][j][k];
          } else {
            offspring.weights[i][j][k] = partner.weights[i][j][k];
          }
        }
      }
    }

    // Cross biases
    for (let i = 0; i < this.biases.length; i++) {
      for (let j = 0; j < this.biases[i].length; j++) {
        if (Math.random() < 0.5) {
          offspring.biases[i][j] = this.biases[i][j];
        } else {
          offspring.biases[i][j] = partner.biases[i][j];
        }
      }
    }

    return offspring;
  }

  /**
   * Applies Gaussian mutations to weights and biases
   * @param {number} rate Mutation rate probability (0.0 to 1.0)
   * @param {number} power Mutation power/variance factor
   */
  mutate(rate, power = 0.1) {
    // Mutate weights
    for (let i = 0; i < this.weights.length; i++) {
      for (let j = 0; j < this.weights[i].length; j++) {
        for (let k = 0; k < this.weights[i][j].length; k++) {
          if (Math.random() < rate) {
            this.weights[i][j][k] += randomGaussian(0, power);
            
            // Cap weights between -4 and 4 to prevent explosion
            this.weights[i][j][k] = Math.max(-4, Math.min(4, this.weights[i][j][k]));
          }
        }
      }
    }

    // Mutate biases
    for (let i = 0; i < this.biases.length; i++) {
      for (let j = 0; j < this.biases[i].length; j++) {
        if (Math.random() < rate) {
          this.biases[i][j] += randomGaussian(0, power);
          this.biases[i][j] = Math.max(-2, Math.min(2, this.biases[i][j]));
        }
      }
    }
  }
}

/**
 * Visualizer class for drawing the Neural Network details on canvas
 */
class NeuralNetworkVisualizer {
  /**
   * @param {HTMLCanvasElement} canvas The canvas to render onto
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.labels = {
      inputs: [
        "Sens Left-Outer",
        "Sens Left-Inner",
        "Sens Center",
        "Sens Right-Inner",
        "Sens Right-Outer",
        "Angle to Target",
        "Dist to Target"
      ],
      outputs: [
        "Steering (-L / +R)",
        "Thrust (0-1)"
      ]
    };
  }

  /**
   * Render the neural network graph
   * @param {NeuralNetwork} nn Neural network instance to draw
   */
  draw(nn) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    
    // Clear and handle high-DPI scaling
    const rect = canvas.parentNode.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!nn) {
      // Draw idle HUD message
      ctx.font = "11px Orbitron";
      ctx.fillStyle = "#718096";
      ctx.textAlign = "center";
      ctx.fillText("WAITING FOR TARGET TELEMETRY...", canvas.width / 2, canvas.height / 2);
      return;
    }

    const layersCount = nn.topology.length;
    const paddingX = 45;
    const paddingY = 22;
    const workingW = canvas.width - paddingX * 2;
    const workingH = canvas.height - paddingY * 2;

    // Calculate node coordinates in grid
    const nodesCoords = [];
    for (let i = 0; i < layersCount; i++) {
      const layerSize = nn.topology[i];
      const colX = paddingX + (workingW / (layersCount - 1)) * i;
      const layerCoords = [];

      for (let j = 0; j < layerSize; j++) {
        // Space nodes vertically
        let nodeY;
        if (layerSize === 1) {
          nodeY = paddingY + workingH / 2;
        } else {
          nodeY = paddingY + (workingH / (layerSize - 1)) * j;
        }
        layerCoords.push({ x: colX, y: nodeY });
      }
      nodesCoords.push(layerCoords);
    }

    // 1. Draw Synapses (Weights connections) first so nodes render on top
    for (let i = 0; i < nn.weights.length; i++) {
      const layerWeights = nn.weights[i];
      const fromLayer = nodesCoords[i];
      const toLayer = nodesCoords[i + 1];

      for (let j = 0; j < layerWeights.length; j++) { // for each target neuron (j)
        const targetNode = toLayer[j];
        for (let k = 0; k < layerWeights[j].length; k++) { // from source neuron (k)
          const sourceNode = fromLayer[k];
          const weight = layerWeights[j][k];

          // Connection styling
          const absWeight = Math.min(Math.abs(weight), 3);
          ctx.lineWidth = 0.5 + absWeight * 0.8;
          
          if (weight >= 0) {
            // Cyan connection for positive weights
            ctx.strokeStyle = `rgba(0, 240, 255, ${0.1 + absWeight * 0.2})`;
          } else {
            // Magenta/Orange connection for negative weights
            ctx.strokeStyle = `rgba(255, 0, 127, ${0.1 + absWeight * 0.2})`;
          }

          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          ctx.stroke();
        }
      }
    }

    // 2. Draw Nodes (Neurons)
    const activations = nn.activations.length > 0 ? nn.activations : new Array(layersCount).fill(null).map((_, i) => new Array(nn.topology[i]).fill(0));

    for (let i = 0; i < layersCount; i++) {
      const layerCoords = nodesCoords[i];
      const layerActivations = activations[i];

      for (let j = 0; j < layerCoords.length; j++) {
        const node = layerCoords[j];
        const val = layerActivations ? layerActivations[j] : 0;

        // Draw node base circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = "#0c0e18";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1;
        ctx.fill();
        ctx.stroke();

        // Draw activation glowing core
        if (Math.abs(val) > 0.01) {
          const intensity = Math.min(Math.abs(val), 1.0);
          ctx.beginPath();
          ctx.arc(node.x, node.y, 4.5, 0, 2 * Math.PI);
          
          if (val > 0) {
            ctx.fillStyle = `rgba(0, 240, 255, ${intensity})`;
            ctx.shadowColor = "rgba(0, 240, 255, 0.6)";
            ctx.shadowBlur = 6;
          } else {
            ctx.fillStyle = `rgba(255, 0, 127, ${intensity})`;
            ctx.shadowColor = "rgba(255, 0, 127, 0.6)";
            ctx.shadowBlur = 6;
          }
          
          ctx.fill();
          ctx.shadowBlur = 0; // reset shadow
        }

        // 3. Draw Labels (only for Input and Output layers)
        if (i === 0) {
          // Inputs - Draw label on the left of input node
          ctx.font = "8px Roboto Mono";
          ctx.fillStyle = "#718096";
          ctx.textAlign = "right";
          const label = this.labels.inputs[j] || `In ${j}`;
          ctx.fillText(label, node.x - 12, node.y + 3);
        } else if (i === layersCount - 1) {
          // Outputs - Draw label on the right of output node
          ctx.font = "8px Roboto Mono";
          
          // Color text based on actual steer or thrust
          ctx.fillStyle = j === 0 ? "var(--neon-cyan)" : "var(--neon-magenta)";
          ctx.textAlign = "left";
          const valText = val.toFixed(2);
          const label = `${this.labels.outputs[j] || `Out ${j}`} (${valText >= 0 ? '+' : ''}${valText})`;
          ctx.fillText(label, node.x + 12, node.y + 3);
        }
      }
    }
  }
}
