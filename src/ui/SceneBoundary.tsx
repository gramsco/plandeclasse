import { Component, type ReactNode } from 'react'

type State = { failed: boolean }

/**
 * Keeps a failure of the 3D view (the code is downloaded on first use, and WebGL may be missing) from taking
 * the whole application down: React unmounts everything under an uncaught render or effect error.
 */
export class SceneBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <p className="hint" role="alert">
        La vue 3D n'a pas pu s'ouvrir. Au premier usage, elle demande une connexion pour se télécharger ; elle demande
        aussi que le navigateur autorise WebGL. Le reste de l'application n'est pas touché.
      </p>
    )
  }
}
