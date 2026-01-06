import * as THREE from 'three';

export function createWater(scene) {
    // Large water plane extending into the distance
    const waterGeometry = new THREE.PlaneGeometry(100, 500, 50, 50);

    // Add some subtle wave-like displacement
    const positions = waterGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const wave = Math.sin(x * 0.5) * 0.03 + Math.sin(z * 0.3) * 0.02;
        positions.setZ(i, wave);
    }
    waterGeometry.computeVertexNormals();

    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x1A5276,
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.85
    });

    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.3;
    water.position.z = 200; // Extend forward
    water.receiveShadow = true;

    scene.add(water);
    return water;
}

export function createRiverbanks(scene) {
    const bankMaterial = new THREE.MeshStandardMaterial({
        color: 0x3D2817,
        roughness: 0.9,
        metalness: 0.1
    });

    const banks = [];

    // Create riverbanks on both sides
    [-1, 1].forEach(side => {
        const bankGeometry = new THREE.BoxGeometry(30, 3, 500);

        const bank = new THREE.Mesh(bankGeometry, bankMaterial);
        bank.position.set(side * 22, 0, 200);
        bank.receiveShadow = true;
        bank.castShadow = true;

        scene.add(bank);
        banks.push(bank);
    });

    // Add some grass on top of banks
    const grassMaterial = new THREE.MeshStandardMaterial({
        color: 0x2E7D32,
        roughness: 0.8,
        metalness: 0
    });

    [-1, 1].forEach(side => {
        const grassGeometry = new THREE.BoxGeometry(30, 0.3, 500);
        const grass = new THREE.Mesh(grassGeometry, grassMaterial);
        grass.position.set(side * 22, 1.65, 200);
        grass.receiveShadow = true;
        scene.add(grass);
        banks.push(grass);
    });

    return banks;
}

export function createSky(scene) {
    // Gradient sky dome
    const skyGeometry = new THREE.SphereGeometry(400, 32, 15);

    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x0077ff) },
            bottomColor: { value: new THREE.Color(0xADD8E6) },
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
        color: 0x4A5568,
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

export function createEnvironment(scene) {
    const water = createWater(scene);
    const banks = createRiverbanks(scene);
    const sky = createSky(scene);

    return { water, banks, sky };
}
