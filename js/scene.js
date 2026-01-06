import * as THREE from 'three';

export function createScene() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87CEEB, 50, 200);
    return scene;
}

export function createCamera() {
    const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        500
    );
    // First-person: start above and behind the first stone
    camera.position.set(0, 1.6, -1);
    camera.lookAt(0, 0.5, 10);
    return camera;
}

export function createRenderer() {
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    document.body.insertBefore(renderer.domElement, document.body.firstChild);

    return renderer;
}

export function createLighting(scene) {
    // Ambient light - soft overall illumination
    const ambientLight = new THREE.AmbientLight(0x6699CC, 0.4);
    scene.add(ambientLight);

    // Hemisphere light - natural sky-ground gradient
    const hemiLight = new THREE.HemisphereLight(
        0x87CEEB, // Sky blue
        0x3D2817, // Earth brown
        0.5
    );
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    // Directional light - sun with shadows
    const sunLight = new THREE.DirectionalLight(0xFFFAE5, 1.5);
    sunLight.position.set(30, 80, 40);
    sunLight.castShadow = true;

    // Shadow camera setup for good coverage
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.bias = -0.0001;
    sunLight.shadow.normalBias = 0.02;

    scene.add(sunLight);

    return { ambientLight, hemiLight, sunLight };
}

export function handleResize(camera, renderer) {
    const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', onResize);
    return onResize;
}
