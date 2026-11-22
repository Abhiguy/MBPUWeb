import { Trigger } from "./trigger";
import { state } from "../state";

export class GroundhogTrigger extends Trigger {
	sounds = ['infotutorial.wav'];

	onMarbleEnter() {
		if (!this.level.groundhogReachedBottom) state.menu.hud.displayHelp("Head back up!", true);
	}

	onMarbleLeave() {
		this.level.groundhogReachedBottom = true;
	}
}

export class GroundhogTrigger2 extends Trigger {
	sounds = ['infotutorial.wav'];

	onMarbleEnter() {
		if (this.level.groundhogReachedBottom && this.level.finishLocked) state.menu.hud.displayHelp("Head back down!", true);
	}

	onMarbleLeave() {
		if (this.level.groundhogReachedBottom) this.level.finishLocked = false;
	}
}