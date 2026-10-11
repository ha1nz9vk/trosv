import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import type { Listing } from "@/types/api";
import "@/styles/leaflet-pins.css";

/*
  Price pins: white pills with 1px ink border, small tail, tabular
  numbers. Hover/selected = clay. Clusters: ink circles with cream
  numbers. Warm tiles via .leaflet-tile-pane filter (styles.css).
*/

function formatPriceShort(vnd: number): string {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(vnd / 1_000_000)}tr`;
}

const DEFAULT_CENTER: [number, number] = [16.0471, 108.2068]; // Việt Nam trung tâm dự phòng

export interface ListingMapProps {
  listings: Listing[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onHover?: (id: number | null) => void;
  ariaLabel?: string;
}

/* Cluster icon: ink circle with cream number. */
function makeClusterIcon(cluster: { getChildCount: () => number }): L.DivIcon {
  const count = cluster.getChildCount();
  return L.divIcon({
    html: `<span class="trosv-cluster" aria-hidden="true">${count}</span>`,
    className: "trosv-cluster-wrap",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

export function makePinIcon(
  listing: Listing,
  selected: boolean
): L.DivIcon {
  return L.divIcon({
    html: `<span
      class="trosv-pin${selected ? " trosv-pin--selected" : ""}"
      role="button"
      tabindex="0"
      aria-label="${formatPriceShort(listing.price)} một tháng, ${listing.title.replace(/"/g, "&quot;")}"
    >${formatPriceShort(listing.price)}</span>`,
    className: "trosv-pin-wrap",
    iconSize: [40, 40],
    iconAnchor: [20, 22],
  });
}

/* Recenter helper: not a hook consumer, so kept simple for external use. */
function MapControllerCenterHint(): null {
  return null;
}

export function ListingMap({
  listings,
  selectedId,
  onSelect,
  onHover,
  ariaLabel = "Bản đồ phòng trọ",
}: ListingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clusterGroup = useRef<L.MarkerClusterGroup | null>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const [ready, setReady] = useState(false);

  const points = useMemo(
    () =>
      listings.filter(
        (l) => l.latitude != null && l.longitude != null
      ),
    [listings]
  );

  /* Build/rebuild the marker cluster group whenever the result set or
     selection changes, in raw leaflet (not react-leaflet Marker) so we
     control clustering + custom divIcons cleanly. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    void import("leaflet").then((Lm) => {
      let map = leafletMap.current;
      if (!map) {
        map = Lm.map(el, { scrollWheelZoom: true }).setView(DEFAULT_CENTER, 5);
        leafletMap.current = map;
        Lm.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        // Warm the tiles in CSS (.leaflet-tile-pane filter) — nothing here.
        setReady(true);
      }

      /* markercluster's types augment L lazily; the calls are valid at
         runtime but the bundler appends them after the fact, so we go
         through typed shims instead of @ts-expect-error dirs. */
      const clusterFactory = (
        Lm as unknown as {
          markerClusterGroup: (opts: {
            iconCreateFunction: (c: { getChildCount: () => number }) => L.DivIcon;
            showCoverageOnHover: boolean;
            maxClusterRadius: number;
          }) => L.MarkerClusterGroup;
        }
      ).markerClusterGroup;
      if (!clusterGroup.current) {
        clusterGroup.current = clusterFactory({
          iconCreateFunction: makeClusterIcon,
          showCoverageOnHover: false,
          maxClusterRadius: 55,
        });
        (map as unknown as { addLayer: (l: unknown) => void }).addLayer(clusterGroup.current);
      } else {
        (clusterGroup.current as unknown as { clearLayers: () => void }).clearLayers();
      }

      for (const item of points) {
        if (item.latitude == null || item.longitude == null) continue;
        const marker = Lm.marker([item.latitude, item.longitude], {
          icon: makePinIcon(item, item.id === selectedId),
          keyboard: true,
          alt: `${formatPriceShort(item.price)} - ${item.title}`,
        });
        marker.on("click", () => { onSelect(item.id); });
        marker.on("mouseover", () => onHover?.(item.id));
        marker.on("mouseout", () => onHover?.(null));
        (clusterGroup.current as unknown as { addLayer: (l: unknown) => void }).addLayer(marker);
      }
    });
  }, [points, selectedId, onSelect, onHover]);

  useEffect(() => {
    return () => {
      leafletMap.current?.remove();
      leafletMap.current = null;
      clusterGroup.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={ariaLabel}
      className="h-full w-full"
      data-testid="map"
      data-ready={ready ? "true" : "false"}
    />
  );
}

/* Re-exported hooks not used directly here; kept minimal for the page imports. */
export { MapControllerCenterHint as MapController };
