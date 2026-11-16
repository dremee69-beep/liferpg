// CAMP (settings): share codes with your partner, back up your save to a
// file, or bring one back in.

import { useState } from 'react'
import { exportFileName, saveToText } from '../storage/save.ts'
import type { SaveData } from '../storage/save.ts'
import type { ShareProblem } from '../game/share.ts'
import { ImportSave } from './ImportSave.tsx'
import { SharePanel } from './SharePanel.tsx'

type Props = {
  save: SaveData
  now: Date
  onImport: (save: SaveData) => void
  onPartnerCode: (text: string) => ShareProblem | null
}

// Builds the backup file in memory. It is a plain text file so that phones
// are happy to share it to WhatsApp or Google Drive.
function makeBackupFile(save: SaveData): File {
  return new File([saveToText(save)], exportFileName(save, new Date()), {
    type: 'text/plain',
  })
}

// Can this device open its "Share" sheet with a file? (Most phones can.)
function canShareFiles(file: File): boolean {
  return (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  )
}

export function Camp({ save, now, onImport, onPartnerCode }: Props) {
  const [message, setMessage] = useState<string | null>(null)
  const shareAvailable = canShareFiles(makeBackupFile(save))

  // Download: the browser saves the file to the device's Downloads folder.
  function handleDownload() {
    const file = makeBackupFile(save)
    const url = URL.createObjectURL(file) // a temporary address for the file
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    // Tidy up the temporary address once the download has started.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage(`Downloaded ${file.name}`)
  }

  // Share: opens the phone's share sheet (WhatsApp, Drive, Files...).
  async function handleShare() {
    const file = makeBackupFile(save)
    try {
      await navigator.share({ files: [file], title: 'LifeRPG save' })
      setMessage(`Shared ${file.name}`)
    } catch (error) {
      // "AbortError" just means the player closed the share sheet.
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage('Sharing did not work here. Try Download instead.')
    }
  }

  return (
    <main className="screen camp">
      <header className="screen-header">
        <h1>Camp</h1>
        <p className="screen-subtitle">Share codes and backups</p>
      </header>

      <SharePanel save={save} now={now} onPartnerCode={onPartnerCode} />

      <section className="panel">
        <h2>Back up your save</h2>
        <p className="panel-text">
          Your progress lives only on this device. Save a backup file once a
          week and keep it in Google Drive or WhatsApp.
        </p>
        <div className="button-column">
          {shareAvailable && (
            <button
              type="button"
              className="button button-strong button-wide"
              onClick={handleShare}
            >
              Share save file
            </button>
          )}
          <button
            type="button"
            className={
              shareAvailable
                ? 'button button-wide'
                : 'button button-strong button-wide'
            }
            onClick={handleDownload}
          >
            Download save file
          </button>
        </div>
        {message !== null && (
          <p className="panel-message" role="status">
            {message}
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Restore from a backup</h2>
        <p className="panel-text">
          Choose a save file you exported earlier, for example after getting a
          new phone.
        </p>
        <ImportSave hasExistingSave onImport={onImport} />
      </section>
    </main>
  )
}
