/**
 * Layer - Represents a single layer in the Neural Network.
 */
class Layer {
    constructor(inputSize, outputSize) {
        this.inputSize = inputSize;
        this.outputSize = outputSize;
        
        // Weights matrix: weights[inputIndex][outputIndex]
        this.weights = [];
        for (let i = 0; i < inputSize; i++) {
            this.weights[i] = new Float32Array(outputSize);
            for (let j = 0; j < outputSize; j++) {
                this.weights[i][j] = Math.random() * 2 - 1; // Random between -1 and 1
            }
        }
        
        // Biases vector
        this.biases = new Float32Array(outputSize);
        for (let i = 0; i < outputSize; i++) {
            this.biases[i] = Math.random() * 2 - 1; // Random between -1 and 1
        }

        // Store activations for visualization
        this.activations = new Float32Array(outputSize);
    }

    /**
     * Compute layer outputs using Tanh activation.
     */
    forward(inputs) {
        for (let j = 0; j < this.outputSize; j++) {
            let sum = this.biases[j];
            for (let i = 0; i < this.inputSize; i++) {
                sum += inputs[i] * this.weights[i][j];
            }
            // Tanh activation function: output range [-1, 1]
            this.activations[j] = Math.tanh(sum);
        }
        return this.activations;
    }

    /**
     * Deep copy the layer.
     */
    clone() {
        const copy = new Layer(this.inputSize, this.outputSize);
        
        for (let i = 0; i < this.inputSize; i++) {
            copy.weights[i].set(this.weights[i]);
        }
        copy.biases.set(this.biases);
        return copy;
    }

    /**
     * Mutate weights and biases.
     * @param {number} rate - Probability of mutation for each gene [0, 1]
     * @param {number} amount - Maximum mutation strength
     */
    mutate(rate, amount = 0.2) {
        // Gaussian mutation helper (Box-Muller transform)
        const gaussianRandom = () => {
            let u = 0, v = 0;
            while(u === 0) u = Math.random(); 
            while(v === 0) v = Math.random();
            return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        };

        for (let i = 0; i < this.inputSize; i++) {
            for (let j = 0; j < this.outputSize; j++) {
                if (Math.random() < rate) {
                    this.weights[i][j] += gaussianRandom() * amount;
                    // Clamp weight between -1 and 1 to prevent runaway values
                    this.weights[i][j] = Math.max(-1, Math.min(1, this.weights[i][j]));
                }
            }
        }

        for (let i = 0; i < this.outputSize; i++) {
            if (Math.random() < rate) {
                this.biases[i] += gaussianRandom() * amount;
                this.biases[i] = Math.max(-1, Math.min(1, this.biases[i]));
            }
        }
    }
}

/**
 * NeuralNetwork - Container for layers and network-wide operations.
 */
export class NeuralNetwork {
    /**
     * @param {number[]} layerSizes - Array defining sizes of layers (e.g. [inputSize, hiddenSize, outputSize])
     */
    constructor(layerSizes) {
        this.layerSizes = layerSizes;
        this.layers = [];
        
        for (let i = 0; i < layerSizes.length - 1; i++) {
            this.layers.push(new Layer(layerSizes[i], layerSizes[i + 1]));
        }

        // Store overall inputs for visualization
        this.inputs = new Float32Array(layerSizes[0]);
    }

    /**
     * Perform forward pass through all layers.
     * @param {number[]} inputs - Input values
     * @returns {Float32Array} - Network output values
     */
    feedForward(inputs) {
        this.inputs.set(inputs);
        let currentOutputs = this.inputs;
        
        for (let i = 0; i < this.layers.length; i++) {
            currentOutputs = this.layers[i].forward(currentOutputs);
        }
        
        return currentOutputs;
    }

    /**
     * Deep copy the network.
     */
    clone() {
        const copy = new NeuralNetwork(this.layerSizes);
        copy.layers = this.layers.map(layer => layer.clone());
        return copy;
    }

    /**
     * Mutate all layers.
     */
    mutate(rate, amount = 0.2) {
        for (let i = 0; i < this.layers.length; i++) {
            this.layers[i].mutate(rate, amount);
        }
    }

    /**
     * Combine two parent networks to create a child.
     * Uses uniform crossover.
     * @param {NeuralNetwork} parentA
     * @param {NeuralNetwork} parentB
     * @returns {NeuralNetwork}
     */
    static crossover(parentA, parentB) {
        const child = new NeuralNetwork(parentA.layerSizes);
        
        for (let l = 0; l < child.layers.length; l++) {
            const layerC = child.layers[l];
            const layerA = parentA.layers[l];
            const layerB = parentB.layers[l];
            
            for (let i = 0; i < layerC.inputSize; i++) {
                for (let j = 0; j < layerC.outputSize; j++) {
                    // 50% chance to inherit from A, 50% from B
                    layerC.weights[i][j] = (Math.random() < 0.5) ? layerA.weights[i][j] : layerB.weights[i][j];
                }
            }
            
            for (let i = 0; i < layerC.outputSize; i++) {
                layerC.biases[i] = (Math.random() < 0.5) ? layerA.biases[i] : layerB.biases[i];
            }
        }
        
        return child;
    }
}
