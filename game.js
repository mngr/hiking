
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

class SteppingStoneGame {
    constructor() {
        this.container = document.body;
        this.stones = [];
        this.player = null;
        this.currentStoneIndex = 0;
        this.isPlaying = false;
        this.score = 0;
        this.startTime = 0;

        // Config
        this.worldWidth = 200;
        this.stoneGap = 40;
        this.cameraOffset = { x: 0, y: 150, z: -100 };
        this.lookAheadDistance = 500;

        this.init();
        this.createPlayer();
        this.generateInitialStones();
        this.setupInteraction();
        this.setupUI();

        this.animate = this.animate.bind(this);
        this.animate();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 200, 800);

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(0, 100, -100);
        this.camera.lookAt(0, 0, 50);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('gameCanvas') });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        dirLight.shadow.camera.left = -100;
        dirLight.shadow.camera.right = 100;
        dirLight.shadow.camera.top = 100;
        dirLight.shadow.camera.bottom = -100;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        // Ground/Water (Abyss)
        const waterGeometry = new THREE.PlaneGeometry(2000, 2000);
        const waterMaterial = new THREE.MeshPhongMaterial({ color: 0x0077be, transparent: true, opacity: 0.8 });
        this.water = new THREE.Mesh(waterGeometry, waterMaterial);
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -50;
        this.scene.add(this.water);

        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    createPlayer() {
        const geometry = new THREE.SphereGeometry(10, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.4 });
        this.player = new THREE.Mesh(geometry, material);
        this.player.castShadow = true;
        this.player.position.set(0, 15, 0);
        this.scene.add(this.player);

        // Target position for smooth movement
        this.playerTarget = new THREE.Vector3(0, 15, 0);
        this.playerVelocity = new THREE.Vector3();
    }

    generateInitialStones() {
        this.lastStoneZ = 0;
        // Initial stone under player
        this.addStone(0, 0, 60, 60);

        for (let i = 0; i < 15; i++) {
            this.generateNewStone();
        }
    }

    generateNewStone() {
        const minGap = 40;
        const maxGap = 70;
        const zDist = Math.random() * (maxGap - minGap) + minGap;
        this.lastStoneZ += zDist;

        const rangeX = 80;
        const xPos = (Math.random() - 0.5) * rangeX;

        const baseSize = 40;
        const width = baseSize * (0.8 + Math.random() * 0.5);
        const length = baseSize * (0.8 + Math.random() * 0.5);

        this.addStone(xPos, this.lastStoneZ, width, length);
    }

    addStone(x, z, w, l) {
        const shape = new THREE.Shape();
        const numPoints = 10;

        // Generate points
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            // Radius variation
            const rX = (w / 2) * (0.85 + Math.random() * 0.3);
            const rY = (l / 2) * (0.85 + Math.random() * 0.3);

            const px = Math.cos(angle) * rX;
            const py = Math.sin(angle) * rY;

            if (i === 0) shape.moveTo(px, py);
            else shape.lineTo(px, py);
        }
        shape.closePath();

        const extrudeSettings = { depth: 5, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 1, bevelThickness: 1 };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        const hue = 0.1 + Math.random() * 0.1; // Earthy tones
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(hue, 0.6, 0.4 + Math.random() * 0.2),
            flatShading: true
        });

        const mesh = new THREE.Mesh(geometry, material);
        // Correct rotation for ExtrudeGeometry (extrudes along Z, shape is XY)
        // We want shape on XZ plane, extrusion down Y.
        // Actually Extrude defaults to extruding along Z. 
        // If we rotate X -90, shape is XZ, extrusion is along -Y (down) or +Y (up).
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0, z); // Top of stone at y=0 roughly (bevel adds a bit)
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { index: this.stones.length };

        this.scene.add(mesh);
        this.stones.push(mesh);
    }

    setupInteraction() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        const handleInput = (event) => {
            if (!this.isPlaying && this.currentStoneIndex > 0) return; // Game Over state

            let clientX, clientY;
            if (event.changedTouches) {
                clientX = event.changedTouches[0].clientX;
                clientY = event.changedTouches[0].clientY;
            } else {
                clientX = event.clientX;
                clientY = event.clientY;
            }

            this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.stones);

            if (intersects.length > 0) {
                const hitObject = intersects[0].object;
                const index = hitObject.userData.index;

                if (index === this.currentStoneIndex + 1) {
                    // Valid step
                    this.stepTo(index);
                } else if (index > this.currentStoneIndex + 1) {
                    // Too far or skipped
                    // Maybe allow skipping? Original game logic didn't seem to allow strict checking, 
                    // but checked if stone.n > current. 
                    // Let's implement strict "next stone" for simplicity or loose "forward"
                    this.stepTo(index); // Allow jumping forward freely? Let's assume yes like original
                }
            } else {
                // Clicked water/missed
                // Check if we clicked "water"
                const waterIntersect = this.raycaster.intersectObject(this.water);
                if (waterIntersect.length > 0) {
                    this.gameOver();
                }
            }
        };

        window.addEventListener('mousedown', handleInput);
        window.addEventListener('touchstart', handleInput, { passive: false });
    }

    stepTo(index) {
        if (!this.isPlaying && this.score === 0) {
            this.isPlaying = true;
            this.startTime = Date.now();
        }

        this.currentStoneIndex = index;
        const targetStone = this.stones[index];

        // Move player
        this.playerTarget.copy(targetStone.position);
        this.playerTarget.y += 10; // offset for player radius

        this.score++;
        this.updateStats();

        // Generate more stones
        if (this.stones.length - index < 10) {
            this.generateNewStone();
        }
    }

    setupUI() {
        this.statsElement = document.getElementById('gameStats');
        this.statsElement.style.color = 'white';
        this.statsElement.style.textShadow = '1px 1px 2px black';
    }

    updateStats() {
        const time = this.startTime ? ((Date.now() - this.startTime) / 1000).toFixed(1) : '0.0';
        this.statsElement.innerHTML = `Steps: ${this.score} <br> Time: ${time}s`;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    gameOver() {
        this.isPlaying = false;
        alert(`Game Over! Score: ${this.score}`);
        location.reload(); // Simple restart
    }

    animate() {
        requestAnimationFrame(this.animate);

        // Smooth player movement
        this.player.position.lerp(this.playerTarget, 0.1);

        // Camera follow
        const idealCameraZ = this.player.position.z - 80;
        this.camera.position.z += (idealCameraZ - this.camera.position.z) * 0.05;
        this.camera.position.x += (this.player.position.x * 0.5 - this.camera.position.x) * 0.05; // Slight lag follow on X
        this.camera.lookAt(this.player.position.x * 0.2, 0, this.player.position.z + 50);

        // Water movement effect
        this.water.position.z = this.camera.position.z;
        this.water.position.x = this.camera.position.x;

        if (this.isPlaying) this.updateStats();

        this.renderer.render(this.scene, this.camera);
    }
}

new SteppingStoneGame();
