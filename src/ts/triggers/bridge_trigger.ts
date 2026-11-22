import { Trigger } from "./trigger";
import { Shape } from "../shape";
import { Util } from "../util";
import { TimeState, Level, PHYSICS_TICK_RATE } from "../level";
import { MissionElementTrigger } from "../parsing/mis_parser";
import { Box3 } from "../math/box3";
import { Vector3 } from "../math/vector3";
import { Quaternion } from "../math/quaternion";

const BRIDGE_DTS = "shapes/ac/bridge.dts";
const TILE_SIZE = 0.5; // BridgeFloor.width
const MAX_SPEED = 5; // The bridge disappears above this marble speed
const BRIDGE_SIZE = 1.5; // Tiles within this distance of the marble are visible
const TIMEOUT = 1500; // How long the bridge stays hidden after the marble was too fast
const FADE_TIME = 400;
const POOL_SIZE = 64;

interface Tile {
	shape: Shape;
	/** The grid cell this tile currently occupies, or -1 if it's free. */
	cell: number;
	opacity: number;
	solid: boolean;
	/** Whether this tile's collision bodies have been added to the physics world yet. */
	inWorld: boolean;
}

/** A trigger area that builds a bridge of tiles under the marble while it moves slowly. */
export class BridgeTrigger extends Trigger {
	box: Box3;
	columns: number;
	rows: number;
	tiles: Tile[] = [];
	ready = false;
	marbleInside = false;
	/** The attempt time before which the bridge stays hidden. */
	hiddenUntil = 0;

	constructor(element: MissionElementTrigger, level: Level) {
		super(element, level);

		this.box = new Box3().setFromPoints(this.vertices);
		this.columns = Math.ceil((this.box.max.x - this.box.min.x) / TILE_SIZE);
		this.rows = Math.ceil((this.box.max.y - this.box.min.y) / TILE_SIZE);
	}

	async init() {
		await super.init();

		// Create the pool of tile shapes, all hidden and without collision. Their physics bodies are only added to the world once a tile is first used.
		for (let i = 0; i < POOL_SIZE; i++) {
			let shape = new Shape(BRIDGE_DTS);
			this.level.shapes.push(shape);
			await Util.wait(10); // Same hack as for regular shapes
			await shape.init(this.level, null);

			shape.setTransform(this.parkingPosition(), new Quaternion(), new Vector3(1, 1, 1));
			this.level.scene.add(shape.group);

			shape.setOpacity(0);
			shape.setCollisionEnabled(false);
			this.tiles.push({ shape, cell: -1, opacity: 0, solid: false, inWorld: false });
		}

		this.ready = true;
	}

	/** Unused tiles wait inside the trigger's own area, so the physics world doesn't have to grow to reach them. */
	parkingPosition() {
		return new Vector3(
			(this.box.min.x + this.box.max.x) / 2,
			(this.box.min.y + this.box.max.y) / 2,
			this.box.min.z - TILE_SIZE / 2
		);
	}

	onMarbleEnter() {
		this.marbleInside = true;
	}

	onMarbleLeave() {
		this.marbleInside = false;
	}

	reset() {
		super.reset(); // Note: this also runs from the Trigger constructor, before our fields exist
		this.marbleInside = false;
		this.hiddenUntil = 0;
		for (let tile of this.tiles ?? []) if (tile.cell !== -1) this.release(tile);
	}

	/** Returns a tile to the pool and hides it right away. */
	release(tile: Tile) {
		tile.cell = -1;
		tile.opacity = 0;
		tile.shape.setOpacity(0);
		this.setSolid(tile, false);
	}

	setSolid(tile: Tile, solid: boolean) {
		if (tile.solid === solid) return;
		tile.solid = solid;
		tile.shape.setCollisionEnabled(solid);
	}

	/** Adds the tile's collision bodies to the physics world the first time the tile is needed. */
	addToWorld(tile: Tile) {
		if (tile.inWorld) return;
		tile.inWorld = true;

		for (let body of tile.shape.bodies) this.level.world.add(body);
		for (let collider of tile.shape.colliders) this.level.world.add(collider.body);
	}

	tick(time: TimeState) {
		if (!this.ready) return;

		let marble = this.level.marble.body;
		let now = time.currentAttemptTime;

		// Too fast: the bridge disappears and stays gone for a while
		if (this.marbleInside && marble.linearVelocity.length() > MAX_SPEED) this.hiddenUntil = now + TIMEOUT;
		let allowed = this.marbleInside && now >= this.hiddenUntil;

		if (!allowed) {
			for (let tile of this.tiles) if (tile.cell !== -1) this.release(tile);
			return;
		}

		// Work out which grid cells are close enough to the marble
		let min = this.box.min;
		let tileZ = min.z - TILE_SIZE / 2;
		let wanted = new Set<number>();
		let colStart = Math.max(0, Math.floor((marble.position.x - BRIDGE_SIZE - min.x) / TILE_SIZE));
		let colEnd = Math.min(this.columns - 1, Math.floor((marble.position.x + BRIDGE_SIZE - min.x) / TILE_SIZE));
		let rowStart = Math.max(0, Math.floor((marble.position.y - BRIDGE_SIZE - min.y) / TILE_SIZE));
		let rowEnd = Math.min(this.rows - 1, Math.floor((marble.position.y + BRIDGE_SIZE - min.y) / TILE_SIZE));

		for (let col = colStart; col <= colEnd; col++) {
			for (let row = rowStart; row <= rowEnd; row++) {
				let dx = min.x + (col + 0.5) * TILE_SIZE - marble.position.x;
				let dy = min.y + (row + 0.5) * TILE_SIZE - marble.position.y;
				let dz = tileZ - marble.position.z;
				if (dx * dx + dy * dy + dz * dz <= BRIDGE_SIZE * BRIDGE_SIZE) wanted.add(row * this.columns + col);
			}
		}

		let fadeStep = (1000 / PHYSICS_TICK_RATE) / FADE_TIME;

		// Fade tiles in or out depending on whether their cell is still close to the marble
		for (let tile of this.tiles) {
			if (tile.cell === -1) continue;

			let stillWanted = wanted.delete(tile.cell); // Cells left in the set afterwards are new
			tile.opacity = Util.clamp(tile.opacity + (stillWanted ? fadeStep : -fadeStep), 0, 1);
			tile.shape.setOpacity(tile.opacity);
			this.setSolid(tile, stillWanted);

			if (!stillWanted && tile.opacity === 0) this.release(tile);
		}

		// Give each newly needed cell a free tile
		for (let cell of wanted) {
			let tile = this.tiles.find(x => x.cell === -1);
			if (!tile) break; // Pool exhausted, shouldn't happen

			let col = cell % this.columns;
			let row = Math.floor(cell / this.columns);
			tile.cell = cell;
			tile.shape.setTransform(new Vector3(min.x + (col + 0.5) * TILE_SIZE, min.y + (row + 0.5) * TILE_SIZE, tileZ), new Quaternion(), new Vector3(1, 1, 1));
			this.addToWorld(tile); // The tile is at its real position now
			this.setSolid(tile, true);
		}
	}
}