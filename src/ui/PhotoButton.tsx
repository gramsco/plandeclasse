import { useRef } from 'react'
import { fullName, type Student } from '../model/types'
import { resizePhoto } from '../storage/photo'
import { useApp } from '../store'
import { NeutralAvatar } from './NeutralAvatar'

/** The photo of a person: a click opens the file picker (a photo can also be dropped on it). */
export function PhotoButton({ student, url }: { student: Student; url?: string }) {
  const setPhoto = useApp((s) => s.setPhoto)
  const input = useRef<HTMLInputElement>(null)
  const receive = async (file?: File) => {
    if (file?.type.startsWith('image/')) await setPhoto(student.id, await resizePhoto(file))
  }
  return (
    <>
      <button
        type="button"
        className="mini-avatar table-avatar photo-button"
        aria-label={`Choisir une photo pour ${fullName(student) || 'cette personne'}`}
        title="Choisir une photo (ou glisser un fichier)"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          void receive(e.dataTransfer.files[0])
        }}
      >
        {url ? <img src={url} alt="" /> : <NeutralAvatar />}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void receive(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </>
  )
}
