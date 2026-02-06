import * as THREE from 'three';
import { createScene, createCamera, createRenderer, createLighting, handleResize } from './scene.js';
import { createEnvironment } from './environment.js';
import { StoneManager } from './stones.js';
import { PlayerCamera } from './player.js';
import { InputHandler } from './input.js';
import { UIManager } from './ui.js';
import { AssetManager } from './assets.js';

class SteppingStones3D {
    constructor() {
        // Game state
        this.gameOver = false;
        this.steps = 0;
        this.gameStartTime = null;
        this.currentTime = 0;

        // Three.js setup
        this.scene = createScene();
        this.camera = createCamera();
        this.renderer = createRenderer();
        createLighting(this.scene);
        handleResize(this.camera, this.renderer);

        this.assets = new AssetManager(this.renderer);

        // Environment
        this.environment = createEnvironment(this.scene, this.assets);

        // Stone management
        this.stoneManager = new StoneManager(this.scene, this.environment, this.assets);
        this.stoneManager.generateInitialStones();

        // Player camera
        this.playerCamera = new PlayerCamera(this.camera, this.environment);

        // Input handling
        this.inputHandler = new InputHandler(this.camera, this.renderer, this.stoneManager);
        this.inputHandler.onValidClick = this.handleValidClick.bind(this);
        this.inputHandler.onInvalidClick = this.handleInvalidClick.bind(this);

        // Set initial camera target to first stone
        const firstStone = this.stoneManager.getStoneByIndex(0);
        if (firstStone) {
            this.playerCamera.setTargetStone(firstStone, true);
            this.inputHandler.setCurrentStoneIndex(firstStone.userData.index);
        }

        this.environment.update(this.playerCamera.getCameraZ(), 0);

        // UI
        this.ui = new UIManager();
        this.ui.onReplay = this.resetGame.bind(this);

        // Clock for delta time
        this.clock = new THREE.Clock();

        // Start game loop
        this.animate();
    }

    handleValidClick(stone, x, y) {
        // Start timer on first click
        if (this.gameStartTime === null) {
            this.gameStartTime = Date.now();
        }

        this.steps++;
        this.stoneManager.highlightStone(stone);
        this.playerCamera.setTargetStone(stone);
    }

    handleInvalidClick(x, y, reason) {
        this.gameOver = true;
        this.inputHandler.setEnabled(false);
        this.ui.showMissIndicator(x, y);

        // Show game over after a short delay
        setTimeout(() => {
            this.ui.showGameOver(this.steps, this.currentTime);
        }, 300);
    }

    resetGame() {
        // Reset game state
        this.gameOver = false;
        this.steps = 0;
        this.gameStartTime = null;
        this.currentTime = 0;

        // Reset managers
        this.stoneManager.reset();
        this.playerCamera.reset();
        this.inputHandler.reset();
        this.ui.reset();
        this.environment.reset();

        // Set initial target to first stone
        const firstStone = this.stoneManager.getStoneByIndex(0);
        if (firstStone) {
            this.playerCamera.setTargetStone(firstStone, true);
            this.inputHandler.setCurrentStoneIndex(firstStone.userData.index);
        }

        this.environment.update(this.playerCamera.getCameraZ(), 0);
    }

    updateTimer() {
        if (this.gameStartTime !== null && !this.gameOver) {
            this.currentTime = Date.now() - this.gameStartTime;
        }
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        const deltaTime = this.clock.getDelta();

        // Update timer
        this.updateTimer();

        // Update UI
        this.ui.updateStats(this.steps, this.currentTime);

        // Update camera
        this.playerCamera.update(deltaTime);

        // Update stones (generate/remove based on camera position)
        this.stoneManager.updateStones(this.playerCamera.getCameraZ());

        // Update environment (generate/remove segments)
        this.environment.update(this.playerCamera.getCameraZ(), deltaTime);

        // Render
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SteppingStones3D();
});
