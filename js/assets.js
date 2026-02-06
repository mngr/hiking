import * as THREE from 'three';

const ROCK_TEXTURES = {
    diff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rocky_terrain_02/rocky_terrain_02_diff_1k.jpg',
    normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rocky_terrain_02/rocky_terrain_02_nor_gl_1k.jpg',
    rough: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rocky_terrain_02/rocky_terrain_02_rough_1k.jpg'
};

const WATER_NORMAL = 'https://threejs.org/examples/textures/waternormals.jpg';

export class AssetManager {
    constructor(renderer) {
        THREE.Cache.enabled = true;
        this.renderer = renderer;
        this.loader = new THREE.TextureLoader();
        this.loader.crossOrigin = 'anonymous';
        this.maxAnisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;

        this.rockSet = this.loadTextureSet(ROCK_TEXTURES, 1.6);
        this.groundSet = this.loadTextureSet(ROCK_TEXTURES, 5.5);
        this.waterNormal = this.loadTexture(WATER_NORMAL, 3.0, false);

        this.groundMaterial = new THREE.MeshStandardMaterial({
            color: 0xe2d7b0,
            map: this.groundSet.map,
            normalMap: this.groundSet.normalMap,
            roughnessMap: this.groundSet.roughnessMap,
            roughness: 0.95,
            metalness: 0,
            vertexColors: true
        });

        this.rockMaterial = new THREE.MeshStandardMaterial({
            map: this.rockSet.map,
            normalMap: this.rockSet.normalMap,
            roughnessMap: this.rockSet.roughnessMap,
            roughness: 0.9,
            metalness: 0.05
        });

        this.waterMaterial = new THREE.MeshStandardMaterial({
            color: 0x3ad2ea,
            roughness: 0.12,
            metalness: 0.08,
            transparent: true,
            opacity: 0.8
        });
        this.waterMaterial.depthWrite = false;
        this.waterMaterial.normalMap = this.waterNormal;
        this.waterMaterial.normalScale = new THREE.Vector2(0.45, 0.45);

        this.trunkMaterial = new THREE.MeshStandardMaterial({
            color: 0x6b4a2d,
            roughness: 0.9,
            metalness: 0
        });

        this.foliageMaterial = new THREE.MeshStandardMaterial({
            color: 0x3f5f3a,
            roughness: 0.9,
            metalness: 0,
            vertexColors: true
        });
    }

    loadTexture(url, repeat, isColor = true) {
        const texture = this.loader.load(url);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeat, repeat);
        if (isColor) {
            texture.colorSpace = THREE.SRGBColorSpace;
        }
        texture.anisotropy = this.maxAnisotropy;
        return texture;
    }

    loadTextureSet(urls, repeat) {
        return {
            map: this.loadTexture(urls.diff, repeat, true),
            normalMap: this.loadTexture(urls.normal, repeat, false),
            roughnessMap: this.loadTexture(urls.rough, repeat, false)
        };
    }

    createStoneMaterial(color) {
        const material = this.rockMaterial.clone();
        material.color.copy(color);
        material.vertexColors = true;
        return material;
    }
}
