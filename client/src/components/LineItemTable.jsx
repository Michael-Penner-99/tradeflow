import { Plus, Trash2, Package } from 'lucide-react';

export const ITEM_TYPES = ['material', 'labor', 'freight', 'mileage', 'shop_supply', 'other'];

const fmt = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

export function calcItem(item) {
  const qty = parseFloat(item.quantity) || 0;
  const cost = parseFloat(item.unit_cost) || 0;
  const markup = parseFloat(item.markup_percent) || 0;
  const unitPrice = item.type === 'labor' ? cost : cost * (1 + markup / 100);
  const total = qty * unitPrice;
  return {
    ...item,
    unit_price: Math.round(unitPrice * 10000) / 10000,
    total: Math.round(total * 100) / 100
  };
}

export function makeItem(defaults = {}) {
  return calcItem({
    _id: Date.now() + Math.random(),
    type: 'material',
    description: '',
    sku: '',
    quantity: 1,
    unit_cost: 0,
    markup_percent: defaults.markup || 0,
    unit_price: 0,
    total: 0,
    group_label: defaults.group_label || null,
    ...defaults._overrides
  });
}

// Shared grid template — header and every row use the exact same columns
export const ROW_GRID = 'grid items-center gap-x-1.5 px-4';
export const ROW_COLS = 'grid-cols-[95px_82px_1fr_50px_72px_52px_72px_76px_28px]';
export const INP = 'w-full border border-gray-200 rounded px-1.5 py-[5px] text-xs focus:outline-none focus:ring-1 focus:ring-[#F97316] bg-white';

// ── Column header ────────────────────────────────────────────────────
export function LineItemsHeader({ tint = false }) {
  const bg = tint ? 'bg-orange-50/80 border-orange-100 text-orange-400' : 'bg-gray-50 border-gray-200 text-gray-400';
  return (
    <div className={`${ROW_GRID} ${ROW_COLS} py-1.5 border-b ${bg} text-[10px] font-semibold uppercase tracking-wider select-none`}>
      <div>Type</div>
      <div>SKU</div>
      <div>Description</div>
      <div className="text-right">Qty</div>
      <div className="text-right">Cost</div>
      <div className="text-right">Mkup%</div>
      <div className="text-right">Price</div>
      <div className="text-right">Total</div>
      <div />
    </div>
  );
}

// ── Shared line item row ─────────────────────────────────────────────
export function ItemRow({ item, inventory, skuSearch, setSkuSearch, onUpdate, onRemove, onSelectSKU }) {
  const filteredInv = inventory.filter(inv =>
    skuSearch[item._id]
      ? inv.sku?.toLowerCase().includes(skuSearch[item._id].toLowerCase()) ||
        inv.description?.toLowerCase().includes(skuSearch[item._id].toLowerCase())
      : false
  ).slice(0, 8);

  return (
    <div className={`${ROW_GRID} ${ROW_COLS} py-1`}>
      {/* 1 — Type */}
      <select
        value={item.type}
        onChange={e => onUpdate(item._id, 'type', e.target.value)}
        className={INP}
      >
        {ITEM_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
      </select>

      {/* 2 — SKU (search-as-you-type, dropdown below) */}
      <div className="relative">
        <input
          type="text"
          value={skuSearch[item._id] !== undefined ? skuSearch[item._id] : (item.sku || '')}
          onChange={e => {
            setSkuSearch(prev => ({ ...prev, [item._id]: e.target.value }));
            if (!e.target.value) onUpdate(item._id, 'sku', '');
          }}
          placeholder="SKU…"
          className={INP}
        />
        {filteredInv.length > 0 && (
          <div className="absolute top-full left-0 z-20 w-64 bg-white border border-gray-200 rounded-lg shadow-lg mt-0.5 max-h-48 overflow-y-auto">
            {filteredInv.map(inv => (
              <div key={inv.id} onClick={() => onSelectSKU(item._id, inv)} className="px-3 py-2 hover:bg-orange-50 cursor-pointer text-xs">
                <div className="font-mono font-medium text-gray-900">{inv.sku}</div>
                <div className="text-gray-500 truncate">{inv.description}</div>
                <div className="text-[#F97316]">{fmt(inv.weighted_avg_cost)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3 — Description */}
      <input
        type="text"
        value={item.description}
        onChange={e => onUpdate(item._id, 'description', e.target.value)}
        placeholder="Description…"
        className={INP}
      />

      {/* 4 — Qty */}
      <input type="number" value={item.quantity}
        onChange={e => onUpdate(item._id, 'quantity', e.target.value)}
        min="0" step="0.5"
        className={`${INP} text-right`}
      />

      {/* 5 — Cost */}
      <input type="number" value={item.unit_cost}
        onChange={e => onUpdate(item._id, 'unit_cost', e.target.value)}
        min="0" step="0.01"
        className={`${INP} text-right`}
      />

      {/* 6 — Markup (hidden for labor) */}
      {item.type !== 'labor'
        ? <input type="number" value={item.markup_percent}
            onChange={e => onUpdate(item._id, 'markup_percent', e.target.value)}
            min="0" step="1"
            className={`${INP} text-right`}
          />
        : <div />
      }

      {/* 7 — Unit price (computed, read-only) */}
      <div className="text-right text-xs text-gray-500 tabular-nums">{fmt(item.unit_price)}</div>

      {/* 8 — Line total (computed, read-only) */}
      <div className="text-right text-xs font-semibold text-gray-900 tabular-nums">{fmt(item.total)}</div>

      {/* 9 — Delete */}
      <button onClick={() => onRemove(item._id)} className="flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Bundle box ───────────────────────────────────────────────────────
export function BundleBox({ label, items, inventory, skuSearch, setSkuSearch, onRename, onAddItem, onUpdateItem, onRemoveItem, onRemoveGroup, onSelectSKU }) {
  const groupTotal = items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);

  return (
    <div className="border-2 border-orange-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-orange-50 px-4 py-2.5 flex items-center gap-3">
        <Package className="w-4 h-4 text-[#F97316] flex-shrink-0" />
        <input
          type="text"
          value={label}
          onChange={e => onRename(label, e.target.value)}
          className="flex-1 text-sm font-semibold text-gray-900 bg-transparent border-b border-orange-300 focus:outline-none focus:border-[#F97316] min-w-0"
          placeholder="Bundle name..."
        />
        <span className="text-xs text-gray-400 flex-shrink-0">{items.length} item{items.length !== 1 ? 's' : ''}</span>
        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex-shrink-0 font-medium">
          1 line on invoice
        </span>
        <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{fmt(groupTotal)}</span>
        <button
          onClick={() => onRemoveGroup(label)}
          className="text-gray-300 hover:text-red-500 flex-shrink-0 transition-colors"
          title="Remove bundle"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Column header (orange tint) */}
      <LineItemsHeader tint />

      {/* Items */}
      <div>
        {items.map((item, i) => (
          <div key={item._id} className={`border-b border-orange-50 ${i % 2 === 1 ? 'bg-orange-50/20' : 'bg-white'}`}>
            <ItemRow
              item={item}
              inventory={inventory}
              skuSearch={skuSearch}
              setSkuSearch={setSkuSearch}
              onUpdate={onUpdateItem}
              onRemove={onRemoveItem}
              onSelectSKU={onSelectSKU}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-orange-50/60 border-t border-orange-100">
        <button
          onClick={() => onAddItem(label)}
          className="flex items-center gap-1.5 text-xs text-[#F97316] hover:text-orange-600 font-medium"
        >
          <Plus className="w-3 h-3" /> Add item to bundle
        </button>
      </div>
    </div>
  );
}
