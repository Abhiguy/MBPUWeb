import { Shape } from "../shape";
import { MissionElement, MissionElementItem, MisParser } from "../parsing/mis_parser";
import { Vector3 } from "../math/vector3";
import { Quaternion } from "../math/quaternion";
import { Level, TimeState, PHYSICS_TICK_RATE } from "../level";
import { isPressed, normalizedJoystickHandlePosition } from "../input";
import { BlendingType } from "../rendering/renderer";
import { PointLight } from "../rendering/point_light";
import { landMineSmokeParticle, landMineSparksParticle } from "./land_mine";
import { Util } from "../util";

// Thanks to Whirlgig Who had implemented real working tanks. The Port is built from his work.

const BULLET_ARSENAL_SIZE = 10;

/** Tank Bullets are fired from the Tank Gun. Uses RayCast */
export class TankBullet {
	position: Vector3;
	aimAngle: number;
	tank: Tank;
	creationTime: number;
	lifetime = 5000;
	stepTime = 20;
	updateSchedule: number;
	shape: Shape;
	justFired = true; // skip wall collision on first tick to avoid self-hit

	constructor(tank: Tank, aimAngle: number, creationTime: number, shape: Shape) {
		this.tank = tank;
		this.aimAngle = aimAngle;
		this.shape = shape;

		// origin = gun.getTransform() XY = same as tank XY
		// position = VectorAdd(%origin, getWords(VectorScale(%dif,5),0,1) SPC 2.3)
		let gunPos = tank.worldPosition.clone();
		this.position = new Vector3(
			gunPos.x + 3 * Math.cos(aimAngle),
			gunPos.y + 3 * Math.sin(aimAngle),
			2.3
		);
		this.creationTime = creationTime;

		if (this.shape) {
			this.shape.group.scale.set(1, 1, 1);
			this.shape.group.recomputeTransform();
		}

		this.updateSchedule = window.setTimeout(() => this.update(), this.stepTime) as any;
	}

	/** Most Important Primitive, Used to detect the collisions of the Bullets with Interiors, Boards, Targets */
	update() {
		if (!this.tank.level) {
			this.destroy(); return;
		}

		let time = this.tank.level.timeState.currentAttemptTime;
		if (time - this.creationTime > this.lifetime) { this.destroy(); return; }

		let origin = this.position.clone();
		// .mis: %scale = 2 * $stepTime / 50
		let scale = 2 * this.stepTime / 50;
		let dif = new Vector3(
			scale * Math.cos(this.aimAngle),
			scale * Math.sin(this.aimAngle),
			0
		);
		this.position = origin.clone().add(dif);
		this.syncVisual();

		// Wall / interior collision
		if (this.justFired) {
			this.justFired = false;
		} else {
			let dir = dif.clone().normalize();
			let rayLength = dif.length() + 1.0; // extra reach to catch thin walls

			let tankOwnedShapes = new Set<any>();
			for (const b of this.tank.bodies)
				for (const cs of b.shapes) tankOwnedShapes.add(cs);
			if (this.tank.gun)
				for (const b of this.tank.gun.bodies)
					for (const cs of b.shapes) tankOwnedShapes.add(cs);

			let hits = this.tank.level.world.castRay(origin, dir, rayLength);
			let wallHit = hits.find(h => {
				if (h.shape === this.tank.level.marble.shape) return false;
				if (tankOwnedShapes.has(h.shape)) return false;
				let owner = this.findOwnerShape(h.shape);
				if (owner instanceof TankTarget) return false;
				return true;
			});

			if (wallHit) {
				this.explode(this.position.clone());
				let hitGameShape = this.findOwnerShape(wallHit.shape); // Collididng with shapes present in the level
				if (hitGameShape instanceof Boards) {
					hitGameShape.hit();
				}
				this.destroy();
				return;
			}
		}

		// Target collision
		this.checkTargetCollisions(origin, dif);
		if (this.updateSchedule === null) return;

		// Boards collision
		this.checkBoardCollisions(origin);
		if (this.updateSchedule === null) return;

		this.updateSchedule = window.setTimeout(() => this.update(), this.stepTime) as any;
	}

	/** Recursively Find level.shapes to find which game Shape owns a given CollisionShape. */
	findOwnerShape(cs: any): Shape | null {
		for (let gameShape of this.tank.level.shapes) {
			for (let body of gameShape.bodies) {
				if (body.shapes && body.shapes.includes(cs)) return gameShape;
			}
		}
		return null;
	}

	/** The Time when Explosion happens after the bullets hits something.*/
	explode(position: Vector3) {
		let level = this.tank.level;


		level.audio.play('explode1.wav');

		level.particles.createEmitter(bulletFireParticle,   position.clone());
		level.particles.createEmitter(landMineSmokeParticle, position.clone());
		level.particles.createEmitter(landMineSparksParticle, position.clone());
		level.explosionEffect.position.copy(position);
		level.explosionEffect.radius = 6;
		level.explosionEffect.color = { r: 0.5, g: 0.5, b: 0.5 };
		level.explosionEffect.active = true;

		let light = new PointLight(new Vector3(10, 10, 10), position.clone(), 25);
		level.scene.addPointLight(light);
		let elapsed = 0;
		let fadeDuration = 1000;
		let fadeInterval = 50;
		let fade = setInterval(() => {
			elapsed += fadeInterval;
			let t = Math.min(elapsed / fadeDuration, 1);
			light.range = (1 - t) * 25;
			light.color.set((1 - t) * 10, (1 - t) * 10, (1 - t) * 10);
			if (t >= 1) {
				clearInterval(fade);
				let idx = level.scene.pointLights.indexOf(light);
				if (idx > -1) level.scene.pointLights.splice(idx, 1);
			}
		}, fadeInterval);
	}

	/** Explicit sphere check for Tank's Target */
	checkTargetCollisions(origin: Vector3, direction: Vector3) {
		for (let shape of this.tank.level.shapes) {
			if (!(shape instanceof TankTarget) || shape.isDestroyed) continue;

			let toTarget = shape.worldPosition.clone().sub(origin);
			let dist = toTarget.length();

			if (dist < 3) {
				let dot = toTarget.normalize().dot(direction.normalize());
				if (dot > 0) {
					shape.hit();
					this.tank.level.awardTankPoints(10000);
					this.explode(shape.worldPosition.clone());
					this.destroy();
					return;
				}
			}
		}
	}

	/** Explicit sphere check for Bill Boards */
	checkBoardCollisions(origin: Vector3) {
		// Recursively Iterate level.shapes, detecting Boards
		for (let shape of this.tank.level.shapes) {
			if (!(shape instanceof Boards) || shape.isDestroyed) continue;

			let dist = shape.worldPosition.clone().sub(origin).length();
			if (dist < 6) {
				shape.hit();
				this.explode(shape.worldPosition.clone());
				this.destroy();
				return;
			}
		}
	}

	/**
	 * Convert bullet's world position into tank-group local space and update
	 * the borrowed visual shape so it renders at the correct world location.
	 *
	 *   localPos = inv(tankWorldRot) * (bulletWorldPos - tankWorldPos)
	 */
	syncVisual() {
		if (!this.shape || !this.tank) return;

		let relPos = this.position.clone().sub(this.tank.worldPosition);
		relPos.applyQuaternion(this.tank.worldOrientation.clone().invert());

		let bulletWorldRot = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), this.aimAngle);
		let localRot = this.tank.worldOrientation.clone().invert().multiply(bulletWorldRot);

		this.shape.group.position.copy(relPos);
		this.shape.group.orientation.copy(localRot);
		this.shape.group.recomputeTransform();
	}

	destroy() {
		if (this.updateSchedule !== null) {
			clearTimeout(this.updateSchedule as any);
			this.updateSchedule = null;
		}
		// Return visual shape to pool of bullets and hide it
		if (this.shape) {
			this.shape.group.scale.set(0.001, 0.001, 0.001);
			this.shape.group.recomputeTransform();
			this.tank.bulletPool.push(this.shape);
			this.shape = null;
		}
	}
}

/** Target that can be hit by tank bullets */
export class TankTarget extends Shape {
	dtsPath = "shapes/tank/target.dts";
	collideable = false;
	hasNonVisualSequences = true;
	shareNodeTransforms = false;
	isDestroyed = false;
	hitTime = -Infinity;
	mover = false;
	startPosition: Vector3;
	endPosition: Vector3;
	customOffset: Vector3;
	moveT = 0;
	moveSpeed: number;
	moveDirection = 1;
	ambientRotate = false;

	get animationDuration() {
		return this.dts.sequences.length > 0 ? this.dts.sequences[0].duration * 1000 : 0;
	}

	constructor(element: MissionElementItem) {
		super();

		if (element.my_x)
			this.customOffset = new Vector3(MisParser.parseNumber(element.my_x),MisParser.parseNumber(element.my_y),MisParser.parseNumber(element.my_z));
		else
			this.customOffset = new Vector3(0, 0, 0);

		if (!this.mover)
			this.mover = this.customOffset.length() > 0;

		if (element.myspeed)
			this.moveSpeed = MisParser.parseNumber(element.myspeed);
		else
			this.moveSpeed = 2;

		if (element.myspinning)
			this.ambientRotate = MisParser.parseBoolean(element.myspinning);
		else
			this.ambientRotate = false;
	}

	async onLevelStart() {
		this.startPosition = this.worldPosition.clone();
		if (this.mover) {
			this.endPosition = this.startPosition.clone().add(this.customOffset);
		} else {
			this.endPosition = this.startPosition.clone();
		}
		this.moveT = 0;
		this.moveDirection = 1;
	}

	hit() {
		if (this.isDestroyed) return;
		this.isDestroyed = true;
		this.hitTime = this.level.timeState.timeSinceLoad;

		if (this.level.audio) {
			this.level.audio.play('bell.wav');
		}
	}

	tick(time: TimeState, onlyVisual: boolean) {
		if (this.mover) {
			let moveSpeed = this.moveSpeed;
			let distance = this.startPosition.distanceTo(this.endPosition);
			if (distance > 0) {
				this.moveT += (moveSpeed / distance) * this.moveDirection / PHYSICS_TICK_RATE;

				if (this.moveT > 1) {
					this.moveT = 1;
					this.moveDirection = -1;
				} else if (this.moveT < 0) {
					this.moveT = 0;
					this.moveDirection = 1;
				}
				this.worldPosition = this.startPosition.clone().lerp(this.endPosition, this.moveT);
				this.worldMatrix.setPosition(this.worldPosition);
				this.group.position.copy(this.worldPosition);
				this.group.recomputeTransform();

				// Update bodies to match new position for collision detection
				for (let body of this.bodies) {
					body.position.copy(this.worldPosition);
				}
			}
		}
		if (this.dts.sequences.length > 0) {
			let seq = this.dts.sequences[0];
			let completion = 0;

			if (this.isDestroyed) {
				let elapsed = time.timeSinceLoad - this.hitTime; // Elapsed time counter evaluating the time for the destruction animation
				completion = Util.clamp(elapsed / this.animationDuration, 0, 1);
			}

			this.sequenceKeyframeOverride.set(seq, completion * (seq.numKeyframes - 1));
		}
		super.tick(time, onlyVisual);
	}

	reset() {
		super.reset();
		this.isDestroyed = false;
		this.hitTime     = -Infinity;
		if (this.dts.sequences.length > 0) {
			this.sequenceKeyframeOverride.set(this.dts.sequences[0], 0);
		}
		if (this.startPosition) {
			this.worldPosition.copy(this.startPosition);
			this.worldMatrix.setPosition(this.worldPosition);
			this.group.position.copy(this.worldPosition);
			this.group.recomputeTransform();
		}
		if (this.mover) {
			this.moveT = 0;
			this.moveDirection = 1;
		}
	}
}

/** Boards that can be destroyed by tank bullets */
export class Boards extends Shape {
	dtsPath = "shapes/tank/boards.dts";
	collideable = false; // bullets pass through, checkBoardCollisions handles hit detection
	hasNonVisualSequences = true;
	shareNodeTransforms = false;
	isDestroyed = false;
	hitTime = -Infinity;

	get animationDuration() {
		return this.dts.sequences.length > 0 ? this.dts.sequences[0].duration * 1000 : 0;
	}

	constructor(_element: MissionElementItem) {
		super();
	}

	hit() {
		if (this.isDestroyed) return;
		this.isDestroyed = true;
		this.hitTime = this.level.timeState.timeSinceLoad;
		this.setCollisionEnabled(false);
	}

	tick(time: TimeState, onlyVisual: boolean) {
		if (this.dts.sequences.length > 0) {
			let seq = this.dts.sequences[0];
			let completion = 0;

			if (this.isDestroyed) {
				let elapsed = time.timeSinceLoad - this.hitTime;
				completion = Util.clamp(elapsed / this.animationDuration, 0, 1);

				if (completion >= 1) {
					this.setOpacity(0);
				}
			}

			this.sequenceKeyframeOverride.set(seq, completion * (seq.numKeyframes - 1));
		}
		super.tick(time, onlyVisual);
	}

	reset() {
		super.reset();
		this.isDestroyed = false;
		this.hitTime = -Infinity;
		this.setOpacity(1);
		if (this.dts.sequences.length > 0) {
			this.sequenceKeyframeOverride.set(this.dts.sequences[0], 0);
		}
	}
}

/** Tank that the marble can enter and use to shoot targets */
export class Tank extends Shape {
	dtsPath = "shapes/tank/tank_base.dts";
	collideable = false;
	ambientRotate = false;
	gun: Shape;
	bulletPool: Shape[] = [];
	bullets: TankBullet[] = [];
	isActive = false;
	tankYaw = 0;
	tankSpeed = 5;
	tankTurnSpeed = 1.5;
	initialPosition: Vector3;
	initialOrientation: Quaternion;
	initialYaw = 0;
	fireRateDelay = 250;
	savedMarblePosition: Vector3;
	savedMarbleVelocity: Vector3;
	savedGravity: number;
	cannotFireUntil = 0;
	marbleWasOutside = true; // Whether marble had entered the Tank..
	movingSound: any = null;
	lastTankPosition: Vector3;

	constructor(_element: MissionElementItem) {
		super();
	}

	async init(level?: Level, srcElement: MissionElement = null) {
		await super.init(level, srcElement);

		// Gun is added with the Tank Base
		this.gun = new Shape("shapes/tank/tank_gun.dts");
		this.gun.collideable   = false;
		this.gun.ambientRotate = false;
		await this.gun.init(level);
		this.group.add(this.gun.group);
		this.gun.group.position.set(0, 0, 0);
		this.gun.group.orientation.copy(new Quaternion());
		this.gun.group.scale.set(1, 1, 1);
		this.gun.group.recomputeTransform();

		// Bullet Arsenal
		for (let i = 0; i < BULLET_ARSENAL_SIZE; i++) {
			let bullet = new Shape("shapes/tank/bullet.dts");
			bullet.collideable   = false;
			bullet.ambientRotate = false;
			await bullet.init(level);
			this.group.add(bullet.group);
			bullet.group.scale.set(0.001, 0.001, 0.001);
			bullet.group.position.set(0, 0, 0);
			bullet.group.recomputeTransform();
			this.bulletPool.push(bullet);
		}
	}

	async onLevelStart() {
		if (!this.initialPosition) {
			this.initialPosition    = this.worldPosition.clone();
			this.initialOrientation = this.worldOrientation.clone();

			let q = this.initialOrientation;
			this.initialYaw = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
		}
	}

	onMarbleInside(t: number) {
		if (this.isActive) return;
		if (!this.marbleWasOutside) return;
		this.marbleWasOutside = false;
		this.enterTank(t);
		this.level.replay.recordMarbleInside(this);
	}

	onMarbleOutside() {
		if (!this.isActive) this.marbleWasOutside = true;
	}

	enterTank(t: number) {
		this.isActive = true;

		let marble = this.level.marble;
		this.savedMarblePosition = marble.body.position.clone();
		this.savedMarbleVelocity = marble.body.linearVelocity.clone() ?? new Vector3(0, 0, 0);
		this.savedGravity = this.level.defaultGravity;

		marble.body.linearVelocity.set(0, 0, 0);
		this.level.setGravityIntensity(0);

		this.tankYaw = 0;
		this.cannotFireUntil = t;
		this.lastTankPosition = null;
	}

	exitTank() {
		if (!this.isActive) return;
		this.isActive = false;
		this.marbleWasOutside = false;
		setTimeout(() => { this.marbleWasOutside = true; }, 2500);

		let marble = this.level.marble;
		let exitPos = this.worldPosition.clone().add(new Vector3(0, 0, 2.5));
		marble.body.position.copy(exitPos);
		marble.group.position.copy(exitPos);
		marble.group.recomputeTransform();
		marble.body.linearVelocity.set(0, 0, 0);

		if (this.savedGravity !== null) this.level.setGravityIntensity(this.savedGravity);
		marble.body.linearVelocity.z = 10;

		for (const b of this.bullets) b.destroy();
		this.bullets = [];

		if (this.movingSound) {
			this.movingSound.stop();
			this.movingSound = null;
		}
	}

	tick(time: TimeState, onlyVisual = false) {
		super.tick(time, onlyVisual);

		this.updateGunTransform();

		if (!this.isActive) return;

		if (!onlyVisual) {
			this.handleTankMovement();

			if (isPressed('use') && time.currentAttemptTime >= this.cannotFireUntil) {
				this.fire(time.currentAttemptTime);
				this.cannotFireUntil = time.currentAttemptTime + this.fireRateDelay;
			}

			if (isPressed('jump')) this.exitTank();

			for (let i = this.bullets.length - 1; i >= 0; i--) {
				if (this.bullets[i].updateSchedule === null)
					this.bullets.splice(i, 1);
			}
		}
	}

	handleTankMovement() {
		let joy = normalizedJoystickHandlePosition;
		let joyX = joy ? joy.x : 0;
		let joyY = joy ? joy.y : 0;
		let isMobile = Util.isTouchDevice;

		let moveForward  = isPressed('up')   || joyY < -0.2;
		let moveBackward = isPressed('down')  || joyY >  0.2;
		// For touch devices, turning is driven by camera yaw
		let turnLeft  = !isMobile && (isPressed('left')  || joyX < -0.2);
		let turnRight = !isMobile && (isPressed('right') || joyX >  0.2);
		let isMoving  = moveForward || moveBackward || turnLeft || turnRight || (isMobile && (joyX < -0.2 || joyX > 0.2));

		if (isMoving && !this.movingSound) {
			this.movingSound = this.level.audio.createAudioSource('tankmoving.wav');
			this.movingSound.setLoop(true);
			this.movingSound.play();
		} else if (!isMoving && this.movingSound) {
			this.movingSound.stop();
			this.movingSound = null;
		}

		let delta = 1 / 60;

		if (isMobile) {
			// For touch devices, the tank body always faces the camera yaw direction
			this.tankYaw = (this.level.yaw + Math.PI) - this.initialYaw;
		} else {
			if (turnRight) this.tankYaw -= this.tankTurnSpeed * delta;
			if (turnLeft)  this.tankYaw += this.tankTurnSpeed * delta;
		}

		let moveDistance = 0;
		if (moveForward)  moveDistance = -this.tankSpeed * delta;
		if (moveBackward) moveDistance =  this.tankSpeed * delta;

		if (moveDistance !== 0 || turnLeft || turnRight || isMobile) {
			let worldYaw = this.initialYaw + this.tankYaw;
			let tankRotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), worldYaw);
			let moveX = moveDistance * Math.cos(worldYaw);
			let moveY = moveDistance * Math.sin(worldYaw);
			let newPos = this.worldPosition.clone().add(new Vector3(moveX, moveY, 0));
			this.setTransform(newPos, tankRotation, this.worldScale);
		}
	}

	updateGunTransform() {
		if (!this.gun) return;

		let cameraYaw = this.level?.yaw ?? 0;
		let gunWorldAngle = cameraYaw + Math.PI;
		let gunWorldRot = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), gunWorldAngle);

		let tankWorldRotInv = this.worldOrientation.clone().invert();
		let gunLocalRot = tankWorldRotInv.multiply(gunWorldRot);

		this.gun.group.position.set(0, 0, 0);
		this.gun.group.orientation.copy(gunLocalRot);
		this.gun.group.recomputeTransform();
	}

	fire(currentTime: number) {
		if (this.bulletPool.length === 0) return;

		let cameraYaw   = this.level.yaw ?? 0;
		// Gun faces cameraYaw
		let bulletAngle = cameraYaw;

		let bulletShape = this.bulletPool.pop();
		let bullet = new TankBullet(this, bulletAngle, currentTime, bulletShape);
		bullet.syncVisual();
		this.bullets.push(bullet);

		if (this.level.audio) {
			this.level.audio.play('tankfire.wav');
		}
	}

	render(time: TimeState) {
		super.render(time);

		this.updateGunTransform();

		for (let bullet of this.bullets) bullet.syncVisual();

		if (this.isActive) {
			let marble = this.level.marble;
			let newMarblePos = this.worldPosition.clone().add(new Vector3(0, 0, 2.5));
			marble.body.position.copy(newMarblePos);
			marble.group.position.copy(newMarblePos);
			marble.group.recomputeTransform();

			if (this.lastTankPosition) {
				let movement = this.worldPosition.clone().sub(this.lastTankPosition);
				if (movement.length() > 0)
					marble.body.linearVelocity.copy(movement.clone().multiplyScalar(60));
			}
			this.lastTankPosition = this.worldPosition.clone();
		}
	}

	reset() {
		super.reset();

		if (this.isActive) this.exitTank();

		let marble = this.level.marble;
		if (marble) {
			marble.body.linearVelocity.set(0, 0, 0);
			marble.body.angularVelocity.set(0, 0, 0);
			marble.body.orientation.copy(new Quaternion(0, 0, 0, 1));
		}

		if (this.initialPosition && this.initialOrientation) {
			this.setTransform(
				this.initialPosition.clone(),
				this.initialOrientation.clone(),
				this.worldScale.clone()
			);
		}

		this.isActive = false;
		this.tankYaw = 0;
		this.cannotFireUntil = 0;
		this.marbleWasOutside = true;
		this.lastTankPosition = null;

		for (let b of this.bullets) b.destroy();
		this.bullets = [];

		if (this.movingSound) {
			this.movingSound.stop();
			this.movingSound = null;
		}

		if (this.gun) {
			this.gun.group.position.set(0, 0, 0);
			this.gun.group.orientation.copy(new Quaternion());
			this.gun.group.recomputeTransform();
		}
	}

	onReplayPlayback() {
		this.isActive = false;
		for (const b of this.bullets) b.destroy();
		this.bullets = [];
	}
}
/** Fire particle for bullet explosion */
const bulletFireParticle = {
	ejectionPeriod: 0.2,
	ambientVelocity: new Vector3(0, 0, 0),
	ejectionVelocity: 2,
	velocityVariance: 1,
	emitterLifetime: 50,
	inheritedVelFactor: 0.2,
	particleOptions: {
		texture: 'particles/smoke.png',
		blending: BlendingType.Additive,
		spinSpeed: 40,
		spinRandomMin: -90,
		spinRandomMax: 90,
		lifetime: 800,
		lifetimeVariance: 150,
		dragCoefficient: 0.8,
		acceleration: 0,
		colors: [{r: 0.9, g: 0.6, b: 0.1, a: 1}, {r: 0.9, g: 0.3, b: 0.1, a: 0}],
		sizes: [0.4, 0.8],
		times: [0, 1]
	}
};