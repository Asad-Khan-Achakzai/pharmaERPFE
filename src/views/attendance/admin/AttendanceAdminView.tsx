'use client'

import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import Switch from '@mui/material/Switch'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import CustomTextField from '@core/components/mui/TextField'
import MenuItem from '@mui/material/MenuItem'
import { attendanceService } from '@/services/attendance.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import AttendanceModuleLayout from '@/views/attendance/AttendanceModuleLayout'
import { getAttendancePermissionFlags } from '@/views/attendance/attendancePermissions'
import ApprovalRoutingSection from '@/views/attendance/admin/ApprovalRoutingSection'
import SchedulesPeopleTab from '@/views/attendance/admin/SchedulesPeopleTab'
import AttendanceOperationsCenter from '@/views/attendance/admin/AttendanceOperationsCenter'

type GovernanceSettings = {
  attendanceGovernanceEnabled?: boolean
  attendancePoliciesEnabled?: boolean
  attendanceApprovalsEnabled?: boolean
  strictLateBlocking?: boolean
  allowCheckInWhenLate?: boolean
  autoRequestOnLateCheckIn?: boolean
  attendanceApprovalSlaHours?: number | null
  attendanceSlaBreachAction?: 'NONE' | 'ESCALATE_NEXT' | 'ADMIN_POOL'
  attendanceEodEscalationEnabled?: boolean
  attendanceEodEscalationAction?: 'NONE' | 'ESCALATE_NEXT' | 'ADMIN_POOL'
  attendanceOversightInterventionEnabled?: boolean
  attendancePendingAutoRejectHours?: number | null
}

export default function AttendanceAdminView() {
  const { user, hasPermission } = useAuth()
  const flags = getAttendancePermissionFlags(user, hasPermission)

  const [adminTab, setAdminTab] = useState(0)
  const [settings, setSettings] = useState<GovernanceSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exceptions, setExceptions] = useState<any>(null)
  const [shifts, setShifts] = useState<any[]>([])
  const [policies, setPolicies] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [matrices, setMatrices] = useState<any[]>([])
  const [monitoring, setMonitoring] = useState<any>(null)
  const [flowName, setFlowName] = useState('Standard approval flow')

  const [automationForm, setAutomationForm] = useState({
    attendanceApprovalSlaHours: '' as string,
    attendanceSlaBreachAction: 'NONE' as 'NONE' | 'ESCALATE_NEXT' | 'ADMIN_POOL',
    attendanceEodEscalationEnabled: false,
    attendanceEodEscalationAction: 'NONE' as 'NONE' | 'ESCALATE_NEXT' | 'ADMIN_POOL',
    attendanceOversightInterventionEnabled: false,
    attendancePendingAutoRejectHours: '' as string
  })

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizStep, setWizStep] = useState(0)
  const [wizPreset, setWizPreset] = useState<'field' | 'office' | 'hybrid'>('field')

  const canViewSettings = flags.canEditRules || hasPermission('attendance.governance.view')
  const canEditSettings = flags.canEditRules
  const canConfigure = flags.canConfigureSchedules

  useEffect(() => {
    if (!canViewSettings && canConfigure) setAdminTab(1)
  }, [canViewSettings, canConfigure])

  const loadSettings = useCallback(async () => {
    if (!canViewSettings) return
    setLoadingSettings(true)
    try {
      const r = await attendanceService.governanceSettings()
      setSettings(r.data.data || {})
    } catch (e) {
      showApiError(e, 'Could not load attendance rules')
    } finally {
      setLoadingSettings(false)
    }
  }, [canViewSettings])

  const loadAux = useCallback(async () => {
    try {
      if (canViewSettings || canConfigure) {
        try {
          const m = await attendanceService.monitoringSummary()
          setMonitoring(m.data?.data || null)
        } catch {
          setMonitoring(null)
        }
      }
      if (flags.canSeeAlerts) {
        try {
          const ex = await attendanceService.todayExceptions()
          setExceptions(ex.data.data || null)
        } catch {
          setExceptions(null)
        }
      }
      if (canConfigure) {
        const [s, p, m, a] = await Promise.all([
          attendanceService.listWorkShifts(),
          attendanceService.listPolicies(),
          attendanceService.listApprovalMatrices(),
          attendanceService.listPolicyAssignments()
        ])
        setShifts(s.data.data || [])
        setPolicies(p.data.data || [])
        setMatrices(m.data.data || [])
        setAssignments(a.data.data || [])
      }
    } catch (e) {
      showApiError(e, 'Could not load schedules')
    }
  }, [canConfigure, canViewSettings, flags.canSeeAlerts])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])
  useEffect(() => {
    void loadAux()
  }, [loadAux])

  useEffect(() => {
    if (!settings) return
    setAutomationForm({
      attendanceApprovalSlaHours:
        settings.attendanceApprovalSlaHours != null ? String(settings.attendanceApprovalSlaHours) : '',
      attendanceSlaBreachAction: settings.attendanceSlaBreachAction || 'NONE',
      attendanceEodEscalationEnabled: Boolean(settings.attendanceEodEscalationEnabled),
      attendanceEodEscalationAction: settings.attendanceEodEscalationAction || 'NONE',
      attendanceOversightInterventionEnabled: Boolean(settings.attendanceOversightInterventionEnabled),
      attendancePendingAutoRejectHours:
        settings.attendancePendingAutoRejectHours != null ? String(settings.attendancePendingAutoRejectHours) : ''
    })
  }, [settings])

  const patchFlag = async (key: keyof GovernanceSettings, value: boolean) => {
    if (!canEditSettings) return
    setSaving(true)
    try {
      const r = await attendanceService.patchGovernanceSettings({ [key]: value })
      setSettings(r.data.data || {})
      showSuccess('Saved')
    } catch (e) {
      showApiError(e, 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const saveAutomationRules = async () => {
    if (!canEditSettings) return
    setSaving(true)
    try {
      const slaRaw = automationForm.attendanceApprovalSlaHours.trim()
      const rejRaw = automationForm.attendancePendingAutoRejectHours.trim()
      const r = await attendanceService.patchGovernanceSettings({
        attendanceApprovalSlaHours: slaRaw === '' ? null : Number(slaRaw),
        attendanceSlaBreachAction: automationForm.attendanceSlaBreachAction,
        attendanceEodEscalationEnabled: automationForm.attendanceEodEscalationEnabled,
        attendanceEodEscalationAction: automationForm.attendanceEodEscalationAction,
        attendanceOversightInterventionEnabled: automationForm.attendanceOversightInterventionEnabled,
        attendancePendingAutoRejectHours: rejRaw === '' ? null : Number(rejRaw)
      })
      setSettings(r.data.data || {})
      showSuccess('Response rules saved')
    } catch (e) {
      showApiError(e, 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const seedDefaultFlow = async () => {
    if (!canConfigure) return
    setBusy(true)
    try {
      const ws = await attendanceService.createWorkShift({
        name: `${wizPreset === 'office' ? 'Office' : 'Field'} · day`,
        startMinutes: wizPreset === 'office' ? 9 * 60 : 9 * 60,
        endMinutes: wizPreset === 'office' ? 18 * 60 : 18 * 60,
        graceMinutes: wizPreset === 'hybrid' ? 30 : 15,
        shiftEndsNextDay: false,
        isDefault: true
      })
      const wid = ws.data.data?._id
      if (wid) {
        const pol = await attendanceService.createPolicy({
          name: 'Default schedule policy',
          workShiftId: String(wid),
          isDefault: true
        })
        const pid = pol.data.data?._id
        if (pid) await attendanceService.createPolicyAssignment({ policyId: String(pid), employeeId: null })
      }
      await attendanceService.createApprovalMatrix({
        name: flowName.trim().slice(0, 120) || 'Company approval flow',
        requestCategory: 'ALL',
        steps: [
          { order: 0, resolverType: 'DIRECT_MANAGER', requiredPermission: 'attendance.approve.direct' },
          { order: 1, resolverType: 'ADMIN_QUEUE', requiredPermission: 'admin.access' }
        ],
        isActive: true
      })
      await attendanceService.patchGovernanceSettings({
        attendanceGovernanceEnabled: true,
        attendancePoliciesEnabled: true,
        attendanceApprovalsEnabled: true
      })
      showSuccess('Guided setup applied')
      setWizardOpen(false)
      setWizStep(0)
      await loadSettings()
      await loadAux()
    } catch (e) {
      showApiError(e, 'Setup failed — names may already exist')
    } finally {
      setBusy(false)
    }
  }

  if (!flags.canAccessAdmin) {
    return (
      <AttendanceModuleLayout>
        <Typography color='text.secondary'>You do not have access to attendance administration.</Typography>
      </AttendanceModuleLayout>
    )
  }

  return (
    <AttendanceModuleLayout>
      <Stack spacing={3}>
        <Stack direction='row' flexWrap='wrap' gap={2} justifyContent='space-between' alignItems='center'>
          <Typography variant='body2' color='text.secondary' sx={{ maxWidth: 560 }}>
            Configure how attendance works for your company. Changes apply to new check-ins and requests; existing data is kept.
          </Typography>
          {canEditSettings ? (
            <Button variant='contained' color='secondary' onClick={() => setWizardOpen(true)}>
              Guided setup
            </Button>
          ) : null}
        </Stack>

        <Tabs value={adminTab} onChange={(_, v) => setAdminTab(v)} variant='scrollable' scrollButtons='auto'>
          <Tab label='Rules' disabled={!canViewSettings} />
          <Tab label='Schedules' disabled={!canConfigure} />
          <Tab label='Who approves' disabled={!canConfigure} />
          <Tab label='Insights' />
        </Tabs>

        {adminTab === 0 && canViewSettings ? (
          <Card variant='outlined' elevation={0}>
            <CardHeader title='Attendance settings' subheader='Turn features on in order: history → expected times → manager requests. Names here are for your admins only.' />
            <CardContent>
              {loadingSettings || !settings ? (
                <Typography color='text.secondary'>Loading…</Typography>
              ) : (
                <Stack spacing={2}>
                  <Typography variant='subtitle2'>Attendance tracking</Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(settings.attendanceGovernanceEnabled)}
                        disabled={!canEditSettings || saving}
                        onChange={(_, v) => void patchFlag('attendanceGovernanceEnabled', v)}
                      />
                    }
                    label='Keep attendance change history'
                  />
                  <Typography variant='caption' color='text.secondary' display='block'>
                    Records who checked in/out for traceability. Recommended for regulated or distributed teams.
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(settings.attendancePoliciesEnabled)}
                        disabled={!canEditSettings || saving}
                        onChange={(_, v) => void patchFlag('attendancePoliciesEnabled', v)}
                      />
                    }
                    label='Enable schedules (expected times & late calculation)'
                  />
                  <Typography variant='caption' color='text.secondary' display='block'>
                    Requires at least one work schedule and assignment. Without this, late minutes are not calculated.
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(settings.attendanceApprovalsEnabled)}
                        disabled={!canEditSettings || saving}
                        onChange={(_, v) => void patchFlag('attendanceApprovalsEnabled', v)}
                      />
                    }
                    label='Enable manager requests & approvals'
                  />
                  <Typography variant='caption' color='text.secondary' display='block'>
                    When off, request inbox and late approvals are unavailable.
                  </Typography>

                  <Typography variant='subtitle2' className='mts-2'>
                    Late attendance
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(settings.strictLateBlocking)}
                        disabled={!canEditSettings || saving || !settings.attendancePoliciesEnabled}
                        onChange={(_, v) => void patchFlag('strictLateBlocking', v)}
                      />
                    }
                    label='Require approval for late check-in'
                  />
                  <Typography variant='caption' color='text.secondary' display='block'>
                    Late punches are saved but need manager approval before check-out when approvals are on and “Allow late check-in” is off.
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(settings.allowCheckInWhenLate)}
                        disabled={!canEditSettings || saving || !settings.attendancePoliciesEnabled}
                        onChange={(_, v) => void patchFlag('allowCheckInWhenLate', v)}
                      />
                    }
                    label='Allow late check-in without blocking'
                  />
                  <Typography variant='caption' color='text.secondary' display='block'>
                    Recommended for field sales. Late minutes still recorded; optional automatic request can be enabled below.
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(settings.autoRequestOnLateCheckIn)}
                        disabled={!canEditSettings || saving || !settings.attendanceApprovalsEnabled}
                        onChange={(_, v) => void patchFlag('autoRequestOnLateCheckIn', v)}
                      />
                    }
                    label='Automatically create late-arrival request after late check-in'
                  />
                  <Typography variant='caption' color='text.secondary' display='block'>
                    Non-blocking acknowledgment for managers. Requires requests & approvals.
                  </Typography>

                  <Typography variant='subtitle2' className='mts-4'>
                    Response deadlines and automatic routing
                  </Typography>
                  <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
                    When people do not act in time, the system can move the request to the next manager or to the administrator queue.
                    Leave hours blank to turn off time-based automation.
                  </Typography>
                  <Stack spacing={2} maxWidth={560}>
                    <CustomTextField
                      label='Hours until “needs attention” follow-up'
                      type='number'
                      size='small'
                      disabled={!canEditSettings || saving || !settings.attendanceApprovalsEnabled}
                      value={automationForm.attendanceApprovalSlaHours}
                      onChange={e => setAutomationForm(f => ({ ...f, attendanceApprovalSlaHours: e.target.value }))}
                      inputProps={{ min: 0.25, step: 0.5 }}
                      helperText='Example: 2 means about two hours after submission, if still open.'
                    />
                    <CustomTextField
                      select
                      label='When that time passes'
                      size='small'
                      disabled={!canEditSettings || saving || !settings.attendanceApprovalsEnabled}
                      value={automationForm.attendanceSlaBreachAction}
                      onChange={e =>
                        setAutomationForm(f => ({
                          ...f,
                          attendanceSlaBreachAction: e.target.value as 'NONE' | 'ESCALATE_NEXT' | 'ADMIN_POOL'
                        }))
                      }
                    >
                      <MenuItem value='NONE'>Do not move automatically</MenuItem>
                      <MenuItem value='ESCALATE_NEXT'>Move one step up the approval path</MenuItem>
                      <MenuItem value='ADMIN_POOL'>Send to administrator queue</MenuItem>
                    </CustomTextField>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(automationForm.attendanceEodEscalationEnabled)}
                          disabled={!canEditSettings || saving || !settings.attendanceApprovalsEnabled}
                          onChange={(_, v) => setAutomationForm(f => ({ ...f, attendanceEodEscalationEnabled: v }))}
                        />
                      }
                      label='After the workday ends, move requests that are still open'
                    />
                    <CustomTextField
                      select
                      label='End-of-day action'
                      size='small'
                      disabled={
                        !canEditSettings || saving || !settings.attendanceApprovalsEnabled || !automationForm.attendanceEodEscalationEnabled
                      }
                      value={automationForm.attendanceEodEscalationAction}
                      onChange={e =>
                        setAutomationForm(f => ({
                          ...f,
                          attendanceEodEscalationAction: e.target.value as 'NONE' | 'ESCALATE_NEXT' | 'ADMIN_POOL'
                        }))
                      }
                    >
                      <MenuItem value='NONE'>No automatic move</MenuItem>
                      <MenuItem value='ESCALATE_NEXT'>Move one step up</MenuItem>
                      <MenuItem value='ADMIN_POOL'>Send to administrator queue</MenuItem>
                    </CustomTextField>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(automationForm.attendanceOversightInterventionEnabled)}
                          disabled={!canEditSettings || saving || !settings.attendanceApprovalsEnabled}
                          onChange={(_, v) =>
                            setAutomationForm(f => ({ ...f, attendanceOversightInterventionEnabled: v }))
                          }
                        />
                      }
                      label='Allow senior managers (RM tier) to decide while the request is still with the field manager'
                    />
                    <CustomTextField
                      label='Automatic rejection after (hours) — late arrivals only, optional'
                      type='number'
                      size='small'
                      disabled={!canEditSettings || saving || !settings.attendanceApprovalsEnabled}
                      value={automationForm.attendancePendingAutoRejectHours}
                      onChange={e => setAutomationForm(f => ({ ...f, attendancePendingAutoRejectHours: e.target.value }))}
                      inputProps={{ min: 1, step: 1 }}
                      helperText='Strict option: clears the check-in and marks absent if still pending. Leave blank to disable.'
                    />
                    {canEditSettings ? (
                      <Button variant='outlined' disabled={saving} onClick={() => void saveAutomationRules()}>
                        Save response rules
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              )}
            </CardContent>
          </Card>
        ) : null}

        {adminTab === 1 && canConfigure ? (
          <SchedulesPeopleTab
            shifts={shifts}
            policies={policies}
            assignments={assignments}
            onRefresh={loadAux}
            companyRules={settings ?? undefined}
          />
        ) : null}

        {adminTab === 2 && canConfigure ? <ApprovalRoutingSection matrices={matrices} onRefresh={loadAux} /> : null}

        {adminTab === 3 ? (
          <AttendanceOperationsCenter
            flags={flags}
            exceptions={exceptions}
            monitoring={monitoring}
            onOpenAdminTab={setAdminTab}
          />
        ) : null}
      </Stack>

      <Dialog open={wizardOpen} onClose={() => !busy && setWizardOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Guided attendance setup</DialogTitle>
        <DialogContent>
          <Stepper activeStep={wizStep} alternativeLabel sx={{ py: 3 }}>
            <Step>
              <StepLabel>Company type</StepLabel>
            </Step>
            <Step>
              <StepLabel>Review</StepLabel>
            </Step>
            <Step>
              <StepLabel>Activate</StepLabel>
            </Step>
          </Stepper>
          {wizStep === 0 ? (
            <Stack spacing={2}>
              <Typography variant='body2' color='text.secondary'>
                Choose a preset. You can fine-tune schedules after activation.
              </Typography>
              <CustomTextField select label='Company type' value={wizPreset} onChange={e => setWizPreset(e.target.value as 'field' | 'office' | 'hybrid')}>
                <MenuItem value='field'>Field force</MenuItem>
                <MenuItem value='office'>Office</MenuItem>
                <MenuItem value='hybrid'>Hybrid</MenuItem>
              </CustomTextField>
              <CustomTextField label='Routing name' value={flowName} onChange={e => setFlowName(e.target.value)} />
            </Stack>
          ) : null}
          {wizStep === 1 ? (
            <Typography variant='body2'>
              This will create a default day schedule (09:00–18:00), company-wide assignment, a two-step approval flow (manager →
              company administrator), and turn on auditing, schedules, and requests. If records already exist, you may need unique names.
            </Typography>
          ) : null}
          {wizStep === 2 ? (
            <Typography variant='body2'>
              Confirm activation. You can adjust settings on the Attendance settings tab afterward.
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWizardOpen(false)} disabled={busy}>
            Cancel
          </Button>
          {wizStep > 0 ? (
            <Button onClick={() => setWizStep(s => s - 1)} disabled={busy}>
              Back
            </Button>
          ) : null}
          {wizStep < 2 ? (
            <Button variant='contained' onClick={() => setWizStep(s => s + 1)} disabled={busy}>
              Next
            </Button>
          ) : (
            <Button variant='contained' onClick={() => void seedDefaultFlow()} disabled={busy}>
              Activate
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </AttendanceModuleLayout>
  )
}
