import * as React from "react";
import { Polyline } from "@react-google-maps/api";

export type StreetSelectionGeometry = {
  type: "MultiLineString";
  coordinates: Array<Array<[number, number]>>;
};

interface StreetSelectionLayerProps {
  geometry?: StreetSelectionGeometry | null;
  visible?: boolean;
}

export const StreetSelectionLayer: React.FC<StreetSelectionLayerProps> = ({
  geometry,
  visible = true,
}) => {
  const paths = React.useMemo(() => {
    if (
      !visible ||
      !geometry ||
      geometry.type !== "MultiLineString" ||
      !Array.isArray(geometry.coordinates)
    ) {
      return [];
    }

    return geometry.coordinates
      .map((line) =>
        line
          .filter(
            (position) =>
              Array.isArray(position) &&
              position.length >= 2 &&
              Number.isFinite(position[0]) &&
              Number.isFinite(position[1])
          )
          .map(([lng, lat]) => ({
            lat,
            lng,
          }))
      )
      .filter((line) => line.length >= 2);
  }, [geometry, visible]);

  if (paths.length === 0) {
    return null;
  }

  return (
    <>
      {paths.map((path, index) => (
        <Polyline
          key={`street-selection-${index}`}
          path={path}
          options={{
            strokeColor: "#f59e0b",
            strokeOpacity: 1,
            strokeWeight: 6,
            clickable: false,
            zIndex: 50,
          }}
        />
      ))}
    </>
  );
};

export default StreetSelectionLayer;