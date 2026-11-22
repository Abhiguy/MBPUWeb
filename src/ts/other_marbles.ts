import { Shape } from "./shape";
import { TimeState, Level } from "./level";
import { MissionElementStaticShape, MisParser } from "./parsing/mis_parser";
import { Vector3 } from "./math/vector3";
import { Quaternion } from "./math/quaternion";
import { RigidBody, RigidBodyType } from "./physics/rigid_body";
import { BallCollisionShape } from "./physics/collision_shape";
import { Group } from "./rendering/group";
import { Mesh } from "./rendering/mesh";
import { Geometry } from "./rendering/geometry";
import { Material } from "./rendering/material";
import { ResourceManager } from "./resources";
import { AudioSource } from "./audio";
import { Util } from "./util";
/** The Radiuses for the three NPC Marble Spawners.. */
const NPC_MARBLE_RADIUS = {
	PUSH: 0.2,          // Push Marble
	BIG: 0.3,           // Big Marble
	BEACH: 0.5          // Beach Ball Marble
};

/** NPCMarble: A physics-enabled marble that can collide with the player marble and other objects */
export class NPCMarble {
	level: Level;
	group: Group;
	sphere: Mesh;
	body: RigidBody;
	shape: BallCollisionShape;
	worldPosition = new Vector3();
	lastPosition = new Vector3();
	startPosition = new Vector3();
	startRotation = new Quaternion();
	radius: number;
	bounceRestitution = 0.5;
	friction = 1;
	gravityMultiplier = 1; // Gravity acting on each NPC Marble..
	dtsPath = 'shapes/balls/ball-superball.dts';
	marbleName = 'NPC Marble';
	textureUrl = 'shapes/balls/base.marble.png';
	rollingSound: AudioSource;
	previousFrameVel = new Vector3();
	previousFrameAngVel = new Vector3();
	mass = 1; // Default

	constructor(level: Level, radius: number = NPC_MARBLE_RADIUS.PUSH) {
		this.level = level;
		this.radius = radius;
	}

	async init() {
		this.group = new Group();

		// Create the visual sphere
		let geometry = Geometry.createSphereGeometry(1, 32, 16);
		let sphereMaterial = new Material();
		sphereMaterial.diffuseMap = await ResourceManager.getTexture(this.textureUrl); // texture for base NPC
		sphereMaterial.normalizeNormals = true;
		sphereMaterial.flipY = true;

		let sphere = new Mesh(geometry, [sphereMaterial]);
		sphere.castShadows = true;
		this.sphere = sphere;

		// Scale the sphere by the marble radius - directly applied
		sphere.scale.set(this.radius, this.radius, this.radius);
		sphere.recomputeTransform();
		this.group.add(sphere);

		// Create the physics body
		this.body = new RigidBody();
		this.body.type = RigidBodyType.Dynamic;

		// Add collision shape
		let colShape = new BallCollisionShape(this.radius);
		colShape.restitution = this.bounceRestitution;
		colShape.friction = this.friction;
		colShape.mass = this.mass;
		this.body.addCollisionShape(colShape);
		this.shape = colShape;

		// Store initial position
		this.worldPosition.copy(this.body.position);
		this.lastPosition.copy(this.body.position);
		this.startPosition.copy(this.body.position);

		// Load and set up rolling sound
		await this.level.audio.loadBuffers(['rolling_hard.wav', 'bouncehard1.wav', 'bouncehard2.wav', 'bouncehard3.wav', 'bouncehard4.wav']);
		this.rollingSound = this.level.audio.createAudioSource('rolling_hard.wav');
		this.rollingSound.play();
		this.rollingSound.gain.gain.setValueAtTime(0, this.level.audio.currentTime);
		this.rollingSound.setLoop(true);

		// Set up integration callback for gravity handling
		this.body.onBeforeIntegrate = this.onBeforeIntegrate.bind(this);
	}

	onBeforeIntegrate(dt: number) {
		// Apply reduced gravity for lighter marbles
		if (this.gravityMultiplier < 1) {
			// Cancel out the portion of gravity we don't want
			let gravityReduction = (1 - this.gravityMultiplier);
			this.body.linearVelocity.addScaledVector(this.level.world.gravity, -gravityReduction * dt);
		}
	}

	setTransform(position: Vector3, rotation: Quaternion = new Quaternion()) {
		this.body.position.copy(position);
		this.body.orientation.copy(rotation || new Quaternion());
		this.group.position.copy(position);
		this.group.orientation.copy(this.body.orientation);
		this.group.recomputeTransform?.();

		this.worldPosition.copy(position);
		this.startPosition.copy(position);
		this.startRotation.copy(this.body.orientation);
		this.lastPosition.copy(position);
	}

	reset() {
		// Reset to starting position and rotation
		this.body.position.copy(this.startPosition);
		this.body.orientation.copy(this.startRotation);
		this.body.linearVelocity.set(0, 0, 0);
		this.body.angularVelocity.set(0, 0, 0);
		this.group.position.copy(this.startPosition);
		this.group.orientation.copy(this.startRotation);
		this.group.recomputeTransform?.();
		this.worldPosition.copy(this.startPosition);
		this.lastPosition.copy(this.startPosition);
	}

	tick(_time: TimeState) {
		// Check for collisions and handle sounds
		if (this.body.collisions && this.body.collisions.length > 0) {
			let bestCollision = this.findBestCollision(c => c.normal.dot(this.level.currentUp));
			if (bestCollision) {
				let contactNormal = bestCollision.contactNormal;
				let contactShape = bestCollision.contactShape;
				let surfaceRelativeVelocity = this.body.linearVelocity.clone().sub(contactShape.body.linearVelocity);

				// Handle rolling sounds
				if (contactNormal.dot(surfaceRelativeVelocity) < 0.01) {
					let predictedMovement = this.body.angularVelocity.clone().cross(this.level.currentUp).multiplyScalar(1 / Math.PI / 2);

					if (predictedMovement.dot(surfaceRelativeVelocity) < -0.00001 || (predictedMovement.length() > 0.5 && predictedMovement.length() > surfaceRelativeVelocity.length() * 1.5)) {
						// Sliding
						this.rollingSound.gain.gain.setValueAtTime(0, this.level.audio.currentTime);
					} else {
						// Rolling
						let pitch = Util.clamp(surfaceRelativeVelocity.length() / 15, 0, 1) * 0.75 + 0.75;
						this.rollingSound.gain.gain.linearRampToValueAtTime(Util.clamp(pitch - 0.75, 0, 1), this.level.audio.currentTime + 0.02);
						this.rollingSound.setPlaybackRate(pitch);
					}
				} else {
					// no rolling sound when falling or in air..Heh..
					this.rollingSound.gain.gain.linearRampToValueAtTime(0, this.level.audio.currentTime + 0.02);
				}
			}
		} else {
			// No collision, fade out rolling sound
			this.rollingSound.gain.gain.linearRampToValueAtTime(0, this.level.audio.currentTime + 0.02);
		}

		// Update visual position and rotation from physics body
		this.group.position.copy(this.body.position);
		this.group.orientation.copy(this.body.orientation);
		this.group.recomputeTransform?.();
		this.worldPosition.copy(this.body.position);

		// Store current velocity for next frame's impact detection
		this.previousFrameVel.copy(this.body.linearVelocity);
		this.previousFrameAngVel.copy(this.body.angularVelocity);
	}

	findBestCollision(scoreFn: (collision: any) => number) {
		let bestCollision: any = null;
		let bestScore = -Infinity;

		if (!this.body.collisions) return null;

		for (let collision of this.body.collisions) {
			let score = scoreFn(collision);
			if (score > bestScore) {
				bestScore = score;
				bestCollision = collision;
			}
		}

		if (!bestCollision) return null;

		// Extract contact normal and shape
		let contactNormal = bestCollision.normal.clone();
		let contactShape = bestCollision.s2;

		// Flip normal
		if (bestCollision.s1 !== this.shape) {
			contactNormal.negate();
		}

		return { collision: bestCollision, contactNormal, contactShape };
	}

	remove() {
		if (this.group?.parent) {
			this.group.parent.remove(this.group);
		}
	}
}

/** The Push Marble NPC marble Spawner */
export class SpawnPushMarble extends Shape {
	dtsPath = 'shapes/balls/ball-superball.dts';
	hasNonVisualSequences = false;
	shareNodeTransforms = false;
	npcMarble: NPCMarble;

	setTransform() {}

	reset() {
		if (this.npcMarble) {
			this.npcMarble.reset();
		}
	}

	async init(level: Level, element: MissionElementStaticShape) {
		// we don't call super.init()..spawner shape has no physics
		this.level = level;
		this.group = new Group();

		// Parse element position directly
		let position = MisParser.parseVector3(element.position);
		let rotation = MisParser.parseRotation(element.rotation);

		// Create the NPC marble
		this.npcMarble = new NPCMarble(level, NPC_MARBLE_RADIUS.PUSH);
		this.npcMarble.marbleName = 'Push Marble';
		this.npcMarble.textureUrl = 'shapes/balls/push.marble.png';
		await this.npcMarble.init();

		// Add to scene
		level.scene.add(this.npcMarble.group);

		// Add physics body to world for collisions and movement
		level.world.add(this.npcMarble.body);

		// Set initial position from parsed element coordinates
		this.npcMarble.setTransform(position, rotation);

		// Empty bodies array, spawner itself has no physics
		this.bodies = [];
		this.colliders = [];
	}

	tick(time: TimeState, onlyVisual: boolean) {
		if (this.npcMarble && !onlyVisual) {
			this.npcMarble.tick(time);
		}
	}

	render(_time: TimeState) {
		if (this.npcMarble) {
			this.npcMarble.group.position.copy(this.npcMarble.body.position);
			this.npcMarble.group.orientation.copy(this.npcMarble.body.orientation);
			this.npcMarble.group.recomputeTransform?.();
			this.npcMarble.worldPosition.copy(this.npcMarble.body.position);
		}
	}
}

/**  The big Marble NPC marble Spawner*/
export class SpawnBigMarble extends Shape {
	dtsPath = 'shapes/balls/ball-big.dts';
	hasNonVisualSequences = false;
	shareNodeTransforms = false;
	npcMarble: NPCMarble;

	setTransform() {} // Just a call..

	reset() {
		if (this.npcMarble) {
			this.npcMarble.reset();
		}
	}

	async init(level: Level, element: MissionElementStaticShape) {
		// We don't call super.init()..spawner shape has no physics
		this.level = level;
		this.group = new Group();

		// Parse element position directly
		let position = MisParser.parseVector3(element.position);
		let rotation = MisParser.parseRotation(element.rotation);

		// Create the NPC marble
		this.npcMarble = new NPCMarble(level, NPC_MARBLE_RADIUS.BIG);
		this.npcMarble.marbleName = 'Big Marble';
		this.npcMarble.textureUrl = 'shapes/balls/push.marble.png';
		this.npcMarble.mass = 2; // slightly heavier than player marble
		await this.npcMarble.init();

		// Add to scene
		level.scene.add(this.npcMarble.group);

		// Add physics body to world for collisions and movement
		level.world.add(this.npcMarble.body);

		// Set initial position from parsed element coordinates
		this.npcMarble.setTransform(position, rotation);

		// Empty bodies array, spawner itself has no physics
		this.bodies = [];
		this.colliders = [];
	}

	tick(time: TimeState, onlyVisual: boolean) {
		if (this.npcMarble && !onlyVisual) {
			this.npcMarble.tick(time);
		}
	}

	render(_time: TimeState) {
		if (this.npcMarble) {
			this.npcMarble.group.position.copy(this.npcMarble.body.position);
			this.npcMarble.group.orientation.copy(this.npcMarble.body.orientation);
			this.npcMarble.group.recomputeTransform?.();
			this.npcMarble.worldPosition.copy(this.npcMarble.body.position);
		}
	}
}

/** The beach ball NPC marble Spawner*/
export class SpawnBeachBallMarble extends Shape {
	dtsPath = 'shapes/balls/ball-beach.dts';
	hasNonVisualSequences = false;
	shareNodeTransforms = false;
	npcMarble: NPCMarble;

	setTransform() {}

	reset() {
		if (this.npcMarble) {
			this.npcMarble.reset();
		}
	}

	async init(level: Level, element: MissionElementStaticShape) {
		// spawner shape has no physics
		this.level = level;
		this.group = new Group();

		// Parse element position directly
		let position = MisParser.parseVector3(element.position);
		let rotation = MisParser.parseRotation(element.rotation);

		// Create the NPC marble
		this.npcMarble = new NPCMarble(level, NPC_MARBLE_RADIUS.BEACH);
		this.npcMarble.marbleName = 'Beach Ball Marble';
		this.npcMarble.textureUrl = 'shapes/balls/beachball.marble.png';
		this.npcMarble.mass = 0.5;
		this.npcMarble.bounceRestitution = 0.78; // For now this should fit...
		this.npcMarble.friction = 0.3;
		this.npcMarble.gravityMultiplier = 0.25; // Beach Ball is half as massive...
		await this.npcMarble.init();

		// Add to scene
		level.scene.add(this.npcMarble.group);

		// Add physics body to world for collisions and movement
		level.world.add(this.npcMarble.body);

		// Set initial position from parsed element coordinates
		this.npcMarble.setTransform(position, rotation);

		// Empty bodies array, spawner itself has no physics
		this.bodies = [];
		this.colliders = [];
	}

	tick(time: TimeState, onlyVisual: boolean) {
		if (this.npcMarble && !onlyVisual) {
			this.npcMarble.tick(time);
		}
	}

	render(_time: TimeState) {
		if (this.npcMarble) {
			this.npcMarble.group.position.copy(this.npcMarble.body.position);
			this.npcMarble.group.orientation.copy(this.npcMarble.body.orientation);
			this.npcMarble.group.recomputeTransform?.();
			this.npcMarble.worldPosition.copy(this.npcMarble.body.position);
		}
	}
}