import { isCategory } from './categories';
import { normalizeForMatch } from '../text/normalize';

interface KeywordRule {
  keyword: string;
  category: string;
}

/**
 * Longer phrases are checked first. Keywords of 3 characters or fewer match a whole token
 * so short names like "פז" or "hot" do not fire inside unrelated words.
 */
const RULES: readonly KeywordRule[] = [
  ['סופר פארם', 'health'],
  ['super pharm', 'health'],
  ['חברת חשמל', 'utilities'],
  ['רמי לוי', 'groceries'],
  ['שופרסל', 'groceries'],
  ['shufersal', 'groceries'],
  ['יוחננוף', 'groceries'],
  ['ויקטורי', 'groceries'],
  ['טיב טעם', 'groceries'],
  ['אושר עד', 'groceries'],
  ['קרפור', 'groceries'],
  ['carrefour', 'groceries'],
  ['supermarket', 'groceries'],
  ['grocery', 'groceries'],
  ['מקדונלד', 'dining'],
  ['mcdonald', 'dining'],
  ['מסעדה', 'dining'],
  ['restaurant', 'dining'],
  ['ארומה', 'dining'],
  ['וולט', 'dining'],
  ['wolt', 'dining'],
  ['קפה', 'dining'],
  ['cafe', 'dining'],
  ['coffee', 'dining'],
  ['פיצה', 'dining'],
  ['pizza', 'dining'],
  ['בורגר', 'dining'],
  ['burger', 'dining'],
  ['רכבת ישראל', 'transport'],
  ['יאנגו', 'transport'],
  ['yango', 'transport'],
  ['מונית', 'transport'],
  ['פנגו', 'transport'],
  ['pango', 'transport'],
  ['gett', 'transport'],
  ['uber', 'transport'],
  ['bolt', 'transport'],
  ['taxi', 'transport'],
  ['דור אלון', 'fuel'],
  ['סונול', 'fuel'],
  ['sonol', 'fuel'],
  ['דלק', 'fuel'],
  ['delek', 'fuel'],
  ['shell', 'fuel'],
  ['yellow', 'fuel'],
  ['יילו', 'fuel'],
  ['פלאפון', 'utilities'],
  ['pelephone', 'utilities'],
  ['סלקום', 'utilities'],
  ['cellcom', 'utilities'],
  ['פרטנר', 'utilities'],
  ['partner', 'utilities'],
  ['בזק', 'utilities'],
  ['bezeq', 'utilities'],
  ['ארנונה', 'utilities'],
  ['חשמל', 'utilities'],
  ['הוט', 'utilities'],
  ['hot', 'utilities'],
  ['netflix', 'subscriptions'],
  ['spotify', 'subscriptions'],
  ['disney', 'subscriptions'],
  ['icloud', 'subscriptions'],
  ['openai', 'subscriptions'],
  ['chatgpt', 'subscriptions'],
  ['איקאה', 'shopping'],
  ['ikea', 'shopping'],
  ['אמזון', 'shopping'],
  ['whole foods', 'groceries'],
  ['trader joe', 'groceries'],
  ['starbucks', 'dining'],
  ['chipotle', 'dining'],
  ['amazon', 'shopping'],
  ['target', 'shopping'],
  ['verizon', 'utilities'],
  ['con edison', 'utilities'],
  ['foreign transaction fee', 'fees'],
  ['קסטרו', 'shopping'],
  ['עזריאלי', 'shopping'],
  ['zara', 'shopping'],
  ['בית מרקחת', 'health'],
  ['קופת חולים', 'health'],
  ['pharmacy', 'health'],
  ['מכבי', 'health'],
  ['כללית', 'health'],
  ['סינמה', 'entertainment'],
  ['cinema', 'entertainment'],
  ['יס פלאנט', 'entertainment'],
  ['steam', 'entertainment'],
  ['אל על', 'travel'],
  ['el al', 'travel'],
  ['elal', 'travel'],
  ['ארקיע', 'travel'],
  ['arkia', 'travel'],
  ['ישראייר', 'travel'],
  ['israir', 'travel'],
  ['airbnb', 'travel'],
  ['booking', 'travel'],
  ['hotel', 'travel'],
  ['מלון', 'travel'],
  ['אוניברסיטה', 'education'],
  ['מכללה', 'education'],
  ['coursera', 'education'],
  ['udemy', 'education'],
  ['ביטוח', 'insurance'],
  ['הפניקס', 'insurance'],
  ['insurance', 'insurance'],
  ['מנורה', 'insurance'],
  ['איילון', 'insurance'],
  ['הראל', 'insurance'],
  ['מגדל', 'insurance'],
  ['דמי כרטיס', 'fees'],
  ['עמלת', 'fees'],
  ['עמלה', 'fees'],
  ['ריבית', 'fees'],
  ['card fee', 'fees'],
  ['פייבוקס', 'transfers'],
  ['paybox', 'transfers'],
  ['העברה', 'transfers'],
  ['transfer', 'transfers'],
  ['בביט', 'transfers'],
  ['ביט', 'transfers'],
  ['פז', 'fuel'],
  ['גט', 'transport'],
].map(([keyword, category]) => ({
  keyword: normalizeForMatch(keyword ?? ''),
  category: category ?? 'other',
}));

const ORDERED_RULES = [...RULES].sort((left, right) => right.keyword.length - left.keyword.length);

export function categorizeByRules(merchant: string): string {
  const normalized = normalizeForMatch(merchant);
  const tokens = new Set(normalized.split(' ').filter(Boolean));
  for (const rule of ORDERED_RULES) {
    if (!rule.keyword || !isCategory(rule.category)) {
      continue;
    }
    const matched = rule.keyword.length <= 3
      ? tokens.has(rule.keyword)
      : normalized.includes(rule.keyword);
    if (matched) {
      return rule.category;
    }
  }
  return 'other';
}

export function isRecurringCharge(
  category: string,
  installments: { total: number } | null,
): boolean {
  return category === 'subscriptions' || (installments !== null && installments.total >= 2);
}

const FEE_MARKERS = ['דמי כרטיס', 'עמלת', 'עמלה', 'ריבית', 'card fee', 'late fee'];

export function looksLikeFee(merchant: string): boolean {
  const normalized = normalizeForMatch(merchant);
  return FEE_MARKERS.some((marker) => normalized.includes(normalizeForMatch(marker)));
}

export function ruleTargets(): readonly string[] {
  return ORDERED_RULES.map((rule) => rule.category);
}
