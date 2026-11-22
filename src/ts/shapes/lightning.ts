import { Shape } from "../shape";
import { TimeState } from "../level";
import { Vector3 } from "../math/vector3";
import { Util } from "../util";
import { PointLight } from "../rendering/point_light";

/** The Lightning! */
export class Lightning extends Shape {
	dtsPath = "shapes/hazards/lightning.dts";
	collideable = false;
	nextStrikeTime = 0;
	strikeLight: PointLight;
	strikeTime = -Infinity;

	async onLevelStart() {
		this.setOpacity(0);
		this.nextStrikeTime = 0;
	}

	tick(time: TimeState, onlyVisual: boolean) {
		if (onlyVisual) return;
		super.tick(time);

		const now = time.timeSinceLoad;

		if (now >= this.nextStrikeTime) {
			this.strike();
			// schedule(2000 + 6000*getRandom())
			this.nextStrikeTime = now + 2000 + Math.random() * 6000;
		}
	}

	/** The Random Strike of the Lightning... */
	strike() {
		let marble = this.level.marble;
		if (!marble) return;

		// Pick random XY near marble (±10)
		let offsetX = -10 + Math.random() * 20;
		let offsetY = -10 + Math.random() * 20;
		let baseX = marble.body.position.x + offsetX;
		let baseY = marble.body.position.y + offsetY;
		let origin = new Vector3(baseX, baseY, 10000);
		let direction = new Vector3(0, 0, -1);
		let lambdaMax = 20000;
		let hits = this.level.world.castRay(origin, direction, lambdaMax);
		if (!hits || hits.length === 0) return;

		let hit = hits[0];
		let strikePos = new Vector3(origin.x + direction.x * hit.lambda, origin.y + direction.y * hit.lambda, origin.z + direction.z * hit.lambda);

		this.setTransform(strikePos, this.worldOrientation, new Vector3(1, 1, 1));
		this.setOpacity(1);
		this.level.audio.play("lightning.wav");
		setTimeout(() => this.setOpacity(0), 300);

		this.strikeTime = this.level.timeState.timeSinceLoad;
		let lightPos = strikePos.clone();
		lightPos.z += 8;
		this.strikeLight = new PointLight(new Vector3(10, 10, 0), lightPos, 40);
		this.level.scene.addPointLight(this.strikeLight);
	}

	render(time: TimeState) {
		if (this.strikeLight && time.timeSinceLoad < this.strikeTime + 300) {
			let elapsed = time.timeSinceLoad - this.strikeTime;
			let progress = elapsed / 300;
			this.strikeLight.range = 40;
			this.strikeLight.color.copy(new Vector3(Util.lerp(10, 0, progress),
				Util.lerp(10, 0, progress), 0 ));
		} else if (this.strikeLight && time.timeSinceLoad >= this.strikeTime + 300) {
			let index = this.level.scene.pointLights.indexOf(this.strikeLight);
			if (index > -1) this.level.scene.pointLights.splice(index, 1);
			this.strikeLight = null;
		}
	}
}