import { Shape } from "../shape";
import { Util } from "../util";
import { TimeState } from "../level";
import { MissionElementStaticShape, MisParser } from "../parsing/mis_parser";

const RESET_TIME = 5000;

/** Trap doors open on contact. */
export class TrapDoor extends Shape {
	dtsPath = "shapes/hazards/trapdoor.dts";
	hasNonVisualSequences = true;
	shareNodeTransforms = false;
	lastContactTime = -Infinity;
	/** The time it takes from the moment of touching the trapdoor to it opening. */
	timeout = 0;
	lastDirection: number;
	lastCompletion = 0;
	stayOpen = false;
	counted = false;
	/** Set on reset so the next full tick rebuilds the collision geometry (see tick). */
	collisionStale = false;
	/** Set when a respawn starts the closing animation; once it finishes, the collision geometry gets one last rebuild. */
	closing = false;
	sounds = ['trapdooropen.wav'];

	constructor(element: MissionElementStaticShape) {
		super();

		if (element.timeout) this.timeout = MisParser.parseNumber(element.timeout);
	}

	get animationDuration() {
		return this.dts.sequences[0].duration * 1000;
	}

	tick(time: TimeState, onlyVisual: boolean) {
		let currentCompletion = this.getCurrentCompletion(time);

		// Override the keyframe
		this.sequenceKeyframeOverride.set(this.dts.sequences[0], currentCompletion * (this.dts.sequences[0].numKeyframes - 1));

		if (this.closing && currentCompletion === 0) {
			this.closing = false;
			this.collisionStale = true;
		}

		if (!onlyVisual && this.collisionStale) {
			this.lastSequenceKeyframes.delete(this.dts.sequences[0]);
			this.collisionStale = false;
		}

		super.tick(time, onlyVisual);

		if (onlyVisual) return;

		let direction = Math.sign(currentCompletion - this.lastCompletion);
		if (direction !== 0 && direction !== this.lastDirection) {
			// If the direction has changed, play the sound
			this.level.audio.play(this.sounds[0], undefined, undefined, this.worldPosition);
		}

		this.lastCompletion = currentCompletion;
		this.lastDirection = direction;
	}

	/** Gets the current completion of the trapdoor openness. 0 = closed, 1 = open. */
	getCurrentCompletion(time: TimeState) {
		let elapsed = time.timeSinceLoad - this.lastContactTime;
		let completion = Util.clamp(elapsed / this.animationDuration, 0, 1);
		if (elapsed > RESET_TIME && !this.stayOpen) completion = Util.clamp(1 - (elapsed - RESET_TIME) / this.animationDuration, 0, 1);

		return completion;
	}

	open() {
		let time = this.level.timeState;

		if (time.timeSinceLoad - this.lastContactTime <= 0) return false; // The trapdoor is queued to open, so don't do anything.
		let currentCompletion = this.getCurrentCompletion(time);

		// Set the last contact time accordingly so that the trapdoor starts closing (again)
		this.lastContactTime = time.timeSinceLoad - currentCompletion * this.animationDuration;
		if (currentCompletion === 0) this.lastContactTime += this.timeout;

		// Only now: from here on the trapdoor stays open (King of the One-Use)
		if (this.level.trapDoorsStayOpen) this.stayOpen = true;

		return true;
	}

	onMarbleContact() {
		if (!this.open()) return;

		this.level.replay.recordMarbleContact(this);
		if (this.level.isOneUse) this.level.openAllTrapDoors(this);

		if (this.level.isTrapDoorCount && !this.counted) {
			this.counted = true;
			this.level.registerTrapDoorHit();
		}
	}

	reset() {
		super.reset();

		// King of the One-Use and King of the Trapdoors: trapdoors stay open during an attempt, but every respawn closes them again
		if (this.level.trapDoorsStayOpen) {
			let time = this.level.timeState;
			let completion = this.getCurrentCompletion(time);

			if (completion > 0) {
				// Close from wherever the trapdoor currently is, with the normal closing animation and sound
				this.lastContactTime = time.timeSinceLoad - RESET_TIME - (1 - completion) * this.animationDuration;
				this.closing = true;
			} else {
				this.lastContactTime = -Infinity;
				this.lastCompletion = 0;
			}

			this.stayOpen = false;
			this.counted = false;
			this.collisionStale = true;
		}
	}
}