'use client'

import { useCallback, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AdvancedMarker, InfoWindow, Polyline } from '@vis.gl/react-google-maps'
import { formatDistanceToNow, parseISO, isValid } from 'date-fns'
import { GeoMapShell } from '@/geo/components/GeoMapShell'
import { GeoMapBoundsReporter } from '@/geo/components/GeoMapBoundsReporter'
import { LiveMapLayerControls } from '@/geo/components/LiveMapLayerControls'
import { LiveRepMapMarker } from '@/geo/components/LiveRepMapMarker'
import { DoctorMapPin } from '@/geo/components/DoctorMapPin'
import { PharmacyMapPin } from '@/geo/components/PharmacyMapPin'
import { CallPointMapPin } from '@/geo/components/CallPointMapPin'
import { ContextEntityClusterMarker } from '@/geo/components/ContextEntityClusterMarker'
import { TerritoryPolygonOverlays } from '@/geo/components/TerritoryPolygonOverlays'
import { GeofenceCircleOverlays } from '@/geo/components/GeofenceCircleOverlays'
import { GeoHeatmapLayer } from '@/geo/components/GeoHeatmapLayer'
import { useAnimatedLiveMarkers } from '@/geo/hooks/useAnimatedLiveMarkers'
import { useLiveMapClusters } from '@/geo/hooks/useLiveMapClusters'
import { useEntityClusters } from '@/geo/hooks/useEntityClusters'
import { useMapZoom } from '@/geo/hooks/useMapZoom'
import { useLiveMapLayers } from '@/geo/hooks/useLiveMapLayers'
import { useMapContext } from '@/geo/hooks/useMapContext'
import { routeMapPoints } from '@/geo/scenes/RouteMapScene'
import { resolveVisitStopContext } from '@/geo/context/ContextEngine'
import { formatDistanceMeters } from '@/geo/utils/distance'
import { confidenceLabel } from '@/types/liveTracking'
import type { LiveRepLocation } from '@/types/liveTracking'
import type { LatLng } from '@/geo/utils/mapBounds'
import type {
  GeoMapContextPayload,
  LiveMapLayerState,
  MapContextCallPoint,
  MapContextDoctor,
  MapContextPharmacy,
  MapBbox
} from '@/geo/types/mapContext'

type Props = {
  height?: number | string
  rows: LiveRepLocation[]
  loading?: boolean
  selectedUserId?: string | null
  onSelectUser?: (row: LiveRepLocation | null) => void
}

type ContextPin =
  | { kind: 'doctor'; item: MapContextDoctor }
  | { kind: 'pharmacy'; item: MapContextPharmacy }
  | { kind: 'callPoint'; item: MapContextCallPoint }

function doctorVisitStatus(
  doctorId: string,
  context: GeoMapContextPayload | null
): string | undefined {
  if (!context?.employee) return undefined
  if (context.employee.activeVisit?.doctor?.id === doctorId) return 'IN_PROGRESS'
  const routeItem = context.employee.todayRoute?.find((i) => i.doctor?.id === doctorId)
  return routeItem?.status
}

function mergeDoctors(context: GeoMapContextPayload | null): MapContextDoctor[] {
  if (!context) return []
  const map = new Map<string, MapContextDoctor>()
  for (const d of context.doctors) map.set(d.id, d)
  const active = context.employee?.activeVisit?.doctor
  if (active?.lat != null && active?.lng != null && active.id) {
    map.set(active.id, {
      id: active.id,
      name: active.name,
      specialization: active.specialization,
      address: active.address,
      lat: active.lat,
      lng: active.lng
    })
  }
  return Array.from(map.values())
}

function clusterEntityForKind(kind: ContextPin['kind']): 'doctor' | 'pharmacy' | 'callPoint' {
  return kind === 'pharmacy' ? 'pharmacy' : kind === 'callPoint' ? 'callPoint' : 'doctor'
}

function ContextMarkersLayer({
  kind,
  items,
  zoom,
  context,
  selectedPin,
  onSelectPin
}: {
  kind: ContextPin['kind']
  items: Array<MapContextDoctor | MapContextPharmacy | MapContextCallPoint>
  zoom: number
  context: GeoMapContextPayload | null
  selectedPin: ContextPin | null
  onSelectPin: (pin: ContextPin | null) => void
}) {
  const clusterInput = useMemo(
    () => items.map((item) => ({ id: item.id, lat: item.lat, lng: item.lng, item })),
    [items]
  )
  const clusters = useEntityClusters(clusterInput, zoom)

  if (clusters) {
    return (
      <>
        {clusters.map((cluster) => (
          <AdvancedMarker
            key={`${kind}-cluster-${cluster.id}`}
            position={{ lat: cluster.lat, lng: cluster.lng }}
            onClick={() => {
              const first = cluster.items[0]?.item
              if (first) onSelectPin({ kind, item: first })
            }}
          >
            <ContextEntityClusterMarker count={cluster.count} entity={clusterEntityForKind(kind)} />
          </AdvancedMarker>
        ))}
      </>
    )
  }

  return (
    <>
      {items.map((item) => {
        const isSelected = selectedPin?.kind === kind && selectedPin.item.id === item.id
        const isActiveDoctor =
          kind === 'doctor' && context?.employee?.activeVisit?.doctor?.id === item.id
        const visitStatus = kind === 'doctor' ? doctorVisitStatus(item.id, context) : undefined

        return (
          <AdvancedMarker
            key={`${kind}-${item.id}`}
            position={{ lat: item.lat, lng: item.lng }}
            onClick={() => onSelectPin({ kind, item } as ContextPin)}
          >
            {kind === 'doctor' ? (
              <DoctorMapPin
                selected={isSelected || isActiveDoctor}
                visitStatus={visitStatus}
                locationStatus={(item as MapContextDoctor).locationStatus}
              />
            ) : kind === 'pharmacy' ? (
              <PharmacyMapPin selected={isSelected} />
            ) : (
              <CallPointMapPin selected={isSelected} />
            )}
          </AdvancedMarker>
        )
      })}
    </>
  )
}

function LiveTrackingMapContent({
  rows,
  selected,
  onSelect,
  layers,
  layerControls,
  context,
  bounds,
  onBoundsChange
}: {
  rows: LiveRepLocation[]
  selected: LiveRepLocation | null
  onSelect: (row: LiveRepLocation | null) => void
  layers: LiveMapLayerState
  layerControls: React.ReactNode
  context: GeoMapContextPayload | null
  bounds: MapBbox | null
  onBoundsChange: (bbox: MapBbox) => void
}) {
  const animated = useAnimatedLiveMarkers(rows)
  const mapZoom = useMapZoom(10)
  const repClusters = useLiveMapClusters(rows, mapZoom)
  const [contextPin, setContextPin] = useState<ContextPin | null>(null)

  const locatedRows = useMemo(
    () => rows.filter((r) => r.lat != null && r.lng != null),
    [rows]
  )

  const doctors = useMemo(() => mergeDoctors(context), [context])
  const pharmacies = context?.pharmacies ?? []
  const callPoints = context?.callPoints ?? []

  const routePoints: LatLng[] = useMemo(() => {
    if (!layers.route || !context?.employee?.todayRoute?.length) return []
    return routeMapPoints({ checkInPoint: null, items: context.employee.todayRoute })
  }, [context, layers.route])

  const repPosition = selected
    ? animated.get(selected.userId) ||
      (selected.lat != null && selected.lng != null ? { lat: selected.lat, lng: selected.lng! } : null)
    : null

  const activeVisitDoctor = context?.employee?.activeVisit?.doctor
  const visitLine: LatLng[] | null =
    repPosition && activeVisitDoctor?.lat != null && activeVisitDoctor?.lng != null
      ? [repPosition, { lat: activeVisitDoctor.lat, lng: activeVisitDoctor.lng }]
      : null

  const territoryShapes = useMemo(
    () =>
      (context?.territories || []).map((t) => ({
        id: t.id,
        geometry: t.geometry,
        label: t.label
      })),
    [context?.territories]
  )

  return (
    <>
      <GeoMapBoundsReporter onBoundsChange={onBoundsChange} />
      {layerControls}

      {layers.territories ? <TerritoryPolygonOverlays boundaries={territoryShapes} /> : null}
      {layers.geofences && context?.geofences?.length ? (
        <GeofenceCircleOverlays geofences={context.geofences} />
      ) : null}
      {layers.heatmap && context?.heatmap?.points?.length ? (
        <GeoHeatmapLayer points={context.heatmap.points} />
      ) : null}

      {routePoints.length >= 2 ? (
        <Polyline path={routePoints} strokeColor='#1565c0' strokeWeight={3} strokeOpacity={0.65} />
      ) : null}

      {visitLine ? (
        <Polyline
          path={visitLine}
          strokeColor='#6a1b9a'
          strokeWeight={2}
          strokeOpacity={0.85}
          icons={[
            {
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
              offset: '0',
              repeat: '10px'
            }
          ]}
        />
      ) : null}

      {layers.doctors ? (
        <ContextMarkersLayer
          kind='doctor'
          items={doctors}
          zoom={mapZoom}
          context={context}
          selectedPin={contextPin}
          onSelectPin={setContextPin}
        />
      ) : null}

      {layers.pharmacies ? (
        <ContextMarkersLayer
          kind='pharmacy'
          items={pharmacies}
          zoom={mapZoom}
          context={context}
          selectedPin={contextPin}
          onSelectPin={setContextPin}
        />
      ) : null}

      {layers.callPoints ? (
        <ContextMarkersLayer
          kind='callPoint'
          items={callPoints}
          zoom={mapZoom}
          context={context}
          selectedPin={contextPin}
          onSelectPin={setContextPin}
        />
      ) : null}

      {repClusters
        ? repClusters.map((cluster) => (
            <AdvancedMarker
              key={cluster.id}
              position={{ lat: cluster.lat, lng: cluster.lng }}
              onClick={() => onSelect(cluster.rows[0] ?? null)}
            >
              <ContextEntityClusterMarker count={cluster.count} entity='rep' />
            </AdvancedMarker>
          ))
        : locatedRows.map((row) => {
            const pos = animated.get(row.userId) || { lat: row.lat!, lng: row.lng! }
            const isSelected = selected?.userId === row.userId
            return (
              <AdvancedMarker key={row.userId} position={pos} onClick={() => onSelect(row)}>
                <LiveRepMapMarker
                  name={row.name}
                  attendanceStatus={row.attendanceStatus}
                  ageSeconds={row.ageSeconds}
                  confidence={row.confidence}
                  selected={isSelected}
                />
              </AdvancedMarker>
            )
          })}

      {selected && selected.lat != null && selected.lng != null ? (
        <InfoWindow
          position={animated.get(selected.userId) || { lat: selected.lat, lng: selected.lng! }}
          onCloseClick={() => onSelect(null)}
        >
          <div style={{ minWidth: 220, maxWidth: 280 }}>
            <strong>{selected.name}</strong>
            <div>{selected.attendanceStatus.replace(/_/g, ' ')}</div>
            {selected.capturedAt ? (
              <div style={{ fontSize: 12 }}>
                Last heartbeat{' '}
                {(() => {
                  const d = parseISO(selected.capturedAt)
                  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : selected.capturedAt
                })()}
              </div>
            ) : null}
            {selected.accuracy != null ? <div>±{Math.round(selected.accuracy)}m accuracy</div> : null}
            {selected.confidence != null ? <div>{confidenceLabel(selected.confidence)}</div> : null}
            {selected.trackingContext ? (
              <div style={{ fontSize: 12, opacity: 0.85 }}>{selected.trackingContext.replace(/_/g, ' ')}</div>
            ) : null}
            {context?.employee?.activeVisit?.doctor ? (
              <div style={{ marginTop: 6 }}>
                Active visit: {context.employee.activeVisit.doctor.name}
              </div>
            ) : null}
            {context?.employee?.plannedVisit?.doctor &&
            context.employee.plannedVisit.planItemId !== context.employee.activeVisit?.planItemId ? (
              <div>Planned: {context.employee.plannedVisit.doctor.name}</div>
            ) : null}
            {context?.employee?.distanceTravelledMeters != null ? (
              <div>Distance today: {formatDistanceMeters(context.employee.distanceTravelledMeters)}</div>
            ) : null}
            {context?.employee?.nearbyCounts ? (
              <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
                Nearby: {context.employee.nearbyCounts.doctors} doctors ·{' '}
                {context.employee.nearbyCounts.pharmacies} pharmacies ·{' '}
                {context.employee.nearbyCounts.callPoints} call points
              </div>
            ) : null}
          </div>
        </InfoWindow>
      ) : null}

      {contextPin?.kind === 'doctor' ? (
        <InfoWindow
          position={{ lat: contextPin.item.lat, lng: contextPin.item.lng }}
          onCloseClick={() => setContextPin(null)}
        >
          <div style={{ minWidth: 200 }}>
            <strong>{contextPin.item.name}</strong>
            {contextPin.item.specialization ? <div>{contextPin.item.specialization}</div> : null}
            {contextPin.item.address ? (
              <div style={{ fontSize: 12 }}>{contextPin.item.address}</div>
            ) : null}
            {contextPin.item.distanceMeters != null ? (
              <div>{formatDistanceMeters(contextPin.item.distanceMeters)} from rep</div>
            ) : null}
            {(() => {
              const status = doctorVisitStatus(contextPin.item.id, context)
              if (!status) return null
              return <div>Today: {resolveVisitStopContext(status).replace(/_/g, ' ')}</div>
            })()}
          </div>
        </InfoWindow>
      ) : null}

      {contextPin?.kind === 'pharmacy' ? (
        <InfoWindow
          position={{ lat: contextPin.item.lat, lng: contextPin.item.lng }}
          onCloseClick={() => setContextPin(null)}
        >
          <div style={{ minWidth: 200 }}>
            <strong>{contextPin.item.name}</strong>
            {contextPin.item.address ? (
              <div style={{ fontSize: 12 }}>{contextPin.item.address}</div>
            ) : null}
            {contextPin.item.distanceMeters != null ? (
              <div>{formatDistanceMeters(contextPin.item.distanceMeters)} from rep</div>
            ) : null}
          </div>
        </InfoWindow>
      ) : null}

      {contextPin?.kind === 'callPoint' ? (
        <InfoWindow
          position={{ lat: contextPin.item.lat, lng: contextPin.item.lng }}
          onCloseClick={() => setContextPin(null)}
        >
          <div style={{ minWidth: 180 }}>
            <strong>{contextPin.item.name}</strong>
            {contextPin.item.distanceMeters != null ? (
              <div>{formatDistanceMeters(contextPin.item.distanceMeters)} from rep</div>
            ) : null}
          </div>
        </InfoWindow>
      ) : null}
    </>
  )
}

export function LiveTrackingScene({
  height = 420,
  rows,
  loading = false,
  selectedUserId = null,
  onSelectUser
}: Props) {
  const [internalSelected, setInternalSelected] = useState<LiveRepLocation | null>(null)
  const [bounds, setBounds] = useState<MapBbox | null>(null)
  const {
    layers,
    setLayer,
    availableLayers,
    layerLabels,
    proximityRadiusMeters,
    setProximityRadiusMeters,
    activeLayersQuery
  } = useLiveMapLayers()

  const selected =
    selectedUserId != null
      ? rows.find((r) => r.userId === selectedUserId) ?? internalSelected
      : internalSelected

  const locatedRows = useMemo(
    () => rows.filter((r) => r.lat != null && r.lng != null),
    [rows]
  )

  const fitKey = useMemo(
    () => locatedRows.map((r) => r.userId).sort().join(','),
    [locatedRows]
  )

  const fitPoints: LatLng[] = useMemo(
    () => locatedRows.map((r) => ({ lat: r.lat!, lng: r.lng! })),
    [fitKey]
  )

  const { data: context, loading: contextLoading } = useMapContext({
    bounds,
    employeeId: selected?.userId ?? null,
    trackingContext: selected?.trackingContext ?? null,
    radiusMeters: proximityRadiusMeters,
    layersQuery: activeLayersQuery,
    enabled: Boolean(bounds)
  })

  const setSelected = (row: LiveRepLocation | null) => {
    setInternalSelected(row)
    onSelectUser?.(row)
  }

  const handleBoundsChange = useCallback((bbox: MapBbox) => {
    setBounds(bbox)
  }, [])

  const layerControls = (
    <LiveMapLayerControls
      availableLayers={availableLayers}
      layers={layers}
      layerLabels={layerLabels}
      onToggleLayer={setLayer}
      proximityRadiusMeters={proximityRadiusMeters}
      onProximityChange={setProximityRadiusMeters}
      contextLoading={contextLoading}
    />
  )

  if (!loading && rows.length > 0 && locatedRows.length === 0) {
    return (
      <Box
        className='flex flex-col items-center justify-center text-center'
        sx={{ height, borderRadius: 1, border: 1, borderColor: 'divider', px: 3 }}
      >
        <Typography variant='body2' color='text.secondary'>
          Team members are listed below, but none have a recent GPS ping. Reps send adaptive location
          updates while checked in on the mobile app.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ position: 'relative', height, width: '100%' }}>
      <GeoMapShell height={height} points={fitPoints} fitKey={fitKey} autoFit='once'>
        <LiveTrackingMapContent
          rows={rows}
          selected={selected}
          onSelect={setSelected}
          layers={layers}
          layerControls={layerControls}
          context={context}
          bounds={bounds}
          onBoundsChange={handleBoundsChange}
        />
      </GeoMapShell>
    </Box>
  )
}
