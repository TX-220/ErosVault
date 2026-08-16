import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { ScheduleTable } from '../components/ScheduleTable'
import { ScheduleModal } from '../components/ScheduleModal'
import { useBackupStore } from '../lib/store'
import type { ScheduleRecord } from '../lib/types'

export default function SchedulesPage() {
  const { schedules, loadSchedules, toggleSchedule, deleteSchedule } = useBackupStore()
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRecord | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  function handleToggle(id: string, enabled: boolean) {
    toggleSchedule(id, enabled)
  }

  function handleDelete(id: string) {
    setDeleteConfirm(id)
  }

  async function confirmDelete() {
    if (deleteConfirm) {
      await deleteSchedule(deleteConfirm)
      setDeleteConfirm(null)
    }
  }

  function handleSaved(updated: ScheduleRecord) {
    useBackupStore.setState((state) => ({
      schedules: state.schedules.map((s) => (s.id === updated.id ? updated : s)),
    }))
    setEditingSchedule(null)
  }

  return (
    <Layout>
      <div className="ev-panel">
        <div className="px-6 py-4 border-b border-nebula-600/20 flex items-center justify-between">
          <div>
            <h2 className="ev-title text-lg">Schedules</h2>
            <p className="text-sm ev-muted mt-0.5">
              Automated backup schedules (P0 + custom)
            </p>
          </div>
          <button
            onClick={() => loadSchedules()}
            className="p-2 rounded-lg text-nebula-400 hover:text-rose-soft hover:bg-void-700/60 transition"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4">
          <ScheduleTable
            schedules={schedules}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onEdit={setEditingSchedule}
          />
        </div>
      </div>

      {editingSchedule && (
        <ScheduleModal
          schedule={editingSchedule}
          onClose={() => setEditingSchedule(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="ev-panel max-w-sm mx-4 p-6 space-y-4 shadow-glow">
            <h3 className="ev-title text-lg">Delete Schedule</h3>
            <p className="text-sm text-nebula-300">
              Are you sure you want to delete this schedule? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="ev-btn-secondary">
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600/90 text-white hover:bg-red-500 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
