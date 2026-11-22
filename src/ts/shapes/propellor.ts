import { Collision } from "../physics/collision";
import { ConvexHullCollisionShape } from "../physics/collision_shape";
import { Shape } from "../shape";
import { TimeState, Level } from "../level";
import { Vector3 } from "../math/vector3";
import { Quaternion } from "../math/quaternion";
import { MissionElement } from "../parsing/mis_parser";

/**
 * Torque's Z-axis angle is clockwise-positive when viewed from above, while the port's quaternions are the usual
 * counter-clockwise-positive. All angle math below is done in Torque's convention (so the formulas match the
 * TorqueScript 1:1) and converted right before building the quaternion.
 * If the spin or follow direction looks mirrored in-game, flip this to 1.
 */
let YAW_SIGN = -1;

/**
 * The original only moves a propellor (and its collision) in chunks. Within this distance of the marble the port turns
 * it every physics tick instead, so the spinning collision body pushes the marble through the normal collision
 * response
 */
let NEAR_DISTANCE = 20;

/** Directions used to pick a small set of extreme points out of a dense mesh. */
let HULL_DIRECTIONS: Vector3[] = (() => {
	let directions = [new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
	let steps = 24;
	for (let z of [-1, -0.5, 0, 0.5, 1]) {
		for (let i = 0; i < steps; i++) {
			let angle = (i / steps) * Math.PI * 2;
			directions.push(new Vector3(Math.cos(angle), Math.sin(angle), z));
		}
	}
	return directions;
})();

/** Reduces a point cloud to the points that stick out furthest in HULL_DIRECTIONS. Their hull lies inside the mesh's hull. */
function extremePoints(points: Vector3[]): Vector3[] {
	let picked = new Set<number>();
	for (let direction of HULL_DIRECTIONS) {
		let best = -1;
		let bestDot = -Infinity;
		for (let i = 0; i < points.length; i++) {
			let dot = points[i].dot(direction);
			if (dot > bestDot) {
				bestDot = dot;
				best = i;
			}
		}
		if (best >= 0) picked.add(best);
	}
	return [...picked].map((i) => points[i].clone());
}


function readNumber(element: MissionElement | null, key: string, fallback: number): number {
	let fields = element as unknown as Record<string, unknown> | null;
	let raw = fields?.[key.toLowerCase()] ?? fields?.[key];
	if (raw === undefined || raw === null || raw === "") return fallback;
	let parse = Number.parseFloat(String(raw));
	return Number.isNaN(parse) ? 0 : parse;
}

/**Propellors repel the marble*/
export class Propellor extends Shape {
	dtsPath = "shapes/hazards/propellor.dts";
	collideable = true;
	turnSpeed = 1;
	follow = false;
	offset = 0;
	offsetFac = 1;
	/** Current yaw in radians */
	angle = 0;
	initialized = false;
	/** Simulated time at which the next spin step is due. */
	nextSpinAt = 0;
	/** Interval the pending spin step was scheduled with; also its timeDelta argument */
	pendingDelta = 50;
	lastTickTime = 0;
	/** True once the colliders are convex hulls in local space that the body's position/orientation move around. */
	usesLocalHulls = false;

	async init(level?: Level, srcElement: MissionElement = null) {
		await super.init(level, srcElement);

		this.turnSpeed = readNumber(srcElement, "turnSpeed", 1);
		this.follow = readNumber(srcElement, "follow", 0) !== 0;
		this.offset = readNumber(srcElement, "offset", 0);
		this.offsetFac = readNumber(srcElement, "offsetFac", 1);

		let body = this.bodies[0];
		if (body) {
			let shapeHandler = body.onBeforeIntegrate;
			body.onBeforeIntegrate = (dt: number) => {
				if (this.usesLocalHulls) this.syncBody();
				shapeHandler(dt);
			};
		}
	}

	/** Builds one convex hull per DTS object from its collision mesh. */
	generateCollisionObjects() {
		let body = this.bodies[0];
		let dts = this.colliderDts;
		this.usesLocalHulls = false;
		if (!body || !dts) {
			super.generateCollisionObjects();
			return;
		}

		// Collision details are the ones with a negative size; an object's mesh for a detail sits at startMeshIndex + objectDetailNum
		let collisionDetail = dts.details.find((detail) => detail.size < 0);

		let hulls: Vector3[][] = [];
		for (let object of dts.objects) {
			let meshes: (typeof dts.meshes)[number][] = [];
			if (collisionDetail && collisionDetail.objectDetailNum < object.numMeshes) {
				meshes.push(dts.meshes[object.startMeshIndex + collisionDetail.objectDetailNum]);
			}
			if (!meshes.some((mesh) => mesh?.verts?.length)) {
				// No collision mesh..use everything the object has
				meshes.length = 0;
				for (let j = object.startMeshIndex; j < object.startMeshIndex + object.numMeshes; j++) meshes.push(dts.meshes[j]);
			}

			let nodeTransform = this.nodeTransforms[object.nodeIndex];
			let points: Vector3[] = [];
			for (let mesh of meshes) {
				if (!mesh?.verts?.length) continue;

				for (let vert of mesh.verts) {
					let point = new Vector3(vert.x, vert.y, vert.z);
					if (nodeTransform) point.applyMatrix4(nodeTransform);
					points.push(point);
				}
			}

			// Meshes repeat positions once per face normal and are dense; a few extreme points make the same hull
			let hull = extremePoints(points);
			if (hull.length >= 4) hulls.push(hull);
		}

		// the hulls must sit inside the shape's own bounds, otherwise the vertex space isn't what we expect
		let slack = 0.5;
		let fits = hulls.length > 0 && hulls.every((hull) => hull.every((p) =>
			p.x >= dts.bounds.min.x - slack && p.x <= dts.bounds.max.x + slack &&
			p.y >= dts.bounds.min.y - slack && p.y <= dts.bounds.max.y + slack &&
			p.z >= dts.bounds.min.z - slack && p.z <= dts.bounds.max.z + slack
		));
		if (!fits) {
			super.generateCollisionObjects();
			return;
		}

		// This runs again if the scale changes, so start clean
		while (body.shapes.length) {
			this.shapeVertices.delete(body.shapes[0]);
			body.removeCollisionShape(body.shapes[0]);
		}

		let scale = this.worldScale;
		for (let vertices of hulls) {
			let shape = new ConvexHullCollisionShape(vertices.map((p) => new Vector3(p.x * scale.x, p.y * scale.y, p.z * scale.z)));
			shape.restitution = this.restitution;
			shape.friction = this.friction;
			body.addCollisionShape(shape);
		}

		this.usesLocalHulls = true;
	}

	/** we just move the body instead. */
	updateCollisionGeometry(bitfield: number) {
		if (!this.usesLocalHulls) {
			super.updateCollisionGeometry(bitfield);
			return;
		}

		this.syncBody();
	}

	/** Update the collider with the propellor's movement*/
	syncBody() {
		let body = this.bodies[0];
		if (!body) return;

		body.position.copy(this.worldPosition);
		body.orientation.copy(this.worldOrientation);
		if (!body.prevValid) body.storePrevious(); // Otherwise the first time-of-impact would use position (0, 0, 0)
		body.syncShapes();
	}

	tick(time: TimeState, onlyVisual = false) {
		super.tick(time, onlyVisual);
		if (onlyVisual) return;

		let now = time.timeSinceLoad;
		let ticks = Math.max(0, Math.min(now - this.lastTickTime, 50));
		this.lastTickTime = now;

		if (!this.initialized) {
			this.angle = YAW_SIGN * 2 * Math.atan2(this.worldOrientation.z, this.worldOrientation.w);
			this.initialized = true;
		}

		let angleBefore = this.angle;
		let marble = this.level?.marble?.body;
		if (marble) {
			let distToMarble = marble.position.clone().sub(this.worldPosition).length();

			if (distToMarble <= NEAR_DISTANCE) this.spin(marble.position, distToMarble, ticks, now);
			else if (now >= this.nextSpinAt) this.spin(marble.position, distToMarble, this.pendingDelta, now);
		}

		// Give the collision body the velocity its surface moved with this tick, so the collision response can push the marble with it
		let body = this.bodies[0];
		if (body && this.usesLocalHulls) {
			let delta = YAW_SIGN * (this.angle - angleBefore);
			delta = Math.atan2(Math.sin(delta), Math.cos(delta));
			body.angularVelocity.set(0, 0, ticks > 0 ? delta / (ticks / 1000) : 0);
		}
	}


	spin(marblePosition: Vector3, distToMarble: number, timeDelta: number, now: number) {

		if (distToMarble > 60) {
			this.pendingDelta = 300;
		} else if (distToMarble > NEAR_DISTANCE) {
			this.pendingDelta = 100;
		} else {
			this.pendingDelta = 20;
		}
		this.nextSpinAt = now + this.pendingDelta;

		if (this.follow) {
			let dx = marblePosition.x - this.worldPosition.x;
			let dy = marblePosition.y - this.worldPosition.y;
			this.angle = -this.offsetFac * Math.atan2(dy, dx) + this.offset;
		} else {
			this.angle += this.turnSpeed * timeDelta / 1000;
		}

		let rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), YAW_SIGN * this.angle);
		this.setTransform(this.worldPosition.clone(), rotation, this.worldScale.clone());
	}

	onMarbleContact(collision: Collision) {
		if (!collision) return;
		this.level.marble.slidingTimeout = 2;
		this.level.replay.recordMarbleContact(this);
	}
}