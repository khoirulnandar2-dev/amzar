/**
 * AeroEvo — Genetic Algorithm Engine
 * Manages generations, selection pools, crossovers, mutations, and analytics trends
 */

class GeneticAlgorithm {
  constructor() {
    this.history = []; // Array of { generation, maxFitness, avgFitness, successRate }
    this.allTimeBestBrain = null;
    this.allTimeBestFitness = 0;
  }

  /**
   * Evaluates the population, computes statistics, and generates the next generation
   * @param {Array<Object>} finishedPopulation Population of agents after running the simulation round
   * @param {number} popSize Total size of population requested
   * @param {number} mutationRate Probability of mutation per gene (0.01 - 0.50)
   * @param {string} selectionMethod "tournament", "roulette", or "rank"
   * @param {Array<number>} topology Dynamic array representing neural network hidden layers configuration
   * @returns {Array<NeuralNetwork>} The next generation of neural network brains
   */
  evolve(finishedPopulation, popSize, mutationRate, selectionMethod, topology) {
    const generationCount = this.history.length + 1;
    
    // Sort population by fitness in descending order (highest first)
    finishedPopulation.sort((a, b) => b.fitness - a.fitness);

    // Compute stats
    const maxFitness = finishedPopulation[0].fitness;
    let sumFitness = 0;
    let successCount = 0;
    
    for (const agent of finishedPopulation) {
      sumFitness += agent.fitness;
      if (agent.reachedTarget) {
        successCount++;
      }
    }
    
    const avgFitness = sumFitness / finishedPopulation.length;
    const successRate = successCount / finishedPopulation.length;

    // Track all-time best
    if (maxFitness > this.allTimeBestFitness) {
      this.allTimeBestFitness = maxFitness;
      // Store deep clone of the best neural network
      this.allTimeBestBrain = finishedPopulation[0].brain.clone();
    }

    // Record generation stats
    this.history.push({
      generation: generationCount,
      maxFitness: parseFloat(maxFitness.toFixed(2)),
      avgFitness: parseFloat(avgFitness.toFixed(2)),
      successRate: parseFloat(successRate.toFixed(3))
    });

    // Create next generation
    const nextGenerationBrains = [];

    // 1. Elitism: Directly pass the top 10% best performing flight brains to next gen unchanged
    const eliteCount = Math.max(1, Math.floor(popSize * 0.1));
    for (let i = 0; i < eliteCount; i++) {
      nextGenerationBrains.push(finishedPopulation[i].brain.clone());
    }

    // 2. Selection and breeding to fill up the remaining population
    const childrenNeeded = popSize - eliteCount;
    
    // Setup Rank probabilities if using Rank selection to avoid recomputing in loop
    let rankProbabilities = [];
    if (selectionMethod === 'rank') {
      const N = finishedPopulation.length;
      const rankSum = (N * (N + 1)) / 2;
      
      // finishedPopulation is sorted desc (best is index 0, rank index is N).
      // Let's create cumulative distribution
      let cumulativeProb = 0;
      for (let i = 0; i < N; i++) {
        // Best has rank N, Worst has rank 1
        const rank = N - i;
        const prob = rank / rankSum;
        cumulativeProb += prob;
        rankProbabilities.push({ cumulativeProb, agent: finishedPopulation[i] });
      }
    }

    for (let i = 0; i < childrenNeeded; i++) {
      let parentA, parentB;

      // Select Parent A & Parent B
      if (selectionMethod === 'tournament') {
        parentA = this.selectTournament(finishedPopulation, 5);
        parentB = this.selectTournament(finishedPopulation, 5);
      } else if (selectionMethod === 'roulette') {
        parentA = this.selectRoulette(finishedPopulation, sumFitness);
        parentB = this.selectRoulette(finishedPopulation, sumFitness);
      } else { // 'rank'
        parentA = this.selectRank(rankProbabilities);
        parentB = this.selectRank(rankProbabilities);
      }

      // Recombine (Crossover)
      let childBrain = parentA.brain.crossover(parentB.brain);

      // Mutate
      // Adjust mutation intensity: as generations succeed, reduce mutation intensity slightly
      // Standard intensity power: 0.1
      childBrain.mutate(mutationRate, 0.1);

      nextGenerationBrains.push(childBrain);
    }

    return nextGenerationBrains;
  }

  /**
   * Selects an individual via Tournament Selection
   * @param {Array<Object>} population
   * @param {number} k Number of participants in tournament
   */
  selectTournament(population, k) {
    let best = null;
    for (let i = 0; i < k; i++) {
      const ind = population[Math.floor(Math.random() * population.length)];
      if (best === null || ind.fitness > best.fitness) {
        best = ind;
      }
    }
    return best;
  }

  /**
   * Selects an individual via Roulette Wheel Selection
   * @param {Array<Object>} population
   * @param {number} sumFitness Combined sum of all population fitnesses
   */
  selectRoulette(population, sumFitness) {
    if (sumFitness <= 0) {
      // Fallback to random if all fitness is 0 or negative
      return population[Math.floor(Math.random() * population.length)];
    }

    const r = Math.random() * sumFitness;
    let runningSum = 0;
    for (const agent of population) {
      runningSum += agent.fitness;
      if (runningSum >= r) {
        return agent;
      }
    }
    return population[population.length - 1];
  }

  /**
   * Selects an individual via Rank-Based Selection
   * @param {Array<Object>} rankProbabilities Cached cumulative distribution array
   */
  selectRank(rankProbabilities) {
    const r = Math.random();
    for (const entry of rankProbabilities) {
      if (r <= entry.cumulativeProb) {
        return entry.agent;
      }
    }
    return rankProbabilities[rankProbabilities.length - 1].agent;
  }

  /**
   * Resets evolution history data
   */
  reset() {
    this.history = [];
    this.allTimeBestBrain = null;
    this.allTimeBestFitness = 0;
  }
}
