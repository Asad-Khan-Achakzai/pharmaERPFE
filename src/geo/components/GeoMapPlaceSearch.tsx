'use client'

import { useEffect, useRef, useState } from 'react'
import { ControlPosition, MapControl, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'

type PlacePick = {
  lat: number
  lng: number
  label?: string
  viewport?: google.maps.LatLngBounds
}

type Props = {
  countryCode?: string
  onPlaceSelect: (pick: PlacePick) => void
}

/** Pan/zoom map when a place is picked from search. */
export function GeoMapPlaceCamera({ target }: { target: PlacePick | null }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !target) return
    if (target.viewport) {
      map.fitBounds(target.viewport)
    } else {
      map.setCenter({ lat: target.lat, lng: target.lng })
      map.setZoom(16)
    }
  }, [map, target])

  return null
}

export function GeoMapPlaceSearch({ countryCode = 'pk', onPlaceSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const places = useMapsLibrary('places')
  const geocoding = useMapsLibrary('geocoding')
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = '.pac-container { z-index: 1500 !important; }'
    document.head.appendChild(style)
    return () => {
      style.remove()
    }
  }, [])

  useEffect(() => {
    if (!places || !inputRef.current) return

    const country = countryCode.trim().toLowerCase()
    const ac = new places.Autocomplete(inputRef.current, {
      fields: ['geometry', 'name', 'formatted_address'],
      ...(country ? { componentRestrictions: { country } } : {})
    })
    setAutocomplete(ac)

    return () => {
      google.maps.event.clearInstanceListeners(ac)
    }
  }, [places, countryCode])

  useEffect(() => {
    if (!autocomplete) return

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      const loc = place.geometry?.location
      if (!loc) return
      onPlaceSelect({
        lat: loc.lat(),
        lng: loc.lng(),
        label: place.formatted_address || place.name || undefined,
        viewport: place.geometry?.viewport
      })
    })

    return () => {
      google.maps.event.removeListener(listener)
    }
  }, [autocomplete, onPlaceSelect])

  const runGeocodeFallback = () => {
    const query = inputRef.current?.value?.trim()
    if (!query || !geocoding) return
    setSearching(true)
    const geocoder = new geocoding.Geocoder()
    geocoder.geocode({ address: query }, (results, status) => {
      setSearching(false)
      if (status !== 'OK' || !results?.[0]?.geometry?.location) return
      const loc = results[0].geometry.location
      onPlaceSelect({
        lat: loc.lat(),
        lng: loc.lng(),
        label: results[0].formatted_address
      })
    })
  }

  return (
    <MapControl position={ControlPosition.TOP_CENTER}>
      <Box
        sx={{
          mt: 1,
          width: { xs: 280, sm: 360 },
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.5,
          bgcolor: 'background.paper',
          borderRadius: 1,
          boxShadow: 3,
          border: theme => `1px solid ${theme.palette.divider}`
        }}
      >
        <Box
          component='input'
          ref={inputRef}
          placeholder='Search address or place…'
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              runGeocodeFallback()
            }
          }}
          sx={{
            flex: 1,
            border: 'none',
            outline: 'none',
            bgcolor: 'transparent',
            font: 'inherit',
            fontSize: '0.875rem',
            py: 0.75,
            px: 0.5,
            minWidth: 0
          }}
        />
        <IconButton
          size='small'
          aria-label='Search location'
          onClick={runGeocodeFallback}
          disabled={searching || !geocoding}
        >
          {searching ? <CircularProgress size={18} /> : <i className='tabler-search' />}
        </IconButton>
      </Box>
    </MapControl>
  )
}
