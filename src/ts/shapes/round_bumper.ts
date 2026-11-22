import { PHYSICS_TICK_RATE, TimeState } from "../level";
import { Vector3 } from "../math/vector3";
import { MisParser, MissionElementStaticShape } from "../parsing/mis_parser";
import { AbstractBumper } from "./abstract_bumper";

/** A round bumper. */
export class RoundBumper extends AbstractBumper {
	dtsPath = "shapes/bumpers/pball_round.dts";
	sounds = ["bumperding1.wav"];
	chasePlayer = false;
	chaseSpeed: number; // the speed at which the bumper chases the player, can be changed in the .mis! And is default
	startPosition: Vector3;

	constructor(el: MissionElementStaticShape) {
		super();
		this.chasePlayer = el._name === "ChasePlayer";
		// Parse chaseSpeed from .mis file, default to 2 if not set
		this.chaseSpeed = el.chasespeed ? MisParser.parseNumber(el.chasespeed) : 2;
	}

	async onLevelStart() {
		this.startPosition = this.worldPosition.clone();
	}

	tick(time: TimeState, onlyVisual = false) {
		if (this.level.paused) return;
		super.tick(time, onlyVisual);
		if (this.chasePlayer && this.level.marble && this.level.marble.body) {
			// Chase the marble
			let dir = this.level.marble.body.position.clone().sub(this.worldPosition).normalize();
			let speed = this.chaseSpeed;
			let add = dir.multiplyScalar(speed / PHYSICS_TICK_RATE);

			this.worldPosition.add(add);
			this.worldMatrix.setPosition(this.worldPosition);

			this.group.position.copy(this.worldPosition);
			this.group.recomputeTransform();
			// Update collision geometry to match new transform
			this.updateCollisionGeometry(0xffffffff);
		}
	}

	reset(): void {
		super.reset();
		if (this.startPosition) {
			this.worldPosition.copy(this.startPosition);
			this.worldMatrix.setPosition(this.worldPosition);

			this.group.position.copy(this.worldPosition);
			this.group.recomputeTransform();
		}
	}
}