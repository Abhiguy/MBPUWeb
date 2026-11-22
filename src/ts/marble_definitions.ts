export interface MarbleDefinition {
	id: string;
	name: string;
	texturePath: string;
	dtsPath: string;
}

export const MARBLE_DEFINITIONS: { [key: string]: MarbleDefinition } = {
	'default': {
		id: 'default',
		name: 'Original MBG',
		texturePath: './assets/data/shapes/balls/base.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'cosmicvomit': {
		id: 'cosmicvomit',
		name: 'Cosmic Vomit',
		texturePath: './assets/data/shapes/balls/blah.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'wooden': {
		id: 'wooden',
		name: 'Wooden Marble',
		texturePath: './assets/data/shapes/balls/wood.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'bocce': {
		id: 'bocce',
		name: 'Bocce Ball',
		texturePath: './assets/data/shapes/balls/bocce.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'sandy': {
		id: 'sandy',
		name: 'Sandy Stripes',
		texturePath: './assets/data/shapes/balls/sand.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'blackpearl': {
		id: 'blackpearl',
		name: 'Black Pearl',
		texturePath: './assets/data/shapes/balls/black.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'fakedoubler': {
		id: 'fakedoubler',
		name: 'Fake Doubler',
		texturePath: './assets/data/shapes/balls/doubler.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'minibeach': {
		id: 'minibeach',
		name: 'Mini Beach Ball',
		texturePath: './assets/data/shapes/balls/beachball.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'd20': {
		id: 'd20',
		name: 'The D20',
		texturePath: './assets/data/shapes/balls/d20.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'titlescreen': {
		id: 'titlescreen',
		name: 'Title Screen',
		texturePath: './assets/data/shapes/balls/title.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'platinum': {
		id: 'platinum',
		name: 'Platinum Marble',
		texturePath: './assets/data/shapes/balls/platinum.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'ultrablue': {
		id: 'ultrablue',
		name: 'Ultra Blue',
		texturePath: './assets/data/shapes/balls/ultrablue.marble.png',
		dtsPath: 'shapes/balls/ball-mbo.dts'
	},
	'ultrared': {
		id: 'ultrared',
		name: 'Ultra Red',
		texturePath: './assets/data/shapes/balls/ultrared.marble.png',
		dtsPath: 'shapes/balls/ball-mbo.dts'
	},
	'ultragreen': {
		id: 'ultragreen',
		name: 'Ultra Green',
		texturePath: './assets/data/shapes/balls/ultragreen.marble.png',
		dtsPath: 'shapes/balls/ball-mbo.dts'
	},
	'ultragold': {
		id: 'ultragold',
		name: 'Ultra Gold',
		texturePath: './assets/data/shapes/balls/ultragold.marble.png',
		dtsPath: 'shapes/balls/ball-mbo.dts'
	},
	'madness': {
		id: 'madness',
		name: 'Madness',
		texturePath: './assets/data/shapes/balls/blue.png',
		dtsPath: 'shapes/balls/ball-madness.dts'
	},
	'madness2': {
		id: 'madness2',
		name: 'Madness 2',
		texturePath: './assets/data/shapes/balls/dkred_.png',
		dtsPath: 'shapes/balls/ball-madness2.dts'
	},
	'honeydew': {
		id: 'honeydew',
		name: 'Honeydew',
		texturePath: './assets/data/shapes/balls/honeydew.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'nyancat': {
		id: 'nyancat',
		name: 'Nyan Cat',
		texturePath: './assets/data/shapes/balls/nyan.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'solarsystem': {
		id: 'solarsystem',
		name: 'Solar System',
		texturePath: './assets/data/shapes/balls/yellow.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'marble3': {
		id: 'marble3',
		name: 'Marble^3',
		texturePath: './assets/data/shapes/balls/marble-noalpha.png',
		dtsPath: 'shapes/balls/cube.dts'
	},
	'goldenmarble': {
		id: 'goldenmarble',
		name: 'Golden Marble',
		texturePath: './assets/data/shapes/balls/gold.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'dealwithit': {
		id: 'dealwithit',
		name: 'Deal With It',
		texturePath: './assets/data/shapes/balls/base.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	},
	'demonslayer': {
		id: 'demonslayer',
		name: 'Demon Slayer',
		texturePath: './assets/data/shapes/balls/billboard_marble.png',
		dtsPath: 'shapes/balls/ball-doom.dts'
	},
	'septiceye': {
		id: 'septiceye',
		name: 'Septic Eye',
		texturePath: './assets/data/shapes/balls/septic.marble.png',
		dtsPath: 'shapes/balls/ball-superball.dts'
	}
};

export function getMarbleDefinition(marbleId: string): MarbleDefinition {
	return MARBLE_DEFINITIONS[marbleId] || MARBLE_DEFINITIONS['default'];
}

export function getAllMarbleDefinitions(): MarbleDefinition[] {
	return Object.values(MARBLE_DEFINITIONS);
}

export function getAvailableMarbles(): string[] {
	return Object.keys(MARBLE_DEFINITIONS);
}