'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Requirement {
  id: string;
  stableKey: string;
  title: string;
  parentId: string | null;
}

interface RequirementSelectorProps {
  requirements: Requirement[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  placeholder?: string;
}

export function RequirementSelector({
  requirements,
  selectedIds,
  onSelectionChange,
  placeholder = 'Select related requirements',
}: RequirementSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter requirements by search query
  const filteredRequirements = requirements.filter((req) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      req.title.toLowerCase().includes(searchLower) ||
      req.stableKey.toLowerCase().includes(searchLower)
    );
  });

  const toggleRequirement = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const selectedRequirements = requirements.filter((r) => selectedIds.includes(r.id));

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between text-left font-normal"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={cn('truncate', selectedIds.length === 0 && 'text-gray-500')}>
          {selectedIds.length === 0
            ? placeholder
            : `${selectedIds.length} requirement${selectedIds.length !== 1 ? 's' : ''} selected`}
        </span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
      </Button>

      {/* Selected badges */}
      {selectedRequirements.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedRequirements.map((req) => (
            <span
              key={req.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-md"
            >
              [{req.stableKey}] {req.title.substring(0, 30)}
              {req.title.length > 30 && '...'}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRequirement(req.id);
                }}
                className="ml-0.5 hover:text-purple-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {selectedRequirements.length > 1 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-gray-500 hover:text-gray-700 underline ml-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search requirements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>

          {/* Requirements list */}
          <div className="overflow-y-auto max-h-48">
            {filteredRequirements.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                {searchQuery ? 'No requirements match your search' : 'No requirements available'}
              </div>
            ) : (
              filteredRequirements.map((req) => (
                <label
                  key={req.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedIds.includes(req.id)}
                    onCheckedChange={() => toggleRequirement(req.id)}
                  />
                  <span className="text-xs text-purple-600 font-mono">[{req.stableKey}]</span>
                  <span className="text-sm text-gray-800 truncate flex-1">{req.title}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
