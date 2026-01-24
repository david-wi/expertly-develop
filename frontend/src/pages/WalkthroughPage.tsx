import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Play, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Input, Textarea, Select } from '../components/common/Input'
import { projectsApi, scenariosApi, personasApi, walkthroughsApi } from '../api/client'

export default function WalkthroughPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedProject = searchParams.get('project')

  const [formData, setFormData] = useState({
    project_id: preselectedProject || '',
    scenario_text: '',
    label: '',
    description: '',
    preconfigured_scenario: '',
    persona_id: '',
  })

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const { data: scenarios } = useQuery({
    queryKey: ['scenarios'],
    queryFn: scenariosApi.list,
  })

  const { data: personas } = useQuery({
    queryKey: ['personas', formData.project_id],
    queryFn: () => personasApi.list(formData.project_id),
    enabled: !!formData.project_id,
  })

  // Load scenario template when preconfigured scenario is selected
  useEffect(() => {
    if (formData.preconfigured_scenario) {
      const scenario = scenarios?.items?.find(s => s.code === formData.preconfigured_scenario)
      if (scenario) {
        setFormData(prev => ({
          ...prev,
          scenario_text: scenario.scenario_template,
          label: prev.label || scenario.name,
        }))
      }
    }
  }, [formData.preconfigured_scenario, scenarios])

  const createMutation = useMutation({
    mutationFn: walkthroughsApi.create,
    onSuccess: (data) => {
      navigate(`/jobs?highlight=${data.job_id}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      project_id: formData.project_id,
      scenario_text: formData.scenario_text,
      label: formData.label || undefined,
      description: formData.description || undefined,
      preconfigured_scenario: formData.preconfigured_scenario || undefined,
      persona_id: formData.persona_id || undefined,
    })
  }

  const projectOptions = [
    { value: '', label: 'Select a project...' },
    ...(projects?.items?.map(p => ({ value: p.id, label: p.name })) || []),
  ]

  const scenarioOptions = [
    { value: '', label: 'Custom scenario' },
    ...(scenarios?.items?.map(s => ({ value: s.code, label: s.name })) || []),
  ]

  const personaOptions = [
    { value: '', label: 'No persona (default user)' },
    ...(personas?.items?.map(p => ({ value: p.id, label: p.name })) || []),
  ]

  const isValid = formData.project_id && formData.scenario_text

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Walkthrough</h1>
          <p className="text-gray-600 mt-1">Generate a visual walkthrough of your application</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Walkthrough Configuration</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Selection */}
            <Select
              label="Project"
              value={formData.project_id}
              onChange={(e) => setFormData({ ...formData, project_id: e.target.value, persona_id: '' })}
              options={projectOptions}
            />

            {/* Preconfigured Scenario */}
            <Select
              label="Scenario Template"
              value={formData.preconfigured_scenario}
              onChange={(e) => setFormData({ ...formData, preconfigured_scenario: e.target.value })}
              options={scenarioOptions}
            />

            {/* Scenario Text */}
            <Textarea
              label="Scenario Steps"
              value={formData.scenario_text}
              onChange={(e) => setFormData({ ...formData, scenario_text: e.target.value })}
              placeholder={`Enter scenario steps, one per line:
Navigate to /
Capture "Homepage"
Click .nav-link
Wait 2 seconds
Capture "After navigation"`}
              rows={10}
            />

            {/* Label */}
            <Input
              label="Label (optional)"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="My Visual Walkthrough"
            />

            {/* Description */}
            <Textarea
              label="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of what this walkthrough covers..."
              rows={2}
            />

            {/* Persona */}
            {formData.project_id && (personas?.items?.length ?? 0) > 0 && (
              <Select
                label="Run as Persona"
                value={formData.persona_id}
                onChange={(e) => setFormData({ ...formData, persona_id: e.target.value })}
                options={personaOptions}
              />
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValid || createMutation.isPending}
                className="flex-1"
              >
                <Play className="w-4 h-4 mr-2" />
                {createMutation.isPending ? 'Creating...' : 'Start Walkthrough'}
              </Button>
            </div>

            {createMutation.isError && (
              <p className="text-sm text-red-600 mt-2">
                Error: {(createMutation.error as Error).message}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Help */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Scenario Syntax</h2>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 space-y-2">
            <p>Each line in the scenario represents a step. Supported commands:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><code className="bg-gray-100 px-1 rounded">Navigate to /path</code> - Go to a URL path</li>
              <li><code className="bg-gray-100 px-1 rounded">Click .selector</code> - Click an element</li>
              <li><code className="bg-gray-100 px-1 rounded">Wait N seconds</code> - Pause execution</li>
              <li><code className="bg-gray-100 px-1 rounded">Capture "Description"</code> - Take a screenshot with label</li>
            </ul>
            <p className="mt-4">Any other text will capture the current screen state.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
