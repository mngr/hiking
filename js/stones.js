import * as THREE from 'three';

// Stone configuration (ported from original game.js)
const STONE_CONFIG = {
    minSize: 0.3,
    maxSize: 0.7,
    baseZGap: 0.7,
    pathWidth: 5,
    lookAheadDistance: 220,
    renderDistanceBehind: 20,
    maxJumpDistance: 3.2
};

export class StoneManager {
    constructor(scene, environment, assets) {
        this.scene = scene;
        this.environment = environment;
        this.assets = assets;
        this.stones = [];
        this.stoneMeshes = []; // For raycasting
        this.worldEndZ = -3.0;
        this.stoneIndex = 0;
        this.stoneIndex = 0;
    }

    seededRandom(seed) {
        let s = seed % 2147483647;
        if (s <= 0) s += 2147483646;
        return () => (s = (s * 16807) % 2147483647) / 2147483647;
    }

    createStoneMaterial(color) {
        if (this.assets) {
            return this.assets.createStoneMaterial(color);
        }
        return new THREE.MeshStandardMaterial({
            color,
            roughness: 0.9,
            metalness: 0.02,
            flatShading: false,
            vertexColors: true
        });
    }

    createStoneGeometry(baseWidth, baseHeight, baseColor, seed) {
        const rng = this.seededRandom(seed);
        const radius = baseWidth / 2;
        const geometry = new THREE.SphereGeometry(radius, 30, 20);

        const positions = geometry.attributes.position;
        const colors = [];
        const vertex = new THREE.Vector3();

        const phase = seed * 0.013;
        for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i);
            const normal = vertex.clone().normalize();

            const noise = (
                Math.sin(vertex.x * 2.2 + phase) * 0.008 +
                Math.sin(vertex.z * 2.0 + phase * 1.2) * 0.007 +
                Math.sin(vertex.y * 1.6 + phase * 0.7) * 0.006
            ) * radius;
            const radial = radius * (0.98 + rng() * 0.035) + noise;
            vertex.copy(normal.multiplyScalar(radial));

            vertex.y *= baseHeight / radius;
            if (vertex.y < -baseHeight * 0.28) {
                vertex.y = -baseHeight * 0.28 + (vertex.y + baseHeight * 0.28) * 0.12;
            }

            positions.setXYZ(i, vertex.x, vertex.y, vertex.z);

            const color = baseColor.clone();
            const heightTint = THREE.MathUtils.clamp((normal.y + 1) * 0.5, 0, 1);
            color.offsetHSL((rng() - 0.5) * 0.015, 0, (rng() - 0.5) * 0.06 + heightTint * 0.035);
            colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();
        return geometry;
    }

    randomSize() {
        return Math.random() * (STONE_CONFIG.maxSize - STONE_CONFIG.minSize) + STONE_CONFIG.minSize;
    }

    generateNewStone() {
        const n = this.stoneIndex++;

        // Calculate Z position with some random variation
        const zGap = (Math.random() * STONE_CONFIG.baseZGap / 2) + STONE_CONFIG.baseZGap / 2;
        const newStoneWorldZ = this.worldEndZ + zGap;

        const baseWidth = this.randomSize();
        const baseHeight = baseWidth * (0.14 + Math.random() * 0.06);

        const centerX = this.environment ? this.environment.getCreekCenterX(newStoneWorldZ) : 0;
        const creekWidth = this.environment ? this.environment.getCreekWidth(newStoneWorldZ) : STONE_CONFIG.pathWidth;
        const halfWidth = Math.max(0.2, creekWidth * 0.4 - baseWidth * 0.35);
        const randomOffset = (Math.random() - 0.5) * 2 * halfWidth * 0.9;
        const xOffset = n === 0 ? centerX : THREE.MathUtils.clamp(centerX + randomOffset, centerX - halfWidth, centerX + halfWidth);

        // Random rotation around Y axis
        const rotation = Math.random() * Math.PI * 2;

        // Stone color (earthy browns/greys)
        const baseColor = new THREE.Color().setHSL(
            0.08 + Math.random() * 0.08,
            0.08 + Math.random() * 0.08,
            0.38 + Math.random() * 0.2
        );
        const seed = Math.floor(Math.random() * 100000);

        // Create 3D stone mesh
        const geometry = this.createStoneGeometry(baseWidth, baseHeight, baseColor, seed);
        const material = this.createStoneMaterial(baseColor);
        const mesh = new THREE.Mesh(geometry, material);

        const bedHeight = this.environment ? this.environment.getBedHeight(xOffset, newStoneWorldZ) : 0;
        const waterLevel = this.environment ? this.environment.getWaterLevel(newStoneWorldZ) : bedHeight;
        const bedAnchor = bedHeight + baseHeight * 0.22;
        const floatAnchor = waterLevel - baseHeight * 0.45;
        mesh.position.set(xOffset, Math.max(bedAnchor, floatAnchor), newStoneWorldZ);
        mesh.rotation.y = rotation;
        mesh.rotation.z = (Math.random() - 0.5) * 0.15;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Store stone data for game logic
        mesh.userData = {
            index: n,
            worldZ: newStoneWorldZ,
            xOffset: xOffset,
            baseWidth: baseWidth,
            baseHeight: baseHeight,
            color: baseColor
        };

        this.scene.add(mesh);
        this.stones.push(mesh);
        this.stoneMeshes.push(mesh);

        this.worldEndZ = newStoneWorldZ;

        return mesh;
    }

    generateInitialStones(count = 110) {
        this.worldEndZ = 0;
        for (let i = 0; i < count; i++) {
            this.generateNewStone();
        }
    }

    updateStones(cameraZ) {
        // Generate new stones ahead
        while (this.worldEndZ - cameraZ < STONE_CONFIG.lookAheadDistance) {
            this.generateNewStone();
        }

        // Remove stones that are far behind
        this.stones = this.stones.filter(stone => {
            const relativeZ = stone.userData.worldZ - cameraZ;
            if (relativeZ < -STONE_CONFIG.renderDistanceBehind) {
                this.scene.remove(stone);
                stone.geometry.dispose();
                stone.material.dispose();

                // Remove from stoneMeshes array
                const meshIndex = this.stoneMeshes.indexOf(stone);
                if (meshIndex > -1) {
                    this.stoneMeshes.splice(meshIndex, 1);
                }

                return false;
            }
            return true;
        });

        // Update shadow casting based on distance (performance optimization)
        this.stones.forEach(stone => {
            const distance = stone.userData.worldZ - cameraZ;
            stone.castShadow = distance < 30 && distance > -5;
        });
    }

    getStoneByIndex(index) {
        return this.stones.find(s => s.userData.index === index);
    }

    highlightStone(stone) {
        // Store original emissive
        const originalEmissive = stone.material.emissive.clone();

        // Flash green
        stone.material.emissive.setHex(0x22AA22);

        // Animate back to original
        setTimeout(() => {
            stone.material.emissive.copy(originalEmissive);
        }, 150);
    }

    reset() {
        // Remove all stones
        this.stones.forEach(stone => {
            this.scene.remove(stone);
            stone.geometry.dispose();
            stone.material.dispose();
        });

        this.stones = [];
        this.stoneMeshes = [];
        this.worldEndZ = 0;
        this.stoneIndex = 0;

        // Generate fresh stones
        this.generateInitialStones();
    }

    getMeshes() {
        return this.stoneMeshes;
    }
}

export { STONE_CONFIG };
