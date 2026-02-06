import * as THREE from 'three';

export class PlayerCamera {
    constructor(camera) {
        this.camera = camera;
        this.currentStoneIndex = 0;

        // Camera positioning
        this.heightAboveStone = 1.6; // Eye level height
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

    setTargetStone(stone) {
        const stonePos = stone.position;
        const stoneIndex = stone.userData.index;

        this.currentStoneIndex = stoneIndex;

        // Position camera above and slightly behind the stone
        this.targetPosition.set(
            stonePos.x * 0.3, // Reduce horizontal sway for comfort
            stonePos.y + this.heightAboveStone,
            stonePos.z - this.behindStone
        );

        // Look ahead along the path
        this.targetLookAt.set(
            stonePos.x * 0.1, // Slight bias toward center
            stonePos.y + 0.3,
            stonePos.z + this.lookAheadDistance
        );

        // Update camera Z for stone generation/culling
        this.targetCameraZ = stonePos.z;
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

        // Reset to starting position
        this.camera.position.set(0, this.heightAboveStone, -1);
        this.targetPosition.set(0, this.heightAboveStone, -1);
        this.targetLookAt.set(0, 0.5, 10);
        this.currentLookAt.set(0, 0.5, 10);
        this.positionVelocity.set(0, 0, 0);
        this.lookVelocity.set(0, 0, 0);
        this.cameraZVelocity = 0;
        this.camera.lookAt(this.currentLookAt);
    }
}
