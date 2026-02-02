import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Card } from '../components/common/Card';
import type { Person } from '../types';

export function People() {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [search, setSearch] = useState('');

  const { data: people = [], isLoading, error } = useQuery({
    queryKey: ['people'],
    queryFn: () => api.getPeople(),
  });

  const filteredPeople = search
    ? people.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.company?.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase())
      )
    : people;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load people</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--theme-text-heading)]">People</h1>
          <p className="text-sm text-gray-500">Contacts and relationships</p>
        </div>
        <span className="text-sm text-gray-500">{people.length} people</span>
      </div>

      <div>
        <input
          type="text"
          placeholder="Search people..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All People</h2>
          {filteredPeople.length === 0 ? (
            <div className="text-center py-8">
              <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-sm text-gray-500">
                {people.length === 0 ? 'No people added yet.' : 'No matches found.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredPeople.map((person) => (
                <button
                  key={person.id}
                  onClick={() => setSelectedPerson(person)}
                  className={`w-full text-left py-3 -mx-4 px-4 transition-colors ${
                    selectedPerson?.id === person.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-gray-600">
                        {person.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{person.name}</p>
                      {(person.title || person.company) && (
                        <p className="text-xs text-gray-500">
                          {[person.title, person.company].filter(Boolean).join(' at ')}
                        </p>
                      )}
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-gray-400 ml-2" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div>
          {selectedPerson ? (
            <Card>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xl font-medium text-blue-600">
                      {selectedPerson.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="ml-4">
                    <h2 className="text-lg font-semibold text-gray-900">{selectedPerson.name}</h2>
                    {(selectedPerson.title || selectedPerson.company) && (
                      <p className="text-sm text-gray-500">
                        {[selectedPerson.title, selectedPerson.company].filter(Boolean).join(' at ')}
                      </p>
                    )}
                  </div>
                </div>

                {selectedPerson.email && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <p className="text-sm text-gray-900">{selectedPerson.email}</p>
                  </div>
                )}

                {selectedPerson.phone && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <p className="text-sm text-gray-900">{selectedPerson.phone}</p>
                  </div>
                )}

                {selectedPerson.relationship_to_user && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">{selectedPerson.relationship_to_user}</p>
                  </div>
                )}

                {selectedPerson.political_context && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Political Context</label>
                    <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-md">{selectedPerson.political_context}</p>
                  </div>
                )}

                {selectedPerson.communication_notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Communication Notes</label>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">{selectedPerson.communication_notes}</p>
                  </div>
                )}

                {selectedPerson.context_notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Context Notes</label>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md whitespace-pre-wrap">{selectedPerson.context_notes}</p>
                  </div>
                )}

                <div className="pt-4 border-t text-xs text-gray-400">
                  {selectedPerson.last_contact && <p>Last contact: {new Date(selectedPerson.last_contact).toLocaleDateString()}</p>}
                  {selectedPerson.next_follow_up && <p>Next follow-up: {new Date(selectedPerson.next_follow_up).toLocaleDateString()}</p>}
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-12">
                <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-500">Select a person to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function UserGroupIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
