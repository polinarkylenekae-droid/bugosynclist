export interface NormalizedPhPhone {
  valid: boolean;
  isRealNumber: boolean;
  local09: string;
  e164: string;
  formatted: string;
  telco: string;
  cleanRaw: string;
  reason?: string;
}

const GLOBE_TM_PREFIXES = new Set([
  '0817', '0905', '0906', '0915', '0916', '0917', '0926', '0927',
  '0935', '0936', '0937', '0945', '0953', '0954', '0955', '0956',
  '0965', '0966', '0967', '0975', '0976', '0977', '0978', '0979',
  '0994', '0995', '0996', '0997',
]);

const SMART_TNT_SUN_PREFIXES = new Set([
  '0813', '0907', '0908', '0909', '0910', '0911', '0912', '0913',
  '0914', '0918', '0919', '0920', '0921', '0922', '0923', '0924',
  '0925', '0928', '0929', '0930', '0931', '0932', '0933', '0934',
  '0938', '0939', '0940', '0941', '0942', '0943', '0944', '0946',
  '0947', '0948', '0949', '0950', '0951', '0960', '0961', '0962',
  '0963', '0964', '0968', '0969', '0970', '0971', '0980', '0981',
  '0982', '0985', '0998', '0999',
]);

const DITO_PREFIXES = new Set([
  '0895', '0896', '0897', '0898', '0991', '0992', '0993', '0994',
]);

export function detectPhTelco(local09: string): string {
  const prefix = local09.slice(0, 4);
  if (DITO_PREFIXES.has(prefix) && !GLOBE_TM_PREFIXES.has(prefix)) return 'DITO';
  if (GLOBE_TM_PREFIXES.has(prefix)) return 'Globe / TM';
  if (SMART_TNT_SUN_PREFIXES.has(prefix)) return 'Smart / TNT / Sun';
  if (DITO_PREFIXES.has(prefix)) return 'DITO';
  return 'PH Mobile';
}

export function isFakePlaceholderMobileTail(local09: string): boolean {
  if (!/^0[89]\d{9}$/.test(local09)) return true;
  const tail = local09.slice(4); // 7-digit subscriber number
  // All identical digits or 6+ consecutive repeating digits (e.g. 0000000, 1111111, 9999999)
  if (/(\d)\1{5,}/.test(local09)) return true;
  // Classic dummy/sequential zero-padded tails (0000001, 1110000, 5554321, 5550000, 0000000..0000009)
  if (/^0{5,}\d{0,2}$/.test(tail)) return true;
  if (/^(\d)\1{2}0{4}$/.test(tail)) return true;
  if (tail === '5554321' || tail === '5551234' || tail === '5550000') return true;
  // Fewer than 2 distinct digits in the 7-digit subscriber tail (e.g. 2222221)
  if (new Set(tail.split('')).size <= 1) return true;
  return false;
}

export function normalizePhMobileNumber(raw?: string): NormalizedPhPhone {
  const cleanRaw = String(raw || '').trim();
  if (!cleanRaw) {
    return {
      valid: false,
      isRealNumber: false,
      local09: '',
      e164: '',
      formatted: '',
      telco: '',
      cleanRaw: '',
      reason: 'Philippine mobile number is required.',
    };
  }

  const digits = cleanRaw.replace(/\D/g, '');
  let local09 = '';
  if (/^0[89]\d{9}$/.test(digits)) {
    local09 = digits;
  } else if (/^63[89]\d{9}$/.test(digits)) {
    local09 = `0${digits.slice(2)}`;
  } else if (/^[89]\d{9}$/.test(digits)) {
    local09 = `0${digits}`;
  } else {
    return {
      valid: false,
      isRealNumber: false,
      local09: cleanRaw,
      e164: cleanRaw,
      formatted: cleanRaw,
      telco: '',
      cleanRaw,
      reason: 'Must be an 11-digit Philippine mobile number starting with 09 or +639 (e.g. 0917 628 4915).',
    };
  }

  const prefix = local09.slice(0, 4);
  const validPrefix =
    GLOBE_TM_PREFIXES.has(prefix) ||
    SMART_TNT_SUN_PREFIXES.has(prefix) ||
    DITO_PREFIXES.has(prefix);

  if (!validPrefix) {
    return {
      valid: false,
      isRealNumber: false,
      local09,
      e164: `+63${local09.slice(1)}`,
      formatted: `${local09.slice(0, 4)} ${local09.slice(4, 7)} ${local09.slice(7)}`,
      telco: '',
      cleanRaw,
      reason: `Prefix "${prefix}" is not a recognized Philippine mobile network prefix.`,
    };
  }

  const isDummy = isFakePlaceholderMobileTail(local09);
  const formatted = `${local09.slice(0, 4)} ${local09.slice(4, 7)} ${local09.slice(7)}`;
  const e164 = `+63${local09.slice(1)}`;
  const telco = detectPhTelco(local09);

  if (isDummy) {
    return {
      valid: false,
      isRealNumber: false,
      local09,
      e164,
      formatted,
      telco,
      cleanRaw,
      reason: 'Please enter a real active Philippine mobile number (placeholder numbers like 0000 or 555-4321 are not allowed).',
    };
  }

  return {
    valid: true,
    isRealNumber: true,
    local09,
    e164,
    formatted,
    telco,
    cleanRaw,
  };
}

export function formatPhMobileDisplay(raw?: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  let local = '';
  if (/^0[89]\d{9}$/.test(digits)) local = digits;
  else if (/^63[89]\d{9}$/.test(digits)) local = `0${digits.slice(2)}`;
  else if (/^[89]\d{9}$/.test(digits)) local = `0${digits}`;
  if (!local) return String(raw || '').trim();
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

export function maskPhMobile(raw?: string): string {
  const norm = normalizePhMobileNumber(raw);
  const local = norm.local09;
  if (local.length === 11) {
    return `${local.slice(0, 4)}****${local.slice(-3)}`;
  }
  return String(raw || '');
}
