import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Aggiorna l'inquadratura per mostrare tutti i marker a schermo
const AutoFitBounds = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [points, map]);

  return null;
};

const SupplyMap = ({ steps }) => {
  if (!steps || steps.length === 0) return null;

  // Filtra solo le fasi con coordinate numeriche valide
  const validSteps = steps.filter(
    step =>
      Number.isFinite(step.coordinates?.lat) &&
      Number.isFinite(step.coordinates?.lng)
  );

  if (validSteps.length === 0) return null;

  const polylineCoordinates = validSteps.map(step => [step.coordinates.lat, step.coordinates.lng]);
  const center = polylineCoordinates[0];

  // Raggruppamento delle fasi con le stesse coordinate geografiche
  const groupedLocations = validSteps.reduce((acc, step, index) => {
    const lat = Number(step.coordinates.lat).toFixed(6);
    const lng = Number(step.coordinates.lng).toFixed(6);
    const key = `${lat}_${lng}`;

    if (!acc[key]) {
      acc[key] = {
        position: [step.coordinates.lat, step.coordinates.lng],
        location: step.location,
        phases: []
      };
    }

    acc[key].phases.push({
      stepNumber: index + 1,
      process: step.process,
      date: step.date
    });

    return acc;
  }, {});

  return (
    <div style={{ height: '320px', width: '100%', borderRadius: '12px', overflow: 'hidden', margin: '15px 0' }}>
      <MapContainer center={center} zoom={6} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <AutoFitBounds points={polylineCoordinates} />

        {/* Tracciamento logistico cronologico */}
        <Polyline positions={polylineCoordinates} color="#2b5a41" weight={3} dashArray="5, 8" />

        {/* Marker con raggruppamento fasi */}
        {Object.entries(groupedLocations).map(([key, group]) => (
          <Marker key={key} position={group.position}>
            <Popup>
              <div style={{ minWidth: '160px' }}>
                <strong style={{ fontSize: '14px', display: 'block', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '8px' }}>
                  {group.location}
                </strong>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', lineHeight: '1.4' }}>
                  {group.phases.map(p => (
                    <li key={p.stepNumber} style={{ marginBottom: '4px' }}>
                      <strong>Fase {p.stepNumber}:</strong> {p.process}
                      {p.date && <span style={{ color: '#6b7280', display: 'block', fontSize: '11px' }}>Data: {p.date}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default SupplyMap;