import { Shape } from "./shape";
import { TimeState, Level } from "./level";
import { MissionElementStaticShape } from "./parsing/mis_parser";
import { Util } from "./util";
import { NPCMarble } from "./other_marbles";
import { Vector3 } from "./math/vector3";
import { Quaternion } from "./math/quaternion";

/** FloorButton: A pressure-sensitive button that activates when the marble is on the button to trigger and reset door animations */
export class FloorButton extends Shape {
	dtsPath = 'shapes/buttons/floorbutton.dts';
	target: string;
	hasNonVisualSequences = true;
	shareNodeTransforms = false;
	lastContactTime = -Infinity;
	lastLeaveTime = -Infinity;
	isPressed = false; // Gee..
	wasPressed = false; // Whether the button was activated before...Imp for floor button.
	activationDistance = 1.35; // For now...1.35, This should fit..

	get animationDuration() {
		return this.dts.sequences.length > 0 ? this.dts.sequences[0].duration * 1000 : 0;
	}

	constructor(element: MissionElementStaticShape) {
		super();
		// Extract target from element data..(e.g, "GateA")
		if (element && element.target) {
			this.target = element.target;
		}
	}

	tick(time: TimeState, onlyVisual: boolean) {
		// Check distance to any marble (player or NPC Marble) for activation
		// Kinda hacky..but this works way better than the actual collision detection..
		let marbleInRange = false;
		let marble = this.level.marble;

		// Check player marble
		if (marble) {
			let distance = marble.body.position.distanceTo(this.worldPosition);
			if (distance < this.activationDistance) {
				marbleInRange = true;
			}
		}

		// Check all NPC marbles from spawners
		if (!marbleInRange) {
			for (let shape of this.level.shapes) {
				// Check if this shape has an npcMarble property (from spawner classes)
				if ((shape as any).npcMarble) {
					let npcMarble = (shape as any).npcMarble as NPCMarble;
					if (npcMarble && npcMarble.body) {
						let distance = npcMarble.body.position.distanceTo(this.worldPosition);
						if (distance < this.activationDistance) {
							marbleInRange = true;
							break;
						}
					}
				}
			}
		}

		// Handle state transitions
		this.wasPressed = this.isPressed;
		this.isPressed = marbleInRange;

		// Marble just entered range,trigger gate to open
		if (this.isPressed && !this.wasPressed) {
			this.lastContactTime = time.timeSinceLoad;
			this.triggerTarget();
		}

		// Marble just left range,trigger gate to close
		if (!this.isPressed && this.wasPressed) {
			this.lastLeaveTime = time.timeSinceLoad;
			this.triggerTarget();
		}

		// Update animation keyframe with smooth interpolation
		if (this.dts.sequences.length > 0) {
			let currentCompletion = this.getCurrentCompletion(time);
			let seq = this.dts.sequences[0];
			this.sequenceKeyframeOverride.set(seq, currentCompletion * (seq.numKeyframes - 1));
		}

		super.tick(time, onlyVisual);
	}

	/** Gets the current completion of the button animation. 0 = released, 1 = fully pressed. */
	getCurrentCompletion(time: TimeState) {
		if (this.animationDuration === 0) return 0;

		// If marble is in range, animate down (0 -> 1)
		if (this.isPressed) {
			let elapsed = time.timeSinceLoad - this.lastContactTime;
			let completion = Util.clamp(elapsed / this.animationDuration, 0, 1);
			return completion;
		}

		// If marble left range - animate up (1 -> 0)
		let elapsed = time.timeSinceLoad - this.lastLeaveTime;
		let completion = Util.clamp(elapsed / this.animationDuration, 0, 1);
		return 1 - completion; // Reverse animation: 1 to 0
	}

	/** Trigger the target gate if one is set */
	triggerTarget() {
		if (this.target) {
			// Find and trigger the target gate by name (e.g., "GateA", "GateB")
			let targetShape = this.level.shapes.find((s: Shape) => (s as any).srcElement?._name === this.target);
			if (targetShape && targetShape instanceof ButtonGate) {
				(targetShape as ButtonGate).flipGate();
			}
		}
	}
}

/**ButtonGate is a gate that opens/closes when triggered by floorbuttons Can be chained together to create complex door mechanisms */
export class ButtonGate extends Shape {
	dtsPath = 'shapes/hazards/button_gate.dts';
	on = false; // Very Important.. Also it is parsed from .mis..
	backwards = false;
	target: string;
	hasNonVisualSequences = true;
	shareNodeTransforms = false;
	lastStateChangeTime = -Infinity;
	lastNode1Pos = new Vector3(0, 0, 0);

	get animationDuration() {
		return this.dts.sequences.length > 0 ? this.dts.sequences[0].duration * 1000 : 0;
	}

	constructor(element: MissionElementStaticShape) {
		super();
		if (element) {
			if (element.backwards) {
				this.backwards = element.backwards === "1" || element.backwards === "true";
			}
			if (element.target) {
				this.target = element.target;
			}
			if (element.on) {
				this.on = element.on === "1" || element.on === "true";
			}
		}
	}

	async init(level: Level, element: MissionElementStaticShape) {
		await super.init(level, element);

		// Initialize node 1 position
		if (this.nodeTransforms && this.nodeTransforms.length > 1) {
			let node1 = this.nodeTransforms[1];
			let pos = new Vector3();
			node1.decompose(pos, new Quaternion(), new Vector3());
			this.lastNode1Pos.copy(pos);
		}
	}


	tick(time: TimeState, onlyVisual: boolean) {
		if (this.dts.sequences.length > 0) {
			let seq = this.dts.sequences[0];
			let currentCompletion = this.getCurrentCompletion(time);

			if (this.backwards) {
				currentCompletion = 1 - currentCompletion;
			}

			// Set the keyframe with smooth animation
			this.sequenceKeyframeOverride.set(seq, currentCompletion * (seq.numKeyframes - 1));
		}
		super.tick(time, onlyVisual);

		// Collision-1 is attached to nodeIndex=0 (root) in the DTS, but needs to move with node 1
		// Manually apply node 1's movement delta to the collision bodies
		// This is a bit hacky..but since the DTS is broken and has {node Index: 1}
		if (this.nodeTransforms && this.nodeTransforms.length > 1 && this.bodies.length > 0) {
			let node1Matrix = this.nodeTransforms[1];
			let node1Pos = new Vector3();
			let node1Ori = new Quaternion();
			node1Matrix.decompose(node1Pos, node1Ori, new Vector3());

			// Calculate how much node 1 moved this frame
			let offset = node1Pos.clone().sub(this.lastNode1Pos);

			// Apply the movement to all collision bodies
			this.bodies.forEach((b) => {
				b.position.add(offset);
				b.syncShapes();
			});

			// Remember this position for next frame
			this.lastNode1Pos.copy(node1Pos);
		}
	}

	/** Gets the current completion of the gate animation. 0 = closed, 1 = open. */
	getCurrentCompletion(time: TimeState) {
		let elapsed = time.timeSinceLoad - this.lastStateChangeTime;
		let completion = this.on ?
			Util.clamp(elapsed / this.animationDuration, 0, 1) :
			Util.clamp(1 - (elapsed / this.animationDuration), 0, 1);

		return completion;
	}

	/** Toggle the state of this gate and any chained gates Called by floor buttons when they detect marble contact */
	flipGate() {
		this.on = !this.on;
		this.lastStateChangeTime = this.level.timeState.timeSinceLoad;

		// Recursively flip any chained gates
		if (this.target) {
			let targetShape = this.level.shapes.find(s => (s as any).srcElement?._name === this.target);
			if (targetShape && targetShape instanceof ButtonGate) {
				(targetShape as ButtonGate).flipGate();
			}
		}
	}
}

/** Glasspanes are screeens which hinder the marble's way */
export class GlassPane extends Shape {
	dtsPath = 'shapes/hazards/glasspane.dts';
}