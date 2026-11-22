const INTERIOR_DEFAULT_FRICTION = 1;
const INTERIOR_DEFAULT_RESTITUTION = 1;

export const enum BanType {
	NONE        = 0,
	FRICTION    = 1 << 0,
	RESTITUTION = 1 << 1,
	FORCE       = 1 << 2,
}

/** Speed (u/s) imparted along the collision normal when FORCE is active. */
export const BANNED_FORCE_MAGNITUDE       = 10000;

/** Restitution factor applied to the marble when RESTITUTION is active.
 *  The engine multiplies INTERIOR_DEFAULT_RESTITUTION by this value. */
export const BANNED_RESTITUTION_FACTOR    = 100;

/** Friction factor when FRICTION is active.  Negative → strong sideways drag
 *  that yanks the marble perpendicular to its travel direction. */
export const BANNED_FRICTION_FACTOR       = -10_000;

/** Textures that are currently banned.  Populated by the ban* functions. */
export const bannedTextures = new Set<string>();

/** The active ban type (bit-field of BanType flags). */
let activeBanType: number = BanType.FORCE | BanType.RESTITUTION;

/**
 * Override the active ban type at runtime (mirrors setBanType in challenges.cs).
 * @param type  Bit-field composed of BanType flags.
 */
export function setBanType(type: number): void {
	activeBanType = type;
}

/** Returns the currently active ban-type bit-field. */
export function getBanType(): number { return activeBanType; }


interface BannedProperties {
	friction:    number;
	restitution: number;
	force:       number | undefined;
	isRandom:    false;
}

/**
 * Returns physics properties for `material` if it is currently banned,
 * or `null` if it is not.
 */
export function getBannedProperties(material: string): BannedProperties | null {
	if (!bannedTextures.has(material)) return null;

	const useFriction    = (activeBanType & BanType.FRICTION)    !== 0;
	const useRestitution = (activeBanType & BanType.RESTITUTION) !== 0;
	const useForce       = (activeBanType & BanType.FORCE)       !== 0;

	return {
		friction:    useFriction    ? INTERIOR_DEFAULT_FRICTION    * BANNED_FRICTION_FACTOR    : INTERIOR_DEFAULT_FRICTION,
		restitution: useRestitution ? INTERIOR_DEFAULT_RESTITUTION * BANNED_RESTITUTION_FACTOR : INTERIOR_DEFAULT_RESTITUTION,
		force:       useForce       ? BANNED_FORCE_MAGNITUDE : undefined,
		isRandom:    false
	};
}

/** Adds textures to the banned set. */
function ban(textures: readonly string[]): void {
	for (const tex of textures) bannedTextures.add(tex);
}

/** Removes textures from the banned set. */
function unban(textures: readonly string[]): void {
	for (const tex of textures) bannedTextures.delete(tex);
}
// Ban the texture groups
const RED_TEXTURES = [
	'arrow_warm1', 'chevron_warm2', 'custom_red_brick',
	'edge_warm2',  'grid_warm1',    'grid_warm2',
	'solid_warm2', 'stripe_warm',   'trim_warm2', 'wall_warm2'
] as const;

const ORANGE_TEXTURES = [
	'edge_warm1',   'grid_warm4',  'pattern_warm2',
	'solid_warm1',  'stripe_warm2', 'trim_warm1', 'wall_warm1'
] as const;

const YELLOW_TEXTURES = [
	'chevron_warm',      'edge_neutral2',      'friction_ramp_yellow',
	'grid_warm',         'pattern_warm1',       'pattern_warm3',
	'pattern_warm4',     'solid_neutral2',      'trim_neutral2', 'wall_neutral2'
] as const;

const GREEN_TEXTURES = [
	'arrow_cool1',    'chevron_cool2',  'chevron_neutral',
	'edge_neutral1',  'friction_high',  'grid_neutral',
	'ground',         'pattern_neutral1', 'solid_neutral1',
	'stripe_neutral', 'trim_neutral1',  'wall_neutral1'
] as const;

const CYAN_TEXTURES = [
	'grid_cool4', 'grid_neutral1', 'stripe_cool2'
] as const;

const BLUE_TEXTURES = [
	'arrow_neutral1', 'chevron_cool', 'edge_cool1',
	'grid_cool',      'grid_cool2',   'grid_cool3',
	'pattern_cool1',  'solid_cool1',  'stripe_cool',
	'trim_cool1',     'wall_cool1',   'blue_grid2'
] as const;

const PURPLE_TEXTURES = [
	'arrow_neutral2',  'chevron_neutral2', 'edge_cool2',
	'grid_neutral2',   'grid_neutral4',    'pattern_neutral3',
	'solid_cool2',     'stripe_neutral2',  'trim_cool2',
	'trim_cool3',      'wall_cool2'
] as const;

const PINK_TEXTURES = [
	'grid_warm3', 'wall_warm3'
] as const;

const BROWN_TEXTURES = [
	'custom_dirt',         'custom_logend',      'custom_logside',
	'custom_woodblockside','custom_woodblocktop', 'custom_woodbox',
	'friction_low',        'wall_neutral3'
] as const;

const WHITE_TEXTURES = [
	'edge_white',  'edge_white2', 'solid_white',
	'trim_white1', 'trim_white2', 'wall_white'
] as const;

const GRAY_TEXTURES = [
	'custom_crate',    'custom_insd_track', 'custom_lft_track',
	'custom_mid_track','custom_parking',    'custom_road',
	'grid_neutral3',   'pattern_cool2',     'pattern_neutral2'
] as const;

const BLACK_TEXTURES = [
	'friction_none'
] as const;

const TUBE_TEXTURES = [
	'blue_grid', 'tube_cool', 'tube_neutral', 'tube_warm'
] as const;

/** Every texture that can ever be banned, mapped back to DefaultMaterial on reset. */
const ALL_TEXTURES: readonly string[] = [
	...RED_TEXTURES,    ...ORANGE_TEXTURES, ...YELLOW_TEXTURES,
	...GREEN_TEXTURES,  ...CYAN_TEXTURES,   ...BLUE_TEXTURES,
	...PURPLE_TEXTURES, ...PINK_TEXTURES,   ...BROWN_TEXTURES,
	...WHITE_TEXTURES,  ...GRAY_TEXTURES,   ...BLACK_TEXTURES,
	...TUBE_TEXTURES
];

/** Clears all active bans and restores default material behaviour. */
export function resetBan(): void {
	unban(ALL_TEXTURES);
	activeBanType = BanType.FORCE | BanType.RESTITUTION; // Reset to default so stale type from a previous level can't leak in
}

export function banRed():    void { ban(RED_TEXTURES);    }
export function banOrange(): void { ban(ORANGE_TEXTURES); }
export function banYellow(): void { ban(YELLOW_TEXTURES); }
export function banGreen():  void { ban(GREEN_TEXTURES);  }
export function banCyan():   void { ban(CYAN_TEXTURES);   }
export function banBlue():   void { ban(BLUE_TEXTURES);   }
export function banPurple(): void { ban(PURPLE_TEXTURES); }
export function banPink():   void { ban(PINK_TEXTURES);   }
export function banBrown():  void { ban(BROWN_TEXTURES);  }
export function banWhite():  void { ban(WHITE_TEXTURES);  }
export function banGray():   void { ban(GRAY_TEXTURES);   }
export function banBlack():  void { ban(BLACK_TEXTURES);  }
export function banTubes():  void { ban(TUBE_TEXTURES);   }

export function unbanRed():    void { unban(RED_TEXTURES);    }
export function unbanOrange(): void { unban(ORANGE_TEXTURES); }
export function unbanYellow(): void { unban(YELLOW_TEXTURES); }
export function unbanGreen():  void { unban(GREEN_TEXTURES);  }
export function unbanCyan():   void { unban(CYAN_TEXTURES);   }
export function unbanBlue():   void { unban(BLUE_TEXTURES);   }
export function unbanPurple(): void { unban(PURPLE_TEXTURES); }
export function unbanPink():   void { unban(PINK_TEXTURES);   }
export function unbanBrown():  void { unban(BROWN_TEXTURES);  }
export function unbanWhite():  void { unban(WHITE_TEXTURES);  }
export function unbanGray():   void { unban(GRAY_TEXTURES);   }
export function unbanBlack():  void { unban(BLACK_TEXTURES);  }
export function unbanTubes():  void { unban(TUBE_TEXTURES);   }

/**
 * Convenience: ban every colour group at once with a given ban type.
 * @param type  BanType bit-field (defaults to FORCE | RESTITUTION).
 */
export function banAll(type: number = BanType.FORCE | BanType.RESTITUTION): void {
	setBanType(type);
	ban(ALL_TEXTURES);
}