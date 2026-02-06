import * as THREE from 'three';

export class PlayerCamera {
    constructor(camera, environment) {
        this.camera = camera;
        this.environment = environment;
        this.currentStoneIndex = 0;

        // Camera positioning
        this.heightAboveStone = 1.45; // Eye level height
        this.behindStone = 0.3; // Camera offset behind current stone
        this.lookAheadDistance = 8; // How far ahead to look

        // Smooth movement (matching original game feel)
        this.cameraSpeed = 0.05;
        this.springStiffness = 42;
        this.springDamping = 10;
        this.lookStiffness = 38;
        this.lookDamping = 9;
        this.zStiffness = 36;
        this.zDamping = 11;

        // Target and current positions
        this.targetPosition = new THREE.Vector3(0, this.heightAboveStone, -1);
        this.targetLookAt = new THREE.Vector3(0, 0.5, 10);
        this.currentLookAt = new THREE.Vector3(0, 0.5, 10);

        this.positionVelocity = new THREE.Vector3();
        this.lookVelocity = new THREE.Vector3();
        this.cameraZVelocity = 0;
        this.tempVec = new THREE.Vector3();

        // Camera Z for stone management
        this.cameraZ = 0;
        this.targetCameraZ = 0;
    }

    setTargetStone(stone, immediate = false) {
        const stonePos = stone.position;
        const stoneIndex = stone.userData.index;
        const creekX = this.environment ? this.environment.getCreekCenterX(stonePos.z) : 0;
        const followX = THREE.MathUtils.lerp(creekX, stonePos.x, 0.6);

        this.currentStoneIndex = stoneIndex;

        // Position camera above and slightly behind the stone
        this.targetPosition.set(
            followX,
            stonePos.y + this.heightAboveStone,
            stonePos.z - this.behindStone
        );

        // Look ahead along the path
        const lookZ = stonePos.z + this.lookAheadDistance;
        const lookCreekX = this.environment ? this.environment.getCreekCenterX(lookZ) : creekX;
        this.targetLookAt.set(
            THREE.MathUtils.lerp(lookCreekX, stonePos.x, 0.35),
            stonePos.y + 0.2,
            lookZ
        );

        // Update camera Z for stone generation/culling
        this.targetCameraZ = stonePos.z;

        if (immediate) {
            this.camera.position.copy(this.targetPosition);
            this.currentLookAt.copy(this.targetLookAt);
            this.camera.lookAt(this.currentLookAt);
            this.positionVelocity.set(0, 0, 0);
            this.lookVelocity.set(0, 0, 0);
            this.cameraZ = this.targetCameraZ;
            this.cameraZVelocity = 0;
        }
    }

    update(deltaTime) {
        const dt = Math.min(deltaTime, 0.05);

        // Spring-based motion for more natural stepping
        this.tempVec.subVectors(this.targetPosition, this.camera.position);
        this.positionVelocity.addScaledVector(this.tempVec, this.springStiffness * dt);
        this.positionVelocity.multiplyScalar(Math.exp(-this.springDamping * dt));
        this.camera.position.addScaledVector(this.positionVelocity, dt);

        this.tempVec.subVectors(this.targetLookAt, this.currentLookAt);
        this.lookVelocity.addScaledVector(this.tempVec, this.lookStiffness * dt);
        this.lookVelocity.multiplyScalar(Math.exp(-this.lookDamping * dt));
        this.currentLookAt.addScaledVector(this.lookVelocity, dt);
        this.camera.lookAt(this.currentLookAt);

        // Update camera Z (used for stone management)
        const dz = this.targetCameraZ - this.cameraZ;
        this.cameraZVelocity += dz * this.zStiffness * dt;
        this.cameraZVelocity *= Math.exp(-this.zDamping * dt);
        this.cameraZ += this.cameraZVelocity * dt;
    }

    getCurrentStoneIndex() {
        return this.currentStoneIndex;
    }

    getCameraZ() {
        return this.cameraZ;
    }

    reset() {
        this.currentStoneIndex = 0;
        this.cameraZ = 0;
        this.targetCameraZ = 0;

        const startX = this.environment ? this.environment.getCreekCenterX(0) : 0;

        // Reset to starting position
        this.camera.position.set(startX, this.heightAboveStone, -1);
        this.targetPosition.set(startX, this.heightAboveStone, -1);
        this.targetLookAt.set(startX, 0.5, 10);
        this.currentLookAt.set(startX, 0.5, 10);
        this.positionVelocity.set(0, 0, 0);
        this.lookVelocity.set(0, 0, 0);
        this.cameraZVelocity = 0;
        this.camera.lookAt(this.currentLookAt);
    }
}
