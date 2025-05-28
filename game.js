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
        this.minStoneSize = 120; 
        this.maxStoneSize = 200; 
        this.gameOver = false;
        this.steps = 0;
        this.missClick = null;
        this.gameStartTime = null;
        this.currentTime = 0;
        this.replayButton = null;
        this.statsElement = document.getElementById('gameStats');

        this.vanishingPointX = this.canvas.width / 2;
        this.horizonY = this.canvas.height / 3;
        this.roadWidth = this.canvas.width * 0.8;
        this.worldEndZ = 0;
        this.baseStoneZGap = 15; // Reduced from 30

        this.cameraZ = 0;
        this.targetCameraZ = 0;
        this.cameraSpeed = 0.05; // Adjust as needed
        this.lookAheadDistance = 500; // world Z units to generate new stones
        this.renderDistanceBehind = 50; // world Z units behind camera to cull stones
        this.targetPlayerStoneN = null; // For updating player position

        this.resizeCanvas();
        this.generateStones();
        // this.updatePlayerPosition(this.stones[0]); // Removed: gameLoop will handle initial player position via targetPlayerStoneN
        if (this.stones.length > 0) {
            this.targetPlayerStoneN = this.stones[0].n; // Set target to the first stone's 'n'
        }
        this.boundHandleReplayClick = this.handleReplayClick.bind(this); // Add bound event handler
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
        const lastStone = this.stones[this.stones.length - 1];
        const n = lastStone ? lastStone.n + 1 : 0;

        // Perspective Calculation Logic
        const newStoneWorldZ = this.worldEndZ + (Math.random() * this.baseStoneZGap / 2) + this.baseStoneZGap / 2;
        
        // Use the same perspective factor logic as in gameLoop, assuming cameraZ = 0 for initial placement
        const initialPerspectiveFactor = Math.max(1, (newStoneWorldZ * 0.015) + 1); 
        let projectedY = this.horizonY + (this.canvas.height - this.horizonY) / initialPerspectiveFactor;
        let scale = 1 / initialPerspectiveFactor; // This is the stone's initial scale property

        // normalizedY is based on the initial perspective factor
        const normalizedY = (projectedY - this.horizonY) / (this.canvas.height - this.horizonY); 
        // Effectively: const normalizedY = 1 / initialPerspectiveFactor;
        const currentPathWidth = this.roadWidth * normalizedY; // This is pathWidthAtStoneZ for initial placement

        const baseWidth = this.randomSize(); 
        const baseHeight = baseWidth * (0.4 + Math.random() * 0.1);
        
        // stoneWidth and stoneHeight are initial scaled dimensions, used for initial x,y, and original scale property
        const stoneWidth = baseWidth * scale; 
        const stoneHeight = baseHeight * scale;

        // const screenX = this.vanishingPointX + (Math.random() - 0.5) * currentPathWidth; // Old screenX calculation
        const pathWidthAtStoneZ = currentPathWidth; // currentPathWidth is effectively pathWidthAtStoneZ
        const worldXOffsetFromPathCenter = (Math.random() - 0.5) * pathWidthAtStoneZ;
        
        const rotation = Math.random() * Math.PI * 2;
        const baseHue = 20 + Math.random() * 30;
        const baseSaturation = 5 + Math.random() * 15;
        const baseLightness = 45 + Math.random() * 20;

        const points = [];
        const numPoints = 12;
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            // Generate points based on baseWidth and baseHeight
            const radius = (baseWidth / 2) * (0.9 + Math.random() * 0.2); 
            points.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius * (baseHeight / baseWidth) // Use baseHeight/baseWidth ratio
            });
        }

        const noisePattern = [];
        for (let i = 0; i < 8; i++) {
            noisePattern.push({
                angle: Math.random() * Math.PI * 2,
                distance: Math.random() * baseWidth / 3, // Use baseWidth
                size: Math.random() * baseWidth / 8,    // Use baseWidth
                isLight: Math.random() > 0.5,
                alpha: 0.03 + Math.random() * 0.05
            });
        }
        
        this.worldEndZ = newStoneWorldZ; // Update worldEndZ

        this.stones.push({
            x: this.vanishingPointX + worldXOffsetFromPathCenter - (baseWidth * scale) / 2, // Initial X position
            y: projectedY - stoneHeight / 2, // Initial Y position
            width: stoneWidth, // Initial scaled width
            height: stoneHeight, // Initial scaled height
            baseWidth: baseWidth,
            baseHeight: baseHeight,
            worldZ: newStoneWorldZ,
            worldXOffsetFromPathCenter: worldXOffsetFromPathCenter,
            scale: scale, // Initial scale
            n, rotation,
            points, noisePattern,
            color: {
                hue: baseHue,
                saturation: baseSaturation,
                lightness: baseLightness
            }
        });
        // Removed return y; as it's not directly comparable anymore
    }
    
    generateStones() {
        this.worldEndZ = 0; // Reset worldEndZ
        for (let i = 0; i < 20; i++) { // Generate a fixed number of initial stones
            this.generateNewStone();
        }
    }

    // updatePlayerPosition(stone) { // Method is no longer needed
    //     this.playerPosition = {
    //         x: stone.x + stone.width / 2,
    //         y: stone.y + stone.height / 2,
    //         stone: stone.n
    //     };
    // }

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
        // y = event.clientY - rect.top + this.scrollOffset; // Old y calculation
        // For input, we need to check against the stone's current screen position.
        // This means the y coordinate from the event is directly comparable to stone.screenY
        y = event.clientY - rect.top; 
        }

    // Find tapped stone based on its current screen properties
        const tappedStone = this.stones.find(stone => {
        // Ensure stone has been processed by gameLoop and has screen coordinates
        if (stone.screenX === undefined || stone.screenY === undefined) return false;

        const checkX = stone.screenX;
        const checkY = stone.screenY;
        const checkWidth = stone.currentWidth;
        const checkHeight = stone.currentHeight;

        const centerX = checkX + checkWidth / 2;
        const centerY = checkY + checkHeight / 2;
        
        // Rotate point around stone center for click detection
        const rotatedInputX = Math.cos(stone.rotation) * (x - centerX) - Math.sin(stone.rotation) * (y - centerY) + centerX;
        const rotatedInputY = Math.sin(stone.rotation) * (x - centerX) + Math.cos(stone.rotation) * (y - centerY) + centerY;

        // Check if the rotated input point is within the ellipse of the stone
        const distanceX = (rotatedInputX - centerX) / (checkWidth / 2);
        const distanceY = (rotatedInputY - centerY) / (checkHeight / 2);
            return (distanceX * distanceX + distanceY * distanceY <= 1);
        });

    if (tappedStone && (tappedStone.n > (this.playerPosition.stone !== null ? this.playerPosition.stone : -1) )) {
            if (this.gameStartTime === null) {
                this.gameStartTime = Date.now();
            }
        // this.updatePlayerPosition(tappedStone); // Old updatePlayerPosition call
        this.targetCameraZ = tappedStone.worldZ; // Set target camera Z
        this.targetPlayerStoneN = tappedStone.n; // Set target stone for player
        // Remove old targetScrollOffset: this.targetScrollOffset = this.playerPosition.y - this.canvas.height + this.playerSize;
            this.steps++;
        } else {
            this.gameOver = true;
            this.missClick = { x, y };
        }
    }

    gameLoop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Animate Camera
        const dz = this.targetCameraZ - this.cameraZ;
        if (Math.abs(dz) > 0.1) {
            this.cameraZ += dz * this.cameraSpeed;
        } else {
            this.cameraZ = this.targetCameraZ;
        }

        // 2. Old Scroll Logic (ctx.translate and scrollOffset animation) is REMOVED.

        // Draw Path Edges
        this.ctx.fillStyle = '#654321'; // Brown color for the path
        this.ctx.beginPath();
        // Bottom-left point of the path on screen
        this.ctx.moveTo(this.vanishingPointX - this.roadWidth / 2, this.canvas.height);
        // Line to vanishing point (left edge)
        this.ctx.lineTo(this.vanishingPointX, this.horizonY);
        // Line to bottom-right point of the path on screen (right edge)
        this.ctx.lineTo(this.vanishingPointX + this.roadWidth / 2, this.canvas.height);
        this.ctx.closePath();
        this.ctx.fill();

        // 3. Recalculate Stone Properties
        this.stones.forEach(stone => {
            const relativeZ = stone.worldZ - this.cameraZ;

            if (relativeZ <= 0.1) { // Stone is at or behind camera's near plane (or too close)
                // Place it far off-screen below and give it zero scale
                stone.screenY = this.canvas.height + (stone.currentHeight || stone.baseHeight || 200) + 10; 
                stone.currentScale = 0;
                stone.currentWidth = 0;
                stone.currentHeight = 0;
                stone.screenX = this.vanishingPointX; // Center it horizontally when off-screen
                return; 
            }
            
            // Changed 0.015 to 0.005
            const perspectiveFactor = Math.max(1, (relativeZ * 0.005) + 1); 
            stone.currentScale = 1 / perspectiveFactor;
            // Adjust Y to be top of stone, considering its scaled height
            // The formula for screenY should use (stone.baseHeight * stone.currentScale) for the height of the stone itself,
            // and then subtract that WHOLE scaled height from the projected Y point that represents the stone's base on the ground.
            // The original projectedY (center of stone on ground if it had no height) was: this.horizonY + (this.canvas.height - this.horizonY) / perspectiveFactor
            // So, screenY (top of stone) should be: (this.horizonY + (this.canvas.height - this.horizonY) / perspectiveFactor) - (stone.baseHeight * stone.currentScale)
            stone.screenY = (this.horizonY + (this.canvas.height - this.horizonY) / perspectiveFactor) - (stone.baseHeight * stone.currentScale);

            stone.screenX = this.vanishingPointX + (stone.worldXOffsetFromPathCenter * stone.currentScale) - (stone.baseWidth * stone.currentScale) / 2;
            
            stone.currentWidth = stone.baseWidth * stone.currentScale;
            stone.currentHeight = stone.baseHeight * stone.currentScale;
        });
        
        // Sort stones by Z for correct drawing order (painter's algorithm)
        this.stones.sort((a, b) => a.worldZ - b.worldZ);

        // 4. Update Drawing Loop (drawStone uses new properties)
        this.stones.forEach(stone => {
            this.drawStone(stone); // drawStone was updated in Turn 10 to use screenX, screenY, currentWidth etc.
        });
        
        // 5. Update Player Position Drawing (using this.targetPlayerStoneN)
        if (this.targetPlayerStoneN !== null) {
            const playerStone = this.stones.find(s => s.n === this.targetPlayerStoneN);
            if (playerStone && playerStone.currentScale > 0 && playerStone.screenY < this.canvas.height) { // Ensure stone is visible and on screen
                this.playerPosition.x = playerStone.screenX + playerStone.currentWidth / 2;
                this.playerPosition.y = playerStone.screenY + playerStone.currentHeight / 2;
                this.playerPosition.stone = playerStone.n;
            } else if (playerStone && playerStone.currentScale <= 0) {
                // Player was on a stone that's now not visible, keep player at last known n but don't update x,y.
                // Or, if player needs to be invisible too:
                // this.playerPosition.x = -1000; this.playerPosition.y = -1000;
            }
        }

        // Draw player (ensure playerSize also scales with perspective if player is on a stone)
        let playerVisualSize = this.playerSize;
        if (this.playerPosition.stone !== null) {
            const currentStoneOfPlayer = this.stones.find(s => s.n === this.playerPosition.stone);
            if (currentStoneOfPlayer && currentStoneOfPlayer.currentScale > 0 && currentStoneOfPlayer.screenY < this.canvas.height) {
                playerVisualSize = this.playerSize * currentStoneOfPlayer.currentScale;
            } else {
                 playerVisualSize = 0; // Player on a non-visible or off-screen stone
            }
        }


        if (playerVisualSize > 0.5) { // Only draw if visually significant
            this.ctx.fillStyle = '#cc9933';
            this.ctx.beginPath();
            this.ctx.arc(this.playerPosition.x, this.playerPosition.y, playerVisualSize, 0, Math.PI * 2);
            this.ctx.fill();
        }


        // Update timer and stats display (no change needed here, they draw in screen space)
        this.updateTimer();
        this.updateStatsDisplay();

        if (this.gameOver && this.missClick) {
            // Draw red cross at miss click - this is in screen space, which is fine.
            this.ctx.strokeStyle = 'red';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(this.missClick.x - 10, this.missClick.y - 10);
            this.ctx.lineTo(this.missClick.x + 10, this.missClick.y + 10);
            this.ctx.moveTo(this.missClick.x + 10, this.missClick.y - 10);
            this.ctx.lineTo(this.missClick.x - 10, this.missClick.y + 10);
            this.ctx.stroke();
        }

        // 6. Stone Generation/Removal Logic
        // Generate new stones as needed
        // Check if stones array is empty or the last stone is not too far ahead
        if (this.stones.length === 0 || (this.worldEndZ - this.cameraZ < this.lookAheadDistance)) {
            for(let i=0; i < 5; i++){ // Generate a few stones to ensure coverage
                 if (this.worldEndZ - this.cameraZ < this.lookAheadDistance) this.generateNewStone();
            }
        }

        // Remove stones that are off-screen (behind camera or too far down and no longer visible)
        this.stones = this.stones.filter(stone => {
            const relativeZ = stone.worldZ - this.cameraZ;
            const isTooFarBehind = relativeZ < -this.renderDistanceBehind; // Note: renderDistanceBehind is positive
            
            // Check if stone is effectively off-screen below
            // A stone is considered off-screen below if its screenY is past canvas height AND its scale is tiny or zero.
            let offScreenBelow = false;
            if (stone.screenY !== undefined) {
                 offScreenBelow = stone.screenY > this.canvas.height + (stone.currentHeight || 50) || stone.currentScale < 0.01;
            }
            
            return !isTooFarBehind && !offScreenBelow;
        });


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
        this.canvas.addEventListener('click', this.boundHandleReplayClick); // Use bound handler
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
        this.playerPosition = { x: 0, y: 0, stone: null }; // Reset player position object
        // this.scrollOffset = 0; // No longer used
        // this.targetScrollOffset = 0; // No longer used
        this.gameOver = false;
        this.steps = 0;
        this.missClick = null;
        this.gameStartTime = null;
        this.currentTime = 0;

        this.cameraZ = 0; // Reset camera Z
        this.targetCameraZ = 0; // Reset target camera Z
        this.worldEndZ = 0; // Reset world end Z for stone generation

        // Regenerate stones
        this.generateStones(); 

        // Set player to the first stone using targetPlayerStoneN
        if (this.stones.length > 0) {
            this.targetPlayerStoneN = this.stones[0].n;
        } else {
            this.targetPlayerStoneN = null; // No stones, no target
        }
        // Note: The actual update of this.playerPosition.x and .y will happen in the gameLoop.

        // Clear the stats display
        this.statsElement.textContent = '';

        // Remove the click event listener for the replay button
        this.canvas.removeEventListener('click', this.boundHandleReplayClick); // Use bound handler

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
        // Ensure stone has been processed by gameLoop and has screen coordinates and current dimensions
        if (stone.screenX === undefined || stone.screenY === undefined || stone.currentWidth === undefined || stone.currentHeight === undefined || stone.currentScale === undefined) {
            return; // Don't draw if not ready
        }
        if (stone.currentScale <= 0) return; // Don't draw if not visible

        this.ctx.save();
        
        // Translate to the stone's calculated screen position (top-left) and then to its center for rotation
        this.ctx.translate(stone.screenX + stone.currentWidth / 2, stone.screenY + stone.currentHeight / 2);
        this.ctx.rotate(stone.rotation);
        
        // Apply current scale to the entire stone drawing context
        this.ctx.scale(stone.currentScale, stone.currentScale);

        // Flatter gradient using baseHeight (will be scaled by ctx.scale)
        const gradient = this.ctx.createLinearGradient(
            0, -stone.baseHeight / 2,
            0, stone.baseHeight / 2
        );
        
        const baseColor = `hsl(${stone.color.hue}, ${stone.color.saturation}%, ${stone.color.lightness}%)`;
        const darkerColor = `hsl(${stone.color.hue}, ${stone.color.saturation}%, ${stone.color.lightness - 10}%)`;
        const darkestColor = `hsl(${stone.color.hue}, ${stone.color.saturation}%, ${stone.color.lightness - 15}%)`;

        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(0.7, darkerColor);
        gradient.addColorStop(1, darkestColor);

        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        // Shadow properties are now base values, as they will be scaled by ctx.scale
        this.ctx.shadowBlur = 10; 
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 3;

        // Draw irregular stone shape with smooth closing
        // stone.points are now relative to baseWidth/baseHeight
        this.ctx.beginPath();
        
        // Start from the last point to ensure smooth connection
        // stone.points are already scaled to the initial stone.width and stone.height
        // For drawing, we need to scale them again by currentScale / initial scale if basePoints were stored.
        // However, stone.points were generated using initial stoneWidth/Height which included initial scale.
        // So, the points are already in a "scaled space". We just draw them as is, as the canvas context is already scaled by currentWidth/Height effect.
        // The this.ctx.translate and this.ctx.rotate handle the overall position and orientation.
        // The points themselves define the shape relative to the stone's center (0,0) using base dimensions.

        const lastPoint = stone.points[stone.points.length - 1];
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

        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Add texture/cracks - noise.distance and noise.size are already scaled with initial stone.width
        stone.noisePattern.forEach(noise => {
            const x = Math.cos(noise.angle) * noise.distance; // noise.distance is fine
            const y = Math.sin(noise.angle) * noise.distance; // noise.distance is fine
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, noise.size, 0, Math.PI * 2); // noise.size is fine
            this.ctx.fillStyle = noise.isLight ? 
                `hsla(${stone.color.hue}, ${stone.color.saturation}%, ${stone.color.lightness + 10}%, ${noise.alpha})` :
                `hsla(${stone.color.hue}, ${stone.color.saturation}%, ${stone.color.lightness - 10}%, ${noise.alpha})`;
            this.ctx.fill();
        });

        // Subtle top highlight using baseHeight (will be scaled by ctx.scale)
        this.ctx.globalAlpha = 0.1;
        const highlightGradient = this.ctx.createLinearGradient(
            0, -stone.baseHeight / 2,
            0, stone.baseHeight / 4 
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
