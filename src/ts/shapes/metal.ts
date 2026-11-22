import { PowerUp } from "./power_up";
import { state } from "../state";
import { MissionElementItem, MisParser } from "../parsing/mis_parser";

/** Temporarily makes marble heavier */
export class Metal extends PowerUp {
	dtsPath = "shapes/metal/metal.dts";
	pickUpName = (state.modification === 'gold') ? "Metal Marble PowerUp!" : "Metal Marble PowerUp!";
	sounds = ["pumetalvoice.wav", "usemetal.wav", "metal_bouncehard1.wav", "metal_bouncehard2.wav", "metal_bouncehard3.wav", "metal_bouncehard4.wav", "metal_roll.wav"];
	isActive = false;
	metalTime: number; // The duration for which the metal lasts. can be changed from the mis!

	constructor(element: MissionElementItem) {
		super(element);
		this.metalTime = element.metaltime ? MisParser.parseNumber(element.metaltime) : 5000; // Default to 5000 if not set
	}

	pickUp(): boolean {
		return this.level.pickUpPowerUp(this);
	}

	use() {
		// Only enable the metal timer/state on the marble; marble.tick() will observe this and apply effects
		this.level.marble.enableMetal(this.level.timeState, this.metalTime);
		this.isActive = true;
		this.level.deselectPowerUp();
	}
	reset() {
		this.level.marble.metal = false; // Pronbably the metal effect on marble is vanished if respawn
		this.level.marble.jumpImpulse = this.level.marble.baseJumpImpulse; // Restore jump impulse
		this.isActive = false; // Reset the metal if it were active and respawned
		this.lastPickUpTime = null; // Force available on restart
	}

}