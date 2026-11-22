import { Vector3 } from "../math/vector3";
import { Texture } from "./texture";

/** Represents a point light that emits light in all directions from a specific position, Independent of the Ambient Sun. */
export class PointLight {
	color: Vector3;
	position: Vector3;
	range: number;
	texture: Texture;

	constructor(color: Vector3, position: Vector3, range = 10, texture: Texture = null) {
		this.color = color;
		this.position = position;
		this.range = range;
		this.texture = texture;
	}
}
