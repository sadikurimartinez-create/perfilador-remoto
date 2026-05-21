export interface ThreatZone {

  lat: number;

  lng: number;

  radius: number;

  risk:
    | 'BAJO'
    | 'MEDIO'
    | 'ALTO'
    | 'CRÍTICO';

  color: string;

}

export const buildThreatZones = (
  project: any,
  osintResults: any
): ThreatZone[] => {

  const photos =
    project?.photos || [];

  const findings =
    project?.iaAnalysis || [];

  const zones: ThreatZone[] = [];

  photos.forEach(
    (photo: any, index: number) => {

      const finding =
        findings[index];

      let risk:
        | 'BAJO'
        | 'MEDIO'
        | 'ALTO'
        | 'CRÍTICO' =
          'BAJO';

      let color =
        '#22c55e';

      let radius = 120;

      if (
        finding?.riskLevel === 'high' ||
        finding?.riskLevel === 'alto'
      ) {

        risk = 'ALTO';

        color = '#ef4444';

        radius = 250;

      }

      else if (
        finding?.riskLevel === 'medium' ||
        finding?.riskLevel === 'medio'
      ) {

        risk = 'MEDIO';

        color = '#f97316';

        radius = 180;

      }

      const socialSignals =
        (
          osintResults?.reddit
            ?.length || 0
        ) +
        (
          osintResults?.x
            ?.length || 0
        );

      if (socialSignals >= 15) {

        risk = 'CRÍTICO';

        color = '#991b1b';

        radius = 320;

      }

      if (
        photo?.lat &&
        photo?.lng
      ) {

        zones.push({

          lat: photo.lat,

          lng: photo.lng,

          radius,

          risk,

          color,

        });

      }

    }
  );

  return zones;

};