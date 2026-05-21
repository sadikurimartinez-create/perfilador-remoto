import React from 'react';

import {
  Circle,
} from '@react-google-maps/api';

import {
  buildThreatZones,
} from '../utils/threatMapUtils';

interface Props {

  project: any;

  osintResults: any;

}

const ThreatMapOverlay:
React.FC<Props> = ({

  project,

  osintResults,

}) => {

  if (!osintResults) {
    return null;
  }

  const zones =
    buildThreatZones(
      project,
      osintResults
    );

  return (

    <>

      {zones.map(
        (
          zone,
          index
        ) => (

          <Circle
            key={index}
            center={{
              lat: zone.lat,
              lng: zone.lng,
            }}
            radius={zone.radius}
            options={{

              fillColor:
                zone.color,

              strokeColor:
                zone.color,

              fillOpacity: 0.30,

              strokeOpacity: 0.8,

              strokeWeight: 2,

            }}
          />

        )
      )}

    </>

  );

};

export default ThreatMapOverlay;