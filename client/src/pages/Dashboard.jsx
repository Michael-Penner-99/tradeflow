import React from 'react';
import { Link } from 'react-router-dom';
import { Upload, Package, TrendingUp, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome to TradeFlow</h1>
        <p className="text-gray-500 mt-1">
          Manage your supplier statements and track inventory in one place.
        </p>
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <Link
          to="/upload"
          className="bg-white rounded-xl border border-gray-200 p-6 hover:border-[#F97316] hover:shadow-md transition-all group"
        >
          <div className="bg-orange-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-100 transition-colors">
            <Upload className="w-6 h-6 text-[#F97316]" />
          </div>
          <h2 className="font-semibold text-gray-900 mb-1">Upload Statement</h2>
          <p className="text-sm text-gray-500">
            Scan a supplier invoice or statement with AI to extract line items automatically.
          </p>
          <div className="flex items-center gap-1 mt-4 text-[#F97316] text-sm font-medium">
            Get started <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        <Link
          to="/inventory"
          className="bg-white rounded-xl border border-gray-200 p-6 hover:border-[#F97316] hover:shadow-md transition-all group"
        >
          <div className="bg-blue-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="font-semibold text-gray-900 mb-1">View Inventory</h2>
          <p className="text-sm text-gray-500">
            Browse stock levels, weighted average costs, and supplier assignments.
          </p>
          <div className="flex items-center gap-1 mt-4 text-blue-600 text-sm font-medium">
            View all <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        <div className="bg-white rounded-xl border border-gray-200 p-6 opacity-50 cursor-not-allowed">
          <div className="bg-green-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="font-semibold text-gray-900 mb-1">Reports</h2>
          <p className="text-sm text-gray-500">
            Cost analysis, stock movement history, and supplier spend reports.
          </p>
          <div className="mt-4 text-gray-400 text-sm font-medium">Coming soon</div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">How It Works</h2>
        <div className="space-y-4">
          {[
            {
              step: '01',
              title: 'Upload a supplier statement',
              desc: 'Drag and drop a PDF or photo of your supplier invoice.'
            },
            {
              step: '02',
              title: 'AI extracts the line items',
              desc: 'Claude Vision reads the document and pulls out SKU, description, quantity, and cost.'
            },
            {
              step: '03',
              title: 'Review and confirm',
              desc: 'Edit any fields if needed, then confirm to update your inventory with weighted average costing.'
            }
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-4">
              <div className="text-[#F97316] font-bold text-lg w-8 flex-shrink-0">{step}</div>
              <div>
                <p className="font-medium text-gray-900">{title}</p>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
