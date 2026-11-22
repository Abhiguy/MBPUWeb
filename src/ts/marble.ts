import { ResourceManager } from "./resources";
import { isPressed, gamepadAxes, normalizedJoystickHandlePosition, getPressedFlag } from "./input";
import { TimeState, Level, GO_TIME, PHYSICS_TICK_RATE } from "./level";
import { Shape } from "./shape";
import { Util } from "./util";
import { AudioSource } from "./audio";
import { MisParser, MissionElementType } from "./parsing/mis_parser";
import { ParticleEmitter, ParticleEmitterOptions } from "./particles";
import { state } from "./state";
import { StorageManager } from "./storage";
import { getMarbleDefinition } from "./marble_definitions";
import { Group } from "./rendering/group";
import { Geometry } from "./rendering/geometry";
import { Material } from "./rendering/material";
import { Texture } from "./rendering/texture";
import { Mesh } from "./rendering/mesh";
import { CubeTexture } from "./rendering/cube_texture";
import { CubeCamera } from "./rendering/cube_camera";
import { PointLight } from "./rendering/point_light";
import { RigidBody } from "./physics/rigid_body";
import { BallCollisionShape } from "./physics/collision_shape";
import { Collision } from "./physics/collision";
import { Vector3 } from "./math/vector3";
import { Quaternion } from "./math/quaternion";
import { Euler } from "./math/euler";
import { BlendingType } from "./rendering/renderer";

const DEFAULT_RADIUS = 0.2;
const ULTRA_RADIUS = 0.3;
const MEGA_MARBLE_RADIUS = 0.6666;
/** DTS shapes that declare more than one material (e.g. ball-madness's separate "cyan" base and
 *  "yellow" subtractive dot pattern). These should NOT have their per-material textures collapsed
 *  down to the single marble_definitions.ts skin texture — each material needs to keep resolving
 *  to its own file by name so multi-layer patterns render correctly. */
export const MULTI_MATERIAL_MARBLE_DTS = new Set<string>([
	'shapes/balls/ball-madness.dts',
	'shapes/balls/ball-madness2.dts'
]);
// @ts-expect-error Deliberately constant
export const MARBLE_ROLL_FORCE = 40 || 40; // eslint-disable-line no-constant-binary-expression
const TELEPORT_FADE_DURATION = 500;

export const bounceParticleOptions: ParticleEmitterOptions = {
	ejectionPeriod: 1,
	ambientVelocity: new Vector3(0, 0, 0),
	ejectionVelocity: 2.6,
	velocityVariance: 0.25 * 0.5,
	emitterLifetime: 3, // Spawn 4 particles
	inheritedVelFactor: 0,
	particleOptions: {
		texture: 'particles/star.png',
		blending: BlendingType.Normal,
		spinSpeed: 90,
		spinRandomMin: -90,
		spinRandomMax: 90,
		lifetime: 500,
		lifetimeVariance: 100,
		dragCoefficient: 0.5,
		acceleration: -2,
		colors: [{ r: 0.9, g: 0, b: 0, a: 1 }, { r: 0.9, g: 0.9, b: 0, a: 1 }, { r: 0.9, g: 0.9, b: 0, a: 0 }],
		sizes: [0.25, 0.25, 0.25],
		times: [0, 0.75, 1]
	}
};

const blastParticleOptions: ParticleEmitterOptions = {
	ejectionPeriod: 0.9,
	ambientVelocity: new Vector3(0, 0, -0.3),
	ejectionVelocity: 3,
	velocityVariance: 0.4,
	emitterLifetime: 300,
	inheritedVelFactor: 0.25,
	particleOptions: {
		texture: 'particles/smoke.png',
		blending: BlendingType.Additive,
		spinSpeed: 20,
		spinRandomMin: -90,
		spinRandomMax: 90,
		lifetime: 600,
		lifetimeVariance: 250,
		dragCoefficient: 0.2,
		acceleration: -0.1,
		colors: [{ r: 25 / 255, g: 244 / 255, b: 255 / 255, a: 0.2 }, { r: 25 / 255, g: 244 / 255, b: 255 / 255, a: 1 }, { r: 25 / 255, g: 244 / 255, b: 255 / 255, a: 1 }, { r: 25 / 255, g: 244 / 255, b: 255 / 255, a: 0 }],
		sizes: [0.1, 0.1, 0.1],
		times: [0, 0.2, 0.75, 1]
	}
};
/** The fire particle. */
const landMineParticle = {
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
		lifetime: 1000,
		lifetimeVariance: 150,
		dragCoefficient: 0.8,
		acceleration: 0,
		colors: [{ r: 0.56, g: 0.36, b: 0.26, a: 1 }, { r: 0.56, g: 0.36, b: 0.26, a: 0 }],
		sizes: [0.5, 1],
		times: [0, 1]
	}
};
/** The smoke particle. */
export const landMineSmokeParticle = {
	ejectionPeriod: 0.5,
	ambientVelocity: new Vector3(0, 0, 0),
	ejectionVelocity: 0.8,
	velocityVariance: 0.4,
	emitterLifetime: 50,
	inheritedVelFactor: 0.25,
	particleOptions: {
		texture: 'particles/smoke.png',
		blending: BlendingType.Normal,
		spinSpeed: 40,
		spinRandomMin: -90,
		spinRandomMax: 90,
		lifetime: 1200,
		lifetimeVariance: 300,
		dragCoefficient: 0.85,
		acceleration: -8,
		colors: [{ r: 0.56, g: 0.36, b: 0.26, a: 1 }, { r: 0.2, g: 0.2, b: 0.2, a: 1 }, { r: 0, g: 0, b: 0, a: 0 }],
		sizes: [1, 1.5, 2],
		times: [0, 0.5, 1]
	}
};
/** The sparks exploding away. */
export const landMineSparksParticle = {
	ejectionPeriod: 0.4,
	ambientVelocity: new Vector3(0, 0, 0),
	ejectionVelocity: 13 / 4,
	velocityVariance: 6.75 / 4,
	emitterLifetime: 100,
	inheritedVelFactor: 0.2,
	particleOptions: {
		texture: 'particles/spark.png',
		blending: BlendingType.Additive,
		spinSpeed: 40,
		spinRandomMin: -90,
		spinRandomMax: 90,
		lifetime: 500,
		lifetimeVariance: 350,
		dragCoefficient: 0.75,
		acceleration: -8,
		colors: [{ r: 0.6, g: 0.4, b: 0.3, a: 1 }, { r: 0.6, g: 0.4, b: 0.3, a: 1 }, { r: 1, g: 0.4, b: 0.3, a: 0 }],
		sizes: [0.5, 0.25, 0.25],
		times: [0, 0.5, 1]
	}
};
const blastMaxParticleOptions = ParticleEmitter.cloneOptions(blastParticleOptions);
blastMaxParticleOptions.ejectionVelocity = 4;
blastMaxParticleOptions.ejectionPeriod = 0.7;
blastMaxParticleOptions.particleOptions.dragCoefficient = 0.3;
blastMaxParticleOptions.particleOptions.colors = blastMaxParticleOptions.particleOptions.colors.map(x => { x.r = 255 / 255; x.g = 159 / 255; x.b = 25 / 255; return x; });
const goldTrailParticleOptions: ParticleEmitterOptions = {
	ejectionPeriod: 1,
	ambientVelocity: new Vector3(0, 0, 1.5),
	ejectionVelocity: 0.1,//0.8
	velocityVariance: 1.5,//0.3
	emitterLifetime: 1,
	inheritedVelFactor: 0.05,
	particleOptions: {
		texture: 'particles/star.png',
		blending: BlendingType.Normal,
		spinSpeed: 120,
		spinRandomMin: -180,
		spinRandomMax: 180,
		lifetime: 800,
		lifetimeVariance: 200,
		dragCoefficient: 0.1,
		acceleration: 8,
		gravityCoefficient: 1.05,
		colors: [
			{ r: 1, g: 0.4, b: 0, a: 0 },
			{ r: 1, g: 0.4, b: 0, a: 1 },
			{ r: 1, g: 0.4, b: 0, a: 1 },
			{ r: 1, g: 0.4, b: 0, a: 0 }
		],
		sizes: [0.05, 0.12, 0.12, 0.05],
		times: [0, 0.1, 0.6, 1.0]
	}
};

/** Controls marble behavior and responds to player input. */
export class Marble {
	level: Level;
	group: Group;
	innerGroup: Group;
	sphere: Mesh;
	ballShape: Shape;
	/** The predicted position of the marble in the next tick. */
	predictedPosition = new Vector3();
	/** The predicted orientation of the marble in the next tick. */
	predictedOrientation = new Quaternion();
	/** Original Gravity of marble */
	oldGravity: Vector3;

	body: RigidBody;
	/** Main collision shape of the marble. */
	shape: BallCollisionShape;
	/** First auxiliary collision shape of the marble; being twice as big as the normal shape, it's responsible for colliding with shapes such as gems and power-ups. */
	largeAuxShape: BallCollisionShape;
	/** Second auxiliary collision shape of the marble; is responsible for colliding with triggers. */
	smallAuxShape: BallCollisionShape;

	/** The radius of the marble. */
	radius: number = null;
	/** The default jump impulse of the marble. */
	jumpImpulse = 0 || 7.5; // eslint-disable-line no-constant-binary-expression -- For now, seems to fit more than the "actual" 7.5.
	/** The unmodified base jump impulse (used to apply/remove powerup modifiers reliably) */
	baseJumpImpulse = this.jumpImpulse;
	/** Last jump impulse value applied by powerup logic (so other systems can temporarily override) */
	lastAppliedPowerupJumpImpulse: number = null;
	/** The default restitution of the marble. */
	bounceRestitution = 0.5;
	worldPosition = new Vector3();
	lastPosition = new Vector3();

	get speedFac() {
		return DEFAULT_RADIUS / this.radius;
	}

	/** Forcefield around the player shown during super bounce and shock absorber usage. */
	forcefield: Shape;
	/** OilImage around the player shown during oil usage. */
	oilimage: Shape;
	/** GlueImage around the player shown during glue usage. */
	glueimage: Shape;
	/** Helicopter shown above the marble shown during gyrocopter usage. */
	helicopter: Shape;
	/** Airplane shown above the marble shown during flight. */
	airplaneimage: Shape;
	/** The plane flying */
	isFlyingPlane = false;
	/** Point light spawned at crash position, fades out like landmine explosion light */
	planeCrashLight: PointLight;
	/** timeSinceLoad at the moment of crash, used to drive the fade */
	planeCrashTime = -Infinity;
	/** iceImage around the player shown when marble passed over an ice Slick */
	iceimage: Shape;

	superBounceEnableTime = -Infinity;
	superBounceEnableTimex2 = -Infinity;
	shockAbsorberEnableTime = -Infinity;
	shockAbsorberEnableTimex2 = -Infinity;
	helicopterEnableTime = -Infinity;
	helicopterEnableTimex2 = -Infinity;
	oilEnableTime = -Infinity;
	glueEnableTime = -Infinity;
	metalEnableTime = -Infinity;
	paperEnableTime = -Infinity;
	iceEnableTime = -Infinity;
	megaMarbleEnableTime = -Infinity;
	helicopterSound: AudioSource = null;
	shockAbsorberSound: AudioSource = null;
	superBounceSound: AudioSource = null;
	oilSound: AudioSource = null;
	glueSound: AudioSource = null;
	airplaneSound: AudioSource = null;
	metalSound: AudioSource = null;

	// Barrel roll state
	/** Current roll angle in radians (0 → 2π during an active roll). */
	barrelRollAngle = 0;
	/** True while a barrel roll is in progress. */
	barrelRollActive = false;
	/** Timestamp of the last use/powerup press, used for double-press detection. */
	lastUsePressTime = -Infinity;
	/** How long (ms) between two presses counts as a double-press. */
	readonly BARREL_ROLL_DOUBLE_PRESS_WINDOW = 400;
	/** Duration (ms) of one full 360° barrel roll. */
	readonly BARREL_ROLL_DURATION = 700;
	lastUseWasPressed = false;
	paperSound: AudioSource = null;
	teleportEnableTime: number;
	teleportDisableTime: number;
	doubler = false;
	timetravel = false;
	metal = false;
	paper = false;
	revealer = false;

	/** For Handling How long Gyrocopter lasts-- Default (5000ms) */
	gyrocopterTime = 5000;
	/** Gyrocopter's Air acceleration -- Default (5) */
	airAcceleration = 5;
	/** For handling Gyrocopter's Gravity Intensity Multiplier -- Default (1/4th of default gravity (20)) or 0.25 times the level's gravity */
	gyrocopterGravityMultiplier = 0.25;
	/** For Handling how long Super Bounce lasts-- Default (5000ms) */
	superBounceTime = 5000;
	/** For Handling Super Bounce's  Bounce Restitution -- Default (0.9) */
	superBounceBounceRestitution = 0.9;
	/** For Handling how long Shock Absorber lasts-- Default (5000ms) */
	shockAbsorberTime = 5000;
	/** For Handling how long glue is active-- Default (5000ms) */
	glueTime = 5000;
	/** For Handling how long metal is active-- Default (5000ms) */
	metalTime = 5000;
	/** For Handling how long paper is active-- Default (5000ms) */
	paperTime = 5000;

	lastMovementVec = new Vector3();
	beforeVel = new Vector3();
	beforeAngVel = new Vector3();
	/** Necessary for super speed. */
	lastContactNormal = new Vector3();
	slidingTimeout = 0;

	rollingSound: AudioSource;
	rollingMegaMarbleSound: AudioSource;
	rollingMetalSound: AudioSource;
	rollingPaperSound: AudioSource;
	slidingSound: AudioSource;

	cubeMap: CubeTexture;
	cubeCamera: CubeCamera;

	airjumpAllowed = true;
	airjumpsLeft = 2;
	/** Same one-shot-per-press latch as airjumpAllowed above, but for the ground/wall-contact
	 * special (bounce) jump in onAfterCollisionResponse. That block used to have no latch at
	 * all -- just isPressed('jump') -- so it fired on every substep that regenerated contact
	 * while jump was held (e.g. sliding down a wall), re-adding the uncapped +20 push and
	 * replaying bounce_boing.wav each time. Needs its own flag, not a shared one with the
	 * mid-air wall kick's jumpEdgeThisRealTick -- that one gets consumed by the kick first
	 * whenever you're airborne and touching a wall, starving this block of it entirely. */
	specialJumpAllowed = true;
	specialJumpImpulse = 15;
	/** Vertical component of an actual wall-contact special jump (vs. landing on the ground
	 * shortly after touching one, which uses specialJumpImpulse above). Matches the mid-air wall
	 * kick's own "full wall jump" vertical magnitude elsewhere in this file, for consistency
	 * between the two wall-jump paths. The horizontal component is separate -- see
	 * wallJumpKickStrength below. */
	wallJumpImpulse = 15;
	/** Horizontal kick strength for a wall-contact special jump (hug the wall, press jump a
	 * second time while still touching it) -- matches SuperSpeed's default superSpeedStrength
	 * (super_speed.ts) so the kick away from the wall genuinely feels like a super-speed boost,
	 * not a light push. Applied along the wall's push direction, which now has some "up" blended
	 * in (see wallJumpArcBlend below) rather than being purely horizontal, so this sets the total
	 * speed of the kick, not just its sideways component. */
	wallJumpKickStrength = 15;
	/** How much "up" to blend into the wall-kick's own direction before applying it, so the escape
	 * traces a genuine parabolic arc -- useful for reaching hard-to-reach platforms -- instead of a
	 * flat shove straight out from the wall. 0 = purely horizontal (the old behavior), 1 = equal
	 * parts up and sideways before normalizing. Blended in before normalizing, so
	 * wallJumpKickStrength still sets the kick's total speed either way, just its direction shifts. */
	wallJumpArcBlend = 0.5;
	/** How far (as a multiple of the marble's own radius) to directly relocate the marble away from
	 * the wall the instant a wall jump fires, on top of the velocity kick. Velocity alone isn't
	 * enough to guarantee detachment: solvePosition() in collision_response.ts runs unconditionally
	 * on whatever penetration is found on the very next tick, and in a tight corridor two opposing
	 * wall contacts can each push back along their own normal and hold the marble in place regardless
	 * of its velocity. Scaled to radius (rather than a flat constant) so this still works correctly
	 * for mega marbles. Kept modest relative to the existing radius+0.15/radius+0.35 detection
	 * margins in this file, since bypassing CCD with a raw position change carries some tunneling
	 * risk if pushed too far in one tick. */
	WALL_JUMP_POSITION_NUDGE_FACTOR = 0.5;
	/** Milliseconds remaining during which airborne steering input (see the "Handle airborne
	 * movement" branch below) is suppressed after a wall jump fires. Air control adds velocity
	 * from held input directly to linearVelocity every tick with no cap -- if the player is still
	 * holding the direction into the wall (natural, since that's what got them hugging it in the
	 * first place), it silently re-injects velocity back toward the wall every tick, fighting the
	 * kick's one-time horizontal push. It never touches the vertical axis, which is why the kick's
	 * vertical component always visibly works while the horizontal one can get eaten. */
	wallJumpControlLockoutTimer = 0;
	WALL_JUMP_CONTROL_LOCKOUT = 300;
	/** True once a plain jump has already happened during the current wall session (i.e. the player
	 * pressed jump once already while touching/recently touching this wall). The full wall-kick
	 * (vertical + horizontal boost) only fires on this SECOND-or-later press; the first press against
	 * a wall is a completely ordinary jump, so the player can land/stick on a wall corner for a
	 * moment first. Set in both the raycast-based path (onBeforeIntegrate) and the collision-based
	 * path (onAfterCollisionResponse) so either one recognizes an already-used first press. Reset
	 * once the wall session truly ends -- either the forgiveness window fully expires (onBeforeIntegrate)
	 * or landing on the ground away from any wall (onAfterCollisionResponse) -- or once the kick itself
	 * fires (onBeforeIntegrate). */
	hasPlainJumpedAtWall = false;
	pendingSpecialJump = false;
	recentWallBounce = false;
	wallBounceTimer = 0;
	WALL_BOUNCE_FORGIVENESS = 200; /**Timer value (in milliseconds) that gives the player a short window after bouncing off a wall during which a special jump (like a wall jump or special air action) is allowed */
	wallBounceHappened = false;
	autoDoubleJumpArmed = true;
	justLanded = false;
	wallTouchTimer = 0;
	/** Guards against an air jump also firing on the same real tick a wall jump already consumed the jump press. Only reset at real-tick boundaries (see onBeforeIntegrate), not on every substep call. */
	wallJumpFiredThisTick = false;
	/** isPressed('jump') as of the last real-tick boundary. Fallback edge detector for input paths (e.g. gamepad) not confirmed to set level.jumpQueued. */
	lastJumpHeldState = false;
	/** Whether jump was freshly pressed as of the start of the current real tick (from level.jumpQueued, OR the isPressed fallback above). Computed once per real tick and reused/consumed across that tick's substeps — safe against CCD substeps calling onBeforeIntegrate more than once per tick, unlike reading level.jumpQueued or getPressedFlag() live (neither is cleared until after the whole tick, including all its substeps, completes). */
	jumpEdgeThisRealTick = false;
	/** Accumulates while continuously touching a wall; resets the instant contact is lost. Gates the full (kicking) wall jump vs. the lighter immediate special jump. */
	wallHugDuration = 0;
	/** How long (ms) a wall must be continuously hugged before a jump press triggers a full, kicking wall jump instead of a light immediate special jump */
	WALL_HUG_THRESHOLD_FOR_KICK = 1500;
	lastGlueTouchTime = 0;

	// ── Camera effect state ─────────────────────────────────────────────────────────────────────────────
	// DESIGN: effects never write camera.fov / level.pitch directly. Each effect only advances ITS OWN scalar below, and
	// updatePowerupCameraEffects() recomputes the camera from those scalars every frame. That makes any combination of
	// powerups (and re-triggering the same one) compose correctly, and makes "reset" trivial: zero the scalars.

	/** Total pitch offset (rad) this class has currently added on top of the player's own pitch. Only the DIFFERENCE to the wanted offset is ever applied, so player mouse input is never overwritten. */
	appliedPitchOffset = 0;

	// SuperJump: one-shot pitch tilt (exact $mvPitch replication), a pure function of the counter
	superJumpEffectCounter = 0;
	superJumpEffectActive = false;

	// SuperSpeed: one-shot FOV warp (exact compound mulWarp replication), a pure function of the counter
	superSpeedEffectCounter = 0;
	superSpeedEffectActive = false;
	/** Current FOV warp factor applied to tan(fov/2) (1.0 = no warp). Derived from the counter every frame, never accumulated. */
	superSpeedWarp = 1.0;

	// ShockAbsorber: zoom in while active, zoom back out on expire
	shockWasActive = false;
	/** Current zoom factor applied to tan(fov/2) (1.0 = none). Eases toward its target one 0.99 step per frame. */
	shockZoom = 1.0;
	/** True while the zoom-out after expiry is running (the original cancels a running super speed warp when it finishes). */
	shockEnding = false;

	// Gyrocopter: pitches down while active, back up on expire
	/** Current gyrocopter pitch offset in radians; eases toward 0.2 (active) or 0 (inactive). */
	gyroPitchOffset = 0;

	// Marble trail accumulators (Gold / Nyan Cat / Honeydew, SepticEye)
	marbleTrailAccumTime = 0;
	lastGoldTrailTime = 0;
	nyanRainbowIntervals: ReturnType<typeof setInterval>[] = [];
	nyanRainbowPool: { shape: Shape, active: boolean, fadeStart: number }[] = [];
	septicGooPool: { shape: Shape, active: boolean, spawnTime: number, scale: number }[] = [];
	jaffacakePool: { shape: Shape, active: boolean, spawnTime: number, scale: number }[] = [];

	currentTexturePath = "shapes/balls/base.marble.png";
	/** The texture path originally selected for this marble (used to restore after powerups) */
	selectedTexturePath: string = null;
	/** The id of the marble selected by the player (e.g. 'septic', 'madness') */
	selectedMarbleId = 'default';

	// Orbiter marble (3 planets)
	orbiterShapes: Shape[] = [];
	orbiterRels: Vector3[] = [];
	orbiterAxes: Vector3[] = [];
	orbiterPrevOrientation: Quaternion;

	marbleGlasses: Shape;
	glassesOrientation: Quaternion;
	cubeOrientation: Quaternion;

	constructor(level: Level) {
		this.level = level;
	}

	async init() {
		this.group = new Group();
		this.innerGroup = new Group();
		this.group.add(this.innerGroup);
		this.doubler = false;

		if (this.level.mission.misFile.marbleAttributes["jumpImpulse"] !== undefined)
			this.jumpImpulse = MisParser.parseNumber(this.level.mission.misFile.marbleAttributes["jumpImpulse"]);
		if (this.level.mission.misFile.marbleAttributes["bounceRestitution"] !== undefined)
			this.bounceRestitution = MisParser.parseNumber(this.level.mission.misFile.marbleAttributes["bounceRestitution"]);
		if (this.level.mission.misFile.marbleAttributes["enableCustomJumpAndDash"] !== undefined)
			this.level.enableCustomJumpAndDash = MisParser.parseNumber(this.level.mission.misFile.marbleAttributes["enableCustomJumpAndDash"]) === 1;

		// Resolve selected marble, falling back to 'default'
		let selectedMarbleDef = getMarbleDefinition(state.selectedMarble || 'default');
		// Remember which marble id was selected so we can special-case certain marbles later
		this.selectedMarbleId = state.selectedMarble || 'default';

		// Convert browser-relative path './assets/data/shapes/balls/foo.png'
		// to the internal path ResourceManager expects: 'shapes/balls/foo.png'
		let toInternalPath = (p: string): string => {
			const prefix = ResourceManager.mainDataPath; // e.g. './assets/data/'
			if (p.startsWith(prefix)) return p.slice(prefix.length);
			if (p.startsWith('./assets/data/')) return p.slice('./assets/data/'.length);
			if (p.startsWith('assets/data/')) return p.slice('assets/data/'.length);
			return p;
		};

		// Get the correct texture
		let marbleTexture: Texture;

		// Simulacrum override (takes priority over marble selection)
		if (this.level.mission.title === "Simulacrum") {
			marbleTexture = await ResourceManager.getTexture("shapes/balls/matrix.marble.png");
		}

		// Use selected marble's texture (if no custom blob and no Simulacrum override)
		if (!marbleTexture) {
			try {
				const internalPath = toInternalPath(selectedMarbleDef.texturePath);
				marbleTexture = await ResourceManager.getTexture(internalPath);
				this.currentTexturePath = internalPath;
			} catch {
				// Fallback to default if selected texture fails to load
				marbleTexture = await ResourceManager.getTexture("shapes/balls/base.marble.png");
				this.currentTexturePath = "shapes/balls/base.marble.png";
			}
		}

		// Remember the originally selected texture so we can restore it after powerups
		this.selectedTexturePath = this.currentTexturePath;

		// Store base jump impulse so powerups can reference and restore it
		this.baseJumpImpulse = this.jumpImpulse;
		this.lastAppliedPowerupJumpImpulse = this.baseJumpImpulse;

		// Create the 3D ball shape
		let isCustomMarble = !!(state.selectedMarble && state.selectedMarble !== 'default');

		if (isCustomMarble) {
			// Load the selected marble's DTS and apply its texture via Proxy..overrides any internal material name the DTS file declares, the same technique used in marble_selector.ts
			let ballShape = new Shape();
			ballShape.shareMaterials = false;
			ballShape.dtsPath = selectedMarbleDef.dtsPath;
			ballShape.castShadows = true;
			ballShape.materialPostprocessor = m => {
				m.normalizeNormals = true;
				m.flipY = true;
			};

			// Multi-material shapes (e.g. ball-madness.dts, which declares separate "cyan" and
			// "yellow" materials for its base sphere color and subtractive dot pattern) need each
			// of their DTS-declared materials to resolve to its OWN texture file by name — that's
			// what Shape.computeMaterials() does by default when matNamesOverride is empty.
			// Forcing every material to the single skin texture below only makes sense for shapes
			// that have exactly one material to skin; applying it to a multi-material shape
			// collapses all of its distinct materials down to one texture and destroys the pattern.
			let isMultiMaterialShape = MULTI_MATERIAL_MARBLE_DTS.has(selectedMarbleDef.dtsPath);

			if (!isMultiMaterialShape) {
				ballShape.matNamesOverride = new Proxy({} as Record<string, Texture>, {
					get: (_target, key) => typeof key === 'string' ? marbleTexture : undefined
				});
			}

			await ballShape.init(this.level);
			this.innerGroup.add(ballShape.group);
			this.ballShape = ballShape;

			// Some DTS files may not pick up the Proxy override in all codepaths; force-assign the
			// loaded marbleTexture to all materials to ensure the selected texture appears.
			// Skipped for multi-material shapes for the same reason as above.
			if (!isMultiMaterialShape && marbleTexture && this.ballShape.materials) {
				for (let m of this.ballShape.materials) {
					m.diffuseMap = marbleTexture;
				}
			}
		}

		let geometry = Geometry.createSphereGeometry(1, 32, 16);
		let sphereMaterial = new Material();
		sphereMaterial.diffuseMap = marbleTexture;
		sphereMaterial.normalizeNormals = true;
		sphereMaterial.flipY = true;

		// Create the sphere mesh — always needed for radius API and world wrapping
		let sphere = new Mesh(geometry, [sphereMaterial]);
		sphere.castShadows = true;
		this.sphere = sphere;
		this.innerGroup.add(sphere);

		// Create the physics stuff
		this.body = new RigidBody();
		this.body.evaluationOrder = 1000; // Make sure this body's handlers are called after all the other ones (interiors, shapes, etc)
		let colShape = new BallCollisionShape(0); // We'll update the radius later
		colShape.restitution = this.bounceRestitution;
		this.shape = colShape;
		this.body.addCollisionShape(colShape);

		let largeAuxShape = new BallCollisionShape(0);
		largeAuxShape.collisionDetectionMask = 0b10;
		largeAuxShape.collisionResponseMask = 0;
		this.body.addCollisionShape(largeAuxShape);

		let smallAuxShape = new BallCollisionShape(0);
		smallAuxShape.collisionDetectionMask = 0b100;
		smallAuxShape.collisionResponseMask = 0;
		this.body.addCollisionShape(smallAuxShape);

		colShape.broadphaseShape = largeAuxShape;
		smallAuxShape.broadphaseShape = largeAuxShape;

		this.largeAuxShape = largeAuxShape;
		this.smallAuxShape = smallAuxShape;

		this.body.onBeforeIntegrate = this.onBeforeIntegrate.bind(this);
		this.body.onAfterIntegrate = this.onAfterIntegrate.bind(this);
		this.body.onBeforeCollisionResponse = this.onBeforeCollisionResponse.bind(this);
		this.body.onAfterCollisionResponse = this.onAfterCollisionResponse.bind(this);

		// Set the marble's default orientation to be close to actual MBP
		this.body.orientation.setFromEuler(new Euler(Math.PI / 2, Math.PI * 7 / 6, 0));

		this.forcefield = new Shape();
		this.forcefield.dtsPath = "shapes/images/glow_bounce.dts";
		this.oilimage = new Shape();
		this.oilimage.dtsPath = "shapes/images/oil.dts";
		this.glueimage = new Shape();
		this.glueimage.dtsPath = "shapes/images/glue.dts";
		this.airplaneimage = new Shape();
		this.airplaneimage.dtsPath = "shapes/images/airplane.dts";
		this.iceimage = new Shape();
		this.iceimage.dtsPath = "shapes/images/glow_ice.dts";
		await this.forcefield.init(this.level);
		await this.oilimage.init(this.level);
		await this.glueimage.init(this.level);
		await this.iceimage.init(this.level);
		this.forcefield.setOpacity(0);
		this.oilimage.setOpacity(0);
		this.glueimage.setOpacity(0);
		this.forcefield.showSequences = false; // Hide the weird default animation it does
		this.oilimage.showSequences = false; // Hide the weird default animation it does
		this.glueimage.showSequences = false; // Hide the weird default animation it does
		this.iceimage.showSequences = false; // Hide the weird default animation it does
		this.innerGroup.add(this.forcefield.group);
		this.innerGroup.add(this.oilimage.group);
		this.innerGroup.add(this.glueimage.group);
		this.innerGroup.add(this.iceimage.group);

		this.helicopter = new Shape();
		// Easter egg: Due to an iconic bug where the helicopter would instead look like a glow bounce, this can now happen 0.1% of the time.
		this.helicopter.dtsPath = (Math.random() < 1 / 1000) ? "shapes/images/glow_bounce.dts" : "shapes/images/helicopter.dts";
		this.helicopter.castShadows = true;
		await this.helicopter.init(this.level);
		this.helicopter.setOpacity(0);
		this.group.add(this.helicopter.group);

		this.airplaneimage = new Shape();
		// Easter egg: Due to an iconic bug where the airplane would instead look like a glow bounce, this can now happen 0.1% of the time.
		this.airplaneimage.dtsPath = (Math.random() < 1 / 1000) ? "shapes/images/glow_bounce.dts" : "shapes/images/airplane.dts";
		this.airplaneimage.castShadows = true;
		await this.airplaneimage.init(this.level);
		this.airplaneimage.setOpacity(0);
		this.group.add(this.airplaneimage.group);
		// ── Trail pools ──────────────────────────────────────────────────────────
		// Register pool sizes into loadingState.total BEFORE loading begins so the
		// loading bar knows the full budget upfront, then increment loaded as each
		// shape finishes — this prevents the bar from overshooting 100%.
		// Trail behaviour (spawn positions, opacity, scene membership) is identical
		// to the original; only the progress accounting is new.

		// Nyan rainbow pool (always 80, regardless of marble selection)
		const nyanCount = 80;
		const septicCount = state.selectedMarble === 'septiceye' ? 220 : 0;
		const jaffaCount  = state.selectedMarble === 'honeydew'  ? 200 : 0;
		this.level.loadingState.total += nyanCount + septicCount + jaffaCount;

		this.nyanRainbowPool = [];
		for (let i = 0; i < nyanCount; i++) {
			let rainbow = new Shape();
			rainbow.dtsPath = 'shapes/balls/rainbow.dts';
			let entry = { shape: rainbow, active: false, fadeStart: 0 };
			this.nyanRainbowPool.push(entry);
			await rainbow.init(this.level);
			rainbow.setOpacity(0);
			this.level.scene.add(rainbow.group);
			this.level.loadingState.loaded++;
		}
		// Septic goo pool
		this.septicGooPool = [];
		if (state.selectedMarble === 'septiceye') {
			for (let i = 0; i < septicCount; i++) {
				let goo = new Shape();
				goo.dtsPath = 'shapes/balls/septicgoo.dts';
				let entry = { shape: goo, active: false, spawnTime: 0, scale: 1 };
				this.septicGooPool.push(entry);
				await goo.init(this.level);
				goo.setOpacity(0);
				this.level.scene.add(goo.group);
				this.level.loadingState.loaded++;
			}
		}
		// Jaffa cake pool
		this.jaffacakePool = [];
		if (state.selectedMarble === 'honeydew') {
			for (let i = 0; i < jaffaCount; i++) {
				let jaffas = new Shape();
				jaffas.dtsPath = 'shapes/balls/jaffa.dts';
				let entry = { shape: jaffas, active: false, spawnTime: 0, scale: 1 };
				this.jaffacakePool.push(entry);
				await jaffas.init(this.level);
				jaffas.setOpacity(0);
				this.level.scene.add(jaffas.group);
				this.level.loadingState.loaded++;
			}
		}

		// Load the necessary rolling sounds
		let toLoad = ["jump.wav", "bouncehard1.wav", "bouncehard2.wav", "bouncehard3.wav", "bouncehard4.wav", "rolling_hard.wav", "sliding.wav", "dosuperspeed.wav"];
		if (this.level.mission.hasBlast) toLoad.push("blast.wav");
		await this.level.audio.loadBuffers(toLoad);

		this.rollingSound = this.level.audio.createAudioSource('rolling_hard.wav');
		this.rollingSound.play();
		this.rollingSound.gain.gain.setValueAtTime(0, this.level.audio.currentTime);
		this.rollingSound.setLoop(true);

		// Check if we need to prep a Mega Marble sound
		if (this.level.mission.allElements.some(x => x._type === MissionElementType.Item && x.datablock?.toLowerCase() === 'megamarbleitem')) {
			this.rollingMegaMarbleSound = this.level.audio.createAudioSource('mega_roll.wav');
			this.rollingMegaMarbleSound.gain.gain.setValueAtTime(0, this.level.audio.currentTime);
			this.rollingMegaMarbleSound.setLoop(true);
		}
		// Check if we need to prep a Metal sound
		if (this.level.mission.allElements.some(x => x._type === MissionElementType.Item && x.datablock?.toLowerCase() === 'metalitem')) {
			this.rollingMetalSound = this.level.audio.createAudioSource('metal_roll.wav');
			this.rollingMetalSound.gain.gain.setValueAtTime(0, this.level.audio.currentTime);
			this.rollingMetalSound.setLoop(true);
		}
		// Check if we need to prep a Paper sound
		if (this.level.mission.allElements.some(x => x._type === MissionElementType.Item && x.datablock?.toLowerCase() === 'paperitem')) {
			this.rollingPaperSound = this.level.audio.createAudioSource('paper_roll.wav');
			this.rollingPaperSound.gain.gain.setValueAtTime(0, this.level.audio.currentTime);
			this.rollingPaperSound.setLoop(true);
		}

		this.slidingSound = this.level.audio.createAudioSource('sliding.wav');
		this.slidingSound.play();
		this.slidingSound.gain.gain.setValueAtTime(0, this.level.audio.currentTime);
		this.slidingSound.setLoop(true);

		await Promise.all([this.rollingSound.promise, this.slidingSound.promise, this.rollingMegaMarbleSound?.promise, this.rollingMetalSound?.promise, this.rollingPaperSound?.promise]);

		// Orbiter marble: spawn 3 small orbiting planets with marble's own texture
		if (state.selectedMarble === 'solarsystem') {
			// Per-planet textures: Mercury, Venus, Earth
			const planetTexturePaths = [
				'shapes/balls/magenta.marble.png',
				'shapes/balls/green.marble.png',
				'shapes/balls/blue.marble.png'
			];

			// 3 planets evenly spread 120 degrees apart on the XY plane
			const startAngles = [0, Math.PI * 2 / 3, Math.PI * 4 / 3];
			for (let i = 0; i < 3; i++) {
				let planetTex: Texture;
				try {
					planetTex = await ResourceManager.getTexture(planetTexturePaths[i]);
				} catch {
					planetTex = marbleTexture;
				}
				let shape = new Shape();
				shape.dtsPath = selectedMarbleDef.dtsPath;
				shape.shareMaterials = false;
				shape.castShadows = true;
				shape.matNamesOverride = new Proxy({} as Record<string, Texture>, {
					get: (_t, key) => typeof key === 'string' ? planetTex : undefined
				});
				await shape.init(this.level);
				this.level.scene.add(shape.group);
				this.orbiterShapes.push(shape);

				// Mercury=0.35, Venus=0.55, Earth=0.75 — each 120 deg apart
				const orbitRadii = [0.5, 0.5, 0.5];
				const ang = startAngles[i];
				const r = orbitRadii[i];
				// Each planet orbits on a tilted plane
				const orbitalAxes = [
					new Vector3(0, 0, 1),                              // Mercury: flat XY plane
					new Vector3(0, Math.sin(Math.PI/4), Math.cos(Math.PI/4)).normalize(), // Venus: 45 deg tilt
					new Vector3(Math.sin(Math.PI/3), 0, Math.cos(Math.PI/3)).normalize()  // Earth: 60 deg tilt
				];
				this.orbiterRels.push(new Vector3(Math.cos(ang) * r, Math.sin(ang) * r, 0));
				this.orbiterAxes.push(orbitalAxes[i]);
			}
		}
		// Coolest Marble ever.. Player Plays with Savage..
		if (state.selectedMarble === 'dealwithit') {
			let sunglasstex = await ResourceManager.getTexture("shapes/balls/glasses.png");
			let shape = new Shape();
			shape.dtsPath = "shapes/balls/glasses.dts";
			shape.shareMaterials = false;
			shape.castShadows = true;
			shape.matNamesOverride = new Proxy({} as Record<string, Texture>, {
				get: (_t, key) => typeof key === 'string' ? sunglasstex : undefined
			});
			await shape.init(this.level);
			this.level.scene.add(shape.group);
			this.marbleGlasses = shape;
		}
	}
	doAirjump() {
		this.setLinearVelocityInDirection(this.level.currentUp, 1 * this.jumpImpulse, true);
		this.playJumpSound();
	}

	findBestCollision(withRespectTo: (c: Collision) => number) {
		let bestCollision: Collision;
		let bestCollisionValue = -Infinity;
		for (let collision of this.body.collisions) {
			if (collision.s1 !== this.shape) continue; // Could also be an aux collider that caused the collision but we don't wanna count that here

			let value = withRespectTo(collision);

			if (value > bestCollisionValue) {
				bestCollision = collision;
				bestCollisionValue = value;
			}
		}

		if (!bestCollision) return null;

		let contactNormal = bestCollision.normal;
		let contactShape = bestCollision.s2;
		if (bestCollision.s1 !== this.body.shapes[0]) {
			contactNormal.negate();
			contactShape = bestCollision.s2;
		}

		// How much the current surface is pointing up
		let contactNormalUpDot = Math.abs(contactNormal.dot(this.level.currentUp));

		return { collision: bestCollision, contactNormal, contactShape, contactNormalUpDot };
	}

	isOnGround() {
		// Only check collisions that are defined and have a normal
		return this.body.collisions.some(c => c && c.normal && Math.abs(c.normal.dot(this.level.currentUp)) > 0.8);
	}


	/** Returns true if the given control key is disabled for this mission. */
	isControlDisabled(...keys: string[]): boolean {
		if (this.level.oneJumpUsed && keys.some(k => k.toLowerCase() === 'jump')) return true; // Jump!: the single jump has been used
		const raw = this.level.mission.missionInfo?.disable;
		if (!raw) return false;
		const disabled = raw.toLowerCase().split(/[\s,]+/).filter(Boolean);
		return keys.some(k => disabled.includes(k.toLowerCase()));
	}

	onBeforeIntegrate(dt: number) {
		let allowUserInput = !state.menu.finishScreen.showing;

		// world.ts's substep() recurses with a strictly smaller dt than the nominal full tick whenever a
		// CCD collision forces a split — meaning onBeforeIntegrate can run multiple times within one real
		// tick, most often exactly when hitting a wall or the ground. Only treat this as a fresh real tick
		// (and only recompute the jump press edge / reset per-tick guards) when dt matches the full nominal
		// tick length; a recursive substep continuation always has a smaller dt and should reuse the same
		// edge value instead of re-deriving it against jump's current held state.
		let isRealTickStart = Math.abs(dt - 1 / PHYSICS_TICK_RATE) < 1e-6;
		if (isRealTickStart) {
			this.wallJumpFiredThisTick = false;
			// FIX: level.jumpQueued is NOT a clean fresh-press signal for this purpose -- marble.ts
			// itself rewrites it to true from the justLanded handler below ("queue a jump if space
			// is held on landing"), which fires on ANY contactNormalUpDot > 0.5 touch. Holding jump
			// through a wall-then-ledge-then-ground sequence re-sets jumpQueued = true on each touch
			// with no key release involved, which this line was then misreading as a brand new press
			// -- re-firing the wall kick repeatedly and clearing wallBounceHappened before the actual
			// landing ever got a chance to use it. Use only the real isPressed-transition check, which
			// reflects the physical key state and nothing marble.ts writes to itself.
			this.jumpEdgeThisRealTick = isPressed('jump') && !this.lastJumpHeldState;
			this.lastJumpHeldState = isPressed('jump');
			// Jump!: the first press of the jump key uses up the mission's single jump. The jump still works on the tick of the press itself.
			if (this.level.isOneJump) {
				if (this.level.oneJumpPending) {
					this.level.oneJumpUsed = true;
					this.level.oneJumpPending = false;
				} else if (isPressed('jump') && !this.level.oneJumpUsed) {
					this.level.oneJumpPending = true;
				}
			}
		}

		// Construct the raw movement vector from inputs
		let movementVec = new Vector3(0, 0, 0);
		if (isPressed('up') && !this.isControlDisabled('up')) movementVec.add(new Vector3(1, 0, 0));
		if (isPressed('down') && !this.isControlDisabled('down')) movementVec.add(new Vector3(-1, 0, 0));
		if (isPressed('left') && !this.isControlDisabled('left')) movementVec.add(new Vector3(0, 1, 0));
		if (isPressed('right') && !this.isControlDisabled('right')) movementVec.add(new Vector3(0, -1, 0));

		// Add gamepad input and restrict if necessary
		let analogForward = -gamepadAxes.marbleY; // positive: up, negative: down
		let analogSide = -gamepadAxes.marbleX; // positive: left, negative: right
		if (normalizedJoystickHandlePosition) {
			analogForward -= Util.signedSquare(normalizedJoystickHandlePosition.y);
			analogSide -= Util.signedSquare(normalizedJoystickHandlePosition.x);
		}
		if (analogForward > 0 && this.isControlDisabled('up')) analogForward = 0;
		if (analogForward < 0 && this.isControlDisabled('down')) analogForward = 0;
		if (analogSide > 0 && this.isControlDisabled('left')) analogSide = 0;
		if (analogSide < 0 && this.isControlDisabled('right')) analogSide = 0;
		movementVec.add(new Vector3(analogForward, analogSide, 0));
		if (movementVec.x > 1.0)
			movementVec.x = 1.0;
		if (movementVec.x < -1.0)
			movementVec.x = -1.0;
		if (movementVec.y > 1.0)
			movementVec.y = 1.0;
		if (movementVec.y < -1.0)
			movementVec.y = -1.0;

		if (!allowUserInput) movementVec.multiplyScalar(0);
		let inputStrength = movementVec.length();

		// Rotate the vector accordingly
		movementVec.multiplyScalar(MARBLE_ROLL_FORCE * 5 * dt);
		movementVec.applyAxisAngle(new Vector3(0, 0, 1), this.level.yaw);

		let quat = this.level.newOrientationQuat;
		movementVec.applyQuaternion(quat);

		this.lastMovementVec.copy(movementVec);

		if (this.isFlyingPlane) {
			let cameraOrient = this.level.camera.orientation;
			let cameraForward = new Vector3(0, 0, -1);
			cameraForward.applyQuaternion(cameraOrient);

			cameraForward.multiplyScalar(MARBLE_ROLL_FORCE * 5 * dt);

			let planeSpeed = 6.4;
			this.body.angularVelocity.set(0, 0, 0);
			this.body.linearVelocity.set(cameraForward.x * planeSpeed, cameraForward.y * planeSpeed, cameraForward.z * planeSpeed);

			// Double-press use/powerup button (or left mouse) → DO A BARREL ROLL!
			const useDown = isPressed('use');
			const useJustPressed = useDown && !this.lastUseWasPressed;
			this.lastUseWasPressed = useDown;

			if (allowUserInput && !this.barrelRollActive && useJustPressed) {
				const now = this.level.timeState.currentAttemptTime;
				if (now - this.lastUsePressTime < this.BARREL_ROLL_DOUBLE_PRESS_WINDOW) {
					this.barrelRollActive = true;
					this.barrelRollAngle = 0;
					this.level.audio.play('barrelroll.wav');
					this.lastUsePressTime = -Infinity;
				} else {
					this.lastUsePressTime = now;
				}
			}

			// Bail out early
			return;
		}

		// Wall Bounce Handling Block for allowing a special jump if the player jumps on the ground after bounced back the wall when hitting it in the forgiveness window.
		if (this.wallBounceTimer > 0) {
			this.wallBounceTimer -= dt * 1000;
			if (this.wallBounceTimer < 0) this.wallBounceTimer = 0;
		}

		// Wall Touch Timer Handling Block for allowing a wall jump if the player jumps on touching a wall during this window then he feels a ejective force off the wall...
		if (this.wallTouchTimer > 0) {
			this.wallTouchTimer -= dt * 1000;
			if (this.wallTouchTimer < 0) this.wallTouchTimer = 0;
		}

		if (this.wallJumpControlLockoutTimer > 0) {
			this.wallJumpControlLockoutTimer -= dt * 1000;
			if (this.wallJumpControlLockoutTimer < 0) this.wallJumpControlLockoutTimer = 0;
		}

		// FIX: only close the special-jump window once BOTH timers have actually run out. These
		// used to each clear wallBounceHappened/recentWallBounce independently the instant THEIR
		// OWN timer hit zero -- so wallBounceTimer (200ms, only armed by a real physics bounce off
		// the wall) would clear the flag well before wallTouchTimer's much longer 1500ms window said
		// it should still be open, killing the ground-landing special jump's eligibility before you
		// even reached the ground.
		if (this.wallBounceTimer <= 0 && this.wallTouchTimer <= 0) {
			this.recentWallBounce = false;
			this.wallBounceHappened = false;
			this.hasPlainJumpedAtWall = false;
		}

		// "late jump" detection
		if (!this.isOnGround() && isPressed('jump') && !this.isControlDisabled('jump')) {
			// Cast the marble's shape slightly downward to check for ground proximity
			const down = this.level.currentUp.clone().multiplyScalar(-1);
			const movement = down.clone().multiplyScalar(this.radius + 0.35); // 0.35 is the "forgiveness" window
			const hits = this.level.world.castShape(this.shape, movement, 1);

			// If we hit something (ground is close), allow a pending special jump
			if (hits.length > 0) {
				this.pendingSpecialJump = true;
			}
		}

		// Detect if we're touching a wall, and let the player kick directly off it — mirrors jump() in
		// default.bind.cs, which fires straight off the wall raycasts with no ground contact required.
		if (!this.isOnGround()) {
			const directions = [
				new Vector3(1, 0, 0),
				new Vector3(-1, 0, 0),
				new Vector3(0, 1, 0),
				new Vector3(0, -1, 0),
				new Vector3(1, 1, 0).normalize(),
				new Vector3(1, -1, 0).normalize(),
				new Vector3(-1, 1, 0).normalize(),
				new Vector3(-1, -1, 0).normalize()
			];

			let touchedWall = false;
			let pushDirection = new Vector3();

			// FIX: castShape's underlying GJK raycast (collision_detection.ts's castRay) only ever
			// advances its point-of-impact and sets its surface normal inside a branch that a ray
			// starting ALREADY INSIDE the target (i.e. we're embedded, not just touching) can never
			// reach -- it converges early with lambda 0 and a normal that's still its zero-vector
			// initial value. Accumulating that straight into pushDirection could silently leave it at
			// (0,0,0) precisely when the marble is embedded deeply enough for it to matter, since the
			// kick below only applies when pushDirection.lengthSq() > 0. The engine's own live collision
			// normal (EPA-computed, in this.body.collisions) doesn't have this problem -- EPA is built
			// specifically to find a correct normal under deep overlap -- so prefer it when available,
			// and only fall back to the raycasts (filtering out degenerate near-zero hits) for genuine
			// not-yet-touching proximity, which is the case they're actually reliable for.
			let liveWallCollisionForTouch = this.body.collisions.find(c =>
				c && c.s1 === this.shape && c.normal && Math.abs(c.normal.dot(this.level.currentUp)) < 0.5
			);
			if (liveWallCollisionForTouch) {
				touchedWall = true;
				pushDirection.copy(liveWallCollisionForTouch.normal);
				this.wallTouchTimer = 1500; // 1.5 seconds of window
				this.wallBounceHappened = true;
			}

			for (const dir of directions) {
				const movement = dir.clone().multiplyScalar(this.radius + 0.15);
				const hits = this.level.world.castShape(this.shape, movement, 1);
				if (hits.length > 0) {
					touchedWall = true;
					this.wallTouchTimer = 1500; // 1.5 seconds of window
					this.wallBounceHappened = true;

					// Skip degenerate (near-zero-length, or NaN from normalizing zero) normals rather
					// than accumulating them -- see the FIX comment above for why these occur, and only
					// use raycast normals at all if we didn't already get a robust one from a live
					// collision above.
					if (!liveWallCollisionForTouch) {
						let n = hits[0].normal;
						if (n && n.lengthSq() > 1e-6 && Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)) {
							pushDirection.add(n);
						}
					}
				}
			}

			// Track how long we've been continuously hugging a wall — kept for diagnostics, no
			// longer gates anything (see below).
			if (touchedWall) this.wallHugDuration += dt * 1000;
			else this.wallHugDuration = 0;

			let wallJumpPressed = allowUserInput && this.jumpEdgeThisRealTick && !this.isControlDisabled('jump');
			if (touchedWall && this.level.enableCustomJumpAndDash && wallJumpPressed && !this.hasPlainJumpedAtWall) {
				// First press against this wall: a completely ordinary jump. No kick, no wall sound,
				// no position/velocity change beyond the normal vertical impulse -- this is what lets
				// the player stick to and stand on the wall corner for a moment first, exactly as
				// asked for. Doesn't touch wallTouchTimer/wallBounceHappened, so the "still at this
				// wall" window keeps counting down normally and the second press below can still see it.
				this.setLinearVelocityInDirection(
					this.level.currentUp,
					this.jumpImpulse + this.body.linearVelocity.dot(this.level.currentUp),
					true,
					() => {
						this.playJumpSound();
						if (this.level.replay.canStore) this.level.replay.jumpSoundTimes.push(this.level.replay.currentTickIndex);
					}
				);

				this.hasPlainJumpedAtWall = true;
				this.wallJumpFiredThisTick = true;
				this.jumpEdgeThisRealTick = false;
				this.airjumpAllowed = false;
				this.level.jumpQueued = false;
			} else if (touchedWall && this.level.enableCustomJumpAndDash && wallJumpPressed && this.hasPlainJumpedAtWall) {
				// Second (or later) press during the same wall session: the full treatment -- vertical
				// lift + horizontal push away from the wall, identified by bounce_boing.wav.
				this.setLinearVelocityInDirection(
					this.level.currentUp,
					this.wallJumpImpulse + this.body.linearVelocity.dot(this.level.currentUp),
					true,
					() => {
						this.playJumpSound();
						if (this.level.replay.canStore) this.level.replay.jumpSoundTimes.push(this.level.replay.currentTickIndex);
					}
				);

				if (pushDirection.lengthSq() > 0) {
					pushDirection.normalize();
					// Blend some "up" into the kick's own direction before applying it, so the escape
					// traces a parabolic arc (helpful for reaching high platforms) instead of a flat
					// shove. This happens IN the kick direction itself, not as a separate vertical call,
					// so wallJumpKickStrength continues to set the kick's total speed either way.
					let kickDirection = pushDirection.clone()
						.addScaledVector(this.level.currentUp, this.wallJumpArcBlend)
						.normalize();
					// Override (not add to) the velocity component along the kick direction, so the
					// result is a guaranteed outward speed regardless of whatever residual/inward
					// velocity the marble had -- addScaledVector on top of an unknown prior state was
					// exactly what let held steering input (or anything else) partially cancel the kick.
					this.setLinearVelocityInDirection(kickDirection, this.wallJumpKickStrength, false);
					// NOTE: deliberately no manual position push (pushAwayFromWall) here anymore.
					// This runs in onBeforeIntegrate, which is BEFORE world.ts's CCD time-of-impact
					// sweep + body.revert(t) for this same substep. revert() lerps position back
					// toward prevPosition (captured while still embedded, via storePrevious() before
					// this function even ran) whenever the swept path clips ANY geometry not already
					// in inContactCcd -- exactly what happens at a corner, where escaping wall A's
					// embedding can graze wall B. That silently undid the push the same tick it was
					// applied. The velocity override above is NOT reverted (see rigid_body.ts's
					// revert(): only position/orientation are touched) and isn't cancelled by
					// solveVelocity either (that only zeroes CLOSING contacts, not separating ones),
					// so it alone reliably carries the marble away over the next few ticks while the
					// engine's own solvePosition -- which uses real GJK penetration depth, not a
					// castShape sweep starting from inside the wall -- handles de-penetration.
				}
				this.level.audio.play('bounce_boing.wav');

				// This jump already paid out its impulse, so don't also let the same key press
				// trigger an air jump this tick, don't leave a "special jump" bonus queued for later,
				// and don't let a later substep of this same real tick fire the wall jump again.
				this.wallJumpFiredThisTick = true;
				this.jumpEdgeThisRealTick = false;
				this.airjumpAllowed = false;
				this.level.jumpQueued = false;
				this.wallTouchTimer = 0;
				this.wallBounceHappened = false;
				this.wallHugDuration = 0;
				this.hasPlainJumpedAtWall = false;
				this.wallJumpControlLockoutTimer = this.WALL_JUMP_CONTROL_LOCKOUT;
			}
		}


		// The axis of rotation (for angular velocity) is the cross product of the current up vector and the movement vector, since the axis of rotation is perpendicular to both.
		let movementRotationAxis = this.level.currentUp.clone().cross(movementVec);

		let bestCollision = this.findBestCollision(c => c.normal.dot(this.level.currentUp));

		if (bestCollision) {
			let { collision, contactNormal, contactNormalUpDot } = bestCollision;

			// The rotation necessary to get from the up vector to the contact normal.
			let contactNormalRotation = new Quaternion().setFromUnitVectors(this.level.currentUp, contactNormal);
			movementRotationAxis.applyQuaternion(contactNormalRotation);

			// Weaken the marble's angular power based on the friction and steepness of the surface
			let dot = -movementVec.clone().normalize().dot(contactNormal);
			let penalty = Math.max(0, dot - Math.max(0, (collision.s2Friction - 1.0)));
			movementRotationAxis.multiplyScalar(1 - penalty);

			// Apply angular velocity changes
			let angVel = this.body.angularVelocity;

			// Subtract the movement axis so it doesn't get slowed down
			let direction = movementRotationAxis.clone().normalize();
			let dot2 = Math.max(0, angVel.dot(direction));
			angVel.addScaledVector(direction, -dot2);

			// Subtract the "surface rotation axis", this ensures we can roll down hills quickly
			let surfaceRotationAxis = this.level.currentUp.clone().cross(contactNormal);
			let dot3 = Math.max(angVel.dot(surfaceRotationAxis), 0);
			angVel.addScaledVector(surfaceRotationAxis, -dot3);

			angVel.multiplyScalar(0.02 ** (Math.min(1, collision.friction) * dt)); // Handle velocity slowdown

			// Add them back
			angVel.addScaledVector(surfaceRotationAxis, dot3);
			angVel.addScaledVector(direction, dot2);

			if (angVel.length() > 300 * this.speedFac) angVel.multiplyScalar(300 * this.speedFac / angVel.length()); // Absolute max angular speed

			if (dot2 + movementRotationAxis.length() > 12 * Math.PI * 2 * inputStrength / contactNormalUpDot * this.speedFac) {
				// Cap the rolling velocity
				let newLength = Math.max(0, 12 * Math.PI * 2 * inputStrength / contactNormalUpDot * this.speedFac - dot2);
				movementRotationAxis.normalize().multiplyScalar(newLength);
			}
		} else {
			// Handle airborne movement
			// Angular acceleration isn't quite as speedy
			movementRotationAxis.multiplyScalar(1 / 2);

			let time = this.level.timeState;

			let airMovementVector = movementVec.clone();
			let airVelocity = 3.2; // Change air velocity for the helicopter

			if (time.currentAttemptTime - this.helicopterEnableTime < this.gyrocopterTime) airVelocity = this.airAcceleration; // Original gyrocopter air velocity (5)
			if (time.currentAttemptTime - this.helicopterEnableTimex2 < this.gyrocopterTime * 2) airVelocity = this.airAcceleration * 3; // Doubled gyrocopter air velocity (15)
			if (this.level.mission.title === "Simulacrum") airVelocity = 16; // Vaccum in Simulacrum level...increased air acceleration

			if (this.level.finishTime) airVelocity = 0;
			if (this.wallJumpControlLockoutTimer > 0) airVelocity = 0; // Don't let held steering input immediately fight a wall kick's escape velocity
			if (this.level.mission.missionInfo?.noaircontrol === "1") {
				// Scared of Heights: no air control and no air spin while the marble isn't touching anything
				airVelocity = 0;
				movementRotationAxis.multiplyScalar(0);
			}
			airMovementVector.multiplyScalar(airVelocity * dt);
			//this.body.addLinearVelocity(airMovementVector);
			this.body.linearVelocity.add(airMovementVector);

			this.slidingSound.gain.gain.setValueAtTime(0, this.level.audio.currentTime);
			this.rollingSound.gain.gain.linearRampToValueAtTime(0, this.level.audio.currentTime + 0.02);
			this.rollingMegaMarbleSound?.gain.gain.linearRampToValueAtTime(0, this.level.audio.currentTime + 0.02);
			this.rollingMetalSound?.gain.gain.linearRampToValueAtTime(0, this.level.audio.currentTime + 0.02);
			this.rollingPaperSound?.gain.gain.linearRampToValueAtTime(0, this.level.audio.currentTime + 0.02);
		}

		movementRotationAxis.multiplyScalar(this.speedFac);
		// Apply angular acceleration, but make sure the angular velocity doesn't exceed some maximum
		Util.addToVectorCapped(this.body.angularVelocity, movementRotationAxis, 120 * this.speedFac);

		if (this.level.finishTime) this.body.linearVelocity.multiplyScalar(0.9);

		if (allowUserInput && !this.isControlDisabled('use') && this.level.heldPowerUp && (isPressed('use') || this.level.useQueued) && getPressedFlag('use')) {
			this.level.replay.recordUsePowerUp(this.level.heldPowerUp);
			this.level.heldPowerUp.use(0);
			this.level.useQueued = false;
		}

		// Only allow custom jump if enabled for this level
		const enableCustomJumpAndDash = this.level.enableCustomJumpAndDash;
		if (allowUserInput && !this.isControlDisabled('blast') && (isPressed('blast') || this.level.blastQueued) && getPressedFlag('blast')) {
			this.useBlast();
			this.level.blastQueued = false;
		}

		if (this.justLanded && (isPressed('jump') || this.level.jumpQueued) && !this.isControlDisabled('jump')) {
			this.level.jumpQueued = true; // Queue a jump if space is held on landing
			this.justLanded = false;
		}

		this.slidingTimeout--;
		let jumping = (isPressed('jump') || this.level.jumpQueued) && !this.isControlDisabled('jump');
		if (!this.specialJumpAllowed && !jumping) this.specialJumpAllowed = true;
		if (!this.airjumpAllowed && !jumping) {
			this.airjumpAllowed = true;
		} else if (this.airjumpAllowed && jumping && !this.isOnGround() && !this.wallJumpFiredThisTick) {
			// Handle jumping
			if (enableCustomJumpAndDash && !state.menu.finishScreen.showing && this.airjumpsLeft > 0) {
				this.level.jumpQueued = false;
				this.airjumpAllowed = false;

				this.doAirjump();
				this.airjumpsLeft--;
			}
		}

		// Auto double jump / bounce jump — mirrors testDoubleJump() in playgui.cs, where both live under
		// one shared gate (falling + jump held + armed) and share a single latch: firing either one
		// (or both, if conditions allow) consumes it, and only an actual ground landing re-arms it. No
		// separate bounce-jump cooldown exists in the source, so none is added here. This whole block is
		// level-triggered on falling velocity, separate from the edge-triggered manual air-jump above.
		if (enableCustomJumpAndDash && this.autoDoubleJumpArmed && !this.isOnGround() && !this.wallJumpFiredThisTick
			&& isPressed('jump') && !this.isControlDisabled('jump')
			&& this.body.linearVelocity.dot(this.level.currentUp) < -0.1) {
			// Snapshot once, like $marbleVelocity being read once per frame in the source — the bounce
			// jump check below should see the pre-double-jump speed, not the value after it's modified.
			let verticalSpeed = this.body.linearVelocity.dot(this.level.currentUp);
			this.autoDoubleJumpArmed = false;

			// Double jump: unconditional once the shared gate above is satisfied.
			this.setLinearVelocityInDirection(
				this.level.currentUp,
				this.jumpImpulse + verticalSpeed,
				true,
				() => {
					this.playJumpSound();
					if (this.level.replay.canStore) this.level.replay.jumpSoundTimes.push(this.level.replay.currentTickIndex);
				}
			);

			// Bounce jump: stricter on top of the shared gate above — falling considerably faster, and
			// only right before impact. It doesn't launch you up; it amplifies the downward speed just
			// before landing, and lets the engine's own restitution (this.shape.restitution in tick())
			// turn that harder impact into a bigger rebound — matching AmplifySfx being an impact
			// amplifier, not a jump sound.
			if (verticalSpeed < -5) {
				const down = this.level.currentUp.clone().multiplyScalar(-1);
				const movement = down.clone().multiplyScalar(this.radius + 0.8);
				const hits = this.level.world.castShape(this.shape, movement, 1)
					.filter(hit => !this.body.collisions.some(c => c && c.s2 === hit.shape)); // exclude shapes already touching (e.g. a wall pressed against), same fix as the predictedPosition filter elsewhere in this file
				if (hits.length > 0) {
					this.body.linearVelocity.addScaledVector(this.level.currentUp, -5 * this.jumpImpulse);
					this.level.audio.play('bounce_boing.wav');
				}
			}
		}
	}

	onAfterIntegrate() {
		// We'll need these for collision response lata
		this.beforeVel.copy(this.body.linearVelocity);
		this.beforeAngVel.copy(this.body.angularVelocity);

		let time = this.level.timeState;
		let playReplay = this.level.replay.mode === 'playback';

		if (time.currentAttemptTime < GO_TIME && !playReplay) {
			// Lock the marble to the space above the start pad

			let { position: startPosition } = this.level.getStartPositionAndOrientation();
			let position = this.body.position;
			let vel = this.body.linearVelocity;
			// lock the marble to the space above the start pad in z axis too for 2 secs in Simulacrum..
			if (this.level.mission.title === "Simulacrum" && time.currentAttemptTime < 2000) {
				position.x = startPosition.x;
				position.y = startPosition.y;
				position.z = startPosition.z + 3; // keep frozen at same lifted position
				vel.set(0, 0, 0); // fully lock
			} else {
				position.x = startPosition.x;
				position.y = startPosition.y;
				vel.x = vel.y = 0;
			}

			let angVel = this.body.angularVelocity;
			// Cap the angular velocity so it doesn't go haywire
			if (angVel.length() > 60) angVel.normalize().multiplyScalar(60);

			this.shape.friction = 0;
		} else if (time.currentAttemptTime - this.oilEnableTime < 5000) {
			this.shape.friction = 0.05;
		} else if (time.currentAttemptTime - this.iceEnableTime < 5000) {
			this.shape.friction = 0.05;
		}
		else {
			this.shape.friction = 1;
		}
	}

	onBeforeCollisionResponse() {
		// Nothing.
	}

	onAfterCollisionResponse() {
		let bestCollision = this.findBestCollision(c => c.normal.dot(this.level.currentUp));
		if (!bestCollision) return;

		let { collision, contactNormal, contactShape, contactNormalUpDot } = bestCollision;

		this.lastContactNormal.copy(contactNormal);

		// Viridian's Playground: pressing jump while standing on a surface flips gravity (the normal jump is disabled in the mission)
		if (this.level.isGravityFlipJump && contactNormal.dot(this.level.currentUp) > 1e-6 && !state.menu.finishScreen.showing && isPressed('jump')) {
			this.level.flipGravity();
			return; // The up vector just changed, so skip the rest of this tick's collision handling
		}

		// Improve glue responsiveness at non contact with anything or if in mid air
		if (this.level.timeState.currentAttemptTime - this.glueEnableTime < this.glueTime) {
			this.level.setUp(this.lastContactNormal.clone().normalize());
			this.lastGlueTouchTime = this.level.timeState.currentAttemptTime;
		}

		let lastSurfaceRelativeVelocity = this.beforeVel.clone().sub(contactShape.body.linearVelocity);
		let surfaceRelativeVelocity = this.body.linearVelocity.clone().sub(contactShape.body.linearVelocity);
		let maxDotSlide = 0.5; // 30°

		// Implements sliding: If we hit the surface at an angle below 45°, and have movement keys pressed, we don't bounce.
		let dot0 = -contactNormal.dot(lastSurfaceRelativeVelocity.clone().normalize());
		let slidinigEligible = contactNormalUpDot > 0.1; // Kinda arbitrary rn, it's about 84°, definitely makes sure we don't slide on walls
		if (slidinigEligible && this.slidingTimeout <= 0 && dot0 > 0.001 && dot0 <= maxDotSlide && this.lastMovementVec.length() > 0) {
			let dot = contactNormal.dot(surfaceRelativeVelocity);
			let linearVelocity = this.body.linearVelocity;
			let originalLength = linearVelocity.length();
			linearVelocity.addScaledVector(contactNormal, -dot); // Remove all velocity in the direction of the surface normal

			let newLength = linearVelocity.length();
			let diff = originalLength - newLength;
			linearVelocity.normalize().multiplyScalar(newLength + diff * 2); // Give a small speedboost
		}

		// If we're using a shock absorber or we're on a low-restitution surface, give the marble a velocity boost on contact based on its angular velocity.
		outer:
		if (collision.restitution < 0.5) {
			let dot = -this.beforeVel.dot(contactNormal);
			if (dot < 0) break outer;

			let boost = this.beforeAngVel.clone().cross(contactNormal).multiplyScalar(2 * (0.5 - collision.restitution) * dot / 300 / 0.98); // 0.98 fac because shock absorber used to have 0 rest but now 0.01
			this.body.linearVelocity.add(boost);
		}

		// If using a doubled shock absorber...give the marble a yeet on steep slopes if having angular velocity...
		// Doubled Shock Absorber helps marble climb steep slopes very easily..
		if (this.shockAbsorberEnableTimex2 > 0 && collision.restitution < 0.5) {
			let dot = -this.beforeVel.dot(contactNormal);
			if (dot >= 0.01 && contactNormal.z < 0.86) { // Slopes only... Limit to slopes steeper than ~30°
				let gravityDir = contactNormal.clone(); // Acts as slope normal
				let tangent = new Vector3(0, 0, -1).projectOnPlane(gravityDir).normalize().negate();
				let frictionBoost = tangent.multiplyScalar(dot * 1.2); // strong anti-gravity friction necessary for climbing
				this.body.linearVelocity.add(frictionBoost);
			}
		}

		// Create a certain velocity boost on collisions with walls based on angular velocity. This assists in making wall-hits feel more natural.
		let angularBoost = this.body.angularVelocity.clone().cross(contactNormal).multiplyScalar((1 - Math.abs(contactNormalUpDot)) * contactNormal.dot(this.body.linearVelocity) / (Math.PI * 2) / 15);
		if (angularBoost.length() >= 0.01) {
			// Remove a bit of the current velocity so that the response isn't too extreme
			let currentVelocity = this.body.linearVelocity;
			let ratio = angularBoost.length() / currentVelocity.length();
			currentVelocity.multiplyScalar(1 / (1 + ratio * 0.5)).add(angularBoost);
		}

		this.airjumpsLeft = 2;


		// Handle jumping
		let continuousJump = this.level.mission.missionInfo?.continuousjump === "1";
		if (contactNormalUpDot > 1e-6 && !state.menu.finishScreen.showing && (isPressed('jump') || this.level.jumpQueued || continuousJump) && !this.isControlDisabled('jump')) {
			let jumpStrength = this.jumpImpulse;

			let isWallContact = false;
			let wallPushNormal: Vector3 | null = null;

			// Search all current collisions directly for a genuinely wall-like one, independent of
			// bestCollision/contactNormalUpDot -- that pick specifically favors the MOST ground-like
			// contact among everything currently touching, so at a corner where a wall meets the
			// ground (exactly the "hug wall, stand on the floor, press jump" case) it silently
			// discards a real, current wall touch and reports this as a plain ground contact. This is
			// what actually decides "is a wall present right now" -- previously that decision relied
			// solely on wallBounceHappened, which is itself set from that same ground-biased value
			// (see "Detect wall bounce" below), so a live wall touch at a corner could fail both checks
			// for the same underlying reason.
			let liveWallCollision = this.body.collisions.find(c =>
				c && c.s1 === this.shape && c.normal && Math.abs(c.normal.dot(this.level.currentUp)) < 0.5
			);

			// Eligible if a wall is touching THIS INSTANT (liveWallCollision), or was touched recently
			// enough to still be inside the forgiveness window (wallBounceHappened) even if not
			// touching right this tick.
			let atWall = !!(liveWallCollision || this.wallBounceHappened);
			// FIX: previously this block never checked wallJumpFiredThisTick, so it could ALSO fire
			// on the exact same real tick the raycast-based wall-kick (onBeforeIntegrate) already did,
			// applying a second, different velocity change (a plain contactNormal jump) on top of
			// whatever escape the first one started.
			if (this.level.enableCustomJumpAndDash && this.specialJumpAllowed && atWall && !this.wallJumpFiredThisTick) {
				// Two-press design: the full kick only fires once hasPlainJumpedAtWall is already true.
				// That flag is normally set by the raycast-based path (onBeforeIntegrate), which doesn't
				// need a live collision and so is the one actually reliable for catching the second
				// press once the first press has lifted the marble slightly off the wall; this block
				// mirrors the same rule for the rarer case where a live collision exists here but the
				// raycasts in the other path missed it.
				if (liveWallCollision && this.hasPlainJumpedAtWall) {
					// Second (or later) press during this wall session -> the full kick.
					isWallContact = true;
					jumpStrength = this.wallJumpImpulse;
					wallPushNormal = liveWallCollision.normal;
				} else if (liveWallCollision) {
					// First press at this wall -> stays a completely ordinary jump (falls through to
					// the plain contactNormal jump below, since isWallContact is still false here).
					// Just remember it happened so the next press here gets the upgrade.
					this.hasPlainJumpedAtWall = true;
				} else {
					// Still inside the forgiveness window but not touching right this instant -- give
					// the vertical-only special jump rather than the full kick, since there's no live
					// normal to push away from.
					jumpStrength = this.specialJumpImpulse;
				}
				this.specialJumpAllowed = false;
			}

			if (isWallContact && wallPushNormal) {
				// A wall push needs two orthogonal parts, not one impulse "along the normal" --
				// even a genuinely wall-like normal (contactNormalUpDot < 0.5) can still carry some
				// upward component unless the wall is perfectly vertical. Flatten it out first (the
				// same idea as SuperSpeed building a direction tangent to the last surface, rather
				// than boosting along its normal directly) so the horizontal kick is genuinely
				// horizontal, and apply the vertical lift separately via currentUp.
				let horizontalPush = wallPushNormal.clone()
					.addScaledVector(this.level.currentUp, -wallPushNormal.dot(this.level.currentUp));
				if (horizontalPush.lengthSq() > 1e-6) horizontalPush.normalize();

				this.setLinearVelocityInDirection(
					this.level.currentUp,
					this.wallJumpImpulse + this.body.linearVelocity.dot(this.level.currentUp),
					true,
					() => {
						this.playJumpSound();
						if (this.level.replay.canStore) this.level.replay.jumpSoundTimes.push(this.level.replay.currentTickIndex);
					}
				);
				if (horizontalPush.lengthSq() > 0) {
					// Blend some "up" into the kick's own direction before applying it -- same reasoning
					// as the matching change in the raycast-based wall-kick path (onBeforeIntegrate): a
					// parabolic arc instead of a flat shove, without needing a separate vertical call.
					let kickDirection = horizontalPush.clone()
						.addScaledVector(this.level.currentUp, this.wallJumpArcBlend)
						.normalize();
					// Override, not add -- see the matching comment in the raycast-based wall-kick
					// path (onBeforeIntegrate) for why.
					this.setLinearVelocityInDirection(kickDirection, this.wallJumpKickStrength, false);
					// NOTE: deliberately no manual position push here anymore -- see the matching
					// comment in the raycast-based wall-kick path (onBeforeIntegrate) for the full
					// rationale (revert() timing + solvePosition already doing this correctly).
				}
				this.wallJumpFiredThisTick = true;
				this.level.audio.play('bounce_boing.wav');
				this.wallJumpControlLockoutTimer = this.WALL_JUMP_CONTROL_LOCKOUT;
			} else {
				this.setLinearVelocityInDirection(contactNormal,
					jumpStrength + contactShape.body.linearVelocity.dot(contactNormal),
					true,
					() => {
						this.playJumpSound();
						if (jumpStrength === this.specialJumpImpulse) {
							this.level.audio.play('amplify.wav');
						}
						if (this.level.replay.canStore) this.level.replay.jumpSoundTimes.push(this.level.replay.currentTickIndex);
					});
			}

			// Holding jump through liftoff shouldn't hand out a free air jump the instant contact is lost.
			this.airjumpAllowed = false;
		}

		// Detect wall bounce (not ground) -- same fix as above: search collisions directly instead of
		// trusting contactNormalUpDot, which can misreport a genuine wall hit as "ground" if something
		// floor-like is also touching in the same instant (e.g. a wall/floor corner).
		let liveWallCollisionForBounce = this.body.collisions.find(c =>
			c && c.s1 === this.shape && c.normal && Math.abs(c.normal.dot(this.level.currentUp)) < 0.5
		);
		if (this.level.enableCustomJumpAndDash && liveWallCollisionForBounce && surfaceRelativeVelocity.length() > 2) {
			this.recentWallBounce = true;
			this.wallBounceTimer = this.WALL_BOUNCE_FORGIVENESS;
			this.wallBounceHappened = true;
		}
		// Only clear the wall-bounce flag once the wall itself is no longer part of the picture --
		// landing on the ground at a corner shouldn't erase a genuinely current wall touch.
		if (contactNormalUpDot > 0.5 && !liveWallCollisionForBounce) {
			this.recentWallBounce = false;
			this.wallBounceTimer = 0;
			this.wallBounceHappened = false;
			this.hasPlainJumpedAtWall = false;
		}
		// Landing benefits apply whenever we've actually touched down, wall or no wall nearby.
		if (contactNormalUpDot > 0.5) {
			this.airjumpsLeft = 2;
			this.airjumpAllowed = true;
			this.justLanded = true;
			this.autoDoubleJumpArmed = true;
		}

		// Create bounce particles
		let mostPowerfulCollision = this.findBestCollision(c => {
			return -c.normal.dot(this.beforeVel.clone().sub(c.s2.body.linearVelocity));
		});
		let impactVelocity = -mostPowerfulCollision.contactNormal.dot(this.beforeVel.clone().sub(contactShape.body.linearVelocity));
		if (impactVelocity > 6) this.showBounceParticles();

		// Handle bounce sound
		let volume = Util.clamp((impactVelocity / 12) ** 1.5, 0, 1);
		if (impactVelocity > 1) {
			// Play a collision impact sound
			this.playBounceSound(volume);
			if (this.level.replay.canStore) this.level.replay.bounceTimes.push({ tickIndex: this.level.replay.currentTickIndex, volume: volume, showParticles: impactVelocity > 6 });
		}

		// Handle rolling and sliding sounds
		if (contactNormal.dot(surfaceRelativeVelocity) < 0.01) {
			let predictedMovement = this.body.angularVelocity.clone().cross(this.level.currentUp).multiplyScalar(1 / Math.PI / 2);
			// The expected movement based on the current angular velocity. If actual movement differs too much, we consider the marble to be "sliding".

			if (predictedMovement.dot(surfaceRelativeVelocity) < -0.00001 || (predictedMovement.length() > 0.5 && predictedMovement.length() > surfaceRelativeVelocity.length() * 1.5)) {
				this.slidingSound.gain.gain.setValueAtTime(0.6, this.level.audio.currentTime);
				this.rollingSound.gain.gain.setValueAtTime(0, this.level.audio.currentTime);
				if (this.rollingMegaMarbleSound) this.rollingMegaMarbleSound.gain.gain.setValueAtTime(0, this.level.audio.currentTime);
				if (this.rollingMetalSound) this.rollingMetalSound.gain.gain.setValueAtTime(0, this.level.audio.currentTime);
				if (this.rollingPaperSound) this.rollingPaperSound.gain.gain.setValueAtTime(0, this.level.audio.currentTime);
			} else {
				this.slidingSound.gain.gain.setValueAtTime(0, this.level.audio.currentTime);
				let pitch = Util.clamp(surfaceRelativeVelocity.length() / 15, 0, 1) * 0.75 + 0.75;

				this.rollingSound.gain.gain.linearRampToValueAtTime(Util.clamp(pitch - 0.75, 0, 1), this.level.audio.currentTime + 0.02);
				this.rollingMegaMarbleSound?.gain.gain.linearRampToValueAtTime(Util.clamp(pitch - 0.75, 0, 1), this.level.audio.currentTime + 0.02);
				this.rollingMetalSound?.gain.gain.linearRampToValueAtTime(Util.clamp(pitch - 0.75, 0, 1), this.level.audio.currentTime + 0.02);
				this.rollingPaperSound?.gain.gain.linearRampToValueAtTime(Util.clamp(pitch - 0.75, 0, 1), this.level.audio.currentTime + 0.02);
				this.rollingSound.setPlaybackRate(pitch);
				this.rollingMegaMarbleSound?.setPlaybackRate(pitch);
				this.rollingMetalSound?.setPlaybackRate(pitch);
				this.rollingPaperSound?.setPlaybackRate(pitch);
			}
		} else {
			this.slidingSound.gain.gain.setValueAtTime(0, this.level.audio.currentTime);
			this.rollingSound.gain.gain.linearRampToValueAtTime(0, this.level.audio.currentTime + 0.02);
			this.rollingMegaMarbleSound?.gain.gain.linearRampToValueAtTime(0, this.level.audio.currentTime + 0.02);
			this.rollingMetalSound?.gain.gain.linearRampToValueAtTime(0, this.level.audio.currentTime + 0.02);
			this.rollingPaperSound?.gain.gain.linearRampToValueAtTime(0, this.level.audio.currentTime + 0.02);
		}
		// --- Airplane crash detection ---
		if (impactVelocity > 4.78) { // Threshold for "crash"
			this.crashPlane(volume);
		}
	}


	tick(time: TimeState) {
		if (time.currentAttemptTime - this.shockAbsorberEnableTime < this.shockAbsorberTime || time.currentAttemptTime - this.shockAbsorberEnableTimex2 < this.shockAbsorberTime * 2) {
			this.forcefield.setOpacity(1);
			this.shape.restitution = 0.01;

			if (!this.shockAbsorberSound) {
				this.shockAbsorberSound = this.level.audio.createAudioSource('superbounceactive.wav');
				this.shockAbsorberSound.setLoop(true);
				this.shockAbsorberSound.play();
			}
		} else if (time.currentAttemptTime - this.superBounceEnableTime < this.superBounceTime || time.currentAttemptTime - this.superBounceEnableTimex2 < this.superBounceTime * 2) {
			this.forcefield.setOpacity(1);
			this.shape.restitution = this.superBounceBounceRestitution;

			this.shockAbsorberSound?.stop();
			this.shockAbsorberSound = null;
		} else {
			this.forcefield.setOpacity(0);
			this.shape.restitution = this.bounceRestitution;

			this.shockAbsorberSound?.stop();
			this.shockAbsorberSound = null;
			this.superBounceSound?.stop();
			this.superBounceSound = null;
		}
		if (time.currentAttemptTime - this.superBounceEnableTime < this.superBounceTime || time.currentAttemptTime - this.superBounceEnableTimex2 < this.superBounceTime * 2) {
			if (!this.superBounceSound) {
				this.superBounceSound = this.level.audio.createAudioSource('forcefield.wav');
				this.superBounceSound.setLoop(true);
				this.superBounceSound.play();
			}
		}
		if (time.currentAttemptTime - this.helicopterEnableTime < this.gyrocopterTime) {
			this.helicopter.setOpacity(1);
			this.helicopter.setTransform(new Vector3(0, 0, this.radius - DEFAULT_RADIUS).applyQuaternion(this.level.newOrientationQuat), this.level.newOrientationQuat, new Vector3(1, 1, 1));
			this.level.setGravityIntensity(this.level.defaultGravity * this.gyrocopterGravityMultiplier);

			if (!this.helicopterSound) {
				this.helicopterSound = this.level.audio.createAudioSource('use_gyrocopter.wav');
				this.helicopterSound.setLoop(true);
				this.helicopterSound.play();
			}
		} else if (time.currentAttemptTime - this.helicopterEnableTimex2 < this.gyrocopterTime * 2) {
			this.helicopter.setOpacity(1);
			this.helicopter.setTransform(new Vector3(0, 0, this.radius - DEFAULT_RADIUS).applyQuaternion(this.level.newOrientationQuat), this.level.newOrientationQuat, new Vector3(1, 1, 1));
			this.level.setGravityIntensity(this.level.defaultGravity * this.gyrocopterGravityMultiplier * 0.5);

			if (!this.helicopterSound) {
				this.helicopterSound = this.level.audio.createAudioSource('use_gyrocopter.wav');
				this.helicopterSound.setLoop(true);
				this.helicopterSound.play();
			}
		} else {
			this.helicopter.setOpacity(0);
			this.level.setGravityIntensity(this.level.defaultGravity);

			this.helicopterSound?.stop();
			this.helicopterSound = null;
		}

		if (this.radius !== MEGA_MARBLE_RADIUS && time.currentAttemptTime - this.megaMarbleEnableTime < 10000) {
			this.setRadius(MEGA_MARBLE_RADIUS);
			this.body.linearVelocity.addScaledVector(this.level.currentUp, 6);
			this.rollingSound.stop();
			this.rollingMegaMarbleSound?.play();
		} else if (time.currentAttemptTime - this.megaMarbleEnableTime >= 10000) {
			this.setRadius(this.level.mission.hasUltraMarble ? ULTRA_RADIUS : DEFAULT_RADIUS);
			this.rollingSound.play();
			this.rollingMegaMarbleSound?.stop();
		}

		// Update metal/paper active state based on enable times (centralized handling)
		const metalActive = (time.currentAttemptTime - this.metalEnableTime) < this.metalTime;
		const paperActive = (time.currentAttemptTime - this.paperEnableTime) < this.paperTime;
		this.metal = metalActive;
		this.paper = paperActive;

		// Apply jump impulse modifiers deterministically from baseJumpImpulse
		let desiredJumpImpulse = this.baseJumpImpulse ?? this.jumpImpulse;
		if (paperActive) desiredJumpImpulse = this.baseJumpImpulse * 3;
		else if (metalActive) desiredJumpImpulse = this.baseJumpImpulse * 0.5;
		// Only apply if the desired powerup-driven value changed. This allows triggers or other systems
		// to temporarily override `jumpImpulse` without being stomped each tick.
		// If an external system has disabled jumping (e.g. no-jump trigger sets -1), respect that override
		if (this.jumpImpulse !== -1 && this.lastAppliedPowerupJumpImpulse !== desiredJumpImpulse) {
			this.jumpImpulse = desiredJumpImpulse;
			this.lastAppliedPowerupJumpImpulse = desiredJumpImpulse;
		}
		if (time.currentAttemptTime - this.metalEnableTime < this.metalTime) {
			this.rollingSound.stop();
			this.rollingMetalSound?.play();
			if (!this.metalSound) {
				this.metalSound = this.level.audio.createAudioSource('usemetal.wav');
				this.metalSound.play();
			}
		} else if (time.currentAttemptTime - this.metalEnableTime >= this.metalTime) {
			this.rollingSound.play();
			this.rollingMetalSound?.stop();
			this.metalSound?.stop();
			this.metalSound = null;
		}
		if (time.currentAttemptTime - this.paperEnableTime < this.paperTime) {
			this.rollingSound.stop();
			this.rollingPaperSound?.play();
			if (!this.paperSound) {
				this.paperSound = this.level.audio.createAudioSource('usepaper.wav');
				this.paperSound.play();
			}
		} else if (time.currentAttemptTime - this.paperEnableTime >= this.paperTime) {
			this.rollingSound.play();
			this.rollingPaperSound?.stop();
			this.paperSound?.stop();
			this.paperSound = null;
		}
		if (time.currentAttemptTime - this.oilEnableTime < 5000) {
			this.oilimage.setOpacity(1);
			this.shape.friction = 0.01;
			if (!this.oilSound) {
				this.oilSound = this.level.audio.createAudioSource('useglue.wav');
				this.oilSound.play();
			}
		} else {
			this.oilimage.setOpacity(0);
			this.shape.friction = 1;
			this.oilSound?.stop();
			this.oilSound = null;
		}

		if (time.currentAttemptTime - this.glueEnableTime < this.glueTime) {
			// Show the glue image
			this.glueimage.setOpacity(1);
			//this.level.setUp(this.lastContactNormal.clone().normalize());  // glue powerup sticks the marble on last contact with surface
			if (time.currentAttemptTime - this.lastGlueTouchTime > 620 && this.oldGravity) {
				this.level.setUp(this.oldGravity);
			}
			if (!this.glueSound) {
				this.glueSound = this.level.audio.createAudioSource('useglue.wav');
				this.glueSound.play();
			}
		} else {
			this.glueimage.setOpacity(0);
			if (this.oldGravity) {
				this.level.setUp(this.oldGravity);
				this.oldGravity = null; // restore once; otherwise it overrides gravity every frame
			}
			this.glueSound?.stop();
			this.glueSound = null;
		}

		if (time.currentAttemptTime - this.iceEnableTime < 5000) {
			this.iceimage.setOpacity(1);
			this.shape.friction = 0.01;
		} else {
			this.iceimage.setOpacity(0);
			this.shape.friction = 1;
		}

		// Handling the airplane orientation
		let orient = this.level.camera.orientation.clone();
		let rotate = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
		orient.multiply(rotate);

		if (this.isFlyingPlane) {
			// Advance barrel roll animation
			if (this.barrelRollActive) {
				const tickMs = 1000 / PHYSICS_TICK_RATE;
				this.barrelRollAngle += (2 * Math.PI / this.BARREL_ROLL_DURATION) * tickMs;
				if (this.barrelRollAngle >= 2 * Math.PI) {
					this.barrelRollAngle = 0;
					this.barrelRollActive = false;
				}
				// Rotate around the camera's forward axis (the plane's flight direction)
				let forward = new Vector3(0, 0, -1).applyQuaternion(this.level.camera.orientation);
				let rollQuat = new Quaternion().setFromAxisAngle(forward, this.barrelRollAngle);
				orient = rollQuat.clone().multiply(orient);
			}

			// Show the airplane
			this.airplaneimage.setOpacity(1);
			// this.airplaneimage.setTransform(new Vector3(0, 0, this.radius - DEFAULT_RADIUS).applyQuaternion(this.level.newOrientationQuat), this.level.newOrientationQuat, new Vector3(1, 1, 1));
			this.airplaneimage.setTransform(new Vector3(0, 0, this.radius - DEFAULT_RADIUS).applyQuaternion(orient), orient, new Vector3(1, 1, 1));
			this.level.setGravityIntensity(0);

			if (!this.airplaneSound) {
				this.airplaneSound = this.level.audio.createAudioSource('airplane_noise.wav');
				this.airplaneSound.setLoop(true);
				this.airplaneSound.play();
			}
		} else {
			this.isFlyingPlane = false;
			this.airplaneimage.setOpacity(0);
			this.airplaneSound?.stop();
			this.airplaneSound = null;
		}

		// Handle dynamic texture swapping: paper takes precedence over metal; restore original selected texture afterwards.
		const restoreTexturePath = this.selectedTexturePath || "shapes/balls/base.marble.png";
		// Some marbles (madness, madness2) should never receive the generic powerup textures
		const skipPowerupTextureOverride = (this.selectedMarbleId === 'madness' || this.selectedMarbleId === 'madness2');
		if (!skipPowerupTextureOverride) {
			if (this.paper && this.currentTexturePath !== "shapes/balls/paper.marble.png") {
				ResourceManager.getTexture("shapes/balls/paper.marble.png").then(tex => {
					if (this.sphere?.materials[0]) this.sphere.materials[0].diffuseMap = tex;
					if (this.ballShape) {
						// Update existing materials immediately so the DTS updates visually
						for (let m of this.ballShape.materials || []) m.diffuseMap = tex;
						this.ballShape.matNamesOverride = new Proxy({} as Record<string, Texture>, { get: (_t, _k) => tex });
					}
					this.currentTexturePath = "shapes/balls/paper.marble.png";
				});
			} else if (!this.paper && this.currentTexturePath === "shapes/balls/paper.marble.png") {
				ResourceManager.getTexture(restoreTexturePath).then(tex => {
					if (this.sphere?.materials[0]) this.sphere.materials[0].diffuseMap = tex;
					if (this.ballShape) {
						for (let m of this.ballShape.materials || []) m.diffuseMap = tex;
						this.ballShape.matNamesOverride = new Proxy({} as Record<string, Texture>, { get: (_t, _k) => tex });
					}
					this.currentTexturePath = restoreTexturePath;
				});
			}
		}

		if (!this.paper) {
			if (this.metal && this.currentTexturePath !== "shapes/balls/metal.marble.png" && !skipPowerupTextureOverride) {
				ResourceManager.getTexture("shapes/balls/metal.marble.png").then(tex => {
					if (this.sphere?.materials[0]) this.sphere.materials[0].diffuseMap = tex;
					if (this.ballShape) {
						for (let m of this.ballShape.materials || []) m.diffuseMap = tex;
						this.ballShape.matNamesOverride = new Proxy({} as Record<string, Texture>, { get: (_t, _k) => tex });
					}
					this.currentTexturePath = "shapes/balls/metal.marble.png";
				});
			} else if (!this.metal && this.currentTexturePath === "shapes/balls/metal.marble.png" && !skipPowerupTextureOverride) {
				ResourceManager.getTexture(restoreTexturePath).then(tex => {
					if (this.sphere?.materials[0]) this.sphere.materials[0].diffuseMap = tex;
					if (this.ballShape) {
						for (let m of this.ballShape.materials || []) m.diffuseMap = tex;
						this.ballShape.matNamesOverride = new Proxy({} as Record<string, Texture>, { get: (_t, _k) => tex });
					}
					this.currentTexturePath = restoreTexturePath;
				});
			}
		}

		// ── Marble-specific trail effects ─────────────────────────────────────────────
		{
			const marbleDef = getMarbleDefinition(state.selectedMarble || 'default');
			const marbleName = (marbleDef?.name ?? '').toLowerCase();
			const speed = this.body.linearVelocity.length();
			const dt = 1000 / PHYSICS_TICK_RATE;

			if (state.selectedMarble === 'goldenmarble') {
				// ── Gold ──────────────────────────────────────────────────────────────
				if (speed >= 1) {
					this.lastGoldTrailTime += dt;
					if (this.lastGoldTrailTime >= 40) {   // ← new: only spawn every 40ms ≈ mid density
						this.lastGoldTrailTime = 0;
						goldTrailParticleOptions.ambientVelocity = this.level.currentUp.clone().multiplyScalar(1.5);
						this.level.particles.createEmitter(
							goldTrailParticleOptions,
							null,
							() => this.predictedPosition.clone(),
							new Vector3(0.15, 0.15, 0.15).addScaledVector(Util.absVector(this.level.currentUp.clone()), 0.85)
						);
					}} else {
					this.lastGoldTrailTime = 0;
				}
				this.marbleTrailAccumTime = 0;

			} else if (marbleName.includes('nyan')) {
				// ── Nyan Cat ──────────────────────────────────────────────────────────
				const NYAN_FADE_MS = 1800;
				const NYAN_SPAWN_INTERVAL = 30;
				const NYAN_SCALE = 0.45;

				for (const entry of this.nyanRainbowPool) {
					if (!entry.active) continue;
					const elapsed = this.level.timeState.timeSinceLoad - entry.fadeStart;
					const opacity = Math.max(0, 1 - elapsed / NYAN_FADE_MS);
					entry.shape.setOpacity(opacity);
					if (elapsed >= NYAN_FADE_MS) {
						entry.shape.setOpacity(0);
						entry.active = false;
					}
				}

				if (speed > 0.08) {
					this.marbleTrailAccumTime += dt;
					while (this.marbleTrailAccumTime >= NYAN_SPAWN_INTERVAL) {
						this.marbleTrailAccumTime -= NYAN_SPAWN_INTERVAL;

						const entry = this.nyanRainbowPool.find(e => !e.active);
						if (entry) {
							const velNorm = this.body.linearVelocity.clone().normalize();
							const spawnPos = this.body.position.clone()
								.addScaledVector(velNorm, -this.radius * 0.5);

							const forward = new Vector3(0, 1, 0);
							const targetQuat = velNorm.length() > 0.001
								? new Quaternion().setFromUnitVectors(forward, velNorm)
								: new Quaternion();

							entry.shape.setTransform(
								spawnPos,
								targetQuat,
								new Vector3(NYAN_SCALE, NYAN_SCALE, NYAN_SCALE)
							);
							entry.shape.setOpacity(1);
							entry.fadeStart = this.level.timeState.timeSinceLoad;
							entry.active = true;
						}
					}
				} else {
					this.marbleTrailAccumTime = 0;
				}
				this.lastGoldTrailTime = 0;

			} else if (marbleName.includes('honeydew')) {
				// ── Jaffa Cake ────────────────────────────────────────────────────────
				const JAFFA_FADE_MS   = 10000;
				const JAFFA_DELETE_MS = 50000;
				const JAFFA_INTERVAL  = 700;

				for (const entry of this.jaffacakePool) {
					if (!entry.active) continue;
					const elapsed = this.level.timeState.timeSinceLoad - entry.spawnTime;
					entry.shape.setOpacity(Math.max(0, 1 - elapsed / JAFFA_FADE_MS));
					if (elapsed >= JAFFA_DELETE_MS) {
						entry.shape.setOpacity(0);
						entry.active = false;
					} else {
						entry.shape.render(time);
					}
				}

				this.marbleTrailAccumTime += dt;
				if (this.marbleTrailAccumTime > JAFFA_INTERVAL) this.marbleTrailAccumTime = JAFFA_INTERVAL;

				// Same fix as the septic goo trail: jaffa cakes are anchored in world
				// space once spawned, so painting while riding a moving platform or
				// elevator leaves a floating trail behind as the platform carries the
				// marble past each dropped cake. Only paint while genuinely rolling on
				// ground that is itself static — the floor-like normal check below
				// mirrors isOnGround(), now paired with a check on the contact surface's
				// own velocity plus the marble's velocity relative to it.
				const JAFFA_MIN_ROLL_SPEED = 1;
				const JAFFA_MAX_SURFACE_SPEED = 0.05;
				const jaffaContact = this.body.collisions.find(c => c && c.normal && Math.abs(c.normal.dot(this.level.currentUp)) > 0.8);
				let shouldPaintJaffa = false;
				if (jaffaContact) {
					const surfaceVelocity = jaffaContact.s2?.body?.linearVelocity ?? new Vector3();
					const isSurfaceStatic = surfaceVelocity.length() <= JAFFA_MAX_SURFACE_SPEED;
					if (isSurfaceStatic) {
						const relativeVelocity = this.body.linearVelocity.clone().sub(surfaceVelocity);
						shouldPaintJaffa = relativeVelocity.length() > JAFFA_MIN_ROLL_SPEED;
					}
				}

				if (shouldPaintJaffa && this.marbleTrailAccumTime >= JAFFA_INTERVAL) {
					this.marbleTrailAccumTime = 0;

					const entry = this.jaffacakePool.find(e => !e.active);
					if (entry) {
						const up = this.level.currentUp.clone().normalize();
						const jaffaPos = this.body.position.clone().addScaledVector(up, -this.radius);
						const baseQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), up);
						const spinQuat = new Quaternion().setFromAxisAngle(up, Math.random() * Math.PI * 2);
						const jaffaQuat = spinQuat.multiply(baseQuat);
						const randScale = Math.random() + 1;
						entry.shape.setTransform(jaffaPos, jaffaQuat, new Vector3(randScale, randScale, 1));
						entry.shape.setOpacity(1);
						entry.spawnTime = this.level.timeState.timeSinceLoad;
						entry.active = true;
					}
				}
				this.lastGoldTrailTime = 0;

			} else if (state.selectedMarble === 'septiceye') {
				// ── Septic Eye ────────────────────────────────────────────────────────
				const GOO_FADE_MS   = 10000;
				const GOO_DELETE_MS = 12000;
				const GOO_INTERVAL  = 120;

				for (const entry of this.septicGooPool) {
					if (!entry.active) continue;
					const elapsed = this.level.timeState.timeSinceLoad - entry.spawnTime;
					entry.shape.setOpacity(Math.max(0, 1 - elapsed / GOO_FADE_MS));
					if (elapsed >= GOO_DELETE_MS) {
						entry.shape.setOpacity(0);
						entry.active = false;
					} else {
						entry.shape.render(time);
					}
				}
				this.marbleTrailAccumTime += dt;
				if (this.marbleTrailAccumTime > GOO_INTERVAL) this.marbleTrailAccumTime = GOO_INTERVAL;

				// Matches original MBPU behavior: septic goo never spawns on a moving
				// platform or elevator — only while genuinely rolling on static
				// ground/interiors. Goo blobs are anchored in world space once spawned,
				// so even a "correctly" rolling-triggered blob would drift into a
				// floating trail if the contact surface keeps translating after the
				// spawn moment (the blob stays put while the platform carries the
				// marble past it). Requiring the surface's own velocity to be ~0 avoids
				// that, on top of requiring the marble to actually be moving relative
				// to the surface.
				const GOO_MIN_ROLL_SPEED = 1;
				const GOO_MAX_SURFACE_SPEED = 0.05;
				const gooContact = this.body.collisions.find(c => c && c.normal);
				let shouldPaintGoo = false;
				if (gooContact) {
					const surfaceVelocity = gooContact.s2?.body?.linearVelocity ?? new Vector3();
					const isSurfaceStatic = surfaceVelocity.length() <= GOO_MAX_SURFACE_SPEED;
					if (isSurfaceStatic) {
						const relativeVelocity = this.body.linearVelocity.clone().sub(surfaceVelocity);
						shouldPaintGoo = relativeVelocity.length() > GOO_MIN_ROLL_SPEED;
					}
				}

				if (shouldPaintGoo && this.marbleTrailAccumTime >= GOO_INTERVAL) {
					this.marbleTrailAccumTime = 0;

					const entry = this.septicGooPool.find(e => !e.active);
					if (entry) {
						// Use actual surface normal so goo aligns with slope angle
						const surfaceNormal = gooContact.normal.clone().normalize();
						// If normal points away from marble, flip it
						const up = surfaceNormal.dot(this.level.currentUp) >= 0
							? surfaceNormal
							: surfaceNormal.negate();

						const gooPos = this.body.position.clone().addScaledVector(up, -this.radius);
						const baseQuat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), up);
						const spinQuat = new Quaternion().setFromAxisAngle(up, Math.random() * Math.PI * 2);
						const gooQuat = spinQuat.multiply(baseQuat);
						const randScale = Math.random() + 1;
						entry.shape.setTransform(gooPos, gooQuat, new Vector3(randScale, randScale, 1));
						entry.shape.setOpacity(1);
						entry.spawnTime = this.level.timeState.timeSinceLoad;
						entry.active = true;
					}
				}
				this.lastGoldTrailTime = 0;
			} else {
				// No trail marble — reset both accumulators
				this.marbleTrailAccumTime = 0;
				this.lastGoldTrailTime = 0;
			}
		}

		// Update powerup camera effects each frame
		this.updatePowerupCameraEffects(time);
	}
	playJumpSound() {
		// Suppress jump sound in Simulacrum level
		if (this.level.mission.title === "Simulacrum") return;
		// Except it Everything's fine :)
		this.level.audio.play(['jump.wav'], undefined, undefined, undefined);
	}

	playBounceSound(volume: number) {
		// Suppress Bounce sound in Simulacrum level
		if (this.level.mission.title === "Simulacrum") return;
		// Except it Everything's fine :)
		let prefix = (this.radius === MEGA_MARBLE_RADIUS) ? 'mega_' : '';
		let metalbounce = (this.metal) ? 'metal_' : '';
		let paperbounce = (this.paper) ? 'paper_' : '';
		this.level.audio.play(['bouncehard1.wav', 'bouncehard2.wav', 'bouncehard3.wav', 'bouncehard4.wav'].map(x => prefix + x), volume);
		if (this.metal) {
			this.level.audio.play(['bouncehard1.wav', 'bouncehard2.wav', 'bouncehard3.wav', 'bouncehard4.wav'].map(x => metalbounce + x), volume);
		}
		if (this.paper) {
			this.level.audio.play(['bouncehard1.wav', 'bouncehard2.wav', 'bouncehard3.wav', 'bouncehard4.wav'].map(x => paperbounce + x), volume);
		}
	}

	showBounceParticles() {
		this.level.particles.createEmitter(bounceParticleOptions, this.body.position, null,
			new Vector3(1, 1, 1).addScaledVector(Util.absVector(this.level.currentUp.clone()), -0.8));
	}

	/** Directly separates the marble from a wall along `direction`, by as much as is genuinely open
	 * -- measured with a shape sweep -- rather than a fixed guess. A fixed radius-based nudge (what
	 * this used to do) can be far too small if the marble is meaningfully embedded (e.g. crushed
	 * between two close panels), which is exactly the "still stuck, camera clipped into the wall"
	 * failure mode. Sweeping first means we can safely ask for a generous distance and still never
	 * move further than what's actually clear, avoiding tunneling into unseen geometry on the other
	 * side. If the sweep says there's essentially zero room at all (the pathological fully-embedded
	 * case), fall back to a small fixed nudge anyway -- moving a little is strictly better than the
	 * marble never moving, even if it risks a sliver of tunneling in that edge case. Returns the
	 * distance actually moved. */
	pushAwayFromWall(direction: Vector3, desiredDistance: number, margin = 0.02): number {
		const sweep = direction.clone().multiplyScalar(desiredDistance);
		const hits = this.level.world.castShape(this.shape, sweep, 1);

		let clearDistance = desiredDistance;
		if (hits.length > 0) clearDistance = Math.max(0, hits[0].lambda * desiredDistance - margin);

		if (clearDistance < this.radius * 0.1) {
			// Essentially no clear space found -- likely fully embedded. Do a small fixed nudge
			// anyway rather than leaving the marble stuck with zero movement.
			clearDistance = this.radius * this.WALL_JUMP_POSITION_NUDGE_FACTOR;
		}

		this.body.position.addScaledVector(direction, clearDistance);
		this.body.syncShapes();
		return clearDistance;
	}

	/** Sets linear velocity in a specific direction, but capped. Used for things like jumping and bumpers. */
	setLinearVelocityInDirection(direction: Vector3, magnitude: number, onlyIncrease: boolean, onIncrease: () => any = () => { }) {
		let unitVelocity = this.body.linearVelocity.clone().normalize();
		let dot = unitVelocity.dot(direction);
		let directionalSpeed = dot * this.body.linearVelocity.length();

		if (directionalSpeed < magnitude || !onlyIncrease) {
			let velocity = this.body.linearVelocity;
			velocity.addScaledVector(direction, -directionalSpeed);
			velocity.addScaledVector(direction, magnitude);

			if (directionalSpeed < magnitude) onIncrease();
		}
	}

	/** Predicts the position of the marble in the next physics tick to allow for smooth, interpolated rendering. */
	calculatePredictiveTransforms() {
		let pos = this.body.position;
		let orientation = this.body.orientation;
		let linVel = this.body.linearVelocity;
		let angVel = this.body.angularVelocity;

		// Naive: Just assume the marble moves as if nothing was in its way and it continued with its current velocity.
		let predictedPosition = pos.clone().addScaledVector(linVel, 1 / PHYSICS_TICK_RATE).addScaledVector(this.level.world.gravity, 1 / PHYSICS_TICK_RATE ** 2 / 2);
		let movementDiff = predictedPosition.clone().sub(pos);

		let dRotation = angVel.clone().multiplyScalar(1 / PHYSICS_TICK_RATE);
		let dRotationLength = dRotation.length();
		let dq = new Quaternion().setFromAxisAngle(dRotation.normalize(), dRotationLength);
		let predictedOrientation = dq.multiply(orientation);

		// See if we hit something, do this to prevent clipping through things
		let hits = this.level.world.castShape(this.shape, movementDiff, 1);
		let hit = hits.find(x => !this.body.collisions.some(y => y.s2 === x.shape)); // Filter out hits with shapes we're already touching
		let lambda = hit?.lambda ?? 1;

		this.predictedPosition.lerpVectors(pos, predictedPosition, lambda);
		this.predictedOrientation.copy(orientation).slerp(predictedOrientation, lambda);
	}

	render(time: TimeState) {
		// Position based on current and predicted position and orientation
		this.group.position.copy(this.body.position).lerp(this.predictedPosition, time.physicsTickCompletion);
		this.innerGroup.orientation.copy(this.body.orientation).slerp(this.predictedOrientation, time.physicsTickCompletion);
		if (this.ballShape?.dtsPath === 'shapes/balls/ball-doom.dts') {
			this.innerGroup.orientation.copy(this.level.camera.orientation);
		}
		if (this.ballShape?.dtsPath === 'shapes/balls/cube.dts') {
			let up = this.level.currentUp.clone().normalize();
			let vel = this.body.linearVelocity.clone();
			let faceDir: Vector3;
			if (vel.length() > 0.1) {
				faceDir = vel.normalize();
			} else if (this.lastMovementVec.length() > 0.01) {
				let lm = this.lastMovementVec.clone();
				lm.addScaledVector(up, -lm.dot(up));
				faceDir = lm.length() > 0.01 ? lm.normalize() : new Vector3(1, 0, 0);
			} else {
				faceDir = new Vector3(1, 0, 0);
			}
			let right = new Vector3().crossVectors(faceDir, up).normalize();
			let m00 = right.x,   m10 = right.y,   m20 = right.z;
			let m01 = faceDir.x, m11 = faceDir.y, m21 = faceDir.z;
			let m02 = up.x,      m12 = up.y,      m22 = up.z;
			let trace = m00 + m11 + m22;
			let targetQuat = new Quaternion();
			if (trace > 0) {
				let s = 0.5 / Math.sqrt(trace + 1);
				targetQuat.set((m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s);
			} else if (m00 > m11 && m00 > m22) {
				let s = 2 * Math.sqrt(1 + m00 - m11 - m22);
				targetQuat.set(0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s);
			} else if (m11 > m22) {
				let s = 2 * Math.sqrt(1 + m11 - m00 - m22);
				targetQuat.set((m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s);
			} else {
				let s = 2 * Math.sqrt(1 + m22 - m00 - m11);
				targetQuat.set((m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s);
			}
			if (!this.cubeOrientation) this.cubeOrientation = targetQuat.clone();
			targetQuat.normalize();
			this.cubeOrientation.slerp(targetQuat, 0.15);
			this.cubeOrientation.normalize();
			this.innerGroup.orientation.copy(this.cubeOrientation);
		}

		this.group.recomputeTransform();
		this.innerGroup.recomputeTransform();

		if (this.ballShape) this.ballShape.render(time);
		this.forcefield.render(time);
		this.glueimage.render(time);
		this.oilimage.render(time);
		this.iceimage.render(time);
		this.airplaneimage.render(time);
		if (time.currentAttemptTime - this.helicopterEnableTime < this.gyrocopterTime) this.helicopter.render(time);
		else if (time.currentAttemptTime - this.helicopterEnableTimex2 < this.gyrocopterTime * 2) this.helicopter.render(time);

		// Update the teleporting look:

		let teleportFadeCompletion = 0;

		if (this.teleportEnableTime !== null) teleportFadeCompletion = Util.clamp((time.currentAttemptTime - this.teleportEnableTime) / TELEPORT_FADE_DURATION, 0, 1);
		if (this.teleportDisableTime !== null) teleportFadeCompletion = Util.clamp(1 - (time.currentAttemptTime - this.teleportDisableTime) / TELEPORT_FADE_DURATION, 0, 1);

		if (teleportFadeCompletion > 0) {
			this.sphere.opacity = Util.lerp(1, 0.25, teleportFadeCompletion);
		} else {
			this.sphere.opacity = Number(!this.ballShape);
		}

		// Airplane crash explosion light fade — 1.3 seconds from fiery white to black
		let CRASH_LIGHT_DURATION = 1300;
		if (this.planeCrashLight && time.timeSinceLoad < this.planeCrashTime + CRASH_LIGHT_DURATION) {
			let progress = (time.timeSinceLoad - this.planeCrashTime) / CRASH_LIGHT_DURATION;
			// Range fades from 6 down to 2
			this.planeCrashLight.range = Util.lerp(15, 5, progress);
			// Color fades from bright fiery orange (6 6 6) to black
			this.planeCrashLight.color.set(
				Util.lerp(6, 0, progress),
				Util.lerp(6, 0, progress),
				Util.lerp(6, 0, progress)
			);
		} else if (this.planeCrashLight && time.timeSinceLoad >= this.planeCrashTime + CRASH_LIGHT_DURATION) {
			// Fade complete — remove from scene
			let index = this.level.scene.pointLights.indexOf(this.planeCrashLight);
			if (index > -1) this.level.scene.pointLights.splice(index, 1);
			this.planeCrashLight = null;
		}

		// Orbiter marble: update 3 orbiting planets each frame
		if (this.orbiterShapes.length > 0) {
			let marblePos = this.group.position;
			let currentOri = this.body.orientation;
			let rotDiff: Quaternion;

			if (this.orbiterPrevOrientation) {
				rotDiff = currentOri.clone().multiply(this.orbiterPrevOrientation.clone().invert());
			}
			this.orbiterPrevOrientation = currentOri.clone();

			// Mercury=0.35, Venus=0.55, Earth=0.75
			const orbitRadii = [0.5, 0.5, 0.5];
			// All planets orbit fast, inner slightly faster
			const orbitSpeeds = [0.14, 0.14, 0.14];
			for (let i = 0; i < this.orbiterShapes.length; i++) {
				if (rotDiff) {
					this.orbiterAxes[i].applyQuaternion(rotDiff).normalize();
					this.orbiterRels[i].applyQuaternion(rotDiff);
				}

				// Advance along orbit at planet-specific speed
				let dir = this.orbiterAxes[i].clone().cross(this.orbiterRels[i]).normalize();
				this.orbiterRels[i].addScaledVector(dir, orbitSpeeds[i]);

				// Smooth radius correction to target orbit radius
				const dist = orbitRadii[i];
				let len = this.orbiterRels[i].length();
				this.orbiterRels[i].normalize().multiplyScalar((len + 3 * dist) / 4);

				let pos = marblePos.clone().add(this.orbiterRels[i]);
				this.orbiterShapes[i].setTransform(pos, new Quaternion(), new Vector3(0.3, 0.3, 0.3));
				this.orbiterShapes[i].render(time);
			}
		}
		// Marble wears the Sunglasses, marble lives a Thug Life..!
		// ─── ADD this field near other marble state fields (top of class) ────────────
		// glassesOrientation: Quaternion = new Quaternion();
		// ─────────────────────────────────────────────────────────────────────────────

		// ─── INSERT in render() just before the orbiter block ────────────────────────
		if (this.marbleGlasses) {
			const up = this.level.currentUp.clone().normalize();

			// ── Target orientation: local Y → velocity, local Z → world up ────────────
			// (Exact replication of TorqueScript:
			//   RotPoint(rot, "0 0 1", "0 0 1")  → aligns local Z to world Z (up)
			//   RotPoint(rot, $marbleVelocity, "0 1 0") → aligns local Y to velocity)

			// Strip vertical from velocity → purely horizontal faceDir
			let vel = this.body.linearVelocity.clone();

			let faceDir: Vector3;
			if (vel.length() > 0.1) {
				faceDir = vel.normalize();
			} else if (this.lastMovementVec.length() > 0.01) {
				let lm = this.lastMovementVec.clone();
				lm.addScaledVector(up, -lm.dot(up));
				faceDir = lm.length() > 0.01 ? lm.normalize() : new Vector3(1, 0, 0);
			} else {
				faceDir = new Vector3(1, 0, 0);
			}

			// Build orthonormal basis: local Y = faceDir, local Z = up, local X = faceDir × up
			let right = new Vector3().crossVectors(faceDir, up).normalize(); // local X

			// Rotation matrix columns: [right, faceDir, up]
			let m00 = right.x,   m10 = right.y,   m20 = right.z;   // col 0 = local X
			let m01 = faceDir.x, m11 = faceDir.y, m21 = faceDir.z; // col 1 = local Y
			let m02 = up.x,      m12 = up.y,      m22 = up.z;      // col 2 = local Z

			let trace = m00 + m11 + m22;
			let targetQuat = new Quaternion();
			if (trace > 0) {
				let s = 0.5 / Math.sqrt(trace + 1);
				targetQuat.set((m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s);
			} else if (m00 > m11 && m00 > m22) {
				let s = 2 * Math.sqrt(1 + m00 - m11 - m22);
				targetQuat.set(0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s);
			} else if (m11 > m22) {
				let s = 2 * Math.sqrt(1 + m11 - m00 - m22);
				targetQuat.set((m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s);
			} else {
				let s = 2 * Math.sqrt(1 + m22 - m00 - m11);
				targetQuat.set((m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s);
			}

			// Smooth slerp toward target — replicates mPow(0.99, timeDelta) interpolation
			// At ~16ms tick: factor ≈ 0.15 (matches original feel)
			const slerpFactor = 0.15;
			if (!this.glassesOrientation) this.glassesOrientation = targetQuat.clone();
			this.glassesOrientation.slerp(targetQuat, slerpFactor);

			// Position at MARBLE CENTER — the DTS mesh geometry handles the offset itself
			this.marbleGlasses.setTransform(
				this.group.position.clone(),
				this.glassesOrientation,
				new Vector3(1, 1, 1)
			);
			this.marbleGlasses.render(time);
		}
	}

	crashPlane(volume: number) {
		if (this.isFlyingPlane) {
			this.isFlyingPlane = false;
			this.airplaneSound?.stop();
			this.airplaneSound = null;
			// Remove airplane visual
			this.airplaneimage.setOpacity(0); // Stop the plane

			// Restore controls and gravity
			this.level.setGravityIntensity(this.level.defaultGravity);
			// Explosion visual
			let marble = this.level.marble;
			this.level.particles.createEmitter(landMineParticle, null, () => marble.body.position.clone());
			this.level.particles.createEmitter(landMineSmokeParticle, null, () => marble.body.position.clone());
			this.level.particles.createEmitter(landMineSparksParticle, null, () => marble.body.position.clone());

			// Explosion light
			this.planeCrashTime = this.level.timeState.timeSinceLoad;
			this.planeCrashLight = new PointLight(new Vector3(6, 6, 6),
				marble.body.position.clone(),
				15
			);
			this.level.scene.addPointLight(this.planeCrashLight);

			// Play crash sound
			this.level.audio.play('airplane_crash.wav', volume);
		}
	}

	enableSuperBounce(time: TimeState, duration: number) {
		this.superBounceEnableTime = time.currentAttemptTime;
		this.superBounceTime = duration;
	}

	enableShockAbsorber(time: TimeState, duration: number) {
		this.shockAbsorberEnableTime = time.currentAttemptTime;
		this.shockAbsorberTime = duration;
	}

	enableHelicopter(time: TimeState, helicopterDuration: number, gyrocopterGravity: number, airAcceleration: number) {
		this.helicopterEnableTime = time.currentAttemptTime;
		this.gyrocopterTime = helicopterDuration;
		this.gyrocopterGravityMultiplier = gyrocopterGravity;
		this.airAcceleration = airAcceleration;
	}

	enableHelicopterDoubler(time: TimeState, helicopterDuration: number) {
		this.helicopterEnableTimex2 = time.currentAttemptTime;
		this.gyrocopterTime = helicopterDuration;
	}

	enableSuperBounceDoubler(time: TimeState, duration: number) {
		this.superBounceEnableTimex2 = time.currentAttemptTime;
		this.superBounceTime = duration;
	}

	enableShockAbsorberDoubler(time: TimeState, duration: number) {
		this.shockAbsorberEnableTimex2 = time.currentAttemptTime;
		this.shockAbsorberTime = duration;
	}
	enableOil(time: TimeState) {
		this.oilEnableTime = time.currentAttemptTime;
	}
	enableGlue(time: TimeState, duration: number) {
		this.glueEnableTime = time.currentAttemptTime;
		this.glueTime = duration; // Store how long glue should last...default or overridden from mis.
		this.oldGravity = this.level.currentUp.clone();
	}
	enableAirplane() {
		this.isFlyingPlane = true;
		this.level.setGravityIntensity(0); // Zero Gravity
	}
	enableMetal(time: TimeState, duration: number) {
		this.metalEnableTime = time.currentAttemptTime;
		this.metalTime = duration; // Store how long metal should last...default or overridden from mis.
	}
	enablePaper(time: TimeState, duration: number) {
		this.paperEnableTime = time.currentAttemptTime;
		this.paperTime = duration; // Store how long paper should last...default or overridden from mis.
	}
	enableIce(time: TimeState) {
		this.iceEnableTime = time.currentAttemptTime;
	}

	enableTeleportingLook(time: TimeState) {
		let completion = (this.teleportDisableTime !== null) ? Util.clamp((time.currentAttemptTime - this.teleportDisableTime) / TELEPORT_FADE_DURATION, 0, 1) : 1;
		this.teleportEnableTime = time.currentAttemptTime - TELEPORT_FADE_DURATION * (1 - completion);
		this.teleportDisableTime = null;
	}

	disableTeleportingLook(time: TimeState) {
		let completion = Util.clamp((time.currentAttemptTime - this.teleportEnableTime) / TELEPORT_FADE_DURATION, 0, 1) ?? 1;
		this.teleportDisableTime = time.currentAttemptTime - TELEPORT_FADE_DURATION * (1 - completion);
		this.teleportEnableTime = null;
	}

	// Powerup camera effect methods.
	// The time-driven effects (super bounce, shock absorber, gyrocopter) are detected from their enable timestamps inside
	// updatePowerupCameraEffects(), so their enable*/disable* hooks have nothing to set up. They are kept for callers.
	enableSuperJumpEffect() {
		this.superJumpEffectActive = true;
		this.superJumpEffectCounter = 0;
	}

	enableSuperSpeedEffect() {
		this.superSpeedEffectActive = true;
		this.superSpeedEffectCounter = 0;
	}

	enableSuperBounceEffect() {}

	disableSuperBounceEffect(_skipCameraRestore = false) {
		// Nothing stored to undo: the FOV is recomputed from scratch every frame.
	}

	enableShockAbsorberEffect() {}

	disableShockAbsorberEffect(_skipCameraRestore = false) {
		this.shockWasActive = false;
		this.shockEnding = false;
		this.shockZoom = 1.0;
	}

	enableHelicopterEffect() {}

	disableHelicopterEffect() {
		this.gyroPitchOffset = 0; // the composer below removes the already-applied part from the pitch
	}

	/** Zoom factor the shock absorber settles at: 20 steps of mulFov(0.99), as in the original shockStartEffect. */
	readonly SHOCK_ZOOM_TARGET = Math.pow(0.99, 20);

	/** For Handling the Inventory PowerUps Camera Effects..
	 *  Every effect only updates its own scalar; the camera (FOV + pitch) is then composed from ALL of them in one place at the end,
	 *  so overlapping effects can never overwrite or undo each other. */
	updatePowerupCameraEffects(time: TimeState) {
		if (!this.level?.camera) return;

		// "Disable PowerUp Effects" option (Misc tab): powerups still work, but no camera effects (FOV / pitch) are shown.
		// The option is only changed from the menu, and every level starts with a clean camera, so there's nothing to undo here.
		if (StorageManager.data.settings.disablePowerupEffects) return;

		// Number of original 10 ms script ticks this frame represents
		const ticks = (1000 / PHYSICS_TICK_RATE) / 10;

		// ── Super Jump → pitch offset. Original: 40 ticks of -0.0125, then 100 ticks of +0.005 (net 0). Closed form of the counter. ──
		let superJumpOffset = 0;
		if (this.superJumpEffectActive) {
			const c = this.superJumpEffectCounter;
			superJumpOffset = c < 40 ? -0.0125 * c : -0.5 + 0.005 * (Math.min(c, 140) - 40);
			this.superJumpEffectCounter += ticks;
			if (this.superJumpEffectCounter >= 140) {
				this.superJumpEffectActive = false;
				this.superJumpEffectCounter = 0;
			}
		}

		// ── Super Speed → FOV warp. Original: 40 ticks of mulWarp(1.015^2.5), then 100 ticks of mulWarp(1/1.015) (net 1). ──
		// Closed form: warp = 1.015^(2.5c) while c < 40, then 1.015^(140 - c). Re-triggering just restarts the curve; it can't compound.
		let superSpeedWarp = 1;
		if (this.superSpeedEffectActive) {
			const c = this.superSpeedEffectCounter;
			superSpeedWarp = Math.pow(1.015, c < 40 ? 2.5 * c : 140 - c);
			this.superSpeedEffectCounter += ticks;
			if (this.superSpeedEffectCounter >= 140) {
				this.superSpeedEffectActive = false;
				this.superSpeedEffectCounter = 0;
			}
		}
		this.superSpeedWarp = superSpeedWarp;

		// ── Super Bounce → ±1 degree random FOV jitter while active ──
		const isSuperBounceActive = (time.currentAttemptTime - this.superBounceEnableTime < this.superBounceTime) ||
									(time.currentAttemptTime - this.superBounceEnableTimex2 < this.superBounceTime * 2);

		// ── Shock Absorber → zoom in while active, zoom out afterwards (one 0.99 step per frame, 20 steps each way) ──
		const isShockActive = (time.currentAttemptTime - this.shockAbsorberEnableTime < this.shockAbsorberTime) ||
							(time.currentAttemptTime - this.shockAbsorberEnableTimex2 < this.shockAbsorberTime * 2);
		if (isShockActive) this.shockEnding = false;
		else if (this.shockWasActive) this.shockEnding = true;
		this.shockWasActive = isShockActive;

		const shockTarget = isShockActive ? this.SHOCK_ZOOM_TARGET : 1;
		if (this.shockZoom > shockTarget) this.shockZoom = Math.max(shockTarget, this.shockZoom * 0.99);
		else if (this.shockZoom < shockTarget) this.shockZoom = Math.min(shockTarget, this.shockZoom / 0.99);

		if (this.shockEnding && this.shockZoom === 1) {
			// Zoom-out finished. The original's shockEndEffect also cancels a running super speed warp here.
			this.shockEnding = false;
			this.superSpeedEffectActive = false;
			this.superSpeedEffectCounter = 0;
			this.superSpeedWarp = 1.0;
			superSpeedWarp = 1;
		}

		// ── Gyrocopter → pitch offset. Original: +0.01 per tick for 20 ticks on start, -0.01 per tick for 20 ticks on end. ──
		const isHelicopterActive = (time.currentAttemptTime - this.helicopterEnableTime < this.gyrocopterTime) ||
									(time.currentAttemptTime - this.helicopterEnableTimex2 < this.gyrocopterTime * 2);
		const gyroTarget = isHelicopterActive ? 0.2 : 0;
		const gyroStep = 0.01 * ticks;
		if (this.gyroPitchOffset < gyroTarget) this.gyroPitchOffset = Math.min(gyroTarget, this.gyroPitchOffset + gyroStep);
		else if (this.gyroPitchOffset > gyroTarget) this.gyroPitchOffset = Math.max(gyroTarget, this.gyroPitchOffset - gyroStep);

		// ── COMPOSE PITCH: apply only the change in the total wanted offset, so the player's own pitch is preserved ──
		const wantedPitchOffset = superJumpOffset + this.gyroPitchOffset;
		if (wantedPitchOffset !== this.appliedPitchOffset) {
			const before = this.level.pitch;
			// Same bounds the level enforces on the player's pitch; track what was REALLY applied so a clamp can never cause drift
			this.level.pitch = Math.max(-Math.PI / 2 + Math.PI / 4, Math.min(Math.PI / 2 - 0.0001, before + (wantedPitchOffset - this.appliedPitchOffset)));
			this.appliedPitchOffset += this.level.pitch - before;
		}

		// ── COMPOSE FOV from scratch: base FOV, widened/narrowed in tan(fov/2) space by every warp, then jitter ──
		const baseFov = this.level.getBaseFov();
		let fov = baseFov;
		const zoom = superSpeedWarp * this.shockZoom;
		if (zoom !== 1) fov = 2 * Math.atan(Math.tan(baseFov * Math.PI / 360) * zoom) * (180 / Math.PI);
		if (isSuperBounceActive) fov += -1 + 2 * Math.random();
		if (this.level.camera.fov !== fov) {
			this.level.camera.fov = fov;
			this.level.camera.updateProjectionMatrix();
		}
	}

	enableMegaMarble(time: TimeState) {
		this.megaMarbleEnableTime = time.currentAttemptTime;
	}

	useBlast() {
		if (this.level.blastAmount < 0.2 || !this.level.mission.hasBlast) return;

		let impulse = this.level.currentUp.clone().multiplyScalar(Math.max(Math.sqrt(this.level.blastAmount), this.level.blastAmount) * 10);
		this.body.linearVelocity.add(impulse);
		this.level.audio.play('blast.wav');
		this.level.particles.createEmitter(
			(this.level.blastAmount > 1) ? blastMaxParticleOptions : blastParticleOptions,
			null,
			() => this.body.position.clone().addScaledVector(this.level.currentUp, -this.radius * 0.4),
			new Vector3(1, 1, 1).addScaledVector(Util.absVector(this.level.currentUp.clone()), -0.8)
		);

		this.level.blastAmount = 0;
		this.level.replay.recordUseBlast();
	}

	/** Updates the radius of the marble both visually and physically. */
	setRadius(radius: number) {
		if (this.radius === radius) return;

		this.radius = radius;
		this.sphere.scale.setScalar(radius);
		this.sphere.recomputeTransform();
		this.ballShape?.setTransform(new Vector3(), new Quaternion(), new Vector3().setScalar(radius / DEFAULT_RADIUS));

		this.shape.radius = radius;
		this.shape.updateInertiaTensor();
		this.largeAuxShape.radius = 2 * radius;
		this.smallAuxShape.radius = radius;

		this.body.syncShapes();

		this.forcefield.group.scale.setScalar(this.radius / DEFAULT_RADIUS);
		this.forcefield.group.recomputeTransform();
	}

	reset() {
		this.body.linearVelocity.setScalar(0);
		this.body.angularVelocity.setScalar(0);
		this.superBounceEnableTime = -Infinity;
		this.superBounceEnableTimex2 = -Infinity;
		this.shockAbsorberEnableTime = -Infinity;
		this.shockAbsorberEnableTimex2 = -Infinity;
		this.helicopterEnableTime = -Infinity;
		this.helicopterEnableTimex2 = -Infinity;
		this.isFlyingPlane = false;
		this.barrelRollActive = false;
		this.barrelRollAngle = 0;
		this.lastUsePressTime = -Infinity;
		this.oilEnableTime = -Infinity;
		this.glueEnableTime = -Infinity;
		this.metalEnableTime = -Infinity;
		this.paperEnableTime = -Infinity;
		this.iceEnableTime = -Infinity;
		this.teleportEnableTime = null;
		this.teleportDisableTime = null;
		this.megaMarbleEnableTime = -Infinity;
		this.lastContactNormal.set(0, 0, 0);
		this.beforeVel.set(0, 0, 0);
		this.beforeAngVel.set(0, 0, 0);
		this.doubler = false;
		this.metal = false;
		this.paper = false;
		this.revealer = false;
		this.timetravel = false;
		this.slidingTimeout = 0;
		this.predictedPosition.copy(this.body.position);
		this.predictedOrientation.copy(this.body.orientation);
		this.setRadius(this.level.mission.hasUltraMarble ? ULTRA_RADIUS : DEFAULT_RADIUS);
		this.airjumpAllowed = true;
		this.airjumpsLeft = 2;
		this.justLanded = false;
		this.autoDoubleJumpArmed = true;
		this.wallHugDuration = 0;
		// Restore base jump impulse
		this.jumpImpulse = this.baseJumpImpulse;
		this.lastAppliedPowerupJumpImpulse = this.baseJumpImpulse;
		this.marbleTrailAccumTime = 0;
		this.lastGoldTrailTime = 0;
		// Reset all nyan rainbows
		for (const entry of this.nyanRainbowPool) {
			entry.shape.setOpacity(0);
			entry.active = false;
		}
		// Reset all septic goo pools
		for (const entry of this.septicGooPool) {
			entry.shape.setOpacity(0);
			entry.active = false;
		}
		// Reset all jaffacake pools
		for (const entry of this.jaffacakePool) {
			entry.shape.setOpacity(0);
			entry.active = false;
		}
		this.resetCameraEffects();
		this.lastUseWasPressed = false;
	}

	/** Kills every powerup camera effect and snaps the FOV back to default. Never touches pitch/yaw (the level owns those on respawn).
	 * Called from reset() and from checkpoint respawns, which do not go through reset(). */
	resetCameraEffects() {
		// Like the original resetPowerupEffects(): cancel everything. Every effect is just a scalar now, so this is exhaustive.
		this.superJumpEffectActive = false;
		this.superJumpEffectCounter = 0;
		this.superSpeedEffectActive = false;
		this.superSpeedEffectCounter = 0;
		this.superSpeedWarp = 1.0;
		this.shockWasActive = false;
		this.shockEnding = false;
		this.shockZoom = 1.0;
		this.gyroPitchOffset = 0;
		// Pitch is deliberately NOT touched: the level sets the spawn pitch itself. Just forget the offset we had applied,
		// so it is never "un-applied" onto the freshly set spawn pitch.
		this.appliedPitchOffset = 0;

		// FOV straight back to the known base value (the original's resetFov())
		if (this.level?.camera) {
			this.level.camera.fov = this.level.getBaseFov();
			this.level.camera.updateProjectionMatrix();
		}

		// Forget any gravity captured by glue, so it can't be re-applied after the restart
		this.oldGravity = null;
		this.lastGlueTouchTime = 0;
	}

	cloneForWrapping(): { group: Group, innerGroup: Group } {
		let group = new Group();
		let innerGroup = new Group();
		group.add(innerGroup);

		// Clone the sphere mesh (plain sphere, used when no ballShape)
		if (this.sphere) {
			let clonedSphere = new Mesh(this.sphere.geometry, this.sphere.materials);
			clonedSphere.scale.copy(this.sphere.scale);
			clonedSphere.opacity = this.sphere.opacity;
			clonedSphere.castShadows = false;
			if ((this.sphere as any).transform) (clonedSphere as any).transform = (this.sphere as any).transform;
			innerGroup.add(clonedSphere);
		}

		// Clone ballShape's meshes (DTS marble shape)
		if (this.ballShape && this.ballShape.group) {
			for (let child of this.ballShape.group.children) {
				if (child instanceof Mesh) {
					let clonedMesh = new Mesh(child.geometry, child.materials);
					clonedMesh.opacity = child.opacity;
					clonedMesh.castShadows = false;
					// Copy the node transform reference — shared by reference so it stays in sync automatically
					if ((child as any).transform) (clonedMesh as any).transform = (child as any).transform;
					innerGroup.add(clonedMesh);
				}
			}
		}

		group.recomputeTransform();
		return { group, innerGroup };
	}

	cloneMeshesInto(source: Group, target: Group) {
		for (let child of source.children) {
			if (child instanceof Mesh) {
				let m = new Mesh(child.geometry, child.materials);
				m.scale.copy(child.scale);
				m.position.copy(child.position);
				m.orientation.copy(child.orientation);
				m.castShadows = false;
				target.add(m);
			} else if (child instanceof Group) {
				let g = new Group();
				g.scale.copy(child.scale);
				g.position.copy(child.position);
				g.orientation.copy(child.orientation);
				target.add(g);
				this.cloneMeshesInto(child, g);
			}
		}
	}

	dispose() {
		this.cubeMap?.dispose();
	}
}