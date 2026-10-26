import { useState } from 'react'
import { useApp } from '../store'
import { askConfirm, askText } from './ask'
import { NewRoomDialog } from './dialogs'
import { ListNav } from './ListNav'
import { RoomEditor } from './RoomEditor'

export function RoomsView() {
  const { rooms, currentRoomId, selectRoom, renameRoom, duplicateRoom, deleteRoom, plans } = useApp()
  const [dialogOpen, setDialogOpen] = useState(false)
  const room = rooms.find((r) => r.id === currentRoomId)
  const planCount = plans.filter((p) => p.roomId === currentRoomId).length

  return (
    <>
      <div className="toolbar no-print">
        <button onClick={() => setDialogOpen(true)}>+ Nouvelle salle</button>
        {room && (
          <>
            <button
              onClick={async () => {
                const name = await askText('Renommer la salle', 'Nouveau nom', room.name)
                if (name) renameRoom(room.id, name)
              }}
            >
              Renommer
            </button>
            <button onClick={() => duplicateRoom(room.id)}>Dupliquer</button>
            <button
              className="danger"
              onClick={async () => {
                const confirmed = await askConfirm(`Supprimer « ${room.name} » ?`, {
                  message: `${planCount} plan(s) qui l'utilisent seront supprimés.`,
                  confirmLabel: 'Supprimer',
                })
                if (confirmed) deleteRoom(room.id)
              }}
            >
              Supprimer
            </button>
          </>
        )}
      </div>
      <ListNav
        horizontal
        label="Salles"
        currentId={currentRoomId}
        onSelect={selectRoom}
        items={rooms.map((r) => ({ id: r.id, label: r.name }))}
      />
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
