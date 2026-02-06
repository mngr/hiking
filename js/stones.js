import * as THREE from 'three';

// Stone configuration (ported from original game.js)
const STONE_CONFIG = {
    minSize: 0.8,
    maxSize: 1.4,
    baseZGap: 3.5,
    pathWidth: 5,
    lookAheadDistance: 80,
    renderDistanceBehind: 10
};

export class StoneManager {
    constructor(scene) {
        this.scene = scene;
        this.stones = [];
        this.stoneMeshes = []; // For raycasting
        this.worldEndZ = 0;
        this.stoneIndex = 0;
    }

    seededRandom(seed) {
        let s = seed % 2147483647;
        if (s <= 0) s += 2147483646;
        return () => (s = (s * 16807) % 2147483647) / 2147483647;
    }

    createStoneMaterial(color) {
        const hue = color.hue / 360;
        const saturation = color.saturation / 100;
        const lightness = color.lightness / 100;

        const baseColor = new THREE.Color().setHSL(hue, saturation, lightness);

        return new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: 0.9,
            metalness: 0.02,
            flatShading: false,
            vertexColors: true
        });
    }

    createStoneGeometry(baseWidth, baseHeight, baseColor, seed) {
        const rng = this.seededRandom(seed);
        const radius = baseWidth / 2;
        const geometry = new THREE.IcosahedronGeometry(radius, 2);

        const positions = geometry.attributes.position;
        const colors = [];
        const vertex = new THREE.Vector3();

        for (let i = 0; i < positions.count; i++) {
            vertex.fromBufferAttribute(positions, i);
            const normal = vertex.clone().normalize();

            const noise = (rng() - 0.5) * radius * 0.35;
            const radial = radius * (0.85 + rng() * 0.35) + noise;
            vertex.copy(normal.multiplyScalar(radial));

            vertex.y *= baseHeight / radius;
            if (vertex.y < -baseHeight * 0.45) {
                vertex.y = -baseHeight * 0.45 + (vertex.y + baseHeight * 0.45) * 0.25;
            }

            positions.setXYZ(i, vertex.x, vertex.y, vertex.z);

            const color = baseColor.clone();
            color.offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.5) * 0.16);
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

        // Random X offset within the path width
        const xOffset = (Math.random() - 0.5) * STONE_CONFIG.pathWidth;

        const baseWidth = this.randomSize();
        const baseHeight = baseWidth * (0.4 + Math.random() * 0.1);

        // Random rotation around Y axis
        const rotation = Math.random() * Math.PI * 2;

        // Stone color (earthy browns/greys)
        const color = {
            hue: 18 + Math.random() * 25,
            saturation: 4 + Math.random() * 12,
            lightness: 35 + Math.random() * 25
        };

        const baseColor = new THREE.Color().setHSL(color.hue / 360, color.saturation / 100, color.lightness / 100);
        const seed = Math.floor(Math.random() * 100000);

        // Create 3D stone mesh
        const geometry = this.createStoneGeometry(baseWidth, baseHeight, baseColor, seed);
        const material = this.createStoneMaterial(color);
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.set(xOffset, 0, newStoneWorldZ);
        mesh.rotation.y = rotation;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Store stone data for game logic
        mesh.userData = {
            index: n,
            worldZ: newStoneWorldZ,
            xOffset: xOffset,
            baseWidth: baseWidth,
            baseHeight: baseHeight,
            color: color
        };

        this.scene.add(mesh);
        this.stones.push(mesh);
        this.stoneMeshes.push(mesh);

        this.worldEndZ = newStoneWorldZ;

        return mesh;
    }

    generateInitialStones(count = 25) {
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
