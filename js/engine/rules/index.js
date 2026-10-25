import { compileRule } from '../patterns.js';
import credentials from './credentials.js';
import familyEmergency from './family-emergency.js';
import impersonation from './impersonation.js';
import investmentRomance from './investment-romance.js';
import job from './job.js';
import payment from './payment.js';
import prize from './prize.js';
import secrecy from './secrecy.js';
import urgency from './urgency.js';

export const RULE_DEFINITIONS = [
  ...urgency,
  ...payment,
  ...impersonation,
  ...credentials,
  ...prize,
  ...familyEmergency,
  ...secrecy,
  ...investmentRomance,
  ...job,
];

export const RULES = RULE_DEFINITIONS.map(compileRule);

export const CATEGORIES = [
  'urgency', 'payment', 'impersonation', 'credentials', 'prize',
  'family-emergency', 'secrecy', 'investment-romance', 'job', 'links',
];

// Flagged by normalize() rather than a pattern, but explained like any rule.
export const HOMOGLYPH_RULE = {
  id: 'impersonation.homoglyph',
  category: 'impersonation',
  severity: 'high',
  weight: 30,
};
