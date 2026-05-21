export const buildTimelineData = (
  findings: any[]
) => {

  if (!findings || findings.length === 0) {
    return [];
  }

  const grouped: Record<string, number> =
    {};

  findings.forEach(finding => {

    const date =
      new Date(
        finding.timestamp
      ).toLocaleDateString();

    if (!grouped[date]) {
      grouped[date] = 0;
    }

    grouped[date] += 1;

  });

  return Object.entries(grouped).map(
    ([date, total]) => ({
      date,
      total,
    })
  );
};