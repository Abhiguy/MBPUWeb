import { AudioSource } from "../audio";
import { Shape } from "../shape";
import { Level, TimeState } from "../level";
import { MissionElementStaticShape } from "../parsing/mis_parser";
import { RainLocal, BubbleLocal, ParticleEmitter } from "../particles";

export class AddWeather extends Shape {
	dtsPath = 'shapes/colmesh.dts';
	collideable = false;
	weatherType: 'Rain' | 'Bubbles' = 'Rain';
	sounds = ['rain.wav'];
	rainSound: AudioSource;
	weatherEmitter: ParticleEmitter;

	constructor(element: MissionElementStaticShape) {
		super();
		if (element?.weathertype?.toLowerCase() === 'bubbles')
			this.weatherType = 'Bubbles';
	}

	async init(level: Level, element: MissionElementStaticShape) {
		await super.init(level, element);

		let emitterOptions = this.weatherType === 'Rain' ? RainLocal : BubbleLocal;

		// Store the emitter so we can update it every tick
		this.weatherEmitter = this.level.particles.createEmitter(
			emitterOptions,
			this.level.camera.position.clone()
			// No getPos callback — we'll do it manually in tick()
		);
		this.weatherEmitter.isRelative = true;
	}

	tick(time: TimeState, onlyVisual: boolean) {
		if (this.weatherEmitter && this.level.marble) {
			let pos = this.level.camera.position.clone();
			if (this.weatherType === 'Rain') pos.z += 6;
			if (this.weatherType === 'Bubbles') pos.z -= 4;

			// Update emitterCenter — GPU reads this every render frame, zero lag
			this.weatherEmitter.emitterCenter.copy(pos);
		}
		super.tick(time, onlyVisual);
	}

	async onLevelStart() {
		if (this.weatherType === 'Rain') {
			this.rainSound = this.level.audio.createAudioSource('rain.wav', undefined, this.worldPosition);
			this.rainSound.gainFactor = 2;
			this.rainSound.maxDistance = 100;
			this.rainSound.setLoop(true);
			this.rainSound.play();
			await this.rainSound.promise;
		}
	}

	async onLevelEnd() {
		this.rainSound?.stop();
	}
}