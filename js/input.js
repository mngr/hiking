import * as THREE from 'three';
import { STONE_CONFIG } from './stones.js';

export class InputHandler {
    constructor(camera, renderer, stoneManager) {
        this.camera = camera;
        this.renderer = renderer;
        this.stoneManager = stoneManager;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Callbacks
        this.onValidClick = null;
        this.onInvalidClick = null;

        // Current player stone
        this.currentStoneIndex = -1;

        // Game state
        this.enabled = true;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const canvas = this.renderer.domElement;

        // Mouse click
        canvas.addEventListener('mousedown', (e) => this.handleInput(e));
        canvas.addEventListener('touchstart', (e) => this.handleTouch(e), { passive: false });
    }

    handleTouch(event) {
        event.preventDefault();
        if (event.touches.length > 0) {
            this.handleInput(event.touches[0]);
        }
    }

    handleInput(event) {
        if (!this.enabled) return;

        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();

        // Get client coordinates
        const clientX = event.clientX !== undefined ? event.clientX : event.pageX;
        const clientY = event.clientY !== undefined ? event.clientY : event.pageY;

        // Convert to normalized device coordinates (-1 to +1)
        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        // Cast ray from camera
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Check intersections with stone meshes
        const stoneMeshes = this.stoneManager.getMeshes();
        const intersects = this.raycaster.intersectObjects(stoneMeshes);

        if (intersects.length > 0) {
            const clickedStone = intersects[0].object;
            this.handleStoneClick(clickedStone, clientX, clientY);
        } else {
            this.handleMissClick(clientX, clientY);
        }
    }

    handleStoneClick(stone, x, y) {
        const stoneIndex = stone.userData.index;

        // Valid click: any stone ahead of current position (matches original game logic)
        if (stoneIndex > this.currentStoneIndex) {
            const currentStone = this.stoneManager.getStoneByIndex(this.currentStoneIndex);
            if (currentStone) {
                const dx = stone.position.x - currentStone.position.x;
                const dz = stone.position.z - currentStone.position.z;
                const distance = Math.hypot(dx, dz);
                const currentRadius = (currentStone.userData.baseWidth || 0) * 0.5;
                const targetRadius = (stone.userData.baseWidth || 0) * 0.5;
                const edgeGap = Math.max(0, distance - currentRadius - targetRadius);
                if (edgeGap > STONE_CONFIG.maxJumpDistance) {
                    this.handleMissClick(x, y, 'tooFar');
                    return;
                }
            }

            this.currentStoneIndex = stoneIndex;

            if (this.onValidClick) {
                this.onValidClick(stone, x, y);
            }
        }
        // Clicking behind or on current stone is ignored (no penalty)
    }

    handleMissClick(x, y, reason = 'water') {
        // Clicked water/environment - game over
        if (this.onInvalidClick) {
            this.onInvalidClick(x, y, reason);
        }
    }

    setCurrentStoneIndex(index) {
        this.currentStoneIndex = index;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    reset() {
        this.currentStoneIndex = -1;
        this.enabled = true;
    }
}
