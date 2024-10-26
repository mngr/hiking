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
        const height = this.randomSize();
        const gap = this.randomSize();
        const x = Math.random() * (this.canvas.width - width);
        const y = lastStone ? lastStone.y - height - gap : this.canvas.height - height;
        const n = lastStone ? lastStone.n + 1 : 0;
        const rotation = Math.random() * Math.PI * 2; // Random rotation in radians
        this.stones.push({ x, y, width, height, n, rotation });
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

        this.stones.forEach(stone => {
            this.ctx.fillStyle = '#33ccff';
            this.ctx.save();
            this.ctx.translate(stone.x + stone.width / 2, stone.y + stone.height / 2);
            this.ctx.rotate(stone.rotation);
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, stone.width / 2, stone.height / 2, 0, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.restore();
        });

        // Draw player
        this.ctx.fillStyle = '#cc9933';
        this.ctx.beginPath();
        this.ctx.arc(this.playerPosition.x, this.playerPosition.y, this.playerSize, 0, Math.PI * 2);
        this.ctx.fill();

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

            // Display steps
            this.ctx.fillStyle = 'black';
            this.ctx.font = '24px Arial';
            this.ctx.fillText(`Steps: ${this.steps}`, 10, this.scrollOffset + 30);
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
        }
    }
}

new SteppingStoneGame();
