import { PowerUp } from "./power_up";
import { state } from "../state";
import { MissionElementItem, MisParser } from "../parsing/mis_parser";

/** Temporarily makes marble lighter */
export class Paper extends PowerUp {
	dtsPath = "shapes/paper/paper.dts";
	pickUpName = (state.modification === 'gold') ? "Paper Marble PowerUp!" : "Paper Marble PowerUp!";
	sounds = ["pupapervoice.wav", "usepaper.wav", "paper_bouncehard1.wav", "paper_bouncehard2.wav", "paper_bouncehard3.wav", "paper_bouncehard4.wav", "paper_roll.wav"];
	isActive = false;
	paperTime: number; // The duration for which the paper lasts. can be changed from the mis!

	constructor(element: MissionElementItem) {
		super(element);
		this.paperTime = element.papertime ? MisParser.parseNumber(element.papertime) : 5000; // Default to 5000 if not set
	}

	pickUp(): boolean {
		return this.level.pickUpPowerUp(this);
	}

	use() {
		// Only enable the paper timer/state on the marble; marble.tick() will observe this and apply effects
		this.level.marble.enablePaper(this.level.timeState, this.paperTime);
		this.isActive = true;
		this.level.deselectPowerUp();
	}
	reset() {
		this.level.marble.paper = false; // Probably the paper effect on marble is vanished if respawn
		this.level.marble.jumpImpulse = this.level.marble.baseJumpImpulse; // Restore jump impulse
		this.isActive = false; // Reset the paper if it were active and respawned
		this.lastPickUpTime = null; // <-- Force available on restart
	}

}