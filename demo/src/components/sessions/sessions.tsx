import { useState, useEffect } from 'react'
import '@/styles/sessions.css'

import { SessionToken, PermissionMap } from '@/types/index.js'
import { TokenEncoder } from '@/index.js'
import { useClientCtx } from '@/demo/context/client.js'
import { PermissionsDropdown } from './permissions.js'

export function Sessions() {
  const client = useClientCtx()

  const [activeSessions, setActiveSessions]   = useState<SessionToken[]>([])
  const [pendingSessions, setPendingSessions] = useState<SessionToken[]>([])
  const [connectString, setConnectString]     = useState('')
  const [error, setError] = useState<string | null>(null)
  const [expandedPermissions, setExpandedPermissions] = useState<Set<string>>(new Set())
  const [editingPermissions, setEditingPermissions] = useState<Record<string, PermissionMap>>({})
  const [newEventKind, setNewEventKind] = useState<Record<string, string>>({})

  // Update sessions when they change
  useEffect(() => {
    const updateSessions = () => {
      setActiveSessions(client.ref?.session?.active   || [])
      setPendingSessions(client.ref?.session?.pending || [])
    }

    // Initial update
    updateSessions()

    // Listen for session changes
    client.ref?.on('activate', updateSessions)
    client.ref?.on('register', updateSessions)
    client.ref?.on('updated', updateSessions)

    return () => {
      client.ref?.off('activate', updateSessions)
      client.ref?.off('register', updateSessions)
      client.ref?.off('updated', updateSessions)
    }
  }, [ client ])

  const handleRevokeSession = (pubkey: string) => {
    client.ref?.session.revoke_session(pubkey)
  }

  const handleActivateSession = async () => {
    try {
      setError(null)
      const token = TokenEncoder.connect.decode(connectString)
      await client.ref?.session.register_session(token)
      setConnectString('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate session')
    }
  }

  const togglePermissionsDropdown = (pubkey: string) => {
    const newExpanded = new Set(expandedPermissions)
    if (newExpanded.has(pubkey)) {
      newExpanded.delete(pubkey)
      // Clear editing state when closing
      const newEditing = { ...editingPermissions }
      delete newEditing[pubkey]
      setEditingPermissions(newEditing)
      // Clear new event kind input
      const newEventKinds = { ...newEventKind }
      delete newEventKinds[pubkey]
      setNewEventKind(newEventKinds)
    } else {
      newExpanded.add(pubkey)
      // Initialize editing state with current permissions
      const session = [...activeSessions, ...pendingSessions].find(s => s.pubkey === pubkey)
      if (session) {
        setEditingPermissions(prev => ({
          ...prev,
          [pubkey]: { ...(session.perms || {}) }
        }))
      }
    }
    setExpandedPermissions(newExpanded)
  }

  const handlePermissionChange = (pubkey: string, permissions: PermissionMap) => {
    setEditingPermissions(prev => ({
      ...prev,
      [pubkey]: permissions
    }))
  }

  const handleEventKindChange = (pubkey: string, eventKind: string) => {
    setNewEventKind(prev => ({ ...prev, [pubkey]: eventKind }))
  }

  const handleUpdateSession = async (pubkey: string) => {
    try {
      const session = [...activeSessions, ...pendingSessions].find(s => s.pubkey === pubkey)
      if (!session) return

      const updatedSession = {
        ...session,
        perms: editingPermissions[pubkey] || {}
      }

      await client.ref?.session.update_session(updatedSession)
      
      // Close the dropdown after successful update
      const newExpanded = new Set(expandedPermissions)
      newExpanded.delete(pubkey)
      setExpandedPermissions(newExpanded)
      
      // Clear editing state
      const newEditing = { ...editingPermissions }
      delete newEditing[pubkey]
      setEditingPermissions(newEditing)
      
      // Clear new event kind input
      const newEventKinds = { ...newEventKind }
      delete newEventKinds[pubkey]
      setNewEventKind(newEventKinds)
    } catch (err) {
      console.error('Failed to update session:', err)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Combine active and pending sessions
  const allSessions = [
    ...activeSessions.map(s => ({ ...s, status: 'active' as const })),
    ...pendingSessions.map(s => ({ ...s, status: 'pending' as const }))
  ]

  return (
    <div className="sessions-container">
      <h2 className="section-header">Client Sessions</h2>

      {/* Combined Active and Pending Sessions */}
      <div className="sessions-section">
        {allSessions.length === 0 ? (
          <p className="session-empty">No sessions</p>
        ) : (
          <div className="sessions-list">
            {allSessions.map((session) => {
              const truncatedPubkey = session.pubkey.slice(0, 12) + '...' + session.pubkey.slice(-12)
              
              return (
                <div key={session.pubkey} className="session-card">
                  {/* Header with session info and actions */}
                  <div className="session-header">
                    <div className="session-info">
                      <span className="session-name">{session.name ?? 'unknown'}</span>
                      <div className="session-pubkey-container">
                        <span className="session-pubkey">{truncatedPubkey}</span>
                        <button
                          onClick={() => copyToClipboard(session.pubkey)}
                          className="copy-pubkey-btn"
                          title="Copy full public key"
                        >
                          📋
                        </button>
                      </div>
                      <span className="session-created">Created: {new Date(session.created_at * 1000).toLocaleString()}</span>
                    </div>
                    
                    <div className="session-card-actions">
                      <span className={`session-badge ${session.status}`}>{session.status}</span>
                      {session.status === 'active' && (
                        <button
                          onClick={() => handleRevokeSession(session.pubkey)}
                          className="session-revoke-btn"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Permissions Toggle */}
                  <div className="session-permissions-toggle">
                    <button
                      onClick={() => togglePermissionsDropdown(session.pubkey)}
                      className="session-permissions-btn"
                    >
                      {expandedPermissions.has(session.pubkey) ? 'Hide' : 'Show'} Permissions
                    </button>
                  </div>
                  
                  {/* Permissions Dropdown */}
                  {expandedPermissions.has(session.pubkey) && (
                    <PermissionsDropdown
                      session={session}
                      editingPermissions={editingPermissions[session.pubkey] || session.perms || {}}
                      newEventKind={newEventKind[session.pubkey] || ''}
                      onPermissionChange={(permissions) => handlePermissionChange(session.pubkey, permissions)}
                      onEventKindChange={(eventKind) => handleEventKindChange(session.pubkey, eventKind)}
                      onUpdateSession={() => handleUpdateSession(session.pubkey)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Register Session */}
      <div className="sessions-section">
        <div className="session-card-row">
          <input
            type="text"
            value={connectString}
            onChange={(e) => setConnectString(e.target.value)}
            placeholder="Paste nostrconnect:// string here"
            className="session-input"
          />
          <button
            onClick={handleActivateSession}
            className="session-btn-primary"
          >
            Connect
          </button>
        </div>
        {error && <p className="session-error">{error}</p>}
      </div>
    </div>
  )
} 