#!/usr/bin/env node
// Replaces the Rocket.Chat brand name inside a fixed set of end-user-visible
// i18n keys, across every locale. Re-run after rebasing on upstream.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BRAND = 'TechnoTribes';
const KEYS = [
	'Powered_by_RocketChat',
	'registration.page.poweredBy',
	'registration.component.welcome',
	'registration.page.guest.loginWithRocketChat',
	'Rocket_Chat_Alert',
	'Take_rocket_chat_with_you_with_mobile_applications',
	'Install_rocket_chat_on_your_preferred_desktop_platform',
	'Learn_how_to_unlock_the_myriad_possibilities_of_rocket_chat',
	'Thank_You_For_Choosing_RocketChat',
	'Update_your_RocketChat',
	'Your_web_browser_blocked_Rocket_Chat_from_opening_tab',
	'Email_Change_Disabled',
	'Password_Change_Disabled',
	'RealName_Change_Disabled',
	'Username_Change_Disabled',
	'StatusMessage_Change_Disabled',
	'Email_Notifications_Change_Disabled',
	'Device_Changes_Not_Available',
	'onboarding.form.adminInfoForm.fields.keepPosted.label',
	'onboarding.page.emailConfirmed.subtitle',
	'Visit_Site_Url_and_try_the_best_open_source_chat_solution_available_today',
	'Install_FxOs',
	'Install_FxOs_done',
];
const PATTERN = /Rocket\.?\s?Chat/g;

const localesDir = join(dirname(fileURLToPath(import.meta.url)), '../../packages/i18n/src/locales');
let touched = 0;

for (const file of readdirSync(localesDir).filter((f) => f.endsWith('.i18n.json'))) {
	const path = join(localesDir, file);
	const raw = readFileSync(path, 'utf8');
	const json = JSON.parse(raw);
	let changed = false;
	for (const key of KEYS) {
		if (typeof json[key] === 'string' && PATTERN.test(json[key])) {
			json[key] = json[key].replace(PATTERN, BRAND);
			changed = true;
		}
		PATTERN.lastIndex = 0;
	}
	if (changed) {
		writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
		touched++;
	}
}
console.log(`rebrand-i18n: updated ${touched} locale files`);
