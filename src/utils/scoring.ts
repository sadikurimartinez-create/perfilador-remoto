interface RiskResult {
  averageScore: number;
  maxScore: number;
  classification: 'Bajo' | 'Medio' | 'Alto';
}

export const calculateRisk = (findings: any[]): RiskResult => {
  if (!findings || findings.length === 0) return {
    averageScore: 0,
    maxScore: 0,
    classification: 'Bajo'
  };

  const scoreMap: Record<string, number> = {
    low: 1,
    medio: 2,
    medium: 2,
    high: 3,
    alto: 3
  };

  const scores = findings.map(f => scoreMap[f.riskLevel] || 0);
  const total = scores.reduce((a,b) => a+b, 0);
  const average = total / scores.length;
  const maxScore = Math.max(...scores);

  let classification: 'Bajo' | 'Medio' | 'Alto' = 'Bajo';
  if (average >= 2 && average < 3) classification = 'Medio';
  else if (average >= 3) classification = 'Alto';

  return { averageScore: average, maxScore, classification };
};