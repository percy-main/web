import {
  AdvancedMarker,
  APIProvider,
  Map as GMap,
  InfoWindow,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import { MAPS_API_KEY, MAPS_MAP_ID } from "astro:env/client";
import { useCallback, useState, type FC, type PropsWithChildren } from "react";
import type { Coordinates } from "@/collections/location";

type Props = PropsWithChildren<{
  center: Coordinates;
  infoWindow?: {
    header: string;
  };
}>;

export const Map: FC<Props> = ({ center, infoWindow, children }) => {
  const position = { lat: center.lat, lng: center.lon };
  return (
    <APIProvider apiKey={MAPS_API_KEY}>
      <GMap
        mapId={MAPS_MAP_ID}
        className="w-96 md:w-full h-[24rem] md:h-[48rem] mt-8"
        defaultCenter={position}
        defaultZoom={15}
        gestureHandling={"greedy"}
        disableDefaultUI={true}
      >
        {infoWindow && (
          <MarkerWithInfoWindow position={position} header={infoWindow.header}>
            {children}
          </MarkerWithInfoWindow>
        )}
      </GMap>
    </APIProvider>
  );
};

const MarkerWithInfoWindow: FC<
  PropsWithChildren<{
    position: google.maps.LatLngLiteral;
    header: string;
  }>
> = ({ position, header, children }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  const [infoWindowShown, setInfoWindowShown] = useState(true);

  // clicking the marker will toggle the infowindow
  const handleMarkerClick = useCallback(
    () => setInfoWindowShown((isShown) => !isShown),
    [],
  );

  // if the maps api closes the infowindow, we have to synchronize our state
  const handleClose = useCallback(() => setInfoWindowShown(false), []);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        onClick={handleMarkerClick}
      />

      {infoWindowShown && (
        <InfoWindow anchor={marker} onClose={handleClose} headerDisabled>
          {children}
        </InfoWindow>
      )}
    </>
  );
};
