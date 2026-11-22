import { Trigger } from "./trigger";
import { state } from "../state";

/** Groundhog Day, bottom zone: the player has to reach it, then head back up. */
export class GroundhogTrigger extends Trigger {
	sounds = ['infotutorial.wav'];

	onMarbleEnter() {
		if (!this.level.groundhogReachedBottom) state.menu.hud.displayHelp("Head back up!", true);
	}

	onMarbleLeave() {
		this.level.groundhogReachedBottom = true;
	}
}

/** Groundhog Day, top zone: once the player has been to the bottom, leaving it unlocks the finish. */
export class GroundhogTrigger2 extends Trigger {
	sounds = ['infotutorial.wav'];

	onMarbleEnter() {
		if (this.level.groundhogReachedBottom && this.level.finishLocked) state.menu.hud.displayHelp("Head back down!", true);
	}

	onMarbleLeave() {
		if (this.level.groundhogReachedBottom) this.level.finishLocked = false;
	}
}