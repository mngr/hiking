import * as THREE from 'three';

function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function createRockGeometry(radius, rng) {
    const geometry = new THREE.IcosahedronGeometry(radius, 2);
    const positions = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i);
        const normal = vertex.clone().normalize();
        const noise = (rng() - 0.5) * radius * 0.35;
        const radial = radius + noise;
        vertex.copy(normal.multiplyScalar(radial));
        vertex.y *= 0.55 + rng() * 0.1;
        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    geometry.computeVertexNormals();
    return geometry;
}

function createTree(rng) {
    const tree = new THREE.Group();
    const trunkHeight = 2 + rng() * 2;
    const trunkRadius = 0.15 + rng() * 0.12;
    const canopyRadius = 1.2 + rng() * 1.2;
    const canopyHeight = 2 + rng() * 2;

    const trunkGeometry = new THREE.CylinderGeometry(trunkRadius * 0.8, trunkRadius, trunkHeight, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
        color: 0x6b4a2d,
        roughness: 0.9,
        metalness: 0
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;

    const canopyGeometry = new THREE.ConeGeometry(canopyRadius, canopyHeight, 8, 2);
    const canopyColor = new THREE.Color().setHSL(0.3 + rng() * 0.06, 0.5 + rng() * 0.2, 0.25 + rng() * 0.15);
    const canopyMaterial = new THREE.MeshStandardMaterial({
        color: canopyColor,
        roughness: 0.9,
        metalness: 0
    });
    const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
    canopy.position.y = trunkHeight + canopyHeight * 0.35;
    canopy.castShadow = true;
    canopy.receiveShadow = true;

    tree.add(trunk, canopy);
    return tree;
}

export function createSky(scene) {
    // Gradient sky dome
    const skyGeometry = new THREE.SphereGeometry(400, 32, 15);

    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x5aa8ff) },
            bottomColor: { value: new THREE.Color(0xd7f1ff) },
            offset: { value: 20 },
            exponent: { value: 0.5 }
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                float t = max(pow(max(h, 0.0), exponent), 0.0);
                gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
            }
        `,
        side: THREE.BackSide
    });

    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);

    // Add distant mountains for depth
    const mountainMaterial = new THREE.MeshStandardMaterial({
        color: 0x56616f,
        roughness: 1.0,
        metalness: 0
    });

    // Create simple mountain silhouettes
    for (let i = 0; i < 5; i++) {
        const mountainGeometry = new THREE.ConeGeometry(
            30 + Math.random() * 40,
            40 + Math.random() * 50,
            4
        );
        const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);

        const angle = (i / 5) * Math.PI - Math.PI / 2;
        const distance = 180;
        mountain.position.set(
            Math.sin(angle) * distance,
            -5,
            150 + Math.cos(angle) * distance * 0.3
        );
        mountain.rotation.y = Math.random() * Math.PI;

        scene.add(mountain);
    }

    return sky;
}

class EnvironmentManager {
    constructor(scene) {
        this.scene = scene;
        this.segments = new Map();
        this.segmentLength = 50;
        this.lookAhead = 240;
        this.renderBehind = 80;
        this.roadWidth = 7.5;
        this.terrainWidth = 140;
        this.groundY = -0.4;
        this.sky = createSky(scene);

        this.groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x2f5b2d,
            roughness: 0.95,
            metalness: 0
        });
        this.roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x5f4a33,
            roughness: 0.9,
            metalness: 0
        });
        this.rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x7a746b,
            roughness: 0.85,
            metalness: 0.05
        });
    }

    getRoadCenterX(z) {
        const slow = Math.sin(z * 0.008) * 10;
        const fast = Math.sin(z * 0.035) * 5;
        return slow + fast;
    }

    getRoadTangentAngle(z) {
        const dz = 1;
        const x1 = this.getRoadCenterX(z - dz);
        const x2 = this.getRoadCenterX(z + dz);
        const dx = x2 - x1;
        return Math.atan2(dx, dz * 2);
    }

    createGroundSegment(segmentIndex) {
        const rng = seededRandom(segmentIndex * 997 + 31);
        const zStart = segmentIndex * this.segmentLength;
        const zCenter = zStart + this.segmentLength / 2;

        const groundGeometry = new THREE.PlaneGeometry(this.terrainWidth, this.segmentLength, 16, 8);
        const positions = groundGeometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getY(i);
            const worldZ = zCenter + z;
            const noise = Math.sin((x + worldZ) * 0.05) * 0.2 + Math.sin(worldZ * 0.12) * 0.1;
            const jitter = (rng() - 0.5) * 0.1;
            positions.setZ(i, noise + jitter);
        }
        groundGeometry.computeVertexNormals();
        const groundMaterial = this.groundMaterial.clone();
        groundMaterial.color.offsetHSL((rng() - 0.5) * 0.03, (rng() - 0.5) * 0.05, (rng() - 0.5) * 0.05);
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, this.groundY, zCenter);
        ground.receiveShadow = true;

        const roadGeometry = new THREE.BoxGeometry(this.roadWidth, 0.12, this.segmentLength);
        const roadMaterial = this.roadMaterial.clone();
        roadMaterial.color.offsetHSL((rng() - 0.5) * 0.02, (rng() - 0.5) * 0.04, (rng() - 0.5) * 0.04);
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        const roadX = this.getRoadCenterX(zCenter);
        const roadAngle = this.getRoadTangentAngle(zCenter);
        road.position.set(roadX, this.groundY + 0.05, zCenter);
        road.rotation.y = roadAngle;
        road.receiveShadow = true;

        const segmentGroup = new THREE.Group();
        segmentGroup.add(ground, road);

        const treeCount = 8 + Math.floor(rng() * 8);
        for (let i = 0; i < treeCount; i++) {
            const tree = createTree(rng);
            const offsetZ = (rng() - 0.5) * this.segmentLength;
            const centerX = this.getRoadCenterX(zCenter + offsetZ);
            const side = rng() > 0.5 ? 1 : -1;
            const xSpread = this.roadWidth * 0.7 + 6 + rng() * 20;
            tree.position.set(centerX + side * xSpread, this.groundY, zCenter + offsetZ);
            tree.rotation.y = rng() * Math.PI * 2;
            segmentGroup.add(tree);
        }

        const rockCount = 2 + Math.floor(rng() * 3);
        for (let i = 0; i < rockCount; i++) {
            const rockRadius = 1.2 + rng() * 1.8;
            const rock = new THREE.Mesh(createRockGeometry(rockRadius, rng), this.rockMaterial.clone());
            const tint = 0.9 + rng() * 0.2;
            rock.material.color.multiplyScalar(tint);
            const offsetZ = (rng() - 0.5) * this.segmentLength;
            const centerX = this.getRoadCenterX(zCenter + offsetZ);
            const side = rng() > 0.5 ? 1 : -1;
            const xSpread = this.roadWidth + 4 + rng() * 10;
            rock.position.set(centerX + side * xSpread, this.groundY + 0.1, zCenter + offsetZ);
            rock.rotation.set(rng() * 0.2, rng() * Math.PI * 2, rng() * 0.2);
            rock.castShadow = true;
            rock.receiveShadow = true;
            segmentGroup.add(rock);
        }

        this.scene.add(segmentGroup);
        this.segments.set(segmentIndex, segmentGroup);
    }

    update(cameraZ) {
        const startIndex = Math.floor((cameraZ - this.renderBehind) / this.segmentLength);
        const endIndex = Math.floor((cameraZ + this.lookAhead) / this.segmentLength);

        for (let i = startIndex; i <= endIndex; i++) {
            if (!this.segments.has(i)) {
                this.createGroundSegment(i);
            }
        }

        for (const [index, group] of this.segments) {
            if (index < startIndex - 1 || index > endIndex + 1) {
                group.traverse(child => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) child.material.dispose();
                    }
                });
                this.scene.remove(group);
                this.segments.delete(index);
            }
        }
    }

    reset() {
        for (const [, group] of this.segments) {
            group.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            });
            this.scene.remove(group);
        }
        this.segments.clear();
    }
}

export function createEnvironment(scene) {
    return new EnvironmentManager(scene);
}
