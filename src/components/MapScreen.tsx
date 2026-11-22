// THE MAP: India with its terrain, state outlines, and your pins.
//
//   - Tap a state (or pick it from the list) to zoom in on it.
//   - "Add a pin" takes two taps: one roughly where the place is, then, once
//     the map has zoomed in close, one on the exact spot. The app works out
//     the state, the height and the terrain type from that spot.
//
// Town names are drawn on the map to help find a place. How many show
// depends on how far the map is zoomed in (see src/game/towns.ts).
//
// The map is an SVG: a picture made of shapes. Its "viewBox" says which part
// of the map's grid is on screen, so zooming is just changing the viewBox.

import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { dateFromDayKey, dayKey } from '../game/dates.ts'
import {
  describeHeight,
  gridToLonLat,
  isMountainHeight,
  lonLatToGrid,
  stateAt,
  terrainFor,
  terrainName,
} from '../game/geo.ts'
import type { GridPoint, PlaceState, TerrainId } from '../game/geo.ts'
import { canAddPin, pinsNewestFirst } from '../game/pins.ts'
import type { PinInput } from '../game/pins.ts'
import { MAX_PIN_NAME_LENGTH } from '../game/rules.ts'
import { townLabelSize, townLabelsFor } from '../game/towns.ts'
import type { MapView } from '../game/towns.ts'
import { loadHeights } from '../map/heights.ts'
import type { Heights } from '../map/heights.ts'
import { INDIA_MAP } from '../map/india.ts'
import { INDIA_TOWNS } from '../map/towns.ts'
import type { Pin, SaveData } from '../storage/save.ts'
import { ConfirmButton } from './ConfirmButton.tsx'
import { MapDecorations } from './MapDecorations.tsx'

type Props = {
  save: SaveData
  now: Date
  onAddPin: (input: PinInput) => void
  onUpdatePin: (
    pinId: string,
    changes: { name: string; date: string; bucketList: boolean },
  ) => void
  onRemovePin: (pinId: string) => void
}

// The terrain picture lives in the public folder. BASE_URL is the app's
// address on the web ("/liferpg/"), so the link works there and on the laptop.
const RELIEF_URL = `${import.meta.env.BASE_URL}map/india-relief.png`

const MAP_SHAPE = INDIA_MAP.width / INDIA_MAP.height

// How much room to leave around a state when zoomed in, as a share of its size.
const ZOOM_MARGIN = 0.25
// Never zoom a state view closer than this many grid units wide.
const SMALLEST_VIEW = 120
// How wide the close-up views are, in grid units. One unit is about 2.4 km,
// so placing a pin happens on a view about 140 km across.
const PLACING_WIDTH = 60
const SHOWING_WIDTH = 200

// A view of the given width centred on a point, in the map's own shape.
function viewAround([x, y]: GridPoint, width: number): MapView {
  const height = width / MAP_SHAPE
  return { left: x - width / 2, top: y - height / 2, width, height }
}

// The part of the map to show for one state: its box plus a margin.
function viewForState(box: readonly [number, number, number, number]): MapView {
  const [left, top, width, height] = box
  let viewWidth = Math.max(width * (1 + ZOOM_MARGIN * 2), SMALLEST_VIEW)
  const viewHeight = Math.max(height * (1 + ZOOM_MARGIN * 2), SMALLEST_VIEW / MAP_SHAPE)
  // Widen the view if the state is taller than the map's shape allows.
  viewWidth = Math.max(viewWidth, viewHeight * MAP_SHAPE)
  return viewAround([left + width / 2, top + height / 2], viewWidth)
}

const WHOLE_MAP: MapView = {
  left: 0,
  top: 0,
  width: INDIA_MAP.width,
  height: INDIA_MAP.height,
}

// Where a tap landed, on the map's grid. The browser knows how the SVG's
// grid is stretched onto the screen; we ask it to run that backwards.
function gridPointOf(event: MouseEvent<SVGSVGElement>): GridPoint | null {
  const stretch = event.currentTarget.getScreenCTM()
  if (stretch === null) return null
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
    stretch.inverse(),
  )
  return [point.x, point.y]
}

// "7 Nov 2026"
function describeDate(date: string): string {
  return dateFromDayKey(date).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// What the app worked out about the spot being pinned.
type Spot = {
  point: GridPoint
  state: PlaceState
  metres: number // the height the map read at this spot
  nearSea: boolean
}

// The highest a typed height may be (a little above the highest peak).
const HIGHEST_METRES = 9000

// Where the "Add a pin" steps have got to.
//   'view'   just looking at the map;
//   'rough'  waiting for the first, rough tap;
//   'exact'  zoomed in close, waiting for (or adjusting) the exact tap.
type Mode = 'view' | 'rough' | 'exact'

export function MapScreen({ save, now, onAddPin, onUpdatePin, onRemovePin }: Props) {
  // The id of the state that is zoomed in on, or null for all of India.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // A close-up view, when there is one: where it is centred and how wide.
  const [closeUp, setCloseUp] = useState<{ centre: GridPoint; width: number } | null>(
    null,
  )
  const [mode, setMode] = useState<Mode>('view')
  const [heights, setHeights] = useState<Heights | null>(null)
  const [spot, setSpot] = useState<Spot | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // The little form for a pin's name, date and bucket-list tick. It is used
  // for a new pin (editingId is null) and for editing one.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [date, setDate] = useState(dayKey(now))
  const [bucketList, setBucketList] = useState(false)
  // The height shown for the spot being pinned, as typed text. It starts as
  // what the map read, and the player can correct it.
  const [heightText, setHeightText] = useState('')

  const selected = INDIA_MAP.states.find((state) => state.id === selectedId)
  const pins = pinsNewestFirst(save)
  const today = dayKey(now)

  // The part of the map on screen.
  const view = closeUp
    ? viewAround(closeUp.centre, closeUp.width)
    : selected
      ? viewForState(selected.box)
      : WHOLE_MAP
  const viewBox = `${view.left} ${view.top} ${view.width} ${view.height}`

  // The town names that fit on this view. Worked out again only when the
  // view changes ("useMemo" remembers the answer in between).
  const townLabels = useMemo(
    () =>
      townLabelsFor(INDIA_TOWNS, {
        left: view.left,
        top: view.top,
        width: view.width,
        height: view.height,
      }),
    [view.left, view.top, view.width, view.height],
  )
  const townSize = townLabelSize(view)

  // Back to plain looking: no pin being added, nothing being edited.
  function stopAdding() {
    setMode('view')
    setSpot(null)
    setCloseUp(null)
    setMessage(null)
  }

  // "Add a pin": fetch the height data (the first time), then wait for a tap.
  async function startAdding() {
    setEditingId(null)
    setSpot(null)
    setMessage(null)
    setName('')
    setDate(today)
    setBucketList(false)
    try {
      setHeights(await loadHeights())
      setCloseUp(null)
      setMode('rough')
    } catch {
      setMessage('The height data could not be loaded. Check your internet and try again.')
    }
  }

  function handleMapTap(event: MouseEvent<SVGSVGElement>) {
    const point = gridPointOf(event)
    if (point === null) return

    if (mode === 'view') {
      // Looking around: a tap on a state zooms to it (or back out of it).
      const state = stateAt(point)
      setCloseUp(null)
      setSelectedId(state === null || state.id === selectedId ? null : state.id)
      return
    }

    if (mode === 'rough') {
      // First tap of a new pin: zoom in close around it.
      setCloseUp({ centre: point, width: PLACING_WIDTH })
      setMode('exact')
      return
    }

    // Second tap (or a later one, to adjust): this is the spot.
    const state = stateAt(point)
    if (state === null || heights === null) {
      setSpot(null)
      setMessage(
        'That spot is outside India. Pins for trips abroad come with the world map.',
      )
      return
    }
    const { metres, nearSea } = heights.at(point)
    setMessage(null)
    setHeightText(String(Math.round(metres / 10) * 10))
    setSpot({ point, state, metres, nearSea })
  }

  function handleSaveNewPin() {
    if (spot === null) return
    const { lon, lat } = gridToLonLat(spot.point)
    onAddPin({
      name,
      date,
      bucketList,
      lon,
      lat,
      stateId: spot.state.id,
      stateName: spot.state.name,
      metres: spotMetres,
      terrain: spotTerrain,
    })
    // Stay zoomed where the new pin is, a little further out.
    setCloseUp({ centre: spot.point, width: SHOWING_WIDTH })
    setMode('view')
    setSpot(null)
  }

  function startEditing(pin: Pin) {
    stopAdding()
    setEditingId(pin.id)
    setName(pin.name)
    setDate(pin.date)
    setBucketList(pin.bucketList)
  }

  const formIsValid = name.trim() !== '' && date !== '' && date <= today

  // The height for the spot being pinned: what was typed, if it is a
  // sensible number; otherwise what the map read.
  const typedMetres = Number(heightText)
  const heightIsValid =
    heightText.trim() !== '' &&
    Number.isFinite(typedMetres) &&
    typedMetres >= 0 &&
    typedMetres <= HIGHEST_METRES
  const spotMetres = heightIsValid ? typedMetres : (spot?.metres ?? 0)
  const spotTerrain: TerrainId =
    spot === null
      ? 'plains'
      : terrainFor({ metres: spotMetres, nearSea: spot.nearSea, stateId: spot.state.id })

  // The three fields shared by "new pin" and "edit pin".
  const pinFields = (
    <>
      <label className="field">
        <span className="field-label">Name of the place</span>
        <input
          className="edit-input"
          type="text"
          value={name}
          maxLength={MAX_PIN_NAME_LENGTH}
          placeholder="Where did you go?"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">When you went</span>
        <input
          className="edit-input"
          type="date"
          value={date}
          max={today}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={bucketList}
          onChange={(event) => setBucketList(event.target.checked)}
        />
        It was on our bucket list
      </label>
    </>
  )

  let subtitle = selected ? selected.name : 'India: tap a state to zoom in'
  if (mode === 'rough') subtitle = 'Tap roughly where the place is'
  if (mode === 'exact') subtitle = 'Now tap the exact spot'

  return (
    <main className="screen map-screen">
      <header className="screen-header">
        <h1>Map</h1>
        <p className="screen-subtitle">{subtitle}</p>
      </header>

      <section className="panel map-panel">
        <svg
          className={mode === 'view' ? 'map' : 'map map-placing'}
          viewBox={viewBox}
          role="img"
          aria-label={
            selected ? `Terrain map zoomed in on ${selected.name}` : 'Terrain map of India'
          }
          onClick={handleMapTap}
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

          {/* One shape per state. */}
          {INDIA_MAP.states.map((state) => (
            <path
              key={state.id}
              d={state.path}
              className={
                'map-state' +
                (state.noLine ? ' map-state-no-line' : '') +
                (state.id === selectedId && closeUp === null
                  ? ' map-state-selected'
                  : '')
              }
            />
          ))}

          {/* India's outline, on top of the states. */}
          <path d={INDIA_MAP.outline} className="map-outline" />

          {/* Trees, mountains, landmarks, clouds, waves, boats and birds. */}
          <MapDecorations view={view} />

          {/* The town names: a small dot with the name beside it. They are
              sized from the view, so they look the same at every zoom. */}
          <g className="map-towns" fontSize={townSize}>
            {townLabels.map((town) => (
              <g key={`${town.name} ${town.x} ${town.y}`}>
                <path d={`M${town.x} ${town.y}h0.01`} className="map-town-dot" />
                <text
                  className="map-town-name"
                  x={town.textX}
                  y={town.textY}
                  strokeWidth={townSize * 0.28}
                >
                  {town.name}
                </text>
              </g>
            ))}
          </g>

          {/* The pins. Each is a "line" of no length with a thick round
              end, which the browser draws as a dot that stays the same size
              however far the map is zoomed. Two dots make an outlined one. */}
          {save.pins.map((pin) => {
            const [x, y] = lonLatToGrid(pin.lon, pin.lat)
            const dot = `M${x} ${y}h0.01`
            return (
              <g key={pin.id}>
                <path d={dot} className="map-pin-edge" />
                <path d={dot} className="map-pin" />
              </g>
            )
          })}

          {/* The spot being pinned right now. */}
          {spot !== null && (
            <g>
              <path
                d={`M${spot.point[0]} ${spot.point[1]}h0.01`}
                className="map-pin-edge map-pin-edge-new"
              />
              <path
                d={`M${spot.point[0]} ${spot.point[1]}h0.01`}
                className="map-pin map-pin-new"
              />
            </g>
          )}
        </svg>

        {mode === 'view' ? (
          <div className="map-controls">
            <label className="field map-jump">
              <span className="field-label">Jump to a state</span>
              <select
                className="edit-select"
                value={closeUp === null ? (selectedId ?? '') : ''}
                onChange={(event) => {
                  setCloseUp(null)
                  setSelectedId(event.target.value || null)
                }}
              >
                <option value="">All of India</option>
                {INDIA_MAP.states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </select>
            </label>
            {(selected !== undefined || closeUp !== null) && (
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setCloseUp(null)
                  setSelectedId(null)
                }}
              >
                All of India
              </button>
            )}
          </div>
        ) : (
          <div className="map-controls">
            <p className="panel-message map-step">
              {mode === 'rough'
                ? 'Step 1 of 2: tap roughly where the place is.'
                : spot === null
                  ? 'Step 2 of 2: tap the exact spot.'
                  : 'Tap again to move it, or fill in the details below.'}
            </p>
            <button type="button" className="link-button" onClick={stopAdding}>
              Cancel
            </button>
          </div>
        )}

        {message !== null && (
          <p className="import-error" role="status">
            {message}
          </p>
        )}

        {/* ----- The details of the spot being pinned ----- */}
        {spot !== null && (
          <form
            className="challenge-form"
            data-realm="together"
            onSubmit={(event) => {
              event.preventDefault() // stop the browser reloading the page
              if (formIsValid && heightIsValid) handleSaveNewPin()
            }}
          >
            <p className="pin-facts">
              <strong>{spot.state.name}</strong>
              <span>
                {describeHeight(spotMetres)} · {terrainName(spotTerrain)}
              </span>
              {isMountainHeight(spotMetres) && (
                <span className="points-chip">Mountain destination</span>
              )}
            </p>
            {pinFields}
            <label className="field">
              <span className="field-label">Height in metres</span>
              <input
                className="edit-input"
                type="number"
                inputMode="numeric"
                min={0}
                max={HIGHEST_METRES}
                step={10}
                value={heightText}
                onChange={(event) => setHeightText(event.target.value)}
              />
              <span className="challenge-hint">
                The map read {describeHeight(spot.metres)} here. It can be a
                few hundred metres off in steep hills, so change it if you
                know the real height.
              </span>
            </label>
            <button
              type="submit"
              className="button button-strong button-wide"
              disabled={!formIsValid || !heightIsValid}
            >
              Save pin
            </button>
          </form>
        )}

        {mode === 'view' && (
          <button
            type="button"
            className="button button-strong button-wide"
            disabled={!canAddPin(save)}
            onClick={startAdding}
          >
            + Add a pin
          </button>
        )}
      </section>

      {/* ----- The list of pins ----- */}
      <section className="panel" data-realm="together">
        <h2>Your pins{pins.length > 0 ? ` (${pins.length})` : ''}</h2>
        {pins.length === 0 ? (
          <p className="panel-text">
            No pins yet. Add one for each place the two of you have visited
            together; the app works out its state, height and terrain.
          </p>
        ) : (
          <ul className="activity-list">
            {pins.map((pin) =>
              editingId === pin.id ? (
                <li key={pin.id}>
                  <form
                    className="challenge-form"
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (!formIsValid) return
                      onUpdatePin(pin.id, { name, date, bucketList })
                      setEditingId(null)
                    }}
                  >
                    {pinFields}
                    <div className="button-row">
                      <button
                        type="button"
                        className="button"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="button button-strong"
                        disabled={!formIsValid}
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={pin.id} className="pin-item">
                  <div className="activity-text">
                    <span className="activity-what">{pin.name}</span>
                    <span className="activity-meta">
                      {pin.stateName} · {describeHeight(pin.metres)} ·{' '}
                      {terrainName(pin.terrain)}
                    </span>
                    <span className="activity-meta">{describeDate(pin.date)}</span>
                    {(isMountainHeight(pin.metres) || pin.bucketList) && (
                      <span className="pin-chips">
                        {isMountainHeight(pin.metres) && (
                          <span className="points-chip">Mountain</span>
                        )}
                        {pin.bucketList && (
                          <span className="points-chip">Bucket list</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="pin-buttons">
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        stopAdding()
                        setCloseUp({
                          centre: lonLatToGrid(pin.lon, pin.lat),
                          width: SHOWING_WIDTH,
                        })
                        window.scrollTo(0, 0)
                      }}
                    >
                      Show
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => startEditing(pin)}
                    >
                      Edit
                    </button>
                    <ConfirmButton label="Remove" onConfirm={() => onRemovePin(pin.id)} />
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
        <p className="challenge-hint">
          Pins stay on this phone for now. Sharing them with your partner
          comes in the next update.
        </p>
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
        <p className="challenge-hint">
          Heights are approximate: one reading about every 2.4 km. Map shapes:
          Natural Earth. Heights: US Geological Survey and NOAA. Town names:
          GeoNames (CC BY 4.0).
        </p>
      </section>
    </main>
  )
}
