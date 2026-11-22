import { PowerUp } from "./power_up";
import { Util } from "../util";
import { state } from "../state";
import { MissionElementItem } from "../parsing/mis_parser";
import { Vector3 } from "../math/vector3";
import { TimeState } from "../level";

/** Changes the gravity on pickup. */
export class AntiGravity extends PowerUp {
	dtsPath = "shapes/items/antigravity.dts";
	autoUse = true;
	pickUpName = (state.modification === 'gold')? "Gravity Modifier" : "Gravity Defier";
	sounds = ["gravitychange.wav"];
	/** If true, this modifier is hidden and can't be picked up until the next restart. */
	lockedOut = false;

	constructor(element: MissionElementItem, respawnInstantly = false) {
		super(element);

		if (respawnInstantly) this.cooldownDuration = -Infinity;
	}

	setLockedOut(locked: boolean) {
		this.lockedOut = locked;
		if (locked) this.setOpacity(0);
	}

	pickUp() {
		if (this.lockedOut) return false;

		let direction = new Vector3(0, 0, -1);
		direction.applyQuaternion(this.worldOrientation).normalize();
		return !Util.isSameVector(direction, this.level.currentUp);
	}

	use() {
		// Determine the new up vector
		let direction = new Vector3(0, 0, -1);
		direction.applyQuaternion(this.worldOrientation);

		this.level.setUp(direction);
		this.level.audio.play(this.sounds[0]);
		this.level.registerGravitySwap(this); // Pass ourselves so we stay the one that respawns
	}

	render(time: TimeState) {
		super.render(time);

		// PowerUp.render sets the opacity every frame, so a locked item has to be re-hidden here
		if (this.lockedOut) this.setOpacity(0);
	}

	reset() {
		super.reset();

		this.lockedOut = false;
		this.setOpacity(1);
	}
}