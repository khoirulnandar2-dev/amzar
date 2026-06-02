import { Vector2D } from './vector.js';

export class TrackManager {
    constructor() {
        this.walls = []; // Array of { a: Vector2D, b: Vector2D }
        this.startPos = new Vector2D(100, 300);
        this.targetPos = new Vector2D(700, 300);
        this.canvasWidth = 800;
        this.canvasHeight = 500;
    }

    /**
     * Add a line-segment wall
     */
    addWall(x1, y1, x2, y2) {
        this.walls.push({
            a: new Vector2D(x1, y1),
            b: new Vector2D(x2, y2)
        });
    }

    /**
     * Clear all walls except the boundary walls
     */
    clearToSandbox() {
        this.walls = [];
        this.addBoundaries();
        this.startPos.set(80, this.canvasHeight / 2);
        this.targetPos.set(this.canvasWidth - 80, this.canvasHeight / 2);
    }

    /**
     * Helper to add canvas border walls so cars don't escape
     */
    addBoundaries() {
        const w = this.canvasWidth;
        const h = this.canvasHeight;
        
        // Inner buffer so cars collide right at the edge
        const pad = 5;
        this.addWall(pad, pad, w - pad, pad);         // Top boundary
        this.addWall(w - pad, pad, w - pad, h - pad); // Right boundary
        this.addWall(w - pad, h - pad, pad, h - pad); // Bottom boundary
        this.addWall(pad, h - pad, pad, pad);         // Left boundary
    }

    /**
     * Load predefined track presets based on width and height
     */
    loadPreset(presetName, width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;
        this.walls = [];
        this.addBoundaries();

        switch (presetName) {
            case 'sandbox':
                this.clearToSandbox();
                break;
                
            case 'scurve':
                // S-Curve layout - mathematically guaranteed non-crossing corridors
                this.startPos.set(80, height * 0.5);
                this.targetPos.set(width - 80, height * 0.5);
                
                // Top wall connections (Center path Y - 0.16 * height)
                this.addWall(0, height * 0.34, width * 0.25, height * 0.14);
                this.addWall(width * 0.25, height * 0.14, width * 0.5, height * 0.54);
                this.addWall(width * 0.5, height * 0.54, width * 0.75, height * 0.14);
                this.addWall(width * 0.75, height * 0.14, width, height * 0.34);

                // Bottom wall connections (Center path Y + 0.16 * height)
                this.addWall(0, height * 0.66, width * 0.25, height * 0.46);
                this.addWall(width * 0.25, height * 0.46, width * 0.5, height * 0.86);
                this.addWall(width * 0.5, height * 0.86, width * 0.75, height * 0.46);
                this.addWall(width * 0.75, height * 0.46, width, height * 0.66);
                break;
                
            case 'circuit':
                // Oval race track circuit - completely open lane loops
                this.startPos.set(width / 2, height - 70); // Bottom center
                this.targetPos.set(width / 2, 70);       // Top center (so they have to drive around the circuit!)

                // Outer boundaries are already added. Let's add some inner walls to make it a loop.
                const innerW = width * 0.55;
                const innerH = height * 0.42;
                const leftX = (width - innerW) / 2;
                const rightX = leftX + innerW;
                const topY = (height - innerH) / 2;
                const bottomY = topY + innerH;
                
                // Inner loop walls (representing the grass center island)
                this.addWall(leftX + 40, topY, rightX - 40, topY);
                this.addWall(rightX - 40, topY, rightX, topY + 40);
                this.addWall(rightX, topY + 40, rightX, bottomY - 40);
                this.addWall(rightX, bottomY - 40, rightX - 40, bottomY);
                this.addWall(rightX - 40, bottomY, leftX + 40, bottomY);
                this.addWall(leftX + 40, bottomY, leftX, bottomY - 40);
                this.addWall(leftX, bottomY - 40, leftX, topY + 40);
                this.addWall(leftX, topY + 40, leftX + 40, topY);
                break;
                
            case 'maze':
                // Maze/Obstacle course layout
                this.startPos.set(60, 60); // Top-left
                this.targetPos.set(width - 60, height - 60); // Bottom-right
                
                // Vertical and horizontal dividers creating a path
                // Obstacle 1
                this.addWall(width * 0.25, 5, width * 0.25, height * 0.6);
                // Obstacle 2
                this.addWall(width * 0.5, height - 5, width * 0.5, height * 0.4);
                // Obstacle 3
                this.addWall(width * 0.75, 5, width * 0.75, height * 0.6);
                
                // Extra horizontal bars
                this.addWall(width * 0.25, height * 0.6, width * 0.38, height * 0.6);
                this.addWall(width * 0.5, height * 0.4, width * 0.62, height * 0.4);
                break;
        }
    }

    /**
     * Draw the target point to canvas
     */
    drawTarget(ctx) {
        ctx.save();
        
        // Target outer pulse effect
        const pulse = 10 + Math.sin(Date.now() * 0.007) * 4;
        
        ctx.beginPath();
        ctx.arc(this.targetPos.x, this.targetPos.y, pulse + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 8, 68, 0.2)';
        ctx.lineWidth = 2.0;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.targetPos.x, this.targetPos.y, pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 8, 68, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Target core dot
        ctx.beginPath();
        ctx.arc(this.targetPos.x, this.targetPos.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0844'; // Radiant magenta/red
        ctx.shadowColor = '#ff0844';
        ctx.shadowBlur = 15;
        ctx.fill();

        ctx.restore();
    }

    /**
     * Draw starting flag point
     */
    drawStart(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.startPos.x, this.startPos.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(46, 213, 115, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(this.startPos.x, this.startPos.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#2ed573'; // Emerald green start point
        ctx.shadowColor = '#2ed573';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
    }

    /**
     * Draw all walls to canvas
     */
    drawWalls(ctx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // Modern thin neon border grid style
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.05)';
        ctx.shadowBlur = 5;

        for (const wall of this.walls) {
            ctx.beginPath();
            ctx.moveTo(wall.a.x, wall.a.y);
            ctx.lineTo(wall.b.x, wall.b.y);
            ctx.stroke();
        }

        ctx.restore();
    }
}
