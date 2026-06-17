// @ts-expect-error - safe-regex has no types
import isSafe from 'safe-regex';
import validator from 'validator';

export function checkRegexSafety(re: RegExp | string): boolean {
  try {
    const target = typeof re === 'string' ? new RegExp(re) : re;
    return isSafe(target);
  } catch (err) {
    return false;
  }
}

// Audited standard validators replacing unsafe custom regexes
export const StandardValidators = {
  isEmail: (val: string) => validator.isEmail(val),
  isMobilePhone: (val: string) => validator.isMobilePhone(val, 'any', { strictMode: false }),
  isURL: (val: string) => {
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  },
  isAlphaNumeric: (val: string) => validator.isAlphanumeric(val),
};
