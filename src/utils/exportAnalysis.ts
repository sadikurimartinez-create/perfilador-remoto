export const exportCSV = (iaAnalysis: any[]) => {
  const headers = ['FotoID', 'Riesgo', 'Observación'];
  const rows = iaAnalysis.map(item => [item.photoId, item.riskLevel, item.note]);
  const csvContent =
    [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'ia_analysis.csv';
  link.click();
};