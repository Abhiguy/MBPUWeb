import { AudioSource, mainAudioManager } from "../audio";
import { blastButton, currentMousePosition, jumpButton, useButton } from "../input";
import { ResourceManager } from "../resources";
import { StorageData, StorageManager } from "../storage";
import { Util } from "../util";
import { Menu } from "./menu";
import { SCALING_RATIO } from "./misc";
import { OptionsScreen } from "./options";

/** Size (in unscaled UI pixels) of the sliders added to the Misc tab. Must match options.css (.misc-slider). */
const MISC_TRACK_WIDTH = 150;
const MISC_KNOB_WIDTH = 22;
const MISC_TRACK_SRC = './assets/ui/options/aud_mus_slide.png';

export class MbgOptionsScreen extends OptionsScreen {
	tabGraphics: HTMLImageElement;
	tabAudio: HTMLImageElement;
	tabControls: HTMLImageElement;
	tabMisc: HTMLImageElement;

	graphicsDiv: HTMLDivElement;
	audioDiv: HTMLDivElement;
	controlsDiv: HTMLDivElement;
	miscDiv: HTMLDivElement;

	disablePowerupEffects: HTMLImageElement;

	/** Container for the FOV and touch control rows in the Misc tab. */
	miscScroll: HTMLDivElement;
	/** Functions that refresh each Misc row from the stored settings. */
	miscUpdateFuncs: (() => void)[] = [];
	/** While a Misc slider is being dragged, this updates it from the current mouse position. */
	miscDragging: (() => void) | null = null;
	/** The bar images of all Misc sliders. */
	miscTrackImages: HTMLImageElement[] = [];
	/** Which part of the slider bar image (as fractions of its width) holds the actual bar. The image has "Music Volume" text on its left, which is cropped away. Refined by detectMiscTrackCrop(). */
	miscTrackCrop = { start: 0.33, end: 1 };

	resolution640: HTMLImageElement;
	resolution800: HTMLImageElement;
	resolution1024: HTMLImageElement;

	openGl: HTMLImageElement;
	direct3D: HTMLImageElement;

	windowedButton: HTMLImageElement;
	fullButton: HTMLImageElement;

	depth16: HTMLImageElement;
	depth32: HTMLImageElement;

	shadowsCheckbox: HTMLImageElement;
	graphicsApply: HTMLImageElement;

	musicVolumeTrack: HTMLImageElement;
	musicVolumeKnob: HTMLImageElement;
	soundVolumeTrack: HTMLImageElement;
	soundVolumeKnob: HTMLImageElement;
	trackLength = 235; // The total draggable length of the slider
	musicVolumeKnobLeft = 155; // The left-most position of the knob
	soundVolumeKnobLeft = 157;
	mouseSensitivityKnobLeft = 148;
	draggingMusicVolume = false;
	draggingSoundVolume = false;
	draggingMouseSensitivity = false;
	soundTestingSound: AudioSource = null;

	controlsBackground: HTMLImageElement;
	marbleTab: HTMLImageElement; // it's not
	cameraTab: HTMLImageElement;
	mouseTab: HTMLImageElement;
	marbleControlsDiv: HTMLDivElement;
	cameraControlsDiv: HTMLDivElement;
	mouseControlsDiv: HTMLDivElement;

	buttonMarbleLeft: HTMLImageElement;
	buttonMarbleRight:  HTMLImageElement;
	buttonMarbleUp: HTMLImageElement;
	buttonMarbleDown: HTMLImageElement;
	buttonMarbleUse: HTMLImageElement;
	buttonMarbleJump: HTMLImageElement;

	buttonMarbleLeftContent: HTMLParagraphElement;
	buttonMarbleRightContent: HTMLParagraphElement;
	buttonMarbleUpContent: HTMLParagraphElement;
	buttonMarbleDownContent: HTMLParagraphElement;
	buttonMarbleUseContent: HTMLParagraphElement;
	buttonMarbleJumpContent: HTMLParagraphElement;

	buttonCameraLeft: HTMLImageElement;
	buttonCameraRight: HTMLImageElement;
	buttonCameraUp: HTMLImageElement;
	buttonCameraDown: HTMLImageElement;

	buttonCameraLeftContent: HTMLParagraphElement;
	buttonCameraRightContent: HTMLParagraphElement;
	buttonCameraUpContent: HTMLParagraphElement;
	buttonCameraDownContent: HTMLParagraphElement;

	mouseSensitivityKnob: HTMLImageElement;

	invertY: HTMLImageElement;
	alwaysFreeLook: HTMLImageElement;
	freeLookKey: HTMLImageElement;
	freeLookKeyContent: HTMLParagraphElement;

	buttonRestartLevel: HTMLImageElement;
	buttonRestartLevelContent: HTMLParagraphElement;

	initProperties() {
		this.div = document.querySelector('#options');
		this.homeButton = document.querySelector('#options-home') as HTMLImageElement;
		this.rebindDialog = document.querySelector('#rebind-dialog') as HTMLDivElement;
		this.rebindConfirm = document.querySelector('#rebind-confirm') as HTMLDivElement;
		this.rebindConfirmYes = document.querySelector('#rebind-confirm-yes') as HTMLImageElement;
		this.rebindConfirmNo = document.querySelector('#rebind-confirm-no') as HTMLImageElement;

		this.homeButtonSrc = 'options/mainm';
		this.rebindConfirmYesSrc = 'common/yes';
		this.rebindConfirmNoSrc = 'common/no';

		this.tabGraphics = document.querySelector('#tab-graphics') as HTMLImageElement;
		this.tabAudio = document.querySelector('#tab-audio') as HTMLImageElement;
		this.tabControls = document.querySelector('#tab-controls') as HTMLImageElement;
		this.tabMisc = document.querySelector('#tab-misc') as HTMLImageElement;

		this.graphicsDiv = document.querySelector('#options-graphics') as HTMLDivElement;
		this.audioDiv = document.querySelector('#options-audio') as HTMLDivElement;
		this.controlsDiv = document.querySelector('#options-controls') as HTMLDivElement;
		this.miscDiv = document.querySelector('#options-misc') as HTMLDivElement;
		this.disablePowerupEffects = document.querySelector('#misc-disable-powerup-effects') as HTMLImageElement;
		this.miscScroll = document.querySelector('#misc-scroll') as HTMLDivElement;

		this.resolution640 = document.querySelector('#graphics-640') as HTMLImageElement;
		this.resolution800 = document.querySelector('#graphics-800') as HTMLImageElement;
		this.resolution1024 = document.querySelector('#graphics-1024') as HTMLImageElement;

		this.openGl = document.querySelector('#graphics-opengl') as HTMLImageElement;
		this.direct3D = document.querySelector('#graphics-direct3d') as HTMLImageElement;

		this.windowedButton = document.querySelector('#graphics-windowed') as HTMLImageElement;
		this.fullButton = document.querySelector('#graphics-full') as HTMLImageElement;

		this.depth16 = document.querySelector('#graphics-depth16') as HTMLImageElement;
		this.depth32 = document.querySelector('#graphics-depth32') as HTMLImageElement;

		this.shadowsCheckbox = document.querySelector('#graphics-shadows') as HTMLImageElement;
		this.graphicsApply = document.querySelector('#graphics-apply') as HTMLImageElement;

		this.musicVolumeTrack = document.querySelector('#audio-music-track') as HTMLImageElement;
		this.musicVolumeKnob = document.querySelector('#audio-music-knob') as HTMLImageElement;
		this.soundVolumeTrack = document.querySelector('#audio-sound-track') as HTMLImageElement;
		this.soundVolumeKnob = document.querySelector('#audio-sound-knob') as HTMLImageElement;

		this.controlsBackground = document.querySelector('#controls-background') as HTMLImageElement;
		this.marbleTab = document.querySelector('#tab-marble') as HTMLImageElement; // it's not
		this.cameraTab = document.querySelector('#tab-camera') as HTMLImageElement;
		this.mouseTab = document.querySelector('#tab-mouse') as HTMLImageElement;
		this.marbleControlsDiv = document.querySelector('#controls-marble') as HTMLDivElement;
		this.cameraControlsDiv = document.querySelector('#controls-camera') as HTMLDivElement;
		this.mouseControlsDiv = document.querySelector('#controls-mouse') as HTMLDivElement;

		this.buttonMarbleLeft = document.querySelector('#button-marble-left') as HTMLImageElement;
		this.buttonMarbleRight = document.querySelector('#button-marble-right') as HTMLImageElement;
		this.buttonMarbleUp = document.querySelector('#button-marble-up') as HTMLImageElement;
		this.buttonMarbleDown = document.querySelector('#button-marble-down') as HTMLImageElement;
		this.buttonMarbleUse = document.querySelector('#button-marble-use') as HTMLImageElement;
		this.buttonMarbleJump = document.querySelector('#button-marble-jump') as HTMLImageElement;

		this.buttonMarbleLeftContent = document.querySelector('#button-marble-left-content') as HTMLParagraphElement;
		this.buttonMarbleRightContent = document.querySelector('#button-marble-right-content') as HTMLParagraphElement;
		this.buttonMarbleUpContent = document.querySelector('#button-marble-up-content') as HTMLParagraphElement;
		this.buttonMarbleDownContent = document.querySelector('#button-marble-down-content') as HTMLParagraphElement;
		this.buttonMarbleUseContent = document.querySelector('#button-marble-use-content') as HTMLParagraphElement;
		this.buttonMarbleJumpContent = document.querySelector('#button-marble-jump-content') as HTMLParagraphElement;

		this.buttonCameraLeft = document.querySelector('#button-camera-left') as HTMLImageElement;
		this.buttonCameraRight = document.querySelector('#button-camera-right') as HTMLImageElement;
		this.buttonCameraUp = document.querySelector('#button-camera-up') as HTMLImageElement;
		this.buttonCameraDown = document.querySelector('#button-camera-down') as HTMLImageElement;

		this.buttonCameraLeftContent = document.querySelector('#button-camera-left-content') as HTMLParagraphElement;
		this.buttonCameraRightContent = document.querySelector('#button-camera-right-content') as HTMLParagraphElement;
		this.buttonCameraUpContent = document.querySelector('#button-camera-up-content') as HTMLParagraphElement;
		this.buttonCameraDownContent = document.querySelector('#button-camera-down-content') as HTMLParagraphElement;

		this.mouseSensitivityKnob = document.querySelector('#sensitivity-knob') as HTMLImageElement;

		this.invertY = document.querySelector('#invert-y') as HTMLImageElement;
		this.alwaysFreeLook = document.querySelector('#always-free-look') as HTMLImageElement;

		this.freeLookKey = document.querySelector('#free-look-key') as HTMLImageElement;
		this.freeLookKeyContent = document.querySelector('#free-look-key-content') as HTMLParagraphElement;

		this.buttonRestartLevel = document.querySelector('#button-restart-level') as HTMLImageElement;
		this.buttonRestartLevelContent = document.querySelector('#button-restart-level-content') as HTMLParagraphElement;
	}

	constructor(menu: Menu) {
		super(menu);

		menu.setupButton(this.resolution640, 'options/graf640', () => this.selectResolutionButton(this.resolution640, 0));
		menu.setupButton(this.resolution800, 'options/graf800', () => this.selectResolutionButton(this.resolution800, 1));
		menu.setupButton(this.resolution1024, 'options/graf1024', () => this.selectResolutionButton(this.resolution1024, 2));

		menu.setupButton(this.openGl, 'options/grafopgl', () => this.selectVideoDriverButton(this.openGl, 0));
		menu.setupButton(this.direct3D, 'options/grafdir3d', () => this.selectVideoDriverButton(this.direct3D, 1));

		menu.setupButton(this.windowedButton, 'options/grafwindo', () => this.selectScreenStyleButton(this.windowedButton, 0));
		menu.setupButton(this.fullButton, 'options/grafful', () => this.selectScreenStyleButton(this.fullButton, 1));

		menu.setupButton(this.depth16, 'options/graf16bt', () => this.selectColorDepthButton(this.depth16, 0));
		menu.setupButton(this.depth32, 'options/graf32bt', () => this.selectColorDepthButton(this.depth32, 1));

		menu.setupButton(this.shadowsCheckbox, 'options/graf_chkbx', () => {
			StorageManager.data.settings.shadows = !this.shadowsCheckbox.hasAttribute('data-locked');
			StorageManager.store();

			// Toggle the checkbox
			if (!this.shadowsCheckbox.hasAttribute('data-locked')) {
				this.shadowsCheckbox.setAttribute('data-locked', '');
				this.shadowsCheckbox.src = './assets/ui/options/graf_chkbx_d.png';
			} else {
				this.shadowsCheckbox.removeAttribute('data-locked');
				this.shadowsCheckbox.src = './assets/ui/options/graf_chkbx_h.png';
			}
		});
		menu.setupButton(this.graphicsApply, 'options/grafapply', () => {});

		const handler = () => {

			// Release all dragging things
			this.draggingMusicVolume = false;
			this.draggingSoundVolume = false;
			this.draggingMouseSensitivity = false;
			this.miscDragging = null;
			StorageManager.store();

			if (this.soundTestingSound) {
				// Stop the sound
				this.soundTestingSound.stop();
				this.soundTestingSound = null;
			}
		};
		window.addEventListener('mouseup', handler);
		window.addEventListener('touchend', handler);
		this.musicVolumeTrack.addEventListener('mousedown', () => this.draggingMusicVolume = true);
		this.musicVolumeTrack.addEventListener('touchstart', () => this.draggingMusicVolume = true);
		this.musicVolumeKnob.addEventListener('mousedown', () => this.draggingMusicVolume = true);
		this.musicVolumeKnob.addEventListener('touchstart', () => this.draggingMusicVolume = true);
		this.soundVolumeTrack.addEventListener('mousedown', () => this.draggingSoundVolume = true);
		this.soundVolumeTrack.addEventListener('touchstart', () => this.draggingSoundVolume = true);
		this.soundVolumeKnob.addEventListener('mousedown', () => this.draggingSoundVolume = true);
		this.soundVolumeKnob.addEventListener('touchstart', () => this.draggingSoundVolume = true);

		requestAnimationFrame(() => this.updateSliders());

		menu.setupButton(this.marbleTab, '', () => this.selectControlsTab('marble'));
		menu.setupButton(this.cameraTab, '', () => this.selectControlsTab('camera'));
		menu.setupButton(this.mouseTab, '', () => this.selectControlsTab('mouse'));

		menu.setupButton(this.buttonMarbleLeft, 'options/cntr_mrb_lft', () => this.changeKeybinding('left'));
		menu.setupButton(this.buttonMarbleRight, 'options/cntr_mrb_rt', () => this.changeKeybinding('right'));
		menu.setupButton(this.buttonMarbleUp, 'options/cntr_mrb_fw', () => this.changeKeybinding('up'));
		menu.setupButton(this.buttonMarbleDown, 'options/cntr_mrb_bak', () => this.changeKeybinding('down'));
		menu.setupButton(this.buttonMarbleUse, 'options/cntr_mrb_pwr', () => this.changeKeybinding('use'));
		menu.setupButton(this.buttonMarbleJump, 'options/cntr_mrb_jmp', () => this.changeKeybinding('jump'));

		menu.setupButton(this.buttonCameraLeft, 'options/cntr_cam_lft', () => this.changeKeybinding('cameraLeft'));
		menu.setupButton(this.buttonCameraRight, 'options/cntr_cam_rt', () => this.changeKeybinding('cameraRight'));
		menu.setupButton(this.buttonCameraUp, 'options/cntr_cam_up', () => this.changeKeybinding('cameraUp'));
		menu.setupButton(this.buttonCameraDown, 'options/cntr_cam_dwn', () => this.changeKeybinding('cameraDown'));

		this.mouseSensitivityKnob.addEventListener('mousedown', () => this.draggingMouseSensitivity = true);
		this.mouseSensitivityKnob.addEventListener('touchstart', () => this.draggingMouseSensitivity = true);

		menu.setupButton(this.invertY, 'options/cntrl_mous_invrt', () => {
			StorageManager.data.settings.invertMouse &= ~0b10;
			StorageManager.data.settings.invertMouse |= Number(!this.invertY.hasAttribute('data-locked')) << 1;
			StorageManager.store();

			// Toggle the checkbox
			if (!this.invertY.hasAttribute('data-locked')) {
				this.invertY.setAttribute('data-locked', '');
				this.invertY.src = './assets/ui/options/cntrl_mous_invrt_d.png';
			} else {
				this.invertY.removeAttribute('data-locked');
				this.invertY.src = './assets/ui/options/cntrl_mous_invrt_h.png';
			}
		});
		menu.setupButton(this.alwaysFreeLook, 'options/cntrl_mous_freel', () => {
			StorageManager.data.settings.alwaysFreeLook = !this.alwaysFreeLook.hasAttribute('data-locked');
			StorageManager.store();

			// Toggle the checkbox
			if (!this.alwaysFreeLook.hasAttribute('data-locked')) {
				this.alwaysFreeLook.setAttribute('data-locked', '');
				this.alwaysFreeLook.src = './assets/ui/options/cntrl_mous_freel_d.png';
			} else {
				this.alwaysFreeLook.removeAttribute('data-locked');
				this.alwaysFreeLook.src = './assets/ui/options/cntrl_mous_freel_h.png';
			}
		});

		menu.setupButton(this.freeLookKey, 'options/cntrl_mous_bttn', () => this.changeKeybinding('freeLook'));

		menu.setupButton(this.buttonRestartLevel, 'options/cntr_cam_dwn', () => this.changeKeybinding('restart'));

		// Misc tab: "Disable PowerUp Effects" checkbox (same graphics as the shadows checkbox)
		menu.setupButton(this.disablePowerupEffects, 'options/graf_chkbx', () => {
			const checked = !this.disablePowerupEffects.hasAttribute('data-locked');
			StorageManager.data.settings.disablePowerupEffects = checked;
			StorageManager.store();
			this.setDisablePowerupEffectsVisual(checked, true);
		});

		this.buildMiscRows();
		this.detectMiscTrackCrop();
	}

	/** Builds the FOV + touch control rows of the Misc tab. */
	buildMiscRows() {
		this.addMiscSlider('fov', 'Field of View', 30, 120, 1, x => (x | 0).toString());

		this.addMiscHeading('Touch Controls');
		this.addMiscSlider('joystickSize', 'Joystick Size', 100, 500, 1, x => (x | 0).toString());
		this.addMiscSlider('joystickLeftOffset', 'Joystick Left Offset', 0, 300, 1, x => (x | 0).toString());
		this.addMiscSlider('joystickVerticalPosition', 'Joystick Vertical Pos', 0, 1, 0, x => Math.floor(100 * x) + '%');
		// The stored value is an index into all permutations of Blast/Jump/Use (shared with the MBP screen). This port has no blast button,
		// so only two choices are offered. Jump - Use is the original side-by-side layout (Blast - Jump - Use: Use left, Jump right);
		// Use - Jump is the stacked layout (Use - Jump - Blast: Use on top of Jump).
		let permutations = Util.getPermutations(['Blast', 'Jump', 'Use']).map(x => x.join(' - '));
		let jumpUseValue = permutations.indexOf('Blast - Jump - Use');
		let useJumpValue = permutations.indexOf('Use - Jump - Blast');
		// Old saves (or the earlier version of this dropdown) can hold other permutations, e.g. "Jump - Use - Blast", which the touch layout
		// in hud.ts shows stacked. Convert any stored value into one of the two valid ones: Use before Jump -> "Use - Jump", else "Jump - Use".
		const normalizeOrder = () => {
			let settings = StorageManager.data?.settings;
			if (!settings) return 0;
			let order = permutations[Number(settings.actionButtonOrder)]?.split(' - ') ?? [];
			let choice = order.indexOf('Use') < order.indexOf('Jump') ? 1 : 0;
			let value = choice === 1 ? useJumpValue : jumpUseValue;
			if (settings.actionButtonOrder !== value) {
				settings.actionButtonOrder = value as never;
				StorageManager.store();
			}
			return choice;
		};
		// Places the touch buttons right away, with the same slots hud.ts uses when a level loads, so the choice shows up without a restart.
		// The slots are: 0 = above the bottom right one, 1 = bottom right, 2 = left of the bottom right one.
		const applyButtonOrder = (value: number) => {
			let buttons: Record<string, HTMLElement | undefined> = { Blast: blastButton, Jump: jumpButton, Use: useButton };
			let offsets = [{ right: 0, bottom: 135 }, { right: 0, bottom: 0 }, { right: 135, bottom: 0 }];
			(permutations[value] ?? '').split(' - ').forEach((name, i) => {
				let button = buttons[name];
				if (!button) return;
				button.style.right = offsets[i].right + 'px';
				button.style.bottom = offsets[i].bottom + 'px';
			});
		};
		normalizeOrder();
		applyButtonOrder(StorageManager.data?.settings ? Number(StorageManager.data.settings.actionButtonOrder) : jumpUseValue);
		this.addMiscDropdown('actionButtonOrder', 'Button Order', [
			{ label: 'Jump - Use', value: jumpUseValue },
			{ label: 'Use - Jump', value: useJumpValue }
		], () => normalizeOrder(), applyButtonOrder);
		this.addMiscSlider('actionButtonSize', 'Button Size', 50, 300, 1, x => (x | 0).toString());
		this.addMiscSlider('actionButtonRightOffset', 'Button Right Offset', 0, 300, 1, x => (x | 0).toString());
		this.addMiscSlider('actionButtonBottomOffset', 'Button Bottom Offset', 0, 300, 1, x => (x | 0).toString());
		this.addMiscSlider('actionButtonAsJoystickMultiplier', 'Button Sensitivity Fac', 0, 3, 0.1, x => x.toFixed(1));
	}

	addMiscHeading(label: string) {
		let heading = document.createElement('div');
		heading.classList.add('misc-heading');
		heading.textContent = label;
		this.miscScroll.appendChild(heading);
	}

	/** Scales/shifts every Misc slider bar image so that only the bar part (no text) is visible, MISC_TRACK_WIDTH wide. */
	applyMiscTrackCrop() {
		let { start, end } = this.miscTrackCrop;
		for (let img of this.miscTrackImages) {
			if (!img.naturalWidth) continue;
			let width = MISC_TRACK_WIDTH / (end - start);
			let height = width * img.naturalHeight / img.naturalWidth;
			img.style.width = width + 'px';
			img.style.height = height + 'px';
			img.style.left = (-start * width) + 'px';
			(img.parentElement as HTMLElement).style.height = height + 'px';
		}
	}

	/** Finds the bar inside the slider image by looking for the widest run of non-empty pixel columns (the text is made of narrow runs). Falls back to the default crop if that doesn't work. */
	async detectMiscTrackCrop() {
		try {
			let image = new Image();
			image.src = MISC_TRACK_SRC;
			await image.decode();

			let canvas = document.createElement('canvas');
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			let context = canvas.getContext('2d');
			context.drawImage(image, 0, 0);
			let data = context.getImageData(0, 0, canvas.width, canvas.height).data;

			let bestStart = 0, bestLength = 0, runStart = -1;
			for (let x = 0; x <= canvas.width; x++) {
				let filled = false;
				if (x < canvas.width) {
					for (let y = 0; y < canvas.height; y++) {
						if (data[(y * canvas.width + x) * 4 + 3] > 24) { filled = true; break; }
					}
				}
				if (filled && runStart === -1) runStart = x;
				if (!filled && runStart !== -1) {
					if (x - runStart > bestLength) { bestStart = runStart; bestLength = x - runStart; }
					runStart = -1;
				}
			}

			// If the widest run starts at the very left, the text and the bar are touching and can't be told apart this way, so keep the default crop
			if (bestLength > 0 && bestStart / canvas.width > 0.05) {
				this.miscTrackCrop = { start: bestStart / canvas.width, end: (bestStart + bestLength) / canvas.width };
				this.applyMiscTrackCrop();
			}
		} catch (e) {
			console.warn('Could not detect the slider bar in the image, using the default crop.', e);
		}
	}

	/** Adds a "label  number  slider" row for a numeric setting. A step of 0 means no rounding. */
	addMiscSlider(setting: keyof StorageData['settings'], label: string, min: number, max: number, step: number, format: (value: number) => string) {
		let row = document.createElement('div');
		row.classList.add('misc-row');

		let name = document.createElement('span');
		name.classList.add('misc-row-label');
		name.textContent = label + ':';

		let value = document.createElement('span');
		value.classList.add('misc-row-value');

		let slider = document.createElement('div');
		slider.classList.add('misc-slider');
		let clip = document.createElement('div');
		clip.classList.add('misc-track-clip');
		let track = document.createElement('img');
		track.src = MISC_TRACK_SRC;
		track.addEventListener('load', () => this.applyMiscTrackCrop());
		clip.appendChild(track);
		this.miscTrackImages.push(track);
		let knob = document.createElement('img');
		knob.classList.add('misc-knob');
		knob.src = './assets/ui/options/aud_mus_knb.png';
		slider.append(clip, knob);

		row.append(name, value, slider);
		this.miscScroll.appendChild(row);

		const refresh = () => {
			let current = StorageManager.data.settings[setting] as number;
			let completion = Util.clamp((current - min) / (max - min), 0, 1);
			knob.style.left = Math.round(completion * (MISC_TRACK_WIDTH - MISC_KNOB_WIDTH)) + 'px';
			value.textContent = format(current);
		};
		// Same mouse math as the other sliders in this screen
		const setFromMouse = () => {
			let leftStart = slider.getBoundingClientRect().left * SCALING_RATIO;
			let completion = Util.clamp((currentMousePosition.x - leftStart - MISC_KNOB_WIDTH / 2) / (MISC_TRACK_WIDTH - MISC_KNOB_WIDTH), 0, 1);
			let result = Util.lerp(min, max, completion);
			if (step > 0) result = Number((Math.round(result / step) * step).toFixed(6));
			StorageManager.data.settings[setting] = result as never;
			refresh();
		};
		const start = () => {
			this.miscDragging = setFromMouse;
			setFromMouse();
		};
		slider.addEventListener('mousedown', start);
		slider.addEventListener('touchstart', start);

		this.miscUpdateFuncs.push(refresh);
	}

	/** Adds a "label  dropdown" row for a setting that stores the index of the chosen option. */
	/** @param choices The options to show and the value each one stores. @param selectedChoice Maps the stored value to the index of the choice to show as selected. */
	addMiscDropdown(setting: keyof StorageData['settings'], label: string, choices: { label: string, value: number }[], selectedChoice: (stored: number) => number, onChoose?: (value: number) => void) {
		let row = document.createElement('div');
		row.classList.add('misc-row');

		let name = document.createElement('span');
		name.classList.add('misc-row-label');
		name.textContent = label + ':';

		let spacer = document.createElement('span');
		spacer.classList.add('misc-row-value');

		let wrapper = document.createElement('div');
		wrapper.classList.add('misc-dropdown');

		let selectionLabel = document.createElement('div');
		selectionLabel.classList.add('misc-dropdown-label');

		let list = document.createElement('div');
		list.classList.add('misc-dropdown-list', 'hidden');
		list.style.backgroundImage = "url('./assets/ui/play/playgui.png')";

		const close = () => list.classList.add('hidden');

		// The button graphic is the same one the "camera down" key binding uses
		let button = document.createElement('img');
		this.menu.setupButton(button, 'options/cntr_cam_dwn', () => {
			if (list.classList.contains('hidden')) {
				list.classList.remove('hidden');
				list.scrollIntoView({ block: 'nearest' }); // The list can reach below the visible part of the scrolling area
			} else {
				close();
			}
		});

		choices.forEach(choice => {
			let item = document.createElement('div');
			item.textContent = choice.label;
			item.addEventListener('mousedown', () => {
				close();
				selectionLabel.textContent = choice.label;
				if (StorageManager.data.settings[setting] !== choice.value) {
					StorageManager.data.settings[setting] = choice.value as never;
					StorageManager.store();
				}
				onChoose?.(choice.value); // Runs even when the value was already stored, so a stale layout always gets fixed
			});
			list.appendChild(item);
		});

		// Clicking anywhere else closes the list
		const outside = (e: Event) => {
			if (!wrapper.contains(e.target as Node)) close();
		};
		window.addEventListener('mousedown', outside);
		window.addEventListener('touchstart', outside);

		wrapper.append(button, selectionLabel, list);
		row.append(name, spacer, wrapper);
		this.miscScroll.appendChild(row);

		this.miscUpdateFuncs.push(() => {
			close();
			selectionLabel.textContent = choices[selectedChoice(Number(StorageManager.data.settings[setting]))].label;
		});
	}

	/** Updates only the checkbox's look/lock state; does not touch stored settings. */
	setDisablePowerupEffectsVisual(checked: boolean, hovered = false) {
		if (checked) {
			this.disablePowerupEffects.setAttribute('data-locked', '');
			this.disablePowerupEffects.src = './assets/ui/options/graf_chkbx_d.png';
		} else {
			this.disablePowerupEffects.removeAttribute('data-locked');
			this.disablePowerupEffects.src = './assets/ui/options/graf_chkbx_' + (hovered ? 'h' : 'n') + '.png';
		}
	}

	show() {
		super.show();
		this.updateAllElements();
	}

	async init() {
		super.init();

		this.setupTab(this.tabGraphics, 'graphics');
		this.setupTab(this.tabAudio, 'audio');
		this.setupTab(this.tabControls, 'controls');
		this.setupTab(this.tabMisc, 'misc');
		// Default selection
		this.selectControlsTab('marble');
		this.selectTab('graphics');

		await ResourceManager.loadImages(['cntrl_marb_bse.png', 'cntrl_cam_bse.png', 'cntrl_mous_base.png'].map(x => './assets/ui/options/' + x));

		await this.updateAllElements();
	}

	async updateAllElements() {
		this.selectResolutionButton([this.resolution640, this.resolution800, this.resolution1024][StorageManager.data.settings.resolution], StorageManager.data.settings.resolution);
		this.selectVideoDriverButton([this.openGl, this.direct3D][StorageManager.data.settings.videoDriver], StorageManager.data.settings.videoDriver);
		this.selectScreenStyleButton([this.windowedButton, this.fullButton][StorageManager.data.settings.screenStyle], StorageManager.data.settings.videoDriver);
		this.selectColorDepthButton([this.depth16, this.depth32][StorageManager.data.settings.colorDepth], StorageManager.data.settings.colorDepth);

		this.musicVolumeKnob.style.left = Math.floor(this.musicVolumeKnobLeft + StorageManager.data.settings.musicVolume * this.trackLength) + 'px';
		this.soundVolumeKnob.style.left = Math.floor(this.soundVolumeKnobLeft + StorageManager.data.settings.soundVolume * this.trackLength) + 'px';
		this.mouseSensitivityKnob.style.left = Math.floor(this.mouseSensitivityKnobLeft + StorageManager.data.settings.mouseSensitivity * this.trackLength) + 'px';

		this.refreshKeybindings();

		// !! so saves from before this setting existed (undefined) count as unchecked
		this.setDisablePowerupEffectsVisual(!!StorageManager.data.settings.disablePowerupEffects);
		for (let refresh of this.miscUpdateFuncs) refresh();

		if (!!(StorageManager.data.settings.invertMouse & 0b10) !== this.invertY.hasAttribute('data-locked')) this.invertY.click();
		if (StorageManager.data.settings.alwaysFreeLook !== this.alwaysFreeLook.hasAttribute('data-locked')) this.alwaysFreeLook.click();
	}

	selectTab(which: 'graphics' | 'audio' | 'controls' | 'misc') {
		for (let elem of [this.tabGraphics, this.tabAudio, this.tabControls, this.tabMisc]) {
			elem.style.zIndex = "-1";
		}
		for (let elem of [this.graphicsDiv, this.audioDiv, this.controlsDiv, this.miscDiv]) {
			elem.classList.add('hidden');
		}

		let index = ['graphics', 'audio', 'controls', 'misc'].indexOf(which);

		let elem = [this.tabGraphics, this.tabAudio, this.tabControls, this.tabMisc][index];
		elem.style.zIndex = "0";
		[this.graphicsDiv, this.audioDiv, this.controlsDiv, this.miscDiv][index].classList.remove('hidden');
	}

	setupTab(element: HTMLImageElement, which: 'graphics' | 'audio' | 'controls' | 'misc') {
		element.addEventListener('mousedown', (e) => {
			if (e.button !== 0) return;
			mainAudioManager.play('buttonpress.wav');
		});
		element.addEventListener('click', (e) => e.button === 0 && this.selectTab(which));
	}

	selectResolutionButton(button: HTMLImageElement, index: number) {
		this.unlockResolutionButtons();
		button.src = button.src.slice(0, button.src.lastIndexOf('_')) + '_d.png';
		button.setAttribute('data-locked', '');
		StorageManager.data.settings.resolution = index;
		StorageManager.store();
	}

	unlockResolutionButtons() {
		// Deselect all resolution buttons
		this.resolution640.src = './assets/ui/options/graf640_n.png';
		this.resolution640.removeAttribute('data-locked');
		this.resolution800.src = './assets/ui/options/graf800_n.png';
		this.resolution800.removeAttribute('data-locked');
		this.resolution1024.src = './assets/ui/options/graf1024_n.png';
		this.resolution1024.removeAttribute('data-locked');
	}

	selectVideoDriverButton(button: HTMLImageElement, index: number) {
		this.unlockVideoDriverButtons();
		button.src = button.src.slice(0, button.src.lastIndexOf('_')) + '_d.png';
		button.setAttribute('data-locked', '');
		StorageManager.data.settings.videoDriver = index;
		StorageManager.store();
	}

	unlockVideoDriverButtons() {
		// Deselect all video driver buttons
		this.openGl.src = './assets/ui/options/grafopgl_n.png';
		this.openGl.removeAttribute('data-locked');
		this.direct3D.src = './assets/ui/options/grafdir3d_n.png';
		this.direct3D.removeAttribute('data-locked');
	}

	selectScreenStyleButton(button: HTMLImageElement, index: number) {
		this.unlockScreenStyleButtons();
		button.src = button.src.slice(0, button.src.lastIndexOf('_')) + '_d.png';
		button.setAttribute('data-locked', '');
		StorageManager.data.settings.screenStyle = index;
		StorageManager.store();
	}

	unlockScreenStyleButtons() {
		// Deselect all screen style buttons
		this.windowedButton.src = './assets/ui/options/grafwindo_n.png';
		this.windowedButton.removeAttribute('data-locked');
		this.fullButton.src = './assets/ui/options/grafful_n.png';
		this.fullButton.removeAttribute('data-locked');
	}

	selectColorDepthButton(button: HTMLImageElement, index: number) {
		this.unlockColorDepthButtons();
		button.src = button.src.slice(0, button.src.lastIndexOf('_')) + '_d.png';
		button.setAttribute('data-locked', '');
		StorageManager.data.settings.colorDepth = index;
		StorageManager.store();
	}

	unlockColorDepthButtons() {
		// Deselect all color depth buttons
		this.depth16.src = './assets/ui/options/graf16bt_n.png';
		this.depth16.removeAttribute('data-locked');
		this.depth32.src = './assets/ui/options/graf32bt_n.png';
		this.depth32.removeAttribute('data-locked');
	}

	async updateSliders() {
		requestAnimationFrame(() => this.updateSliders());
		if (this.div.classList.contains('hidden')) return;

		// Updates all sliders based on mouse position.

		if (this.draggingMusicVolume) {
			let leftStart = this.div.getBoundingClientRect().left * SCALING_RATIO + this.musicVolumeKnobLeft;
			let completion = Util.clamp(((currentMousePosition.x - 12) - leftStart) / this.trackLength, 0, 1);

			this.musicVolumeKnob.style.left = Math.floor(this.musicVolumeKnobLeft + completion * this.trackLength) + 'px';
			StorageManager.data.settings.musicVolume = completion;
			mainAudioManager.updateVolumes();
		}

		if (this.draggingSoundVolume) {
			let leftStart = this.div.getBoundingClientRect().left * SCALING_RATIO + this.soundVolumeKnobLeft;
			let completion = Util.clamp(((currentMousePosition.x - 12) - leftStart) / this.trackLength, 0, 1);

			this.soundVolumeKnob.style.left = Math.floor(this.soundVolumeKnobLeft + completion * this.trackLength) + 'px';
			StorageManager.data.settings.soundVolume = completion;
			mainAudioManager.updateVolumes();

			if (!this.soundTestingSound) {
				this.soundTestingSound = mainAudioManager.createAudioSource('testing.wav');
				this.soundTestingSound.setLoop(true);
				this.soundTestingSound.play();
			}
		}

		if (this.draggingMouseSensitivity) {
			let leftStart = this.div.getBoundingClientRect().left * SCALING_RATIO + this.mouseSensitivityKnobLeft;
			let completion = Util.clamp(((currentMousePosition.x - 12) - leftStart) / this.trackLength, 0, 1);

			this.mouseSensitivityKnob.style.left = Math.floor(this.mouseSensitivityKnobLeft + completion * this.trackLength) + 'px';
			StorageManager.data.settings.mouseSensitivity = completion;
		}

		if (this.miscDragging) this.miscDragging();
	}

	selectControlsTab(which: 'marble' | 'camera' | 'mouse') {
		for (let elem of [this.marbleControlsDiv, this.cameraControlsDiv, this.mouseControlsDiv]) {
			elem.classList.add('hidden');
		}

		let index = ['marble', 'camera', 'mouse'].indexOf(which);
		let elem = [this.marbleControlsDiv, this.cameraControlsDiv, this.mouseControlsDiv][index];
		elem.classList.remove('hidden');

		this.controlsBackground.src = './assets/ui/options/' + ['cntrl_marb_bse.png', 'cntrl_cam_bse.png', 'cntrl_mous_base.png'][index];

		if (which === 'mouse') {
			// The mouse background is sized differently and requires its own transform
			this.controlsBackground.style.left = '2px';
			this.controlsBackground.style.top = '-1px';
		} else {
			this.controlsBackground.style.left = '';
			this.controlsBackground.style.top = '';
		}
	}

	refreshKeybindings() {
		this.buttonMarbleLeftContent.textContent = this.formatKeybinding('left');
		this.buttonMarbleRightContent.textContent = this.formatKeybinding('right');
		this.buttonMarbleUpContent.textContent = this.formatKeybinding('up');
		this.buttonMarbleDownContent.textContent = this.formatKeybinding('down');
		this.buttonMarbleUseContent.textContent = this.formatKeybinding('use');
		this.buttonMarbleJumpContent.textContent = this.formatKeybinding('jump');
		this.buttonCameraLeftContent.textContent = this.formatKeybinding('cameraLeft');
		this.buttonCameraRightContent.textContent = this.formatKeybinding('cameraRight');
		this.buttonCameraUpContent.textContent = this.formatKeybinding('cameraUp');
		this.buttonCameraDownContent.textContent = this.formatKeybinding('cameraDown');
		this.freeLookKeyContent.textContent = this.formatKeybinding('freeLook');
		this.buttonRestartLevelContent.textContent = this.formatKeybinding('restart');
	}
}