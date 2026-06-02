import { Car } from './car.js';
import { NeuralNetwork } from './network.js';

export class GeneticAlgorithm {
    constructor(populationSize = 100, mutationRate = 0.1, sensorCount = 5, sensorRange = 150, networkLayers = [7, 8, 2]) {
        this.populationSize = populationSize;
        this.mutationRate = mutationRate;
        this.sensorCount = sensorCount;
        this.sensorRange = sensorRange;
        this.networkLayers = networkLayers; // [inputCount, hiddenCount, outputCount]
        
        this.generation = 1;
        this.cars = [];
        this.history = []; // Stores { generation, maxFitness, avgFitness, successCount }
        
        // Elite ratio to preserve top performance
        this.eliteRatio = 0.1; // top 10%
    }

    /**
     * Initialize the first generation of cars at the start coordinates
     */
    initializePopulation(startX, startY) {
        this.cars = [];
        this.generation = 1;
        this.history = [];
        
        for (let i = 0; i < this.populationSize; i++) {
            const car = new Car(startX, startY, this.networkLayers, this.sensorCount, this.sensorRange);
            this.cars.push(car);
        }
    }

    /**
     * Find the car with the highest active fitness
     * Useful for tracking the best car while the simulation is running
     */
    getBestCar(target, maxSteps) {
        let bestCar = null;
        let maxFit = -Infinity;
        
        for (const car of this.cars) {
            // Compute real-time temporary fitness for active tracking
            const fit = car.calculateFitness(target, maxSteps);
            if (fit > maxFit) {
                maxFit = fit;
                bestCar = car;
            }
        }
        
        // Also ensure the best car is flagged visually
        for (const car of this.cars) {
            car.isBest = (car === bestCar);
        }

        return bestCar;
    }

    /**
     * Run tournament selection to select a parent based on fitness
     */
    selectParentTournament(tournamentSize = 5) {
        let best = null;
        let bestFitness = -Infinity;
        
        for (let i = 0; i < tournamentSize; i++) {
            const ind = this.cars[Math.floor(Math.random() * this.cars.length)];
            if (ind.fitness > bestFitness) {
                bestFitness = ind.fitness;
                best = ind;
            }
        }
        return best;
    }

    /**
     * Create the next generation of cars using selection, crossover, and mutation
     */
    evolve(startX, startY, target, maxSteps) {
        // 1. Calculate fitness for all cars
        let totalFitness = 0;
        let maxFitness = 0;
        let successCount = 0;
        
        for (const car of this.cars) {
            const fit = car.calculateFitness(target, maxSteps);
            totalFitness += fit;
            if (fit > maxFitness) {
                maxFitness = fit;
            }
            if (car.reachedTarget) {
                successCount++;
            }
        }
        
        const avgFitness = totalFitness / this.populationSize;
        
        // Store current generation stats in history
        this.history.push({
            generation: this.generation,
            maxFitness: Number(maxFitness.toFixed(2)),
            avgFitness: Number(avgFitness.toFixed(2)),
            successCount: successCount
        });

        // 2. Sort population by fitness in descending order (for Elitism)
        this.cars.sort((a, b) => b.fitness - a.fitness);
        
        // Keep track of the absolute best brain to clone/copy
        const bestBrain = this.cars[0].brain.clone();

        // 3. Form the next generation
        const nextGeneration = [];
        
        // Elitism: Preserve the top performers as-is
        const eliteCount = Math.max(1, Math.floor(this.populationSize * this.eliteRatio));
        for (let i = 0; i < eliteCount; i++) {
            const eliteCar = new Car(startX, startY, this.networkLayers, this.sensorCount, this.sensorRange);
            eliteCar.brain = this.cars[i].brain.clone(); // exact clone
            nextGeneration.push(eliteCar);
        }

        // Fill the rest with offspring
        const offspringCount = this.populationSize - eliteCount;
        for (let i = 0; i < offspringCount; i++) {
            // Tournament selection for parents
            const parentA = this.selectParentTournament(5);
            const parentB = this.selectParentTournament(5);
            
            // Crossover
            const childBrain = NeuralNetwork.crossover(parentA.brain, parentB.brain);
            
            // Mutation
            childBrain.mutate(this.mutationRate, 0.2); // Mutate with gaussian deviation
            
            // Instantiate child
            const childCar = new Car(startX, startY, this.networkLayers, this.sensorCount, this.sensorRange);
            childCar.brain = childBrain;
            nextGeneration.push(childCar);
        }

        // 4. Update population and increase generation counter
        this.cars = nextGeneration;
        this.generation++;
        
        // Flag the best car (index 0 corresponds to elite copy)
        this.cars[0].isBest = true;
    }

    /**
     * Resets the entire GA to generation 1 and clears history
     */
    reset(startX, startY) {
        this.initializePopulation(startX, startY);
    }
}
