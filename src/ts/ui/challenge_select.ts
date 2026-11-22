import { state } from "../state";
import { StorageManager } from "../storage";
import { mainAudioManager } from "../audio";
import { MissionLibrary } from "../mission_library";
import { Mission } from "../mission";
import { Util } from "../util";

export class ChallengeSelectUI {
	/** The live Mission objects pulled from MissionLibrary.goldChallenge, filtered by parent level */
	missions: Mission[] = [];
	currentIndex = 0;
	/** The mission currently selected in level select — used to filter challenges */
	currentLevelMission: Mission = null;

	// Buttons and modal elements
	tabChallengeBtn: HTMLImageElement;
	modal: HTMLElement;
	prevBtn: HTMLImageElement;
	playBtn: HTMLImageElement;
	nextBtn: HTMLImageElement;
	backBtn: HTMLImageElement;

	// Text window elements for metadata display
	textWindow: HTMLElement;
	textWindowScrollable: HTMLElement;
	titleDisplay: HTMLElement;
	difficultyDisplay: HTMLElement;
	authorDisplay: HTMLElement;
	descDisplay: HTMLElement;
	bestTimeHeading: HTMLElement;
	bestTimeDisplay: HTMLElement;

	async init() {
		this.missions = [];

		// Restore last-selected challenge by path
		let savedPath: string = null;
		try {
			let result = await StorageManager.databaseGet('keyvalue', 'selectedChallenge');
			if (result) savedPath = result as string;
		} catch (e) {}

		if (savedPath) {
			let idx = this.missions.findIndex(m => m.path === savedPath);
			this.currentIndex = idx >= 0 ? idx : 0;
		} else {
			this.currentIndex = 0;
		}

		this.tabChallengeBtn = document.getElementById("tab-challenge") as HTMLImageElement;
		this.modal = document.getElementById("challenge-modal");
		this.prevBtn = document.getElementById("challenge-prev-btn") as HTMLImageElement;
		this.playBtn = document.getElementById("challenge-play-btn") as HTMLImageElement;
		this.nextBtn = document.getElementById("challenge-next-btn") as HTMLImageElement;
		this.backBtn = document.getElementById("challenge-back-btn") as HTMLImageElement;

		this.textWindow = document.getElementById("challenge-text-window");
		this.textWindowScrollable = document.getElementById("challenge-text-window-scrollable");
		this.titleDisplay = document.getElementById("challenge-title");
		this.difficultyDisplay = document.getElementById("challenge-difficulty");
		this.authorDisplay = document.getElementById("challenge-author");
		this.descDisplay = document.getElementById("challenge-description");
		if (this.descDisplay) this.descDisplay.style.whiteSpace = "pre-line";
		this.bestTimeHeading = document.getElementById("challenge-best-time-heading");
		this.bestTimeDisplay = document.getElementById("challenge-best-time");

		this.attachEventListeners();
		this.updateDisplay();
	}

	attachEventListeners() {
		if (this.tabChallengeBtn) {
			this.tabChallengeBtn.addEventListener("click", () => {
				const selectedMission = state.menu.levelSelect?.currentMission ?? null;
				this.openModal(selectedMission);
			});
		}
		if (this.backBtn) {
			this.backBtn.addEventListener("click", () => this.closeModal());
		}
		if (this.playBtn) {
			this.playBtn.addEventListener("click", () => this.playChallenge());
		}
		if (this.modal) {
			this.modal.addEventListener("click", (e) => {
				if (e.target === this.modal) this.closeModal();
			});
		}
		if (this.prevBtn) this.prevBtn.addEventListener("click", () => this.previousChallenge());
		if (this.nextBtn) this.nextBtn.addEventListener("click", () => this.nextChallenge());

		for (let btn of [this.prevBtn, this.playBtn, this.nextBtn, this.backBtn]) {
			if (btn) btn.addEventListener("mouseenter", () => mainAudioManager.play('buttonover.wav'));
		}

		document.addEventListener("keydown", (e) => {
			if (this.modal && !this.modal.classList.contains("hidden")) {
				if (e.key === "ArrowLeft") this.previousChallenge();
				if (e.key === "ArrowRight") this.nextChallenge();
				if (e.key === "Escape") this.closeModal();
				if (e.key === "Enter") this.playChallenge();
			}
		});
	}

	openModal(levelMission: Mission) {
		if (this.modal) {
			this.currentLevelMission = levelMission;
			// Filter goldChallenge to only those whose parentMission matches the selected level's filename
			if (levelMission) {
				// Get just the filename part of the level path
				let levelPath = levelMission.path.toLowerCase();
				// Extract filename without directory prefix for matching
				const pathParts = levelPath.split('/');
				const levelFilename = pathParts[pathParts.length - 1];
				const levelType = levelMission.type; // e.g. "beginner"
				this.missions = MissionLibrary.goldChallenge.filter(m => {
					if (!m.parentMission) return false;
					const p = m.parentMission.toLowerCase();
					return p === levelPath || p === levelFilename || p === levelType + '/' + levelFilename;
				});
			} else {
				this.missions = [];
			}
			this.currentIndex = 0;
			mainAudioManager.play('buttonpress.wav');
			this.modal.classList.remove("hidden");
			this.updateDisplay();
		}
	}

	closeModal() {
		if (this.modal) {
			mainAudioManager.play('buttonpress.wav');
			this.modal.classList.add("hidden");
		}
	}

	previousChallenge() {
		if (this.missions.length === 0) return;
		mainAudioManager.play('buttonpress.wav');
		this.currentIndex = (this.currentIndex - 1 + this.missions.length) % this.missions.length;
		this.updateDisplay();
	}

	nextChallenge() {
		if (this.missions.length === 0) return;
		mainAudioManager.play('buttonpress.wav');
		this.currentIndex = (this.currentIndex + 1) % this.missions.length;
		this.updateDisplay();
	}

	playChallenge() {
		if (this.missions.length === 0) return;
		mainAudioManager.play('buttonpress.wav');
		let mission = this.missions[this.currentIndex];
		if (mission) {
			this.modal.classList.add("hidden");
			state.menu.levelSelect.hide();
			state.menu.loadingScreen.loadLevel(mission);
		}
	}

	private difficultyToStars(raw: string): string {
		let n = parseInt(raw, 10);
		if (isNaN(n) || n < 1) n = 1;
		if (n > 5) n = 5;
		return '★'.repeat(n);
	}

	updateDisplay() {
		if (this.missions.length === 0) {
			if (this.titleDisplay) this.titleDisplay.textContent = "No Challenges";
			if (this.difficultyDisplay) this.difficultyDisplay.textContent = "";
			if (this.authorDisplay) this.authorDisplay.innerHTML = "";
			if (this.descDisplay) this.descDisplay.textContent = "There are no challenges for the current level.";
			if (this.bestTimeHeading) this.bestTimeHeading.innerHTML = "";
			if (this.bestTimeDisplay) this.bestTimeDisplay.textContent = "";
			// Grey out prev/next/play — no challenges to navigate or play
			if (this.prevBtn) { this.prevBtn.src = "./assets/ui/play/prev_i.png"; this.prevBtn.style.pointerEvents = "none"; }
			if (this.nextBtn) { this.nextBtn.src = "./assets/ui/play/next_i.png"; this.nextBtn.style.pointerEvents = "none"; }
			if (this.playBtn) { this.playBtn.src = "./assets/ui/play/play_i.png"; this.playBtn.style.pointerEvents = "none"; }
			return;
		}
		if (this.playBtn) { this.playBtn.src = "./assets/ui/play/play_n.png"; this.playBtn.style.pointerEvents = ""; }
		let canNavigate = this.missions.length >= 2;
		if (this.prevBtn) { this.prevBtn.src = canNavigate ? "./assets/ui/play/prev_n.png" : "./assets/ui/play/prev_i.png"; this.prevBtn.style.pointerEvents = canNavigate ? "" : "none"; }
		if (this.nextBtn) { this.nextBtn.src = canNavigate ? "./assets/ui/play/next_n.png" : "./assets/ui/play/next_i.png"; this.nextBtn.style.pointerEvents = canNavigate ? "" : "none"; }

		let mission = this.missions[this.currentIndex];
		if (!mission) return;
		if (this.titleDisplay) this.titleDisplay.textContent = mission.title;

		// Difficulty — read missionInfo.difficulty, convert to stars
		let rawDifficulty = (mission.missionInfo as any)?.difficulty ?? "1";
		if (this.difficultyDisplay) this.difficultyDisplay.textContent = `Difficulty: ${this.difficultyToStars(rawDifficulty)}`;

		// Description
		if (this.descDisplay) this.descDisplay.textContent = (mission.description || "").replace(/\\n/g, "\n");

		// Author
		if (this.authorDisplay) {
			this.authorDisplay.innerHTML = `<span class="author-label">Author: </span><span class="author-name">${mission.artist || "Unknown"}</span>`;
		}

		// Best time
		const PLACEHOLDER = "Nardo Polo, 99:59.999";
		try {
			let bestTimes = StorageManager.getBestTimesForMission(mission.path, 1, "Nardo Polo");
			if (bestTimes && bestTimes.length > 0) {
				let bestTime = bestTimes[0];
				let isPlaceholder = bestTime[0] === "Nardo Polo" && bestTime[1] >= 5999999;
				if (isPlaceholder) {
					this.setBestTime(PLACEHOLDER);
				} else {
					this.setBestTime(bestTime[0] + ", " + Util.secondsToTimeString(bestTime[1] / 1000));
				}
			} else {
				this.setBestTime(PLACEHOLDER);
			}
		} catch (e) {
			this.setBestTime(PLACEHOLDER);
		}

		// Persist by path so it survives reloads
		this.persistSelection(mission.path);
	}

	setBestTime(text: string) {
		if (this.bestTimeHeading) {
			this.bestTimeHeading.innerHTML = `Best Time: &nbsp;<span style="font-size:18px; font-weight:bold; font-family:Arial, sans-serif;">${text}</span>`;
		}
		if (this.bestTimeDisplay) this.bestTimeDisplay.textContent = '';
	}

	async persistSelection(path: string) {
		try {
			await StorageManager.databasePut("keyvalue", path, "selectedChallenge");
		} catch (e) {
			console.error("Failed to save challenge selection:", e);
		}
	}
}