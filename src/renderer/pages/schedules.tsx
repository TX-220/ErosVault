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
  }, [])

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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Schedules</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Manage automated backup schedules
            </p>
          </div>
          <button
            onClick={() => loadSchedules()}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
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

      {/* Edit modal */}
      {editingSchedule && (
        <ScheduleModal
          schedule={editingSchedule}
          onClose={() => setEditingSchedule(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Delete Schedule
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to delete this schedule? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition"
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
