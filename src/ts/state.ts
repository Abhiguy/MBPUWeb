import { Level } from "./level";
import { Menu } from "./ui/menu";

export const state = {
	modification: null as 'gold' | 'platinum',
	level: null as Level,
	menu: null as Menu,
	selectedMarble: 'default' as string,
	selectedChallenge: 'timechallenge' as string
};