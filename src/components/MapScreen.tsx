// THE MAP: India with its terrain and state outlines.
// Tap a state (or pick it from the list) to zoom in on it; tap "All of
// India" to zoom back out. Pins come in a later update.
//
// The map is an SVG: a picture made of shapes. Its "viewBox" says which part
// of the map's grid is on screen, so zooming is just changing the viewBox.

import { useState } from 'react'
import { INDIA_MAP } from '../map/india.ts'
import type { MapState } from '../map/india.ts'

// The terrain picture lives in the public folder. BASE_URL is the app's
// address on the web ("/liferpg/"), so the link works there and on the laptop.
const RELIEF_URL = `${import.meta.env.BASE_URL}map/india-relief.png`

// How much room to leave around a state when zoomed in, as a share of its size.
const ZOOM_MARGIN = 0.25
// Never zoom in closer than this many grid units wide, so that a tiny
// territory still shows some of its surroundings.
const SMALLEST_VIEW = 120

// The part of the map to show for one state: its box plus a margin, kept to
// the same shape as the whole map so the picture never stretches.
function viewFor(state: MapState): string {
  const [left, top, width, height] = state.box
  const mapShape = INDIA_MAP.width / INDIA_MAP.height

  let viewWidth = Math.max(width * (1 + ZOOM_MARGIN * 2), SMALLEST_VIEW)
  let viewHeight = Math.max(height * (1 + ZOOM_MARGIN * 2), SMALLEST_VIEW / mapShape)
  // Widen or heighten the view until it has the map's own shape.
  if (viewWidth / viewHeight > mapShape) viewHeight = viewWidth / mapShape
  else viewWidth = viewHeight * mapShape

  const centreX = left + width / 2
  const centreY = top + height / 2
  return `${centreX - viewWidth / 2} ${centreY - viewHeight / 2} ${viewWidth} ${viewHeight}`
}

const WHOLE_MAP = `0 0 ${INDIA_MAP.width} ${INDIA_MAP.height}`

export function MapScreen() {
  // The id of the state that is zoomed in on, or null for all of India.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = INDIA_MAP.states.find((state) => state.id === selectedId)

  return (
    <main className="screen map-screen">
      <header className="screen-header">
        <h1>Map</h1>
        <p className="screen-subtitle">
          {selected ? selected.name : 'India: tap a state to zoom in'}
        </p>
      </header>

      <section className="panel map-panel">
        <svg
          className="map"
          viewBox={selected ? viewFor(selected) : WHOLE_MAP}
          role="img"
          aria-label={
            selected
              ? `Terrain map zoomed in on ${selected.name}`
              : 'Terrain map of India'
          }
        >
          {/* The terrain picture, stretched over the whole grid. */}
          <image
            href={RELIEF_URL}
            x={0}
            y={0}
            width={INDIA_MAP.width}
            height={INDIA_MAP.height}
            preserveAspectRatio="none"
          />

          {/* One shape per state. They are see-through but can be tapped. */}
          {INDIA_MAP.states.map((state) => (
            <path
              key={state.id}
              d={state.path}
              className={
                'map-state' +
                (state.noLine ? ' map-state-no-line' : '') +
                (state.id === selectedId ? ' map-state-selected' : '')
              }
              onClick={() =>
                setSelectedId(state.id === selectedId ? null : state.id)
              }
            />
          ))}

          {/* India's outline, drawn last so it sits on top. */}
          <path d={INDIA_MAP.outline} className="map-outline" />
        </svg>

        <div className="map-controls">
          <label className="field map-jump">
            <span className="field-label">Jump to a state</span>
            <select
              className="edit-select"
              value={selectedId ?? ''}
              onChange={(event) => setSelectedId(event.target.value || null)}
            >
              <option value="">All of India</option>
              {INDIA_MAP.states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <button
              type="button"
              className="link-button"
              onClick={() => setSelectedId(null)}
            >
              All of India
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Height above the sea</h2>
        <ul className="map-key">
          {INDIA_MAP.key.map((band) => (
            <li key={band.label} className="map-key-item">
              <span
                className="map-key-colour"
                style={{ background: band.colour }}
                aria-hidden="true"
              />
              {band.label}
            </li>
          ))}
        </ul>
        <p className="panel-text">
          Pins for the places you visit together come in the next update.
        </p>
        <p className="challenge-hint">
          Map shapes: Natural Earth. Heights: US Geological Survey and NOAA.
        </p>
      </section>
    </main>
  )
}
