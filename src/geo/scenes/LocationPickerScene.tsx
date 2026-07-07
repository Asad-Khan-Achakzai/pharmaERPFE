'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AdvancedMarker, Map, APIProvider, type MapMouseEvent } from '@vis.gl/react-google-maps'
import { MapMarker } from '@/geo/components/markers/MapMarker'
import { getMarker } from '@/geo/marker/MarkerStateResolver'
import { useGeoMapApiKey, useGeoMapId } from '@/geo/hooks/useGeoMapApiKey'
import { GeoMapPlaceCamera, GeoMapPlaceSearch } from '@/geo/components/GeoMapPlaceSearch'
import { useGeoFeatures } from '@/geo/GeoPlatformProvider'
import { latLngFromDragEvent, latLngFromMapClick } from '@/geo/utils/mapEvents'
import { EMBEDDED_GEO_MAP_UI } from '@/geo/constants/mapUi'
import { GeoMapResizeSync } from '@/geo/components/GeoMapResizeSync'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

function MapPickerBody({
  position,
  mapId,
  countryCode,
  searchEnabled,
  onMapClick,
  onPlaceSelect,
  onDragEnd,
  cameraTarget
}: {
  position: { lat: number; lng: number } | null
  mapId: string
  countryCode: string
  searchEnabled: boolean
  onMapClick: (event: MapMouseEvent) => void
  onPlaceSelect: (pick: { lat: number; lng: number; label?: string; viewport?: google.maps.LatLngBounds }) => void
  onDragEnd: (ev: google.maps.MapMouseEvent) => void
  cameraTarget: { lat: number; lng: number; viewport?: google.maps.LatLngBounds } | null
}) {
  return (
    <Map
      mapId={mapId || undefined}
      defaultCenter={position || { lat: 31.5204, lng: 74.3587 }}
      defaultZoom={position ? 15 : 11}
      gestureHandling='greedy'
      onClick={onMapClick}
      style={{ width: '100%', height: '100%' }}
      {...EMBEDDED_GEO_MAP_UI}
    >
      <GeoMapResizeSync />
      <GeoMapPlaceSearch
        countryCode={countryCode}
        onPlaceSelect={onPlaceSelect}
        forceEnabled={searchEnabled}
      />
      <GeoMapPlaceCamera target={cameraTarget} />
      {position && mapId ? (
        <AdvancedMarker position={position} draggable onDragEnd={onDragEnd}>
          <MapMarker visual={getMarker('callPoint', 'selected')} title='Selected location' />
        </AdvancedMarker>
      ) : null}
    </Map>
  )
}

function MapPickerFrame({
  apiKey,
  mapHeight,
  mapId,
  countryCode,
  searchEnabled,
  onMapClick,
  onPlaceSelect,
  onDragEnd,
  cameraTarget,
  position,
  expandButton
}: {
  apiKey: string
  mapHeight: number | string
  mapId: string
  countryCode: string
  searchEnabled: boolean
  position: { lat: number; lng: number } | null
  onMapClick: (event: MapMouseEvent) => void
  onPlaceSelect: (pick: { lat: number; lng: number; label?: string; viewport?: google.maps.LatLngBounds }) => void
  onDragEnd: (ev: google.maps.MapMouseEvent) => void
  cameraTarget: { lat: number; lng: number; viewport?: google.maps.LatLngBounds } | null
  expandButton?: ReactNode
}) {
  return (
    <Box
      sx={{
        height: mapHeight,
        width: '100%',
        borderRadius: 1,
        overflow: 'hidden',
        position: 'relative',
        isolation: 'isolate'
      }}
    >
      {expandButton}
      <APIProvider apiKey={apiKey} libraries={['places', 'geocoding']} region='PK'>
        <MapPickerBody
          position={position}
          mapId={mapId}
          countryCode={countryCode}
          searchEnabled={searchEnabled}
          onMapClick={onMapClick}
          onPlaceSelect={onPlaceSelect}
          onDragEnd={onDragEnd}
          cameraTarget={cameraTarget}
        />
      </APIProvider>
    </Box>
  )
}

export function LocationPickerScene({
  lat,
  lng,
  onChange,
  height = 280,
  searchEnabled = true,
  expandedTitle = 'Set location'
}: {
  lat: number | null
  lng: number | null
  onChange: (coords: { lat: number; lng: number }) => void
  height?: number | string
  /** Address search on the map (default on for entity location pickers). */
  searchEnabled?: boolean
  expandedTitle?: string
}) {
  const apiKey = useGeoMapApiKey()
  const mapId = useGeoMapId()
  const { geoPlatform } = useGeoFeatures()
  const countryCode = geoPlatform.defaults?.countryCode || 'PK'
  const [expanded, setExpanded] = useState(false)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    lat != null && lng != null ? { lat, lng } : null
  )
  const [placeLabel, setPlaceLabel] = useState<string | null>(null)
  const [cameraTarget, setCameraTarget] = useState<{
    lat: number
    lng: number
    viewport?: google.maps.LatLngBounds
  } | null>(null)

  useEffect(() => {
    if (lat != null && lng != null) setPosition({ lat, lng })
  }, [lat, lng])

  const applyPosition = useCallback(
    (next: { lat: number; lng: number }, label?: string | null) => {
      setPosition(next)
      onChange(next)
      if (label !== undefined) setPlaceLabel(label)
    },
    [onChange]
  )

  const handleClick = useCallback(
    (event: MapMouseEvent) => {
      const next = latLngFromMapClick(event)
      if (!next) return
      applyPosition(next, null)
      setCameraTarget(null)
    },
    [applyPosition]
  )

  const handlePlaceSelect = useCallback(
    (picked: { lat: number; lng: number; label?: string; viewport?: google.maps.LatLngBounds }) => {
      applyPosition({ lat: picked.lat, lng: picked.lng }, picked.label ?? null)
      setCameraTarget({ lat: picked.lat, lng: picked.lng, viewport: picked.viewport })
    },
    [applyPosition]
  )

  const handleDragEnd = useCallback(
    (ev: google.maps.MapMouseEvent) => {
      const next = latLngFromDragEvent(ev)
      if (!next) return
      applyPosition(next, null)
    },
    [applyPosition]
  )

  const expandButton = (
    <Tooltip title='Expand map'>
      <IconButton
        size='small'
        aria-label='Expand map'
        onClick={() => setExpanded(true)}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          bgcolor: 'background.paper',
          boxShadow: 2,
          '&:hover': { bgcolor: 'background.paper' }
        }}
      >
        <i className='tabler-arrows-maximize' />
      </IconButton>
    </Tooltip>
  )

  const mapProps = {
    apiKey,
    mapId,
    countryCode,
    searchEnabled,
    position,
    onMapClick: handleClick,
    onPlaceSelect: handlePlaceSelect,
    onDragEnd: handleDragEnd,
    cameraTarget
  }

  if (!apiKey) {
    return (
      <Box sx={{ height }} className='flex items-center justify-center'>
        <Typography color='text.secondary'>Maps API key not configured.</Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 0.75 }}>
        Search for an address, click the map, or drag the pin to set the location.
      </Typography>
      {!mapId ? (
        <Typography variant='caption' color='warning.main' display='block' sx={{ mb: 0.75 }}>
          Set NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID for the location pin to appear (Google Cloud → Map Management).
        </Typography>
      ) : null}

      {!expanded ? (
        <MapPickerFrame {...mapProps} mapHeight={height} expandButton={expandButton} />
      ) : (
        <Box
          sx={{
            height,
            width: '100%',
            borderRadius: 1,
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Typography variant='body2' color='text.secondary'>
            Map expanded — close the full-screen view when done.
          </Typography>
        </Box>
      )}

      {position ? (
        <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.75 }}>
          {placeLabel ? `${placeLabel} · ` : ''}
          {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
        </Typography>
      ) : null}

      <Dialog
        fullScreen
        open={expanded}
        onClose={() => setExpanded(false)}
        sx={{ zIndex: theme => theme.zIndex.modal + 2 }}
      >
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
          sx={{ px: 2, py: 1.5, borderBottom: theme => `1px solid ${theme.palette.divider}` }}
        >
          <Typography variant='subtitle1' fontWeight={600}>
            {expandedTitle}
          </Typography>
          <Stack direction='row' spacing={1} alignItems='center'>
            <Button variant='contained' size='small' onClick={() => setExpanded(false)}>
              Done
            </Button>
            <IconButton aria-label='Close expanded map' onClick={() => setExpanded(false)} size='small'>
              <i className='tabler-x' />
            </IconButton>
          </Stack>
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0, height: 'calc(100dvh - 57px)' }}>
          <MapPickerFrame {...mapProps} mapHeight='100%' />
        </Box>
      </Dialog>
    </Box>
  )
}
