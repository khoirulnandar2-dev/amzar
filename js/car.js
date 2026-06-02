import { Vector2D } from './vector.js';
import { NeuralNetwork } from './network.js';

export class Car {
    constructor(x, y, networkLayers = [7, 8, 2], sensorCount = 5, sensorRange = 150) {
        this.startPos = new Vector2D(x, y);
        this.pos = new Vector2D(x, y);
        this.vel = new Vector2D(0, 0);
        this.acc = new Vector2D(0, 0);
        
        this.width = 16;
        this.height = 28;
        this.angle = 0; // heading angle in radians
        
        // Physics constants
        this.maxSpeed = 3.5;
        this.accelerationPower = 0.15;
        this.friction = 0.05;
        this.turnSpeed = 0.055;
        
        // Sensor settings
        this.sensorCount = sensorCount;
        this.sensorRange = sensorRange;
        this.sensorSpread = Math.PI * 0.75; // 135 degrees spread
        this.sensors = []; // Ray endpoints
        this.readings = []; // Distance values [0, 1] (0 = touching, 1 = clear)
        this.sensorIntersections = []; // Coordinates of intersection points
        
        // Brain
        this.brain = new NeuralNetwork(networkLayers);
        
        // Simulation State
        this.damaged = false;
        this.reachedTarget = false;
        this.timeSteps = 0;
        this.targetReachTime = 0;
        
        // Fitness Metrics
        this.minDistanceToTarget = Infinity;
        this.startDistanceToTarget = 1;
        this.maxProgress = 0;
        this.fitness = 0;
        this.stuckTimer = 0; // Steps spent without progress
        
        // Aesthetics
        this.color = 'hsla(220, 80%, 60%, 0.2)'; // Default: semi-transparent indigo
        this.isBest = false;
    }

    /**
     * Resets the car position and state for a new generation while keeping the brain
     */
    reset(x, y) {
        this.pos.set(x, y);
        this.vel.set(0, 0);
        this.acc.set(0, 0);
        this.angle = 0;
        this.damaged = false;
        this.reachedTarget = false;
        this.timeSteps = 0;
        this.targetReachTime = 0;
        this.minDistanceToTarget = Infinity;
        this.maxProgress = 0;
        this.fitness = 0;
        this.stuckTimer = 0;
    }

    /**
     * Compute polygon corners for collision checking
     */
    getCorners() {
        const corners = [];
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        
        // Rotation vectors
        const dir = Vector2D.fromAngle(this.angle);
        const right = new Vector2D(-dir.y, dir.x); // perpendicular vector
        
        // 4 corners: front-right, front-left, back-left, back-right
        corners.push(
            this.pos.copy().add(Vector2D.mult(dir, halfH)).add(Vector2D.mult(right, halfW))
        );
        corners.push(
            this.pos.copy().add(Vector2D.mult(dir, halfH)).sub(Vector2D.mult(right, halfW))
        );
        corners.push(
            this.pos.copy().sub(Vector2D.mult(dir, halfH)).sub(Vector2D.mult(right, halfW))
        );
        corners.push(
            this.pos.copy().sub(Vector2D.mult(dir, halfH)).add(Vector2D.mult(right, halfW))
        );
        
        return corners;
    }

    /**
     * Update car movement, sensors, and neural network
     */
    update(walls, target, maxSteps) {
        if (this.damaged || this.reachedTarget) {
            return;
        }

        this.timeSteps++;

        // 1. Update Sensors
        this.updateSensors(walls);
        
        // 2. Feedforward inputs into Neural Network
        const relativeTarget = Vector2D.sub(target, this.pos);
        const distToTarget = relativeTarget.mag();
        
        // Track progress and minimum distance
        if (this.startDistanceToTarget === 1) {
            this.startDistanceToTarget = distToTarget;
        }
        if (distToTarget < this.minDistanceToTarget) {
            this.minDistanceToTarget = distToTarget;
        }

        const progress = Math.max(0, this.startDistanceToTarget - distToTarget);
        if (progress > this.maxProgress) {
            this.maxProgress = progress;
            this.stuckTimer = 0; // reset stuck timer if progress is made
        } else {
            this.stuckTimer++; // increment stuck timer if no progress
        }

        // Stuck detection: if car is stuck spinning or barely moving (speed < 0.15) for too long, mark damaged
        if (this.stuckTimer > 180 || (this.vel.mag() < 0.15 && this.stuckTimer > 90)) {
            this.damaged = true;
            return;
        }

        // Check if target is reached
        if (distToTarget < 20) { // Target radius interaction threshold
            this.reachedTarget = true;
            this.targetReachTime = this.timeSteps;
            return;
        }

        // Relative target angle normalized to [-1, 1]
        let targetAngle = relativeTarget.heading() - this.angle;
        // Keep angle within [-PI, PI]
        while (targetAngle < -Math.PI) targetAngle += Math.PI * 2;
        while (targetAngle > Math.PI) targetAngle -= Math.PI * 2;
        const normTargetAngle = targetAngle / Math.PI;

        // Normalized distance to target (1 = very close, 0 = far away)
        const normDistToTarget = 1 / (1 + distToTarget / 400);

        // Current speed normalized
        const normSpeed = this.vel.mag() / this.maxSpeed;

        // Input array construction: sensors + target relative data + speed
        // input size is sensorCount + 3
        const inputs = [...this.readings, normTargetAngle, normDistToTarget, normSpeed];
        
        // Get outputs from neural network
        const outputs = this.brain.feedForward(inputs);
        const steerOutput = outputs[0]; // [-1, 1]
        const throttleOutput = outputs[1]; // [-1, 1]

        // 3. Apply physics
        // Steering
        if (this.vel.mag() > 0.05) { // Can only steer if moving
            const direction = this.vel.dot(Vector2D.fromAngle(this.angle)) >= 0 ? 1 : -1;
            this.angle += steerOutput * this.turnSpeed * normSpeed * direction;
        }

        // Acceleration (Forward-only driving for faster and more stable genetic learning)
        const throttle = (throttleOutput + 1) / 2; // Map [-1, 1] to [0, 1]
        this.acc.add(Vector2D.fromAngle(this.angle, throttle * this.accelerationPower));

        this.vel.add(this.acc);
        this.vel.mult(1 - this.friction); // Apply friction
        this.vel.limit(this.maxSpeed);
        this.pos.add(this.vel);
        
        this.acc.set(0, 0); // reset acceleration

        // 4. Check for collision
        this.checkCollisions(walls);
    }

    /**
     * Raycast sensors and find intersections with walls
     */
    updateSensors(walls) {
        this.sensors = [];
        this.readings = [];
        this.sensorIntersections = [];

        for (let i = 0; i < this.sensorCount; i++) {
            // Distribute rays evenly within spread angle
            let rayAngle = this.angle;
            if (this.sensorCount > 1) {
                rayAngle = this.angle + (i / (this.sensorCount - 1) - 0.5) * this.sensorSpread;
            }

            const rayStart = this.pos.copy();
            const rayEnd = Vector2D.add(rayStart, Vector2D.fromAngle(rayAngle, this.sensorRange));
            
            this.sensors.push({ start: rayStart, end: rayEnd });

            // Find closest intersection
            let closestIntersection = null;
            let minDistance = Infinity;

            for (const wall of walls) {
                const intersect = this.getLineIntersection(rayStart, rayEnd, wall.a, wall.b);
                if (intersect) {
                    const d = rayStart.dist(intersect);
                    if (d < minDistance) {
                        minDistance = d;
                        closestIntersection = intersect;
                    }
                }
            }

            if (closestIntersection) {
                this.sensorIntersections.push(closestIntersection);
                // Normalized reading: 0 at touching, 1 at max range
                this.readings.push(minDistance / this.sensorRange);
            } else {
                this.sensorIntersections.push(null);
                this.readings.push(1.0); // No obstacle in range
            }
        }
    }

    /**
     * Segment-to-segment intersection math
     */
    getLineIntersection(A, B, C, D) {
        const rX = B.x - A.x;
        const rY = B.y - A.y;
        const sX = D.x - C.x;
        const sY = D.y - C.y;

        const denominator = rX * sY - rY * sX;

        if (denominator === 0) {
            return null; // Parallel
        }

        const uNumerator = (C.x - A.x) * rY - (C.y - A.y) * rX;
        const tNumerator = (C.x - A.x) * sY - (C.y - A.y) * sX;

        const t = tNumerator / denominator;
        const u = uNumerator / denominator;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return new Vector2D(A.x + t * rX, A.y + t * rY);
        }

        return null;
    }

    /**
     * Check if car collides with walls
     */
    checkCollisions(walls) {
        const corners = this.getCorners();
        
        for (const wall of walls) {
            for (let i = 0; i < corners.length; i++) {
                const next = corners[(i + 1) % corners.length];
                const collision = this.getLineIntersection(corners[i], next, wall.a, wall.b);
                if (collision) {
                    this.damaged = true;
                    return;
                }
            }
        }
    }

    /**
     * Calculate and return fitness score
     */
    calculateFitness(target, maxSteps) {
        // Base distance reward: how close did we get to the target
        const distanceReward = Math.max(0, this.startDistanceToTarget - this.minDistanceToTarget);
        
        // Progress weight
        this.fitness = distanceReward;
        
        // Encourage moving instead of spinning or idling
        // Penalize crash to prioritize safety, but let them learn progress first
        if (this.damaged) {
            this.fitness *= 0.4; // 60% penalty for crashing
        }

        // Add small reward for staying alive longer IF not crashed (encourages exploration)
        if (!this.damaged && !this.reachedTarget) {
            this.fitness += this.timeSteps * 0.05;
        }

        // Massive reward for reaching target
        if (this.reachedTarget) {
            // Base completion bonus
            this.fitness += 1500;
            
            // Time bonus: reaching it faster yields higher fitness
            // targetReachTime is smaller for faster cars
            const timeBonus = (1 - (this.targetReachTime / maxSteps)) * 1000;
            this.fitness += Math.max(0, timeBonus);
        }

        // Avoid exact 0 or negative fitness for GA selection
        this.fitness = Math.max(0.01, this.fitness);
        return this.fitness;
    }

    /**
     * Draw the car to canvas
     */
    draw(ctx, drawSensors = false) {
        ctx.save();
        
        // Draw sensors for selected / best car
        if (drawSensors && !this.damaged && !this.reachedTarget) {
            for (let i = 0; i < this.sensorCount; i++) {
                const ray = this.sensors[i];
                const intersect = this.sensorIntersections[i];
                
                ctx.beginPath();
                ctx.moveTo(ray.start.x, ray.start.y);
                
                if (intersect) {
                    ctx.lineTo(intersect.x, intersect.y);
                    ctx.strokeStyle = 'rgba(255, 71, 87, 0.4)'; // Reddish indicator at collision
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    
                    // Collision dot
                    ctx.beginPath();
                    ctx.arc(intersect.x, intersect.y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 71, 87, 0.8)';
                    ctx.fill();
                } else {
                    ctx.lineTo(ray.end.x, ray.end.y);
                    ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)'; // Neon cyan ray
                    ctx.lineWidth = 1.0;
                    ctx.stroke();
                }
            }
        }

        // Move to car center and rotate
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        // Body Styling
        ctx.beginPath();
        ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
        
        if (this.damaged) {
            ctx.fillStyle = 'rgba(255, 71, 87, 0.15)'; // Muted red for crashed
            ctx.strokeStyle = 'rgba(255, 71, 87, 0.4)';
            ctx.lineWidth = 1.5;
        } else if (this.reachedTarget) {
            ctx.fillStyle = 'rgba(46, 213, 115, 0.6)'; // Rich emerald for success
            ctx.strokeStyle = '#2ed573';
            ctx.shadowColor = '#2ed573';
            ctx.shadowBlur = 10;
            ctx.lineWidth = 2.0;
        } else if (this.isBest) {
            ctx.fillStyle = 'rgba(0, 242, 254, 0.5)'; // Radiant cyan for best
            ctx.strokeStyle = '#00f2fe';
            ctx.shadowColor = '#00f2fe';
            ctx.shadowBlur = 12;
            ctx.lineWidth = 2.0;
        } else {
            ctx.fillStyle = 'rgba(155, 81, 224, 0.25)'; // Lavender/Purple for normal
            ctx.strokeStyle = 'rgba(155, 81, 224, 0.6)';
            ctx.lineWidth = 1.5;
        }
        
        ctx.fill();
        ctx.stroke();
        
        // Draw directional indicators (e.g. windshield / headlights)
        if (!this.damaged) {
            ctx.shadowBlur = 0; // reset shadow
            ctx.beginPath();
            ctx.rect(-this.width / 2 + 2, -this.height / 2 + 4, this.width - 4, 6);
            ctx.fillStyle = this.isBest ? 'rgba(0, 242, 254, 0.8)' : 'rgba(255, 255, 255, 0.5)';
            ctx.fill();
            
            // Draw small glowing headlights
            ctx.beginPath();
            ctx.arc(-this.width / 4, -this.height / 2 + 1, 2, 0, Math.PI * 2);
            ctx.arc(this.width / 4, -this.height / 2 + 1, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 5;
            ctx.fill();
        }

        ctx.restore();
    }
}
