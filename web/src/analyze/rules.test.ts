import { describe, expect, it } from 'vitest';
import { isCategory } from './categories';
import { categorizeByRules, isRecurringCharge, looksLikeFee, ruleTargets } from './rules';

describe('categorizeByRules', () => {
  it('only targets categories from categories.json', () => {
    for (const category of ruleTargets()) {
      expect(isCategory(category)).toBe(true);
    }
  });

  it.each([
    ['שופרסל דיל', 'groceries'],
    ['רמי לוי שיווק', 'groceries'],
    ["מקדונלד'ס", 'dining'],
    ['WOLT', 'dining'],
    ['GETT', 'transport'],
    ['פז יילו', 'fuel'],
    ['חברת חשמל', 'utilities'],
    ['HOT MOBILE', 'utilities'],
    ['NETFLIX.COM', 'subscriptions'],
    ['AMAZON.COM', 'shopping'],
    ['IKEA', 'shopping'],
    ['סופר-פארם', 'health'],
    ['סינמה סיטי', 'entertainment'],
    ['אל על', 'travel'],
    ['Grand Hotel', 'travel'],
    ['UDEMY', 'education'],
    ['הראל ביטוח', 'insurance'],
    ['עמלת כרטיס', 'fees'],
    ['ביט העברה', 'transfers'],
    ['העברה דנה לוי', 'transfers'],
    ['UNKNOWN KIOSK', 'other'],
  ])('maps %s to %s', (merchant, category) => {
    expect(categorizeByRules(merchant)).toBe(category);
  });

  it('prefers the longer hotel phrase over the hot token', () => {
    expect(categorizeByRules('Grand Hotel')).toBe('travel');
    expect(categorizeByRules('HOT')).toBe('utilities');
  });
});

describe('isRecurringCharge', () => {
  it('marks subscriptions and installment plans', () => {
    expect(isRecurringCharge('subscriptions', null)).toBe(true);
    expect(isRecurringCharge('shopping', { total: 12 })).toBe(true);
    expect(isRecurringCharge('shopping', null)).toBe(false);
  });
});

describe('looksLikeFee', () => {
  it('matches fee wording and not ordinary merchants', () => {
    expect(looksLikeFee('עמלת כרטיס')).toBe(true);
    expect(looksLikeFee('Late fee')).toBe(true);
    expect(looksLikeFee('שופרסל דיל')).toBe(false);
  });
});
