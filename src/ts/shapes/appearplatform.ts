import { Shape } from "../shape";
import { TimeState } from "../level";

/** Appear Platforms...Probably the limbo stuff */
export class AppearPlatform extends Shape {
	dtsPath = "shapes/platforms/platform_real.dts";
	flickerVisible = true;
	nextSwitchTime = -Infinity;

	async onLevelStart() {
		this.flickerVisible = true;
		this.nextSwitchTime = -Infinity;
		this.setOpacity(1);
	}

	tick(time: TimeState, onlyVisual: boolean) {
		if (onlyVisual) return;
		super.tick(time);

		if (time.timeSinceLoad >= this.nextSwitchTime) {
			this.switchVisible(time);
		}

		let marble = this.level.marble;
		if (marble.revealer) {
			this.setOpacity(1);
		}
		else {
			this.setOpacity(this.flickerVisible ? 1 : 0);
		}
	}

	switchVisible(time: TimeState) {
		if (this.flickerVisible) {
			this.flickerVisible = false;
			let delay = (Math.random() < 0.3) ? (20 + Math.random() * (70 - 20)) : (2000 + Math.random() * (7000 - 2000));
			this.nextSwitchTime = time.timeSinceLoad + delay;
		}
		else {
			this.flickerVisible = true;
			this.nextSwitchTime = time.timeSinceLoad + (20 + Math.random() * (70 - 20));
		}
	}
}