import {
  AdvancedMarker,
  APIProvider,
  Map as GMap,
  InfoWindow,
  Marker,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import { MAPS_API_KEY, MAPS_MAP_ID } from "astro:env/client";
import { useCallback, useState, type FC, type PropsWithChildren } from "react";
import type { Coordinates } from "@/collections/location";

type Props = {
  center: Coordinates;
  infoWindow?: {
    header: React.ReactNode;
    content: React.ReactNode;
  };
};

export const Map: FC<Props> = ({ center, infoWindow }) => {
  const position = { lat: center.lat, lng: center.lon };
  return (
    <APIProvider apiKey={MAPS_API_KEY}>
      <GMap
        mapId={MAPS_MAP_ID}
        className="sm:w-96 md:w-full h-[24rem] md:h-[48rem] m-8"
        defaultCenter={position}
        defaultZoom={15}
        gestureHandling={"greedy"}
        disableDefaultUI={true}
      >
        {infoWindow && (
          <MarkerWithInfoWindow position={position} header={infoWindow.header}>
            {infoWindow.content}
          </MarkerWithInfoWindow>
        )}
      </GMap>
    </APIProvider>
  );
};

const MarkerWithInfoWindow: FC<
  PropsWithChildren<{
    position: google.maps.LatLngLiteral;
    header: React.ReactNode;
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
        <InfoWindow
          anchor={marker}
          onClose={handleClose}
          headerContent={header}
        >
          {children}
        </InfoWindow>
      )}
    </>
  );
};
