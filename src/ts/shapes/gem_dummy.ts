import { Shape } from "../shape";
import { MisParser, MissionElementItem } from "../parsing/mis_parser";
import { Util } from "../util";
import { Gem } from "./gem";
import { Level } from "../level";
import { MissionElement } from "../parsing/mis_parser";

// List all of gem colors for randomly choosing one
const GEM_COLORS = ["blue", "red", "yellow", "purple", "green", "turquoise", "orange", "black"]; // "Platinum" is also a color, but it can't appear by chance

/** Dummy Gems */
export class DummyGem extends Shape {
	index: number; // Index of the gem, used for hiding it
	dtsPath = "shapes/spareparts/gem.dts";
	ambientRotate = true;
	collideable = false;
	pickedUp = false;
	shareMaterials = false;
	showSequences = false;
	gemColor: string; // The color of the dummy gem

	constructor(element: MissionElementItem) {
		super();

		// Only assign myIndex if it exists in the element

		let parsed = MisParser.parseNumber(element.myindex);
		this.index = parsed;

		// Determine the color of the gem:
		let color = element.datablock.slice("DummyGemItem".length);
		if (color.length === 0) color = DummyGem.pickRandomColor(); // Random if no color specified

		this.gemColor = color.toLowerCase();
		this.matNamesOverride["base.gem"] = color.toLowerCase() + ".gem";
	}

	async init(level: Level, element: MissionElement) {
		// If this dummy gem has a matching real gem with the same index, use its color
		// Use the level parameter directly since this.level isn't set yet
		if (this.index !== undefined && this.index !== -1) {
			let matchingGem = level.shapes.find(shape => shape instanceof Gem && shape.index === this.index) as Gem;
			if (matchingGem) {
				this.gemColor = matchingGem.gemColor;
				this.matNamesOverride["base.gem"] = matchingGem.gemColor + ".gem";
			}
		}
		// Call parent init after updating matNamesOverride and before materials are loaded
		return super.init(level, element);
	}

	hide() {
		this.setOpacity?.(0);
	}

	reset() {
		super.reset();

		this.pickedUp = false;
		this.setOpacity(1);
		this.setCollisionEnabled(true);
	}

	static pickRandomColor() {
		return Util.randomFromArray(GEM_COLORS);
	}
}