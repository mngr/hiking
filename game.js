class SteppingStoneGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.stones = [];
        this.playerPosition = { x: 0, y: 0, stone: null };
        this.scrollOffset = 0;
        this.targetScrollOffset = 0;
        this.scrollSpeed = 0.05; // Adjust this value to change animation speed
        this.playerSize = 20; // Define player size
        this.minStoneSize = this.playerSize * 2.5; // Minimum stone size
        this.maxStoneSize = this.minStoneSize + 60; // Maximum stone size
        this.gameOver = false;
        this.steps = 0;
        this.missClick = null;
        this.gameStartTime = null;
        this.currentTime = 0;
        this.replayButton = null;
        this.statsElement = document.getElementById('gameStats');

        this.resizeCanvas();
        this.generateStones();
        this.updatePlayerPosition(this.stones[0]);
        this.addEventListeners();
        this.gameLoop();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    randomSize() {
        return Math.random() * (this.maxStoneSize - this.minStoneSize) + this.minStoneSize;
    }

    generateNewStone() {
        let lastStone = this.stones[this.stones.length - 1];
        const width = this.randomSize();
        const height = width * (0.5 + Math.random() * 0.2);
        const gap = this.randomSize();
        const x = Math.random() * (this.canvas.width - width);
        const y = lastStone ? lastStone.y - height - gap : this.canvas.height - height;
        const n = lastStone ? lastStone.n + 1 : 0;
        const rotation = Math.random() * Math.PI * 2;
        
        const baseHue = 20 + Math.random() * 30;
        const baseSaturation = 5 + Math.random() * 15;
        const baseLightness = 45 + Math.random() * 20;

        const points = [];
        const numPoints = 12;
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const radius = (width / 2) * (0.9 + Math.random() * 0.2);
            points.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius * (height / width)
            });
        }

        const noisePattern = [];
        for (let i = 0; i < 8; i++) {
            noisePattern.push({
                angle: Math.random() * Math.PI * 2,
                distance: Math.random() * width / 3,
                size: Math.random() * width / 8,
                isLight: Math.random() > 0.5,
                alpha: 0.03 + Math.random() * 0.05
            });
        }

        this.stones.push({ 
            x, y, width, height, n, rotation,
            points, noisePattern,
            color: {
                hue: baseHue,
                saturation: baseSaturation,
                lightness: baseLightness
            }
        });
        return y;
    }
    
    generateStones() {
        let y;
        do {
            y = this.generateNewStone();
        } while (y > 0)
    }

    updatePlayerPosition(stone) {
        this.playerPosition = {
            x: stone.x + stone.width / 2,
            y: stone.y + stone.height / 2,
            stone: stone.n
        };
    }

    addEventListeners() {
        this.canvas.addEventListener('touchstart', this.handleInput.bind(this));
        this.canvas.addEventListener('mousedown', this.handleInput.bind(this));
        window.addEventListener('resize', this.resizeCanvas.bind(this));
    }

    handleInput(event) {
        if (this.gameOver) return;

        event.preventDefault();
        let x, y;
        
        if (event.type === 'touchstart') {
            const touch = event.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            x = touch.clientX - rect.left;
            y = touch.clientY - rect.top + this.scrollOffset;
        } else if (event.type === 'mousedown') {
            const rect = this.canvas.getBoundingClientRect();
            x = event.clientX - rect.left;
            y = event.clientY - rect.top + this.scrollOffset;
        }

        const tappedStone = this.stones.find(stone => {
            const centerX = stone.x + stone.width / 2;
            const centerY = stone.y + stone.height / 2;
            const rotatedX = Math.cos(stone.rotation) * (x - centerX) - Math.sin(stone.rotation) * (y - centerY) + centerX;
            const rotatedY = Math.sin(stone.rotation) * (x - centerX) + Math.cos(stone.rotation) * (y - centerY) + centerY;
            const distanceX = (rotatedX - centerX) / (stone.width / 2);
            const distanceY = (rotatedY - centerY) / (stone.height / 2);
            return (distanceX * distanceX + distanceY * distanceY <= 1);
        });

        if (tappedStone && (tappedStone.n > this.playerPosition.stone)) {
            if (this.gameStartTime === null) {
                this.gameStartTime = Date.now();
            }
            this.updatePlayerPosition(tappedStone);
            this.targetScrollOffset = this.playerPosition.y - this.canvas.height + this.playerSize;
            this.steps++;
        } else {
            this.gameOver = true;
            this.missClick = { x, y };
        }
    }

    gameLoop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(0, -this.scrollOffset);

        // Draw stones
        this.stones.forEach(stone => {
            this.drawStone(stone);
        });

        // Draw player
        this.ctx.fillStyle = '#cc9933';
        this.ctx.beginPath();
        this.ctx.arc(this.playerPosition.x, this.playerPosition.y, this.playerSize, 0, Math.PI * 2);
        this.ctx.fill();

        // Update timer
        this.updateTimer();
        
        // Update stats display
        this.updateStatsDisplay();

        if (this.gameOver && this.missClick) {
            // Draw red cross at miss click
            this.ctx.strokeStyle = 'red';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(this.missClick.x - 10, this.missClick.y - 10);
            this.ctx.lineTo(this.missClick.x + 10, this.missClick.y + 10);
            this.ctx.moveTo(this.missClick.x + 10, this.missClick.y - 10);
            this.ctx.lineTo(this.missClick.x - 10, this.missClick.y + 10);
            this.ctx.stroke();
        }

        this.ctx.restore();
        
        // Animate scroll offset
        const scrollDiff = this.scrollOffset - this.targetScrollOffset;
        if (scrollDiff > 0.5) {
            this.scrollOffset -= scrollDiff * this.scrollSpeed;
        } else {
            this.scrollOffset = this.targetScrollOffset;
        }

        // Generate new stones as needed
        if (this.stones[this.stones.length - 1].y < this.scrollOffset + this.canvas.height) {
            this.generateNewStone(this.stones[this.stones.length - 1]);
        }

        // Remove stones that are off-screen
        this.stones = this.stones.filter(stone => stone.y > this.scrollOffset - stone.height);

        if (!this.gameOver) {
            requestAnimationFrame(this.gameLoop.bind(this));
        } else {
            this.displayGameOver();
        }
    }

    updateTimer() {
        if (this.gameStartTime !== null && !this.gameOver) {
            this.currentTime = Date.now() - this.gameStartTime;
        }
    }

    updateStatsDisplay() {
        const timeString = this.formatTime(this.currentTime);
        this.statsElement.textContent = `Steps: ${this.steps} | Time: ${timeString}`;
    }

    displayGameOver() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = 'white';
        this.ctx.font = '48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Game Over', this.canvas.width / 2, this.canvas.height / 2 - 50);

        this.ctx.font = '24px Arial';
        const totalMilliseconds = this.currentTime;
        const minutes = Math.floor(totalMilliseconds / 60000);
        const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
        const milliseconds = totalMilliseconds % 1000;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
        this.ctx.fillText(`Steps: ${this.steps} | Time: ${timeString}`, this.canvas.width / 2, this.canvas.height / 2 + 50);

        // Add replay button
        this.addReplayButton();
    }

    addReplayButton() {
        const buttonWidth = 200;
        const buttonHeight = 50;
        const buttonX = (this.canvas.width - buttonWidth) / 2;
        const buttonY = this.canvas.height / 2 + 100;

        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

        this.ctx.fillStyle = 'white';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Play again', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);

        this.replayButton = { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight };

        // Add click event listener for the replay button
        this.canvas.addEventListener('click', this.handleReplayClick.bind(this));
    }

    handleReplayClick(event) {
        if (!this.gameOver) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (x >= this.replayButton.x && x <= this.replayButton.x + this.replayButton.width &&
            y >= this.replayButton.y && y <= this.replayButton.y + this.replayButton.height) {
            this.resetGame();
        }
    }

    resetGame() {
        // Reset game state
        this.stones = [];
        this.playerPosition = { x: 0, y: 0, stone: null };
        this.scrollOffset = 0;
        this.targetScrollOffset = 0;
        this.gameOver = false;
        this.steps = 0;
        this.missClick = null;
        this.gameStartTime = null;
        this.currentTime = 0;

        // Regenerate stones and reset player position
        this.generateStones();
        this.updatePlayerPosition(this.stones[0]);

        // Clear the stats display
        this.statsElement.textContent = '';

        // Remove the click event listener for the replay button
        this.canvas.removeEventListener('click', this.handleReplayClick);

        // Restart the game loop
        this.gameLoop();
    }

    formatTime(totalMilliseconds) {
        const minutes = Math.floor(totalMilliseconds / 60000);
        const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
        const ms = totalMilliseconds % 1000;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }

    displayStepsAndTimer() {
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = 'black';
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        
        const totalMilliseconds = this.currentTime;
        const minutes = Math.floor(totalMilliseconds / 60000);
        const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
        const milliseconds = totalMilliseconds % 1000;
        
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
        this.ctx.fillText(`Steps: ${this.steps} | Time: ${timeString}`, 10, 30);
        
        this.ctx.restore();
    }

    drawStone(stone) {
        this.ctx.save();
        
        this.ctx.translate(stone.x + stone.width / 2, stone.y + stone.height / 2);
        this.ctx.rotate(stone.rotation);

        // Flatter gradient
        const gradient = this.ctx.createLinearGradient(
            0, -stone.height / 2,
            0, stone.height / 2
        );
        
        const baseColor = `hsl(${stone.color.hue}, ${stone.color.saturation}%, ${stone.color.lightness}%)`;
        const darkerColor = `hsl(${stone.color.hue}, ${stone.color.saturation}%, ${stone.color.lightness - 10}%)`;
        const darkestColor = `hsl(${stone.color.hue}, ${stone.color.saturation}%, ${stone.color.lightness - 15}%)`;

        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(0.7, darkerColor);
        gradient.addColorStop(1, darkestColor);

        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 3;

        // Draw irregular stone shape with smooth closing
        this.ctx.beginPath();
        
        // Start from the last point to ensure smooth connection
        const lastPoint = stone.points[stone.points.length - 1];
        this.ctx.moveTo(lastPoint.x, lastPoint.y);

        // Draw the entire shape including the closing segment
        for (let i = 0; i < stone.points.length + 2; i++) {
            const point = stone.points[i % stone.points.length];
            const prevPoint = stone.points[(i - 1 + stone.points.length) % stone.points.length];
            const nextPoint = stone.points[(i + 1) % stone.points.length];
            
            const cp1x = prevPoint.x + (point.x - prevPoint.x) * 0.5;
            const cp1y = prevPoint.y + (point.y - prevPoint.y) * 0.5;
            const cp2x = point.x + (nextPoint.x - point.x) * 0.5;
            const cp2y = point.y + (nextPoint.y - point.y) * 0.5;
            
            this.ctx.quadraticCurveTo(point.x, point.y, cp2x, cp2y);
        }

        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Add texture/cracks
        stone.noisePattern.forEach(noise => {
            const x = Math.cos(noise.angle) * noise.distance;
            const y = Math.sin(noise.angle) * noise.distance;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, noise.size, 0, Math.PI * 2);
            this.ctx.fillStyle = noise.isLight ? 
                `hsla(${stone.color.hue}, ${stone.color.saturation}%, ${stone.color.lightness + 10}%, ${noise.alpha})` :
                `hsla(${stone.color.hue}, ${stone.color.saturation}%, ${stone.color.lightness - 10}%, ${noise.alpha})`;
            this.ctx.fill();
        });

        // Subtle top highlight
        this.ctx.globalAlpha = 0.1;
        const highlightGradient = this.ctx.createLinearGradient(
            0, -stone.height / 2,
            0, stone.height / 4
        );
        highlightGradient.addColorStop(0, '#FFFFFF');
        highlightGradient.addColorStop(1, 'transparent');
        
        // Use the same smooth path for the highlight
        this.ctx.beginPath();
        this.ctx.moveTo(lastPoint.x, lastPoint.y);
        for (let i = 0; i < stone.points.length + 2; i++) {
            const point = stone.points[i % stone.points.length];
            const prevPoint = stone.points[(i - 1 + stone.points.length) % stone.points.length];
            const nextPoint = stone.points[(i + 1) % stone.points.length];
            
            const cp1x = prevPoint.x + (point.x - prevPoint.x) * 0.5;
            const cp1y = prevPoint.y + (point.y - prevPoint.y) * 0.5;
            const cp2x = point.x + (nextPoint.x - point.x) * 0.5;
            const cp2y = point.y + (nextPoint.y - point.y) * 0.5;
            
            this.ctx.quadraticCurveTo(point.x, point.y, cp2x, cp2y);
        }
        
        this.ctx.fillStyle = highlightGradient;
        this.ctx.fill();

        this.ctx.restore();
    }
}

new SteppingStoneGame();
