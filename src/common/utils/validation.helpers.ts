/**
 * Count words in a string (strips HTML tags first)
 */
export function countWords(text: string): number {
  if (!text) return 0;
  // Strip HTML tags
  const stripped = text.replace(/<[^>]*>/g, ' ');
  // Split by whitespace and filter empty strings
  const words = stripped.trim().split(/\s+/).filter(word => word.length > 0);
  return words.length;
}

/**
 * Parse yearly salary string into min and max values
 * Supports formats: "500000" or "500000-800000"
 */
export function parseYearlySalary(yearlySalary: string | undefined): {
  salaryMin: number | null;
  salaryMax: number | null;
} {
  if (!yearlySalary) {
    return { salaryMin: null, salaryMax: null };
  }

  if (yearlySalary.includes('-')) {
    const [minStr, maxStr] = yearlySalary.split('-').map(s => s.trim());
    const min = parseFloat(minStr);
    const max = parseFloat(maxStr);
    return {
      salaryMin: isNaN(min) ? null : min,
      salaryMax: isNaN(max) ? null : max,
    };
  } else {
    const salary = parseFloat(yearlySalary);
    return {
      salaryMin: isNaN(salary) ? null : salary,
      salaryMax: isNaN(salary) ? null : salary,
    };
  }
}

/**
 * Valid candidate quality IDs
 */
export const VALID_CANDIDATE_QUALITIES = [
  'outgoing',
  'realistic',
  'structured',
  'prioritizes_fairness',
  'reserved',
  'conceptual',
  'open_ended',
  'people_impact',
];

/**
 * Validate candidate qualities array
 */
export function validateCandidateQualities(qualities: string[] | undefined): boolean {
  if (!qualities || qualities.length === 0) return true;
  return qualities.every(q => VALID_CANDIDATE_QUALITIES.includes(q));
}


