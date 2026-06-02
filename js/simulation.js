/**
 * AeroEvo — Simulation & Flight Physics Engine
 * Manages aircraft kinematics, radar raycasting, collision bounds, dynamic obstacles drawing, and particles
 */

// Line intersection solver
// Returns {x, y, t, u} or null
function lineIntersection(p0, p1, p2, p3) {
  const s1_x = p1.x - p0.x;
  const s1_y = p1.y - p0.y;
  const s2_x = p3.x - p2.x;
  const s2_y = p3.y - p2.y;

  const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / (-s2_x * s1_y + s1_x * s2_y);
  const t = (s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / (-s2_x * s1_y + s1_x * s2_y);

  if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
    return {
      x: p0.x + (t * s1_x),
      y: p0.y + (t * s1_y),
      param: t
    };
  }
  return null;
}

// Ray-Circle intersection helper
function rayCircleIntersection(rayOrigin, rayAngle, circleCenter, circleRadius) {
  const dx = Math.cos(rayAngle);
  const dy = Math.sin(rayAngle);

  // Vector from ray origin to circle center
  const cx = circleCenter.x - rayOrigin.x;
  const cy = circleCenter.y - rayOrigin.y;

  // Project circle center onto ray
  const t = cx * dx + cy * dy;
  if (t < 0) return null; // Circle is behind ray

  // Closest point on ray
  const px = rayOrigin.x + t * dx;
  const py = rayOrigin.y + t * dy;

  // Distance from closest point to center
  const distSq = (circleCenter.x - px) ** 2 + (circleCenter.y - py) ** 2;
  const rSq = circleRadius ** 2;

  if (distSq > rSq) return null; // Ray misses circle

  // Calculate intersection point along ray
  const dt = Math.sqrt(rSq - distSq);
  const t1 = t - dt;
  const t2 = t + dt;

  const tIntersect = t1 >= 0 ? t1 : (t2 >= 0 ? t2 : null);
  if (tIntersect === null) return null;

  return {
    x: rayOrigin.x + tIntersect * dx,
    y: rayOrigin.y + tIntersect * dy,
    param: tIntersect
  };
}

class Particle {
  constructor(x, y, color, speedScale = 1) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 2 + 1) * speedScale;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.size = Math.random() * 3 + 2;
    this.alpha = 1;
    this.decay = Math.random() * 0.03 + 0.02;
    this.color = color;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 4;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emitCrash(x, y) {
    // Red/orange explosion sparks
    for (let i = 0; i < 15; i++) {
      this.particles.push(new Particle(x, y, "rgba(255, 51, 51, 0.8)", 1.5));
    }
  }

  emitSuccess(x, y) {
    // Neon green/gold victory sparkles
    for (let i = 0; i < 25; i++) {
      const color = Math.random() < 0.5 ? "rgba(57, 255, 20, 0.8)" : "rgba(255, 215, 0, 0.8)";
      this.particles.push(new Particle(x, y, color, 2));
    }
  }

  emitExhaust(x, y, angle, isBest = false) {
    // Subtle exhaust particles leaving trails
    const p = new Particle(x, y, isBest ? "rgba(255, 215, 0, 0.4)" : "rgba(0, 240, 255, 0.25)", 0.3);
    // Push exhaust backwards relative to heading angle
    const backAngle = angle + Math.PI + (Math.random() * 0.4 - 0.2);
    const speed = Math.random() * 0.5 + 0.2;
    p.vx = Math.cos(backAngle) * speed;
    p.vy = Math.sin(backAngle) * speed;
    p.size = Math.random() * 2 + 1;
    p.decay = 0.05;
    this.particles.push(p);
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      p.draw(ctx);
    }
  }

  clear() {
    this.particles = [];
  }
}

class Aircraft {
  /**
   * @param {number} x Initial x position
   * @param {number} y Initial y position
   * @param {number} angle Initial heading angle
   * @param {NeuralNetwork} brain Aircraft steering brain
   */
  constructor(x, y, angle, brain) {
    this.startX = x;
    this.startY = y;
    this.startAngle = angle;
    this.x = x;
    this.y = y;
    this.angle = angle;
    
    this.brain = brain;
    this.fitness = 0;
    
    // Physics variables
    this.speed = 2.0;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    
    this.maxSpeed = 4.5;
    this.minSpeed = 1.0;
    this.maxSteer = 0.085; // radians turn rate per frame
    
    // State flags
    this.isDead = false;
    this.reachedTarget = false;
    
    // Sensors/Radar lines config
    this.sensorRange = 240;
    // Sensor rays orientations relative to heading
    this.sensorAngles = [-Math.PI / 3, -Math.PI / 6, 0, Math.PI / 6, Math.PI / 3]; // -60, -30, 0, 30, 60
    this.sensorInputs = new Array(5).fill(0); // [0 (far) - 1 (near)]
    this.radarIntersections = new Array(5).fill(null); // coordinate points of intersections
    
    // Path history for exhaust trail
    this.trail = [];
    this.trailMax = 15;
    this.trailTimer = 0;

    // Fitness triggers
    this.survivedTime = 0;
    this.minDistanceReached = Infinity;
    this.initialDistance = 0;
  }

  /**
   * Computes aircraft vertices for drawing and collision checks (Delta Wing style)
   * @returns {Array<Object>} List of 3 coordinate vertices
   */
  getVertices() {
    const headLen = 14;
    const wingBack = 10;
    const wingWidth = 7;

    // Center of fuselage
    const cx = this.x;
    const cy = this.y;

    const cosA = Math.cos(this.angle);
    const sinA = Math.sin(this.angle);

    // Tip of aircraft nose
    const nose = {
      x: cx + cosA * headLen,
      y: cy + sinA * headLen
    };

    // Rear wing positions
    const leftWing = {
      x: cx - cosA * wingBack - sinA * wingWidth,
      y: cy - sinA * wingBack + cosA * wingWidth
    };
    
    const rightWing = {
      x: cx - cosA * wingBack + sinA * wingWidth,
      y: cy - sinA * wingBack - cosA * wingWidth
    };

    return [nose, leftWing, rightWing];
  }

  /**
   * Casts radar sensor rays, checking collisions against environmental obstacles
   */
  updateSensors(obstacles, target) {
    const startPoint = { x: this.x, y: this.y };

    for (let i = 0; i < this.sensorAngles.length; i++) {
      const rayAngle = this.angle + this.sensorAngles[i];
      let closestPoint = null;
      let minParam = Infinity;

      // 1. Raycast line segments (Boundary edges + custom user walls)
      for (const obs of obstacles) {
        if (obs.type === 'wall') {
          const ptEnd = {
            x: this.x + Math.cos(rayAngle) * this.sensorRange,
            y: this.y + Math.sin(rayAngle) * this.sensorRange
          };

          const intersect = lineIntersection(startPoint, ptEnd, obs.p1, obs.p2);
          if (intersect && intersect.param < minParam) {
            minParam = intersect.param;
            closestPoint = intersect;
          }
        }
      }

      // 2. Raycast circular towers
      for (const obs of obstacles) {
        if (obs.type === 'tower') {
          const intersect = rayCircleIntersection(startPoint, rayAngle, obs, obs.r);
          if (intersect) {
            // Normalize parameter/distance
            const param = intersect.param / this.sensorRange;
            if (param <= 1.0 && param < minParam) {
              minParam = param;
              closestPoint = { x: intersect.x, y: intersect.y, param: param };
            }
          }
        }
      }

      if (closestPoint) {
        // Record coordinate and normalize sensor input [0-1] (1 means extremely close)
        this.radarIntersections[i] = { x: closestPoint.x, y: closestPoint.y };
        this.sensorInputs[i] = 1.0 - minParam; 
      } else {
        this.radarIntersections[i] = null;
        this.sensorInputs[i] = 0.0; // Clear path
      }
    }
  }

  /**
   * Update physics frame of flight dynamics
   */
  update(obstacles, target, maxRoundFrames) {
    if (this.isDead || this.reachedTarget) return;

    this.survivedTime++;

    // Calculate distance and relative angle to Target
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);

    if (this.initialDistance === 0) {
      this.initialDistance = distToTarget;
      this.minDistanceReached = distToTarget;
    }

    if (distToTarget < this.minDistanceReached) {
      this.minDistanceReached = distToTarget;
    }

    // Wrap target angle difference to [-PI, PI]
    const absoluteAngleToTarget = Math.atan2(dy, dx);
    let relativeAngle = absoluteAngleToTarget - this.angle;
    while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;
    while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;

    // Prepare neural inputs (7 inputs total)
    // 5 sensors + relative angle + distance
    const inputs = [
      this.sensorInputs[0],
      this.sensorInputs[1],
      this.sensorInputs[2],
      this.sensorInputs[3],
      this.sensorInputs[4],
      relativeAngle / Math.PI, // normalize relative angle to [-1, 1]
      Math.min(distToTarget, 600) / 600 // normalize distance to target
    ];

    // Compute neural network steering decisions
    const outputs = this.brain.feedForward(inputs);
    
    // Outputs mapping
    const steerDir = outputs[0]; // [-1 (left) to +1 (right)]
    const speedThrottle = outputs[1]; // [0 (slow) to 1 (fast)]

    // Apply turning physics
    const turningForce = steerDir * this.maxSteer;
    this.angle += turningForce;
    
    // Apply speed / aerodynamic throttle physics
    const targetSpeed = this.minSpeed + speedThrottle * (this.maxSpeed - this.minSpeed);
    // Smooth speed inertia interpolation
    this.speed += (targetSpeed - this.speed) * 0.08;

    // Update kinematic components
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
    this.x += this.vx;
    this.y += this.vy;

    // Check target reach success bounds
    if (distToTarget < target.r + 8) {
      this.reachedTarget = true;
      return;
    }

    // Trail recording every 3 frames
    this.trailTimer++;
    if (this.trailTimer >= 3) {
      this.trailTimer = 0;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.trailMax) {
        this.trail.shift();
      }
    }

    // Check environment boundary bounds (crashes if exits screen limits)
    if (this.x < 0 || this.x > 800 || this.y < 0 || this.y > 550) {
      this.isDead = true;
      return;
    }

    // Check collisions with custom walls/pylons
    this.checkCollisions(obstacles);
  }

  /**
   * Solves collision detection against segments and circular obstacles
   */
  checkCollisions(obstacles) {
    const vertices = this.getVertices();

    // Check segments/walls
    for (const obs of obstacles) {
      if (obs.type === 'wall') {
        // Check if any edge of delta wing triangle intersects the obstacle wall
        for (let i = 0; i < 3; i++) {
          const v1 = vertices[i];
          const v2 = vertices[(i + 1) % 3];

          const intersect = lineIntersection(v1, v2, obs.p1, obs.p2);
          if (intersect) {
            this.isDead = true;
            return;
          }
        }
      } else if (obs.type === 'tower') {
        // Check if any triangle vertex is inside circular tower pylon
        for (const v of vertices) {
          const dx = v.x - obs.x;
          const dy = v.y - obs.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < obs.r * obs.r) {
            this.isDead = true;
            return;
          }
        }
        
        // Also check if circle overlaps center of aircraft
        const cdx = this.x - obs.x;
        const cdy = this.y - obs.y;
        if (cdx * cdx + cdy * cdy < (obs.r + 4) * (obs.r + 4)) {
          this.isDead = true;
          return;
        }
      }
    }
  }

  /**
   * Compute fitness value based on progress and survival
   */
  calculateFitness(maxRoundFrames) {
    // 1. Closeness Progress Reward: how close did it get compared to initial distance
    const progress = this.initialDistance - this.minDistanceReached;
    
    // 2. Survival Bonus: minor reward for staying alive
    const survivalBonus = this.survivedTime * 0.05;

    // 3. Goal Reaching Bonus: massive incentive + time bonus for reaching target faster
    let destinationBonus = 0;
    if (this.reachedTarget) {
      const speedMultiplier = 1.0 + ((maxRoundFrames - this.survivedTime) / maxRoundFrames) * 2.0;
      destinationBonus = 1200 * speedMultiplier;
    }

    // Final blended fitness math (always keep fitness positive via max)
    this.fitness = Math.max(0.1, progress + survivalBonus + destinationBonus);
  }

  /**
   * Render aircraft delta vector to viewport context
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx, showTrails = true, isBest = false) {
    if (this.isDead) return;

    // 1. Draw Fading Exhaust Trail
    if (showTrails && this.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      
      ctx.lineWidth = isBest ? 2 : 1;
      ctx.strokeStyle = isBest 
        ? "rgba(255, 215, 0, 0.45)" // Gold for leader
        : "rgba(0, 240, 255, 0.15)"; // Cyan for followers
      ctx.stroke();
    }

    const vertices = this.getVertices();

    // 2. Draw Delta Wing Aircraft
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    ctx.lineTo(vertices[1].x, vertices[1].y);
    ctx.lineTo(vertices[2].x, vertices[2].y);
    ctx.closePath();

    if (this.reachedTarget) {
      // Golden highlight on success
      ctx.fillStyle = "rgba(255, 215, 0, 0.85)";
      ctx.strokeStyle = "#ffd700";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#ffd700";
    } else if (isBest) {
      // Magenta/Gold for active leader
      ctx.fillStyle = "rgba(255, 0, 127, 0.85)";
      ctx.strokeStyle = "var(--neon-magenta)";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "var(--neon-magenta)";
    } else {
      // Standard cyan wings
      ctx.fillStyle = "rgba(0, 240, 255, 0.35)";
      ctx.strokeStyle = "rgba(0, 240, 255, 0.9)";
    }

    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 3. Draw sensors overlay (only for the best performing aircraft to avoid canvas clutter)
    if (isBest) {
      this.drawSensors(ctx);
    }
  }

  /**
   * Draws active raycasting visualizers
   */
  drawSensors(ctx) {
    ctx.save();
    for (let i = 0; i < this.sensorAngles.length; i++) {
      const rayAngle = this.angle + this.sensorAngles[i];
      const endPoint = this.radarIntersections[i] || {
        x: this.x + Math.cos(rayAngle) * this.sensorRange,
        y: this.y + Math.sin(rayAngle) * this.sensorRange
      };

      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(endPoint.x, endPoint.y);
      
      // Glow red if hitting obstacle, else thin cyan
      if (this.radarIntersections[i]) {
        ctx.strokeStyle = "rgba(255, 51, 51, 0.35)";
        ctx.lineWidth = 1;
        
        // Draw little warning node at impact
        ctx.beginPath();
        ctx.arc(endPoint.x, endPoint.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 51, 51, 0.8)";
        ctx.fill();
      } else {
        ctx.strokeStyle = "rgba(0, 240, 255, 0.12)";
        ctx.lineWidth = 0.5;
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
