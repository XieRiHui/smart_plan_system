<template>
  <div class="plan-form">
    <div v-if="toastVisible" class="toast toast-error" role="alert" @click="hideToast">
      {{ toastMessage }}
    </div>
    <h2 class="page-title">{{ isEdit ? '编辑规划' : '创建新规划' }}</h2>

    <div class="card">
      <form @submit.prevent="submitForm" class="form">
        <div class="form-group">
          <label for="name" class="form-label">规划名称</label>
          <div class="input-wrapper">
            <input 
              type="text" 
              id="name" 
              v-model="formData.name" 
              required 
              placeholder="请输入规划名称"
              class="form-input"
            />
            <span class="input-icon">📝</span>
          </div>
        </div>
        
        <div class="form-group">
          <label for="date" class="form-label">出行日期</label>
          <div class="date-picker">
            <div class="date-picker-header">
              <button type="button" class="date-nav" @click="prevMonth">‹</button>
              <div class="date-month">{{ monthTitle }}</div>
              <button type="button" class="date-nav" @click="nextMonth">›</button>
            </div>

            <div class="date-weekdays">
              <div v-for="w in weekDays" :key="w" class="date-weekday">{{ w }}</div>
            </div>

            <div class="date-grid">
              <button
                v-for="cell in calendarCells"
                :key="cell.key"
                type="button"
                class="date-day"
                :class="cell.className"
                :disabled="cell.disabled"
                @click="selectCalendarDate(cell.date)"
              >
                {{ cell.label }}
              </button>
            </div>

            <div class="date-range-text">
              <span v-if="rangeText">{{ rangeText }}</span>
              <span v-else>请选择日期</span>
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <label for="budget" class="form-label">预算（元）</label>
          <div class="input-wrapper">
            <input 
              type="number" 
              id="budget" 
              v-model.number="formData.budget" 
              required 
              min="0"
              placeholder="请输入预算"
              class="form-input"
            />
            <span class="input-icon">💰</span>
          </div>
        </div>
        
        <div class="form-group">
          <label for="people_count" class="form-label">人数</label>
          <div class="input-wrapper">
            <input 
              type="number" 
              id="people_count" 
              v-model.number="formData.people_count" 
              required 
              min="1"
              placeholder="请输入人数"
              class="form-input"
            />
            <span class="input-icon">👥</span>
          </div>
        </div>
        
        <div class="form-group">
          <label for="preferences" class="form-label">偏好</label>
          <div class="input-wrapper textarea-wrapper">
            <textarea 
              id="preferences" 
              v-model="formData.preferences" 
              placeholder="请输入偏好，多个偏好请用逗号分隔"
              class="form-input"
            ></textarea>
            <span class="input-icon">🎯</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">地点</label>
          <div v-if="selectedPlaces.length === 0" class="locations-empty">暂未添加地点</div>
          <div v-else class="locations-list">
            <div v-for="(place, index) in selectedPlaces" :key="`${place.name}-${place.lng}-${place.lat}`" class="location-item">
              <span class="location-name">{{ place.name }}</span>
              <button type="button" class="remove-location" @click="removePlace(index)">删除</button>
            </div>
          </div>
          <button type="button" @click="goToMap" class="map-button map-button-under-list">
            <span class="button-icon">🗺️</span> 前往地图选点
          </button>
          <button type="button" class="map-button itinerary-button map-button-under-list" @click="goToItinerary">
            <span class="button-icon">🧩</span> 安排行程
          </button>
        </div>

        <div class="form-group">
          <label for="summary" class="form-label">总结（不超过200字）</label>
          <div class="input-wrapper textarea-wrapper">
            <textarea
              id="summary"
              v-model="formData.summary"
              placeholder="请输入总结（优点/风险/可改进点）"
              class="form-input summary-input"
            ></textarea>
            <span class="input-icon">🧠</span>
          </div>
          <div class="summary-meta">
            <div class="summary-count">{{ summaryCount }}/200</div>
            <button type="button" class="summary-ai" :disabled="loading || aiGenerating" @click="generateSummary">
              {{ aiGenerating ? '生成中...' : 'AI辅助生成总结' }}
            </button>
            <button v-if="aiGenerating" type="button" class="summary-ai-stop" @click="stopGenerateSummary">
              停止生成
            </button>
          </div>
          <div v-if="aiError" class="error">{{ aiError }}</div>
        </div>
        
        <div class="form-actions">
          <button type="submit" :disabled="loading" class="submit-button">
            {{ isEdit ? '保存修改' : '创建规划' }}
          </button>
        </div>
      </form>
      
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-if="loading" class="loading-mask" role="status" aria-live="polite">
        <div class="loading-mask-inner">
          <div class="loading-spinner"></div>
          <div class="loading-mask-text">{{ isEdit ? '保存中...' : '创建中...' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { aiApi, planApi, locationApi } from '../api'
import store from '../store'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const error = ref(null)
const errors = ref({})
const planId = computed(() => String(route.params.id || ''))
const isEdit = computed(() => !!planId.value)
const draftKey = computed(() => (isEdit.value ? `edit-${planId.value}` : 'create'))
const selectedPlaces = computed(() => store.getDraftPlaces(draftKey.value))

const formData = ref({
  name: '',
  budget: 0,
  people_count: 1,
  preferences: '',
  summary: ''
})

const buildPlanData = () => {
  return {
    ...formData.value,
    summary: String(formData.value.summary || '').slice(0, 200),
    date: dateRange.value.start,
    start_date: dateRange.value.start,
    end_date: dateRange.value.end,
    preferences: formData.value.preferences
      .split(/[,，]/)
      .map((p) => p.trim())
      .filter((p) => p)
  }
}

const aiGenerating = ref(false)
const aiError = ref('')
const aiStreamState = ref('idle')
const aiStreamSource = ref(null)
const aiStreamBuffer = ref('')
const aiStreamCancel = ref(null)
const toastVisible = ref(false)
const toastMessage = ref('')
let toastTimer = null

const showToast = (message) => {
  toastMessage.value = String(message || '')
  toastVisible.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastVisible.value = false
    toastMessage.value = ''
    toastTimer = null
  }, 2500)
}

const hideToast = () => {
  toastVisible.value = false
  toastMessage.value = ''
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = null
}

const summaryCount = computed(() => String(formData.value.summary || '').length)

watch(
  () => formData.value.summary,
  (val) => {
    const next = String(val || '')
    if (next.length <= 200) return
    formData.value.summary = next.slice(0, 200)
  }
)

const generateSummary = async () => {
  aiGenerating.value = true
  aiError.value = ''
  let saved = null
  try {
    const scrollY = window.scrollY
    saved = await savePlan({ syncLocations: true, switchToEditWhenCreate: true, preserveScroll: true })
    if (!saved.ok) {
      aiError.value = error.value || '保存规划失败，请稍后重试'
      return
    }
    aiStreamBuffer.value = ''
    formData.value.summary = ''

    if (typeof EventSource !== 'function') {
      throw new Error('sse_unsupported')
    }

    const streamUrl = aiApi.getPlanSummaryStreamUrl(saved.id)
    const text = await new Promise((resolve, reject) => {
      aiStreamState.value = 'streaming'
      const source = new EventSource(streamUrl)
      aiStreamSource.value = source
      let settled = false

      const cleanup = () => {
        aiStreamCancel.value = null
        aiStreamSource.value = null
        if (source) source.close()
      }

      aiStreamCancel.value = () => {
        if (settled) return
        settled = true
        aiStreamState.value = 'cancelled'
        cleanup()
        reject(new Error('cancelled'))
      }

      source.onmessage = (event) => {
        if (settled) return
        const chunk = String(event?.data ?? '')
        if (chunk === '[DONE]') {
          settled = true
          aiStreamState.value = 'done'
          cleanup()
          resolve(aiStreamBuffer.value)
          return
        }

        aiStreamBuffer.value += chunk
        formData.value.summary = String(aiStreamBuffer.value || '').slice(0, 200)
      }

      source.onerror = () => {
        if (settled) return
        settled = true
        aiStreamState.value = 'error'
        cleanup()
        reject(new Error('sse_failed'))
      }
    })

    if (typeof text === 'string' && text.trim()) {
      formData.value.summary = text.slice(0, 200)
      await nextTick()
      window.scrollTo(0, scrollY)
      return
    }

    throw new Error('empty_stream')
  } catch (e) {
    if (String(e?.message || '') === 'cancelled') {
      return
    }
    try {
      if (saved && saved.ok) {
        const fallback = await aiApi.generatePlanSummary(saved.id)
        const t = fallback?.data?.summary
        if (typeof t === 'string' && t.trim()) {
          formData.value.summary = t.slice(0, 200)
          aiStreamState.value = 'done'
          return
        }
      }
    } catch {}

    aiError.value = e?.response?.data?.detail || 'AI生成失败，请稍后重试'
  } finally {
    aiGenerating.value = false
    aiStreamCancel.value = null
  }
}

const stopGenerateSummary = () => {
  const cancel = aiStreamCancel.value
  if (typeof cancel === 'function') {
    cancel()
    aiGenerating.value = false
    return
  }
  const source = aiStreamSource.value
  if (source) source.close()
  aiStreamSource.value = null
  aiStreamState.value = 'cancelled'
  aiGenerating.value = false
}

const savePlan = async ({ syncLocations: shouldSyncLocations, switchToEditWhenCreate = false, preserveScroll = false } = {}) => {
  if (!validateForm()) return { ok: false }
  loading.value = true
  error.value = null
  try {
    const planData = buildPlanData()
    let id = planId.value
    let response
    if (isEdit.value) {
      response = await planApi.updatePlan(planId.value, planData)
      store.updatePlan(response.data)
    } else {
      response = await planApi.createPlan(planData)
      store.addPlan(response.data)
      id = String(response.data.id)
      if (switchToEditWhenCreate) {
        const scrollY = preserveScroll ? window.scrollY : 0
        store.clearDraftPlanForm('create')
        store.clearDraftDateRange('create')
        const createPlaces = [...store.getDraftPlaces('create')]
        store.clearDraftPlaces('create')
        createPlaces.forEach((place) => {
          store.addDraftPlace(`edit-${id}`, place)
        })
        await router.replace(`/edit/${id}`)
        if (preserveScroll) {
          await nextTick()
          window.scrollTo(0, scrollY)
        }
      }
    }
    if (shouldSyncLocations) {
      await syncLocations(id)
    }
    if (!isEdit.value) {
      store.clearDraftPlanForm('create')
      store.clearDraftDateRange('create')
      store.clearDraftPlaces('create')
    }
    return { ok: true, id }
  } catch (err) {
    error.value = isEdit.value ? '更新规划失败，请稍后重试' : '创建规划失败，请稍后重试'
    console.error('Error saving plan:', err)
    return { ok: false }
  } finally {
    loading.value = false
  }
}

const goToMap = async () => {
  if (isEdit.value) {
    const res = await savePlan({ syncLocations: false })
    if (!res.ok) return
    router.push({
      path: '/map',
      query: { from: 'edit', planId: planId.value }
    })
    return
  }
  router.push({
    path: '/map',
    query: { from: 'create' }
  })
}

const goToItinerary = async () => {
  const res = await savePlan({ syncLocations: true, switchToEditWhenCreate: true })
  if (!res.ok) return
  router.push({
    path: `/plan/${res.id}/itinerary`,
    query: { returnTo: `/edit/${res.id}` }
  })
}

const dateRange = ref({ start: '', end: '' })

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

const parseYmd = (ymd) => {
  if (!ymd) return null
  const [y, m, d] = ymd.split('-').map((x) => Number(x))
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const toYmd = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const today = new Date()
const todayStart = new Date(today)
todayStart.setHours(0, 0, 0, 0)
const cursorYear = ref(today.getFullYear())
const cursorMonth = ref(today.getMonth())

watch(
  () => dateRange.value.start,
  (val) => {
    const d = parseYmd(val)
    if (!d) return
    cursorYear.value = d.getFullYear()
    cursorMonth.value = d.getMonth()
  },
  { immediate: true }
)

watch(
  () => dateRange.value,
  (val) => {
    store.setDraftDateRange(draftKey.value, val)
  },
  { deep: true }
)

watch(
  () => formData.value,
  (val) => {
    store.setDraftPlanForm(draftKey.value, val)
  },
  { deep: true }
)

const monthTitle = computed(() => `${cursorYear.value}年${cursorMonth.value + 1}月`)
const firstOfMonth = computed(() => new Date(cursorYear.value, cursorMonth.value, 1))
const gridStartDate = computed(() => {
  const first = firstOfMonth.value
  const jsDay = first.getDay()
  const mondayBased = (jsDay + 6) % 7
  const startDate = new Date(first)
  startDate.setDate(first.getDate() - mondayBased)
  startDate.setHours(0, 0, 0, 0)
  return startDate
})

const sameDay = (a, b) => {
  if (!a || !b) return false
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const isInRange = (date, startDate, endDate) => {
  if (!startDate || !endDate) return false
  const t = date.getTime()
  return t >= startDate.getTime() && t <= endDate.getTime()
}

const calendarCells = computed(() => {
  const startDate = parseYmd(dateRange.value.start)
  const endDate = parseYmd(dateRange.value.end)

  const list = []
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStartDate.value)
    date.setDate(gridStartDate.value.getDate() + i)
    date.setHours(0, 0, 0, 0)

    const inMonth = date.getMonth() === cursorMonth.value && date.getFullYear() === cursorYear.value
    const disabled = !inMonth || date.getTime() <= todayStart.getTime()
    const className = [
      startDate && sameDay(date, startDate) ? 'is-start' : '',
      endDate && sameDay(date, endDate) ? 'is-end' : '',
      startDate && endDate && isInRange(date, startDate, endDate) ? 'is-in-range' : '',
      disabled ? 'is-disabled' : ''
    ]
      .filter(Boolean)
      .join(' ')

    list.push({
      key: `${cursorYear.value}-${cursorMonth.value}-${i}`,
      date,
      inMonth,
      disabled,
      label: date.getDate(),
      className
    })
  }
  return list
})

const rangeText = computed(() => {
  if (!dateRange.value.start || !dateRange.value.end) return ''
  if (dateRange.value.start === dateRange.value.end) return `已选择：${dateRange.value.start}`
  return `已选择：${dateRange.value.start} 至 ${dateRange.value.end}`
})

const selectCalendarDate = (date) => {
  const ymd = toYmd(date)

  if (!dateRange.value.start) {
    dateRange.value = { start: ymd, end: ymd }
    return
  }

  if (dateRange.value.start && dateRange.value.end && dateRange.value.start !== dateRange.value.end) {
    dateRange.value = { start: ymd, end: ymd }
    return
  }

  const startDate = parseYmd(dateRange.value.start)
  const clickedDate = parseYmd(ymd)

  if (!startDate || !clickedDate) {
    dateRange.value = { start: ymd, end: ymd }
    return
  }

  const min = clickedDate.getTime() < startDate.getTime() ? clickedDate : startDate
  const max = clickedDate.getTime() < startDate.getTime() ? startDate : clickedDate

  dateRange.value = { start: toYmd(min), end: toYmd(max) }
}

const prevMonth = () => {
  const d = new Date(cursorYear.value, cursorMonth.value, 1)
  d.setMonth(d.getMonth() - 1)
  cursorYear.value = d.getFullYear()
  cursorMonth.value = d.getMonth()
}

const nextMonth = () => {
  const d = new Date(cursorYear.value, cursorMonth.value, 1)
  d.setMonth(d.getMonth() + 1)
  cursorYear.value = d.getFullYear()
  cursorMonth.value = d.getMonth()
}

const removePlace = (index) => {
  store.removeDraftPlace(draftKey.value, index)
}

const validateForm = () => {
  const newErrors = {}
  
  if (!formData.value.name.trim()) {
    newErrors.name = '规划名称不能为空'
  }
  
  if (!dateRange.value.start || !dateRange.value.end) {
    newErrors.date = '出行日期不能为空'
  } else {
    const startDate = parseYmd(dateRange.value.start)
    const endDate = parseYmd(dateRange.value.end)
    if (!startDate || !endDate) {
      newErrors.date = '出行日期格式错误'
    } else if (startDate.getTime() <= todayStart.getTime() || endDate.getTime() <= todayStart.getTime()) {
      newErrors.date = '出行日期必须晚于今日'
    }
  }
  
  if (formData.value.budget < 0) {
    newErrors.budget = '预算不能为负数'
  }
  
  if (formData.value.people_count < 1) {
    newErrors.people_count = '人数至少为1人'
  }
  
  errors.value = newErrors
  const keys = Object.keys(newErrors)
  if (keys.length === 0) return true

  const ordered = ['name', 'date', 'budget', 'people_count', 'preferences']
  for (const k of ordered) {
    if (newErrors[k]) {
      showToast(newErrors[k])
      return false
    }
  }

  showToast(newErrors[keys[0]])
  return false
}

const syncLocations = async (id) => {
  const response = await locationApi.getLocations(id)
  const existing = response.data || []

  for (const item of existing) {
    await locationApi.deleteLocation(id, item.id)
  }

  for (const place of selectedPlaces.value) {
    await locationApi.addLocation(id, {
      name: place.name,
      address: place.address || '',
      latitude: place.lat,
      longitude: place.lng,
      description: ''
    })
  }
}

const submitForm = async () => {
  if (!validateForm()) {
    return
  }
  
  loading.value = true
  error.value = null
  
  try {
    const planData = buildPlanData()
    
    let response
    if (isEdit.value) {
      response = await planApi.updatePlan(planId.value, planData)
      store.updatePlan(response.data)
      await syncLocations(planId.value)
    } else {
      response = await planApi.createPlan(planData)
      store.addPlan(response.data)
      await syncLocations(response.data.id)
    }
    store.clearDraftPlaces(draftKey.value)
    store.clearDraftDateRange(draftKey.value)
    store.clearDraftPlanForm(draftKey.value)
    router.push('/')
  } catch (err) {
    error.value = isEdit.value ? '更新规划失败，请稍后重试' : '创建规划失败，请稍后重试'
    console.error('Error submitting form:', err)
  } finally {
    loading.value = false
  }
}

const fetchLocations = async () => {
  try {
    if (selectedPlaces.value.length > 0) return
    const response = await locationApi.getLocations(planId.value)
    const locations = response.data || []
    locations.forEach((location) => {
      store.addDraftPlace(draftKey.value, {
        name: location.name,
        address: location.address || '',
        lng: location.longitude,
        lat: location.latitude
      })
    })
  } catch (err) {
    console.error('Error fetching locations:', err)
  }
}

const fetchPlan = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await planApi.getPlan(planId.value)
    const plan = response.data
    formData.value = {
      name: plan.name,
      budget: plan.budget,
      people_count: plan.people_count,
      preferences: typeof plan.preferences === 'string' ? plan.preferences : plan.preferences.join(', '),
      summary: plan.summary || ''
    }

    const rawStart = plan.start_date || plan.date
    const rawEnd = plan.end_date || plan.start_date || plan.date
    const start = typeof rawStart === 'string' ? rawStart.split('T')[0] : ''
    const end = typeof rawEnd === 'string' ? rawEnd.split('T')[0] : ''
    const saved = store.getDraftDateRange(draftKey.value)
    dateRange.value = saved || { start: start || '', end: end || start || '' }
  } catch (err) {
    error.value = '获取规划信息失败，请稍后重试'
    console.error('Error fetching plan:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const savedForm = store.getDraftPlanForm(draftKey.value)
  if (savedForm) {
    formData.value = { ...formData.value, ...savedForm }
  }
  const saved = store.getDraftDateRange(draftKey.value)
  if (saved) {
    dateRange.value = saved
  }
  if (isEdit.value) {
    fetchPlan()
    fetchLocations()
  }
})
</script>

<style scoped>
.plan-form {
  max-width: 880px;
  margin: 0 auto;
  animation: fadeIn 1s ease-out;
}

.page-title {
  margin-bottom: 2rem;
  font-size: 2rem;
  font-weight: 700;
  background: var(--text-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-align: center;
  margin-top: 1rem;
}

.card {
  position: relative;
}

.loading-mask {
  position: absolute;
  inset: 0;
  border-radius: var(--border-radius);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
}

.loading-mask-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  padding: 1.1rem 1.25rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.08);
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 3px solid rgba(78, 205, 196, 0.25);
  border-top-color: rgba(78, 205, 196, 0.95);
  animation: spin 0.85s linear infinite;
}

.loading-mask-text {
  font-weight: 850;
  color: rgba(0, 0, 0, 0.72);
  letter-spacing: 0.02em;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  position: relative;
  animation: slideInUp 0.6s ease-out;
}

.form-group:nth-child(1) { animation-delay: 0.1s; }
.form-group:nth-child(2) { animation-delay: 0.2s; }
.form-group:nth-child(3) { animation-delay: 0.3s; }
.form-group:nth-child(4) { animation-delay: 0.4s; }
.form-group:nth-child(5) { animation-delay: 0.5s; }

.form-label {
  display: block;
  margin-bottom: 0.75rem;
  font-weight: 600;
  font-size: 1.1rem;
  color: #333;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 1rem;
  top: 20%;
  transform: translateY(-20%);
  font-size: 1.2rem;
  color: #666;
  z-index: 1;
}

.form-input {
  width: 100%;
  padding: 1rem 1rem 1rem 3.5rem;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--border-radius);
  font-size: 1rem;
  transition: var(--transition);
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
}

.form-input:focus {
  outline: none;
  border-color: #4ECDC4;
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  transform: translateY(-2px);
}

.date-picker {
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
  padding: 1rem;
  overflow: hidden;
}

.date-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.date-month {
  font-weight: 800;
  color: #2c2c2c;
}

.date-nav {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  font-size: 1.25rem;
  font-weight: 800;
  color: #333;
  padding: 0;
}

.date-nav::before,
.date-day::before {
  content: none;
}

.date-nav:hover,
.date-nav:active,
.date-day:hover,
.date-day:active {
  transform: none;
}

.date-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.date-weekday {
  text-align: center;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.55);
  font-size: 0.9rem;
  padding: 0.35rem 0;
}

.date-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.4rem;
}

.date-day {
  height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  font-weight: 800;
  color: #2b2b2b;
  width: 100%;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.date-day:disabled {
  opacity: 0.35;
  cursor: default;
}

.date-day.is-in-range {
  background: rgba(78, 205, 196, 0.22);
  border-color: rgba(78, 205, 196, 0.25);
}

.date-day.is-start,
.date-day.is-end {
  background: linear-gradient(135deg, #45B7D1, #4ECDC4);
  color: #fff;
  border-color: rgba(0, 0, 0, 0);
}

.date-range-text {
  margin-top: 0.8rem;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.75);
}

.textarea-wrapper {
  align-items: flex-start;
}

.textarea-wrapper .input-icon {
  top: 20%;
  transform: translateY(-20%);
}

.form-input[type="textarea"] {
  resize: vertical;
  min-height: 120px;
  padding-top: 1rem;
}

.error {
  color: #FF6B6B;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  animation: shake 0.5s ease-in-out;
}

.error-message {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid #FF6B6B;
  border-radius: var(--border-radius);
  padding: 1rem;
  margin-top: 1.5rem;
  color: #FF6B6B;
  font-weight: 500;
  text-align: center;
}

.toast {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  max-width: min(92vw, 520px);
  padding: 0.85rem 1rem;
  border-radius: 14px;
  font-weight: 700;
  text-align: center;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
  animation: fadeIn 0.18s ease-out;
}

.toast-error {
  background: rgba(255, 107, 107, 0.14);
  border: 1px solid rgba(255, 107, 107, 0.55);
  color: #FF6B6B;
  backdrop-filter: blur(10px);
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  animation: slideInUp 0.6s ease-out 0.6s both;
}

.submit-button{
  flex: 1;
  padding: 1rem 2rem;
  border: none;
  border-radius: var(--border-radius);
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}

.submit-button {
  background: var(--button-gradient);
  color: white;
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

.submit-button:hover {
  background: var(--button-hover-gradient);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 107, 107, 0.4);
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.map-button {
  width: 100%;
  padding: 1rem;
  border: none;
  border-radius: var(--border-radius);
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  background: linear-gradient(135deg, #96CEB4, #FFEAA7);
  color: #333;
  box-shadow: 0 4px 12px rgba(150, 206, 180, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.map-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(150, 206, 180, 0.4);
}

.map-button-under-list {
  margin-top: 0.8rem;
}

.itinerary-button {
  background: linear-gradient(135deg, #45B7D1, #4ECDC4);
  color: #fff;
  box-shadow: 0 4px 12px rgba(69, 183, 209, 0.28);
}

.itinerary-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(69, 183, 209, 0.32);
}

.itinerary-button:disabled {
  background: rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.5);
  box-shadow: none;
  transform: none;
}

.summary-input {
  min-height: 110px;
}

.summary-meta {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.summary-count {
  font-size: 0.9rem;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.6);
}

.summary-ai {
  border: none;
  border-radius: var(--border-radius);
  padding: 0.7rem 1rem;
  cursor: pointer;
  font-weight: 700;
  background: linear-gradient(135deg, rgba(255, 234, 167, 0.95), rgba(150, 206, 180, 0.95));
  color: #333;
  transition: var(--transition);
  box-shadow: 0 4px 12px rgba(150, 206, 180, 0.22);
  flex: 0 0 auto;
}

.summary-ai:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(150, 206, 180, 0.3);
}

.summary-ai:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.summary-ai-stop {
  border: none;
  border-radius: var(--border-radius);
  padding: 0.7rem 1rem;
  cursor: pointer;
  font-weight: 700;
  background: rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.75);
  transition: var(--transition);
  flex: 0 0 auto;
}

.summary-ai-stop:hover {
  background: rgba(0, 0, 0, 0.12);
}

.button-icon {
  font-size: 1.2rem;
}

.locations-empty {
  color: #666;
  background: rgba(255, 255, 255, 0.75);
  border-radius: var(--border-radius);
  padding: 0.8rem 1rem;
}

.locations-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.location-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
  padding: 0.7rem 0.9rem;
  border-radius: 10px;
}

.location-name {
  color: #333;
  font-weight: 500;
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remove-location {
  border: none;
  border-radius: 6px;
  background: #FF6B6B;
  color: #fff;
  padding: 0.35rem 0.7rem;
  cursor: pointer;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes slideInUp {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .form-actions {
    flex-direction: column;
  }
  
  .submit-button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .date-picker {
    padding: 0.75rem;
  }

  .date-nav {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }

  .date-weekdays {
    gap: 0.25rem;
  }

  .date-weekday {
    font-size: 0.8rem;
  }

  .date-grid {
    gap: 0.25rem;
  }

  .date-day {
    height: 36px;
    border-radius: 10px;
    font-size: 0.95rem;
  }

  .locations-list {
    max-height: 40vh;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }

  .location-item {
    align-items: flex-start;
    gap: 0.6rem;
  }

  .location-name {
    white-space: normal;
    overflow: hidden;
    text-overflow: clip;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .remove-location {
    min-height: 40px;
    padding: 0.45rem 0.8rem;
  }

  .summary-meta {
    flex-direction: column;
    align-items: stretch;
  }

  .summary-ai {
    width: 100%;
  }
}
</style>
