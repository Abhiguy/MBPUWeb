import { TimeState } from "../level";
import { Euler } from "../math/euler";
import { Matrix4 } from "../math/matrix4";
import { Quaternion } from "../math/quaternion";
import { Vector3 } from "../math/vector3";
import { AmbientLight } from "../rendering/ambient_light";
import { PerspectiveCamera } from "../rendering/camera";
import { Renderer, BlendingType } from "../rendering/renderer";
import { Texture } from "../rendering/texture";
import { Scene } from "../rendering/scene";
import { Shape } from "../shape";
import { state } from "../state";
import { StorageManager } from "../storage";
import { getAllMarbleDefinitions, getMarbleDefinition } from "../marble_definitions";
import { mainAudioManager } from "../audio";
import { ResourceManager } from "../resources";
import { MULTI_MATERIAL_MARBLE_DTS } from "../marble";


async function createComplementTexture(original: Texture): Promise<Texture> {
	try {
		let sampleCanvas = document.createElement('canvas');
		sampleCanvas.width = sampleCanvas.height = 1;
		let sampleCtx = sampleCanvas.getContext('2d');
		sampleCtx.drawImage(original.image, 0, 0, 1, 1);
		let [r, g, b] = sampleCtx.getImageData(0, 0, 1, 1).data;

		let outCanvas = document.createElement('canvas');
		outCanvas.width = outCanvas.height = 2;
		let outCtx = outCanvas.getContext('2d');
		outCtx.fillStyle = `rgb(${255 - r}, ${255 - g}, ${255 - b})`;
		outCtx.fillRect(0, 0, 2, 2);

		let img = new Image();
		img.src = outCanvas.toDataURL();
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = reject;
		});

		return new Texture(img);
	} catch (e) {
		console.error('Failed to compute complement texture, falling back to original:', e);
		return original;
	}
}

export class MarbleSelectorUI {
	marbles: any[] = [];
	currentIndex = 0; // Index of the Chosen Marble :)

	// Button and modal elements
	buttonImg: HTMLImageElement;
	modal: HTMLElement;
	modalClose: HTMLImageElement;
	previewWrap: HTMLElement;
	nameDisplay: HTMLElement;
	descDisplay: HTMLElement;
	counterDisplay: HTMLElement;
	prevBtn: HTMLImageElement;
	nextBtn: HTMLImageElement;
	confirmBtn: HTMLImageElement;
	marbleCanvas = document.createElement('canvas');
	marbleRenderer = new Renderer({ canvas: this.marbleCanvas, alpha: true, desynchronized: false });
	marbleCamera = new PerspectiveCamera(40, 1);
	currentScene: Scene;
	currentShape: Shape;
	buttonCanvas: HTMLCanvasElement;
	buttonRenderer: Renderer;
	buttonCamera: PerspectiveCamera;
	buttonScene: Scene;
	buttonShape: Shape;

	renderLoopActive = false;
	loadGeneration = 0;

	constructor() {
		this.marbles = getAllMarbleDefinitions();

		this.marbleRenderer.setSize(660, 660);
		this.marbleCanvas.style.cssText = 'width:660px;height:660px;border-radius:50%;display:block;';

		//Disabling culling of faces for some specific marbles in this UI to be able to properly draw those marbleson the selector screen. Original gameplay is unaffected.
		this.marbleRenderer.gl.disable(this.marbleRenderer.gl.CULL_FACE);

		let tilt = new Quaternion().setFromRotationMatrix(new Matrix4().makeRotationX(1.1));
		this.marbleCamera.orientation.premultiply(tilt);
	}

	async init() {
		let selectedMarbleId = state.selectedMarble || "default";
		let selectedMarbleIndex = this.marbles.findIndex((m) => m.id === selectedMarbleId);
		this.currentIndex = selectedMarbleIndex >= 0 ? selectedMarbleIndex : 0;

		this.buttonImg = document.getElementById("mbp-marble-selector-button") as HTMLImageElement;
		this.modal = document.getElementById("mbp-marble-selector-modal");
		this.modalClose = document.getElementById("mbp-marble-modal-close") as HTMLImageElement;
		this.previewWrap = document.getElementById("mbp-marble-preview-wrap");
		this.nameDisplay = document.getElementById("mbp-marble-modal-name");
		this.descDisplay = document.getElementById("mbp-marble-modal-desc");
		this.counterDisplay = document.getElementById("mbp-marble-counter");
		this.prevBtn = document.getElementById("mbp-marble-prev-btn") as HTMLImageElement;
		this.nextBtn = document.getElementById("mbp-marble-next-btn") as HTMLImageElement;
		this.confirmBtn = document.getElementById("mbp-marble-confirm-btn") as HTMLImageElement;

		if (this.previewWrap) {
			this.previewWrap.innerHTML = '';
			this.previewWrap.appendChild(this.marbleCanvas);
		}

		if (this.buttonImg) {
			this.buttonCanvas = document.createElement('canvas');
			this.buttonCanvas.width = 200;
			this.buttonCanvas.height = 200;
			this.buttonCanvas.id = 'mbp-marble-selector-button';
			this.buttonCanvas.style.cssText = 'position:absolute;top:190px;left:-38px;width:200px;height:200px;border-radius:50%;display:block;cursor:inherit;z-index:10;pointer-events:none;';

			this.buttonRenderer = new Renderer({ canvas: this.buttonCanvas, alpha: true, desynchronized: false });
			this.buttonRenderer.setSize(200, 200);
			this.buttonRenderer.gl.disable(this.buttonRenderer.gl.CULL_FACE); // See note in the constructor
			this.buttonCamera = new PerspectiveCamera(40, 1);

			let tilt = new Quaternion().setFromRotationMatrix(new Matrix4().makeRotationX(1.1));
			this.buttonCamera.orientation.premultiply(tilt);

			this.buttonImg.parentNode?.replaceChild(this.buttonCanvas, this.buttonImg);
			this.drawButtonPlaceholder();

			await this.loadMarbleForButton(this.currentIndex);

			let clickTarget = document.createElement('div');
			clickTarget.style.cssText = 'position:absolute;top:253px;left:11px;width:90px;height:90px;border-radius:50%;cursor:inherit;z-index:11;';
			this.buttonCanvas.parentNode?.appendChild(clickTarget);
			clickTarget.addEventListener('click', () => this.openModal());
		}

		this.attachEventListeners();
		this.updateButtonDisplay();

		if (!this.renderLoopActive) {
			this.renderLoopActive = true;
			requestAnimationFrame(() => this.renderLoop());
		}
	}

	attachEventListeners() {
		if (this.modalClose) {
			this.modalClose.addEventListener("click", () => this.closeModal());
		}

		if (this.modal) {
			this.modal.addEventListener("click", (e) => {
				if (e.target === this.modal) this.closeModal();
			});
		}

		if (this.prevBtn) this.prevBtn.addEventListener("click", () => this.previousMarble());
		if (this.nextBtn) this.nextBtn.addEventListener("click", () => this.nextMarble());
		if (this.confirmBtn) this.confirmBtn.addEventListener("click", () => this.confirmSelection());

		for (let btn of [this.prevBtn, this.nextBtn, this.confirmBtn]) {
			if (btn) btn.addEventListener("mouseenter", () => mainAudioManager.play('buttonover.wav'));
		}

		document.addEventListener("keydown", (e) => {
			if (this.modal && !this.modal.classList.contains("hidden")) {
				if (e.key === "ArrowLeft")  this.previousMarble();
				if (e.key === "ArrowRight") this.nextMarble();
				if (e.key === "Enter")      this.confirmSelection();
				if (e.key === "Escape")     this.closeModal();
			}
		});
	}

	openModal() {
		if (this.modal) {
			mainAudioManager.play('buttonpress.wav');
			this.modal.classList.remove("hidden");
			this.updateModalDisplay();

			if (!this.renderLoopActive) {
				this.renderLoopActive = true;
				requestAnimationFrame(() => this.renderLoop());
			}
		}
	}

	closeModal() {
		if (this.modal) {
			this.modal.classList.add("hidden");
		}
	}

	previousMarble() {
		mainAudioManager.play('buttonpress.wav');
		this.currentIndex = (this.currentIndex - 1 + this.marbles.length) % this.marbles.length;
		this.drawButtonPlaceholder();
		this.loadMarbleForButton(this.currentIndex);
		this.updateModalDisplay();
	}

	nextMarble() {
		mainAudioManager.play('buttonpress.wav');
		this.currentIndex = (this.currentIndex + 1) % this.marbles.length;
		this.drawButtonPlaceholder();
		this.loadMarbleForButton(this.currentIndex);
		this.updateModalDisplay();
	}

	updateButtonDisplay() {
		// Button is now a canvas, updated in the render loop
	}

	drawButtonPlaceholder() {
		let canvas = this.buttonCanvas;
		let ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) return;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	}

	updateModalDisplay() {
		let currentMarble = this.marbles[this.currentIndex];

		if (this.nameDisplay) this.nameDisplay.textContent = `${this.currentIndex + 1}. ${currentMarble.name || currentMarble.id}`;
		if (this.descDisplay) this.descDisplay.textContent = currentMarble.description || "A unique marble";
		if (this.counterDisplay) this.counterDisplay.textContent = `${this.currentIndex + 1}/${this.marbles.length}`;

		this.loadMarbleDTS(this.currentIndex);
	}

	toInternalPath(texturePath: string): string {
		let prefix = ResourceManager.mainDataPath;
		if (texturePath.startsWith(prefix)) {
			return texturePath.slice(prefix.length);
		}
		return texturePath.replace(/^\.\/assets\/data\//, '').replace(/^assets\/data\//, '');
	}

	async createShapeWithTexture(dtsPath: string, texturePath: string): Promise<Shape> {
		let shape = new Shape();
		shape.dtsPath = dtsPath;

		// Rendering individual meshes in dts files with different materials can be tricky, especially if the dts uses multiple materials. For marbles that have multiple materials, we don't override the material names with a single texture. Instead, we let the shape compute its own materials based on the dts file's internal material names. For single-material marbles, we override the material names to use the provided texture. But for multi material marbles, they need to be showcased independently
		let isMultiMaterialShape = MULTI_MATERIAL_MARBLE_DTS.has(dtsPath);

		if (texturePath && !isMultiMaterialShape) {
			try {
				let internalPath = this.toInternalPath(texturePath);
				let tex = await ResourceManager.getTexture(internalPath);

				// assigns it to diffuseMap regardless of the DTS's internal material names
				shape.matNamesOverride = new Proxy({} as Record<string, typeof tex>, {
					get: (_target, key) => typeof key === 'string' ? tex : undefined
				});
			} catch (e) {
				console.warn(`Could not load texture for ${dtsPath} (${texturePath}):`, e);
			}
		}

		await shape.init();


		// Preview the shape instance's own materials, regardless of their blending type.
		for (let material of shape.materials) {
			if (material.blending === BlendingType.Subtractve) {
				material.blending = BlendingType.Normal;


				material.opacity = 0.5;

				// True Subtractive blending (result = dst * (1 - src)) makes the shell visually
				// appear as the RGB *complement* of its own texture color once composited over
				// whatever's behind it in-level — that's why e.g. a yellow-textured shell (1,1,0)
				// reads as blue (0,0,1) in-game, and a cyan shell (0,1,1) reads as red (1,0,0). This
				// preview uses plain alpha blending instead (no backdrop for true Subtractive to act
				// on), which would otherwise just show the shell's raw, un-complemented texture color.
				// Reproduce the in-level appearance by swapping in a flat texture of the complement
				// color instead, computed from the shell's own bound texture.
				if (material.diffuseMap) {
					material.diffuseMap = await createComplementTexture(material.diffuseMap);
				}
			}
		}

		return shape;
	}

	//  Load the DTS
	async loadMarbleForButton(index: number) {
		if (!this.buttonRenderer || !this.buttonCamera || !this.buttonCanvas) return;
		let buttonCanvas = this.buttonCanvas;

		try {
			let def = getMarbleDefinition(this.marbles[index].id);
			let shape = await this.createShapeWithTexture(def.dtsPath, def.texturePath);
			let scene = new Scene(this.buttonRenderer);

			let timeState: TimeState = {
				timeSinceLoad: 0, currentAttemptTime: 0,
				gameplayClock: 0, physicsTickCompletion: 0, tickIndex: 0
			};

			let lookVector = new Vector3(0, 0, -1).applyQuaternion(this.buttonCamera.orientation);
			let position = lookVector.clone().multiplyScalar(3);

			shape.setTransform(position, new Quaternion(), new Vector3(1, 1, 1));
			shape.render(timeState);
			scene.add(shape.group);

			let light = new AmbientLight(new Vector3().setScalar(1));
			scene.addAmbientLight(light);
			scene.compile();

			this.buttonScene = scene;
			this.buttonShape = shape;
		} catch (error) {
			// draw the texture on a seperate 2D canvas
			let currentMarble = this.marbles[index];
			this.renderFallbackToSeparateCanvas(currentMarble.texturePath, buttonCanvas);
		}
	}

	async loadMarbleDTS(index: number) {
		let generation = ++this.loadGeneration;
		let def = getMarbleDefinition(this.marbles[index].id);

		try {
			const shape = await this.createShapeWithTexture(def.dtsPath, def.texturePath);

			if (generation !== this.loadGeneration) {
				return;
			}

			let scene = new Scene(this.marbleRenderer);
			let timeState: TimeState = {
				timeSinceLoad: 0, currentAttemptTime: 0,
				gameplayClock: 0, physicsTickCompletion: 0, tickIndex: 0
			};

			let lookVector = new Vector3(0, 0, -1).applyQuaternion(this.marbleCamera.orientation);
			let position = lookVector.clone().multiplyScalar(3);

			shape.setTransform(position, new Quaternion(), new Vector3(1, 1, 1));
			shape.render(timeState);
			scene.add(shape.group);

			let light = new AmbientLight(new Vector3().setScalar(1));
			scene.addAmbientLight(light);
			scene.compile();

			this.currentScene = scene;
			this.currentShape = shape;
		} catch (error) {
			// draw texture on a separate 2D canvas overlaid on top of the WebGL canvas
			this.renderFallbackToSeparateCanvas(def.texturePath, this.marbleCanvas);
		}
	}

	renderFallbackToSeparateCanvas(texturePath: string, referenceCanvas: HTMLCanvasElement) {
		let size = referenceCanvas.width;
		let fallback = document.createElement('canvas');
		fallback.width = size;
		fallback.height = size;
		fallback.style.cssText = referenceCanvas.style.cssText + ';position:absolute;top:0;left:0;';

		let parent = referenceCanvas.parentElement;
		if (parent) {
			parent.style.position = 'relative';
			parent.appendChild(fallback);
		}

		let ctx = fallback.getContext('2d');
		if (!ctx) return;
		let img = new Image();

		img.onload = () => {
			ctx.clearRect(0, 0, size, size);
			ctx.save();
			ctx.beginPath();
			ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
			ctx.clip();
			ctx.drawImage(img, 0, 0, size, size);

			let gradient = ctx.createRadialGradient(size * 0.3, size * 0.3, 0, size / 2, size / 2, size / 2);
			gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
			gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
			gradient.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
			ctx.fillStyle = gradient;
			ctx.fill();
			ctx.restore();

			ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
			ctx.stroke();
		};

		img.onerror = () => {
			ctx.fillStyle = '#aaa';
			ctx.beginPath();
			ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
			ctx.fill();
		};

		img.crossOrigin = 'anonymous';
		img.src = texturePath;
	}

	renderLoop() {
		requestAnimationFrame(() => this.renderLoop());

		let now = performance.now();
		let euler = new Euler(0, 0, now / 5000 * Math.PI);

		if (this.buttonScene?.compiled && this.buttonShape) {
			// Advance the shape's own timeState every frame
			let buttonTimeState: TimeState = {
				timeSinceLoad: now, currentAttemptTime: now,
				gameplayClock: now, physicsTickCompletion: 0, tickIndex: 0
			};
			this.buttonShape.render(buttonTimeState);

			this.buttonShape.group.orientation.setFromEuler(euler);
			this.buttonShape.group.recomputeTransform();
			let buttonCamera = this.buttonCamera;
			if (buttonCamera) {
				buttonCamera.updateMatrixWorld();
				this.buttonScene.prepareForRender(buttonCamera);
				this.buttonRenderer?.render(this.buttonScene, buttonCamera);
			}
		}

		if (!this.modal || this.modal.classList.contains('hidden')) return;

		let scene = this.currentScene;
		let shape = this.currentShape;
		if (!scene?.compiled || !shape) return;

		let modalTimeState: TimeState = {
			timeSinceLoad: now, currentAttemptTime: now,
			gameplayClock: now, physicsTickCompletion: 0, tickIndex: 0
		};
		shape.render(modalTimeState);

		let modalEuler = new Euler(0, 0, now / 3000 * Math.PI);
		shape.group.orientation.setFromEuler(modalEuler);
		shape.group.recomputeTransform();

		this.marbleCamera.updateMatrixWorld();
		scene.prepareForRender(this.marbleCamera);
		this.marbleRenderer.render(scene, this.marbleCamera);
	}

	confirmSelection() {
		mainAudioManager.play('buttonpress.wav');
		let selectedMarble = this.marbles[this.currentIndex];
		state.selectedMarble = selectedMarble.id;
		this.closeModal();
		this.persistSelection(selectedMarble.id);
	}

	async persistSelection(marbleId: string) {
		try {
			await StorageManager.databasePut("keyvalue", marbleId, "selectedMarble");
		} catch (e) {
			console.error("Failed to save marble selection:", e);
		}
	}
}