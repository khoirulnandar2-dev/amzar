export class EvolutionChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        
        // Responsive chart sizes
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.padding = { top: 35, right: 20, bottom: 35, left: 50 };
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    /**
     * Clear and redraw the chart with the evolution history data
     * @param {Object[]} history - Array of { generation, maxFitness, avgFitness, successCount }
     */
    draw(history) {
        if (!this.canvas || !this.ctx) return;
        
        const ctx = this.ctx;
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        ctx.clearRect(0, 0, width, height);

        // Standard layout values
        const padLeft = this.padding.left;
        const padRight = this.padding.right;
        const padTop = this.padding.top;
        const padBottom = this.padding.bottom;
        
        const chartWidth = width - padLeft - padRight;
        const chartHeight = height - padTop - padBottom;

        // Draw background grid/frame
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.4)'; // Sleek transparent slate background
        ctx.beginPath();
        ctx.roundRect(padLeft, padTop, chartWidth, chartHeight, 6);
        ctx.fill();
        ctx.restore();

        // 1. Draw Grid Lines & Axes
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.font = '10px "Fira Code", monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        
        // 4 Horizontal grid lines
        const gridLinesY = 4;
        for (let i = 0; i <= gridLinesY; i++) {
            const y = padTop + (chartHeight / gridLinesY) * i;
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(width - padRight, y);
            ctx.stroke();
        }
        ctx.restore();

        if (history.length === 0) {
            // Draw placeholder text when no data is available
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '13px "Outfit", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Grafik akan muncul di Generasi 2', width / 2, height / 2);
            ctx.restore();
            return;
        }

        // 2. Find range values
        let maxFitValue = 100; // default minimum ceiling
        let maxGenCount = Math.max(2, history.length);

        for (const log of history) {
            if (log.maxFitness > maxFitValue) maxFitValue = log.maxFitness;
            if (log.avgFitness > maxFitValue) maxFitValue = log.avgFitness;
        }

        // Add 15% padding to top of chart so lines don't clip the upper border
        maxFitValue *= 1.15; 

        // Draw Y Axis Labels
        ctx.save();
        ctx.font = '9px "Fira Code", monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        for (let i = 0; i <= gridLinesY; i++) {
            const val = maxFitValue - (maxFitValue / gridLinesY) * i;
            const y = padTop + (chartHeight / gridLinesY) * i;
            ctx.fillText(Math.round(val), padLeft - 10, y);
        }
        ctx.restore();

        // Draw X Axis Labels (Generations)
        ctx.save();
        ctx.font = '9px "Fira Code", monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign = 'center';
        
        const labelInterval = Math.max(1, Math.ceil(maxGenCount / 10));
        for (let i = 0; i < maxGenCount; i++) {
            if (i % labelInterval === 0 || i === maxGenCount - 1) {
                const x = padLeft + (i / (maxGenCount - 1)) * chartWidth;
                ctx.fillText(`G${i + 1}`, x, height - 12);
            }
        }
        ctx.restore();

        // 3. Helper function to plot lines
        const getCoordinates = (valueKey) => {
            const points = [];
            for (let i = 0; i < history.length; i++) {
                const log = history[i];
                const x = padLeft + (i / (maxGenCount - 1)) * chartWidth;
                const y = padTop + chartHeight - (log[valueKey] / maxFitValue) * chartHeight;
                points.push({ x, y });
            }
            return points;
        };

        const maxFitPoints = getCoordinates('maxFitness');
        const avgFitPoints = getCoordinates('avgFitness');

        // Draw Line with Gradient Underfill
        const drawLine = (points, color, glowColor, fillGradient) => {
            if (points.length === 0) return;

            // Draw area gradient under the curve
            if (fillGradient && points.length > 1) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(points[0].x, padTop + chartHeight);
                for (const p of points) {
                    ctx.lineTo(p.x, p.y);
                }
                ctx.lineTo(points[points.length - 1].x, padTop + chartHeight);
                ctx.closePath();
                ctx.fillStyle = fillGradient;
                ctx.fill();
                ctx.restore();
            }

            // Draw line curve
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.restore();

            // Draw terminal endpoint dots
            if (points.length > 0) {
                const last = points[points.length - 1];
                ctx.save();
                ctx.beginPath();
                ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 10;
                ctx.fill();
                
                // Ring outline
                ctx.beginPath();
                ctx.arc(last.x, last.y, 7, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();
            }
        };

        // Create gradients for fills
        const maxGrad = ctx.createLinearGradient(0, padTop, 0, padTop + chartHeight);
        maxGrad.addColorStop(0, 'rgba(0, 242, 254, 0.2)');
        maxGrad.addColorStop(1, 'rgba(0, 242, 254, 0.0)');

        const avgGrad = ctx.createLinearGradient(0, padTop, 0, padTop + chartHeight);
        avgGrad.addColorStop(0, 'rgba(155, 81, 224, 0.15)');
        avgGrad.addColorStop(1, 'rgba(155, 81, 224, 0.0)');

        // Draw Average Fitness line (Violet)
        drawLine(avgFitPoints, '#9b51e0', 'rgba(155, 81, 224, 0.6)', avgGrad);
        
        // Draw Max Fitness line (Cyan)
        drawLine(maxFitPoints, '#00f2fe', 'rgba(0, 242, 254, 0.8)', maxGrad);

        // 4. Draw Header / Legend
        ctx.save();
        ctx.font = '10px "Outfit", sans-serif';
        
        // Max fitness legend
        ctx.fillStyle = '#00f2fe';
        ctx.beginPath();
        ctx.arc(padLeft + 10, padTop - 15, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(`Fitness Terbaik: ${Math.round(history[history.length-1].maxFitness)}`, padLeft + 20, padTop - 12);

        // Avg fitness legend
        ctx.fillStyle = '#9b51e0';
        ctx.beginPath();
        ctx.arc(padLeft + 160, padTop - 15, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(`Fitness Rata-rata: ${Math.round(history[history.length-1].avgFitness)}`, padLeft + 170, padTop - 12);
        
        // Success count legend
        ctx.fillStyle = '#2ed573';
        ctx.beginPath();
        ctx.arc(padLeft + 310, padTop - 15, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(`Target Capai: ${history[history.length-1].successCount}`, padLeft + 320, padTop - 12);

        ctx.restore();
    }
}
