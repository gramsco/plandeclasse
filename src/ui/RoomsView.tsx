import { useState } from 'react'
import { useApp } from '../store'
import { NewRoomDialog } from './dialogs'
import { RoomEditor } from './RoomEditor'

export function RoomsView() {
  const { rooms, currentRoomId, selectRoom, renameRoom, duplicateRoom, deleteRoom, plans } = useApp()
  const [dialogOpen, setDialogOpen] = useState(false)
  const room = rooms.find((r) => r.id === currentRoomId)
  const planCount = plans.filter((p) => p.roomId === currentRoomId).length

  return (
    <>
      <div className="toolbar no-print">
        <select value={currentRoomId ?? ''} onChange={(e) => selectRoom(e.target.value)} disabled={!rooms.length}>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button onClick={() => setDialogOpen(true)}>+ Nouvelle salle</button>
        {room && (
          <>
            <button
              onClick={() => {
                const name = prompt('Nouveau nom ?', room.name)?.trim()
                if (name) renameRoom(room.id, name)
              }}
            >
              Renommer
            </button>
            <button onClick={() => duplicateRoom(room.id)}>Dupliquer</button>
            <button
              className="danger"
              onClick={() =>
                confirm(`Supprimer « ${room.name} » et ${planCount} plan(s) qui l'utilisent ?`) && deleteRoom(room.id)
              }
            >
              Supprimer
            </button>
          </>
        )}
      </div>
      <main className="wide">
        {room ? (
          <RoomEditor key={room.id} room={room} />
        ) : (
          <p className="empty">Aucune salle. Créez-en une à partir d'un modèle.</p>
        )}
      </main>
      {dialogOpen && <NewRoomDialog onClose={() => setDialogOpen(false)} />}
    </>
  )
}
