import * as THREE from 'three';

function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function createRockGeometry(radius, rng) {
    const geometry = new THREE.IcosahedronGeometry(radius, 1);
    const positions = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i);
        const normal = vertex.clone().normalize();
        const noise = (rng() - 0.5) * radius * 0.25;
        const radial = radius * (0.85 + rng() * 0.3) + noise;
        vertex.copy(normal.multiplyScalar(radial));
        vertex.y *= 0.6 + rng() * 0.12;
        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    geometry.computeVertexNormals();
    return geometry;
}

function createFoliageGeometry(radius, rng) {
    const geometry = new THREE.SphereGeometry(radius, 18, 12);
    const positions = geometry.attributes.position;
    const colors = [];
    const vertex = new THREE.Vector3();
    const color = new THREE.Color();
    const phase = rng() * 10;
    for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i);
        const normal = vertex.clone().normalize();
        const noise = (
            Math.sin(vertex.x * 2.2 + phase) * 0.03 +
            Math.sin(vertex.z * 2.0 + phase * 1.2) * 0.025 +
            Math.sin(vertex.y * 1.8 + phase * 0.7) * 0.02
        ) * radius;
        const radial = radius * (0.95 + rng() * 0.08) + noise;
        vertex.copy(normal.multiplyScalar(radial));
        vertex.y *= 0.8 + rng() * 0.12;
        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);

        const heightTint = THREE.MathUtils.clamp((vertex.y / radius + 1) * 0.5, 0, 1);
        color.setHSL(0.3 + rng() * 0.06, 0.45 + rng() * 0.12, 0.2 + heightTint * 0.2);
        colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
}

function createTree(rng, trunkMaterial, foliageMaterial) {
    const tree = new THREE.Group();
    const trunkHeight = 2.8 + rng() * 2.6;
    const trunkRadius = 0.16 + rng() * 0.16;

    const trunkGeometry = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 12, 6);
    const trunkPositions = trunkGeometry.attributes.position;
    const trunkVertex = new THREE.Vector3();
    const bend = (rng() - 0.5) * 0.3;
    for (let i = 0; i < trunkPositions.count; i++) {
        trunkVertex.fromBufferAttribute(trunkPositions, i);
        const strength = (trunkVertex.y / trunkHeight + 0.5);
        trunkVertex.x += bend * strength;
        trunkVertex.z += bend * 0.6 * strength;
        trunkPositions.setXYZ(i, trunkVertex.x, trunkVertex.y, trunkVertex.z);
    }
    trunkGeometry.computeVertexNormals();

    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = false;
    trunk.receiveShadow = true;
    trunk.userData.sharedMaterial = true;

    const canopyRadius = 1.5 + rng() * 1.4;
    const canopy = new THREE.Mesh(createFoliageGeometry(canopyRadius, rng), foliageMaterial);
    canopy.position.set((rng() - 0.5) * 0.4, trunkHeight * 0.65 + canopyRadius * 0.2, (rng() - 0.5) * 0.4);
    canopy.castShadow = false;
    canopy.receiveShadow = true;
    canopy.userData.sharedMaterial = true;

    tree.add(trunk, canopy);
    return tree;
}

export function createSky(scene) {
    const skyGeometry = new THREE.SphereGeometry(400, 32, 15);

    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x7fb7ff) },
            bottomColor: { value: new THREE.Color(0xe6f6ff) },
            offset: { value: 18 },
            exponent: { value: 0.55 }
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

    return sky;
}

class EnvironmentManager {
    constructor(scene, assets) {
        this.scene = scene;
        this.assets = assets;
        this.debugCreek = false;
        this.segments = new Map();
        this.segmentLength = 60;
        this.lookAhead = 260;
        this.renderBehind = 90;
        this.terrainWidth = 120;
        this.baseGroundY = -0.85;
        this.creekDepth = 0.75;
        this.waterDepth = 0.32;
        this.maxCreekWidth = 7.2;
        this.sky = createSky(scene);

        this.groundMaterial = assets.groundMaterial;
        this.waterMaterial = assets.waterMaterial;
        this.rockMaterial = assets.rockMaterial;
        this.trunkMaterial = assets.trunkMaterial;
        this.foliageMaterial = assets.foliageMaterial;
    }

    getCreekCenterX(z) {
        const sweep = Math.sin(z * 0.004 + 1.1) * 12;
        const slow = Math.sin(z * 0.007) * 14;
        const mid = Math.sin(z * 0.021 + 1.7) * 6;
        const fast = Math.sin(z * 0.055 + 0.4) * 2.6;
        return sweep + slow + mid + fast;
    }

    getCreekWidth(z) {
        const base = 5.0 + Math.sin(z * 0.018) * 1.0;
        const ripple = Math.sin(z * 0.05 + 1.7) * 0.5;
        const jagged = Math.sin(z * 0.11 + 0.9) * 0.6 + Math.sin(z * 0.23 + 2.1) * 0.4;
        return Math.max(3.6, base + ripple + jagged);
    }

    getSideWidth(z, side) {
        const base = this.getCreekWidth(z);
        const noise =
            Math.sin(z * 0.17 + (side > 0 ? 1.3 : -2.2)) * 0.18 +
            Math.sin(z * 0.31 + (side > 0 ? 2.6 : -2.6)) * 0.12 +
            Math.sin(z * 0.09 + (side > 0 ? 0.8 : -1.1)) * 0.08;
        return Math.max(2.8, base * (1 + noise));
    }

    getBaseGroundHeight(x, z) {
        const macro1 = Math.sin((x + z) * 0.006) * 0.35;
        const macro2 = Math.sin(x * 0.004 - z * 0.005) * 0.25;
        const macro3 = Math.sin(z * 0.0045 + Math.sin(x * 0.004)) * 0.2;
        const hill1 = Math.sin((x + z) * 0.012) * 0.28;
        const hill2 = Math.sin(z * 0.008 + Math.sin(x * 0.01)) * 0.2;
        const hill3 = Math.sin(x * 0.015) * 0.14;
        const detail1 = Math.sin((x + z) * 0.05) * 0.1;
        const detail2 = Math.sin(z * 0.12) * 0.05;
        const detail3 = Math.sin(x * 0.07 + z * 0.03) * 0.05;
        return this.baseGroundY + macro1 + macro2 + macro3 + hill1 + hill2 + hill3 + detail1 + detail2 + detail3;
    }

    getBedHeight(x, z) {
        const centerX = this.getCreekCenterX(z);
        const dist = Math.abs(x - centerX);
        const side = x < centerX ? -1 : 1;
        const sideWidth = this.getSideWidth(z, side);
        const t = THREE.MathUtils.clamp(dist / (sideWidth * 0.5), 0, 1);
        const tPow = Math.pow(t, 2.2);
        const channel = Math.pow(1 - tPow, 4.8);
        const base = this.getBaseGroundHeight(x, z);
        const baseCenter = this.getBaseGroundHeight(centerX, z);
        const blend = THREE.MathUtils.smoothstep(t, 0, 0.8);
        const shapedBase = THREE.MathUtils.lerp(baseCenter, base, blend);
        const bankLip = Math.pow(Math.max(0, t - 0.68) / 0.32, 2) * 0.54;
        let bed = shapedBase - this.creekDepth * channel + bankLip;
        if (t < 0.98) {
            const waterLevel = this.getWaterLevel(z);
            const minBed = waterLevel - Math.max(0.14, this.waterDepth * 0.6);
            bed = Math.min(bed, minBed);
        }
        return bed;
    }

    getWaterLevel(z) {
        const centerX = this.getCreekCenterX(z);
        const base = this.getBaseGroundHeight(centerX, z);
        return base - this.creekDepth + this.waterDepth;
    }

    createGroundSegment(segmentIndex) {
        const rng = seededRandom(segmentIndex * 991 + 47);
        const zStart = segmentIndex * this.segmentLength;
        const zCenter = zStart + this.segmentLength / 2;

        const groundGeometry = new THREE.PlaneGeometry(this.terrainWidth, this.segmentLength, 70, 24);
        const positions = groundGeometry.attributes.position;
        const colors = [];
        const dryColor = new THREE.Color(0.58, 0.6, 0.44);
        const wetColor = new THREE.Color(0.32, 0.4, 0.35);
        const color = new THREE.Color();

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getY(i);
            const worldZ = zCenter - z;
            const worldX = x;
            const height = this.getBedHeight(worldX, worldZ);
            positions.setZ(i, height);

            const centerX = this.getCreekCenterX(worldZ);
            const dist = Math.abs(worldX - centerX);
            const side = worldX < centerX ? -1 : 1;
            const sideWidth = this.getSideWidth(worldZ, side);
            const wetness = THREE.MathUtils.clamp(1 - dist / (sideWidth * 0.52), 0, 1);
            color.copy(dryColor).lerp(wetColor, wetness);
            colors.push(color.r, color.g, color.b);
        }

        groundGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        groundGeometry.computeVertexNormals();

        const ground = new THREE.Mesh(groundGeometry, this.groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, 0, zCenter);
        ground.receiveShadow = true;
        ground.userData.sharedMaterial = true;

        const waterGeometry = new THREE.PlaneGeometry(this.maxCreekWidth, this.segmentLength, 60, 20);
        const waterPositions = waterGeometry.attributes.position;
        for (let i = 0; i < waterPositions.count; i++) {
            const localX = waterPositions.getX(i);
            const localZ = waterPositions.getY(i);
            const worldZ = zCenter - localZ;
            const centerX = this.getCreekCenterX(worldZ);
            const rel = localX / (this.maxCreekWidth * 0.5);
            const side = rel < 0 ? -1 : 1;
            const halfWidth = this.getSideWidth(worldZ, side) * 0.5;
            const waterX = centerX + rel * halfWidth;
            const waterY = this.getWaterLevel(worldZ) + Math.sin(worldZ * 0.3 + rel * 2.3) * 0.015;
            waterPositions.setX(i, waterX);
            waterPositions.setZ(i, waterY);
        }
        const waterNormals = new Float32Array(waterPositions.count * 3);
        for (let i = 0; i < waterPositions.count; i++) {
            waterNormals[i * 3 + 1] = 1;
        }
        waterGeometry.setAttribute('normal', new THREE.BufferAttribute(waterNormals, 3));

        const water = new THREE.Mesh(waterGeometry, this.waterMaterial);
        water.rotation.x = -Math.PI / 2;
        water.position.set(0, 0.02, zCenter);
        water.renderOrder = 1;
        water.receiveShadow = true;
        water.userData.sharedMaterial = true;

        const segmentGroup = new THREE.Group();
        segmentGroup.add(ground, water);

        if (this.debugCreek) {
            const samples = 20;
            const points = [];
            for (let i = 0; i <= samples; i++) {
                const localZ = -this.segmentLength / 2 + (this.segmentLength * i) / samples;
                const worldZ = zCenter - localZ;
                const x = this.getCreekCenterX(worldZ);
                const y = this.getWaterLevel(worldZ) + 0.04;
                points.push(new THREE.Vector3(x, y, worldZ));
            }
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff00ff });
            const line = new THREE.Line(lineGeometry, lineMaterial);
            segmentGroup.add(line);
        }

        const treeCount = (14 + Math.floor(rng() * 12)) * 5;
        for (let i = 0; i < treeCount; i++) {
            const tree = createTree(rng, this.trunkMaterial, this.foliageMaterial);
            const offsetZ = (rng() - 0.5) * this.segmentLength;
            const worldZ = zCenter + offsetZ;
            const centerX = this.getCreekCenterX(worldZ);
            const width = this.getCreekWidth(worldZ);
            const side = rng() > 0.5 ? 1 : -1;
            const bandPick = rng();
            const bandBase = width * 0.55 + (bandPick < 0.7 ? 2 : 8);
            const bandRange = bandPick < 0.7 ? 6 : 12;
            const xSpread = bandBase + rng() * bandRange + (rng() - 0.5) * 1.5;
            const worldX = centerX + side * xSpread;
            const groundHeight = this.getBaseGroundHeight(worldX, worldZ);
            tree.position.set(worldX, groundHeight, worldZ);
            tree.rotation.y = rng() * Math.PI * 2;
            tree.scale.setScalar(0.9 + rng() * 0.5);
            segmentGroup.add(tree);
        }

        const rockCount = 2 + Math.floor(rng() * 3);
        for (let i = 0; i < rockCount; i++) {
            const rockRadius = 1.2 + rng() * 1.6;
            const rock = new THREE.Mesh(createRockGeometry(rockRadius, rng), this.rockMaterial.clone());
            const tint = 0.9 + rng() * 0.15;
            rock.material.color.multiplyScalar(tint);
            const offsetZ = (rng() - 0.5) * this.segmentLength;
            const worldZ = zCenter + offsetZ;
            const centerX = this.getCreekCenterX(worldZ);
            const width = this.getCreekWidth(worldZ);
            const side = rng() > 0.5 ? 1 : -1;
            const xSpread = width + 5 + rng() * 8;
            const worldX = centerX + side * xSpread;
            rock.position.set(worldX, this.getBaseGroundHeight(worldX, worldZ) + 0.1, worldZ);
            rock.rotation.set(rng() * 0.2, rng() * Math.PI * 2, rng() * 0.2);
            rock.castShadow = true;
            rock.receiveShadow = true;
            segmentGroup.add(rock);
        }

        this.scene.add(segmentGroup);
        this.segments.set(segmentIndex, segmentGroup);
    }

    update(cameraZ, deltaTime) {
        const startIndex = Math.floor((cameraZ - this.renderBehind) / this.segmentLength);
        const endIndex = Math.floor((cameraZ + this.lookAhead) / this.segmentLength);

        for (let i = startIndex; i <= endIndex; i++) {
            if (!this.segments.has(i)) {
                this.createGroundSegment(i);
            }
        }

        if (this.waterMaterial.normalMap) {
            const drift = (deltaTime || 0.016) * 0.015;
            this.waterMaterial.normalMap.offset.x = (this.waterMaterial.normalMap.offset.x + drift) % 1;
            this.waterMaterial.normalMap.offset.y = (this.waterMaterial.normalMap.offset.y + drift * 0.6) % 1;
        }

        for (const [index, group] of this.segments) {
            if (index < startIndex - 1 || index > endIndex + 1) {
                group.traverse(child => {
                    if (!(child.isMesh || child.isLine)) return;
                    if (child.geometry) child.geometry.dispose();
                    const material = child.material;
                    const shared = child.userData.sharedMaterial === true;
                    if (!shared && material) {
                        if (Array.isArray(material)) {
                            material.forEach(mat => mat.dispose());
                        } else {
                            material.dispose();
                        }
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
                if (!(child.isMesh || child.isLine)) return;
                if (child.geometry) child.geometry.dispose();
                const material = child.material;
                const shared = child.userData.sharedMaterial === true;
                if (!shared && material) {
                    if (Array.isArray(material)) {
                        material.forEach(mat => mat.dispose());
                    } else {
                        material.dispose();
                    }
                }
            });
            this.scene.remove(group);
        }
        this.segments.clear();
    }
}

export function createEnvironment(scene, assets) {
    return new EnvironmentManager(scene, assets);
}
