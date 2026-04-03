import { useState, useEffect, useCallback } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enCA } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { X, Trash2, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import Toast from '../components/Toast.jsx';

const locales = { 'en-CA': enCA };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const EVENT_TYPE_COLORS = {
  job:       { bg: '#0F172A', text: 'white' },
  follow_up: { bg: '#F97316', text: 'white' },
  other:     { bg: '#6b7280', text: 'white' }
};

function eventStyleGetter(event) {
  const colors = EVENT_TYPE_COLORS[event.resource?.event_type] || EVENT_TYPE_COLORS.other;
  return { style: { backgroundColor: colors.bg, color: colors.text, borderRadius: '6px', border: 'none', fontSize: '12px', padding: '2px 6px' } };
}

// ── Slide-over event editor ──────────────────────────────────────────
function EventSlideOver({ event, customers, onSave, onDelete, onClose }) {
  const isNew = !event.id;
  const [form, setForm] = useState({
    title: event.title || '',
    start_time: event.start ? event.start.toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    end_time: event.end ? event.end.toISOString().slice(0, 16) : new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    event_type: event.resource?.event_type || 'job',
    customer_id: event.resource?.customer_id || '',
    notes: event.resource?.notes || ''
  });
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave({ ...form, customer_id: form.customer_id || null }, event.id);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-96 bg-white h-full shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isNew ? 'New Event' : 'Edit Event'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={form.title} onChange={set('title')} placeholder="Job site visit..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={form.event_type} onChange={set('event_type')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]">
              <option value="job">Job</option>
              <option value="follow_up">Follow-up</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
              <input type="datetime-local" value={form.start_time} onChange={set('start_time')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
              <input type="datetime-local" value={form.end_time} onChange={set('end_time')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <select value={form.customer_id} onChange={set('customer_id')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]">
              <option value="">— No customer —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Additional notes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
          {!isNew && (
            <button onClick={() => onDelete(event.id)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          <button onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !form.title.trim()}
            className="flex-1 bg-[#F97316] text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Calendar page ────────────────────────────────────────────────────
export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slideOver, setSlideOver] = useState(null); // null | { event object }
  const [toast, setToast] = useState(null);
  const [view, setView] = useState('month');
  const [date, setDate] = useState(new Date());

  const load = useCallback(() => {
    Promise.all([
      apiFetch('/api/calendar').then(r => r.json()),
      apiFetch('/api/customers').then(r => r.json())
    ]).then(([evts, custs]) => {
      const mapped = (Array.isArray(evts) ? evts : []).map(e => ({
        id: e.id,
        title: e.title,
        start: new Date(e.start_time),
        end: new Date(e.end_time),
        resource: e
      }));
      setEvents(mapped);
      setCustomers(Array.isArray(custs) ? custs : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSelectSlot = useCallback(({ start, end }) => {
    setSlideOver({
      title: '',
      start,
      end,
      resource: { event_type: 'job', customer_id: '', notes: '' }
    });
  }, []);

  const handleSelectEvent = useCallback((event) => {
    setSlideOver(event);
  }, []);

  const handleSave = async (form, existingId) => {
    try {
      const url = existingId ? `/api/calendar/${existingId}` : '/api/calendar';
      const method = existingId ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          start_time: form.start_time,
          end_time: form.end_time,
          event_type: form.event_type,
          customer_id: form.customer_id || null,
          notes: form.notes || null
        })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSlideOver(null);
      load();
      setToast({ message: existingId ? 'Event updated' : 'Event created', type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiFetch(`/api/calendar/${id}`, { method: 'DELETE' });
      setSlideOver(null);
      load();
      setToast({ message: 'Event deleted', type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-500 mt-1">Schedule jobs, follow-ups, and appointments</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4" style={{ height: 650 }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
          </div>
        ) : (
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            style={{ height: '100%' }}
          />
        )}
      </div>

      {slideOver && (
        <EventSlideOver
          event={slideOver}
          customers={customers}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setSlideOver(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
