<template>
  <div class="plan-detail">
    <div v-if="loading" class="loading">加载中...</div>
    
    <div v-else-if="error" class="error">
      {{ error }}
      <button @click="fetchPlan" class="retry-button">重试</button>
    </div>
    
    <div v-else-if="plan" class="card">
      <div class="plan-header">
        <h2 class="plan-title">{{ plan.name }}</h2>
        <div class="plan-date-badge">{{ formatPlanDate(plan) }}</div>
      </div>
      
      <div class="plan-info">
        <div class="info-section">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-icon">💰</span>
              <div class="info-content">
                <span class="info-label">预算</span>
                <span class="info-value">¥{{ plan.budget }}</span>
              </div>
            </div>
            <div class="info-item">
              <span class="info-icon">👥</span>
              <div class="info-content">
                <span class="info-label">人数</span>
                <span class="info-value">{{ plan.people_count }}人</span>
              </div>
            </div>
            <div class="info-item full-width">
              <span class="info-icon">🎯</span>
              <div class="info-content">
                <span class="info-label">偏好</span>
                <div class="preferences">
                  <span v-for="(pref, idx) in formatPreferences(plan.preferences)" :key="idx" class="preference-tag">
                    {{ pref }}
                  </span>
                </div>
              </div>
            </div>
            <div class="info-item">
              <span class="info-icon">📅</span>
              <div class="info-content">
                <span class="info-label">创建时间</span>
                <span class="info-value">{{ formatDateTime(plan.created_at) }}</span>
              </div>
            </div>
            <div class="info-item">
              <span class="info-icon">🔄</span>
              <div class="info-content">
                <span class="info-label">更新时间</span>
                <span class="info-value">{{ formatDateTime(plan.updated_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="schedule">
        <div class="schedule-header">
          <div class="schedule-title">行程安排</div>
          <div class="schedule-count">{{ itineraries.length }}</div>
        </div>
        <div v-if="itineraryLoading" class="schedule-state">加载行程中...</div>
        <div v-else-if="itineraryError" class="schedule-state schedule-error">{{ itineraryError }}</div>
        <div v-else-if="itineraries.length === 0" class="schedule-state">暂无行程安排</div>
        <div v-else class="schedule-list">
          <div v-for="item in itineraries" :key="item.id" class="schedule-row">
            <div class="schedule-when">
              <div class="when-date">{{ item.date }}</div>
              <div class="when-period">{{ periodLabel(item.period) }}</div>
            </div>
            <div class="schedule-main">
              <div class="schedule-name" :title="item.location_name">{{ item.location_name }}</div>
              <div class="schedule-meta">
                <div class="meta-chip">时长 {{ formatDuration(item.duration_minutes) }}</div>
                <div class="meta-chip">金额 ¥{{ Number(item.cost || 0).toFixed(0) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="summary">
        <div class="summary-header">
          <div class="summary-title">总结</div>
        </div>
        <div v-if="!plan.summary" class="summary-state">暂无总结</div>
        <div v-else class="summary-body">{{ plan.summary }}</div>
      </div>
      
      <div class="actions">
        <router-link :to="`/edit/${plan.id}`">
          <button class="edit-button">编辑</button>
        </router-link>
        <button class="copy-button" :disabled="copying" @click="openCopyModal">
          {{ copying ? '复制中...' : '复制规划' }}
        </button>
        <button @click="openDeleteModal" class="delete-button" :disabled="deleting">
          {{ deleting ? '删除中...' : '删除' }}
        </button>
        <router-link to="/">
          <button class="back-button">返回列表</button>
        </router-link>
      </div>
    </div>

    <div v-if="copyModalOpen" class="modal-mask" @click.self="closeCopyModal">
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-title">复制规划</div>
        <div class="modal-content">
          <div>将基于当前规划创建一份新规划（不会影响原规划）。</div>
          <div class="modal-hint">复制内容包含：地点、行程安排、总结等。</div>
        </div>
        <div v-if="copyError" class="modal-error">{{ copyError }}</div>
        <div class="modal-actions">
          <button class="modal-button secondary" type="button" :disabled="copying" @click="closeCopyModal">取消</button>
          <button class="modal-button primary" type="button" :disabled="copying" @click="confirmCopy">
            {{ copying ? '复制中...' : '确认复制' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="deleteModalOpen" class="modal-mask" @click.self="closeDeleteModal">
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-title">删除规划</div>
        <div class="modal-content">
          <div>确认要删除该规划吗？删除后将无法恢复。</div>
          <div v-if="plan?.name" class="modal-hint">当前规划：{{ plan.name }}</div>
        </div>
        <div v-if="deleteError" class="modal-error">{{ deleteError }}</div>
        <div class="modal-actions">
          <button class="modal-button secondary" type="button" :disabled="deleting" @click="closeDeleteModal">取消</button>
          <button class="modal-button primary" type="button" :disabled="deleting" @click="confirmDelete">
            {{ deleting ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { itineraryApi, planApi } from '../api'
import store from '../store'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const error = ref(null)
const plan = ref(null)
const planId = route.params.id
const itineraries = ref([])
const itineraryLoading = ref(false)
const itineraryError = ref('')
const copyModalOpen = ref(false)
const copying = ref(false)
const copyError = ref('')

const fetchPlan = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await planApi.getPlan(planId)
    plan.value = response.data
    store.setCurrentPlan(response.data)
    fetchItineraries()
  } catch (err) {
    error.value = '获取规划详情失败，请稍后重试'
    console.error('Error fetching plan:', err)
  } finally {
    loading.value = false
  }
}

const fetchItineraries = async () => {
  itineraryLoading.value = true
  itineraryError.value = ''
  try {
    const res = await itineraryApi.getItineraries(planId)
    itineraries.value = res.data || []
  } catch (e) {
    itineraryError.value = '获取行程安排失败，请稍后重试'
  } finally {
    itineraryLoading.value = false
  }
}

const periodLabel = (period) => {
  if (period === 'morning') return '上午'
  if (period === 'noon') return '中午'
  if (period === 'afternoon') return '下午'
  return period || ''
}

const formatDuration = (minutes) => {
  const m = Number(minutes || 0)
  if (m === 480) return '全天'
  if (m === 30) return '0.5h'
  if (m % 60 === 0 && m > 0) return `${m / 60}h`
  return `${m}min`
}

const deleteModalOpen = ref(false)
const deleting = ref(false)
const deleteError = ref('')

const openDeleteModal = () => {
  deleteError.value = ''
  deleteModalOpen.value = true
}

const closeDeleteModal = () => {
  if (deleting.value) return
  deleteModalOpen.value = false
  deleteError.value = ''
}

const confirmDelete = async () => {
  if (deleting.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await planApi.deletePlan(planId)
    store.deletePlan(planId)
    router.push('/')
  } catch (err) {
    deleteError.value = err?.response?.data?.detail || '删除规划失败，请稍后重试'
    console.error('Error deleting plan:', err)
  } finally {
    deleting.value = false
  }
}

const formatPlanDate = (p) => {
  const start = p?.start_date || p?.date
  const end = p?.end_date || p?.start_date || p?.date

  const startDate = new Date(start)
  const endDate = new Date(end)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return ''

  const startText = startDate.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })

  const endText = endDate.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })

  if (startDate.toDateString() === endDate.toDateString()) return startText
  return `${startText} 至 ${endText}`
}

const formatDateTime = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN')
}

const formatPreferences = (preferences) => {
  if (typeof preferences === 'string') {
    try {
      const parsed = JSON.parse(preferences)
      return Array.isArray(parsed) ? parsed : [preferences]
    } catch {
      return [preferences]
    }
  } else if (Array.isArray(preferences)) {
    return preferences
  }
  return []
}

onMounted(() => {
  fetchPlan()
})

const openCopyModal = () => {
  copyError.value = ''
  copyModalOpen.value = true
}

const closeCopyModal = () => {
  if (copying.value) return
  copyModalOpen.value = false
  copyError.value = ''
}

const confirmCopy = async () => {
  if (copying.value) return
  copying.value = true
  copyError.value = ''
  try {
    const res = await planApi.copyPlan(planId)
    const newId = res?.data?.id
    if (!newId) {
      copyError.value = '复制失败，请稍后重试'
      return
    }
    copyModalOpen.value = false
    router.push(`/edit/${newId}`)
  } catch (e) {
    copyError.value = e?.response?.data?.detail || '复制失败，请稍后重试'
  } finally {
    copying.value = false
  }
}
</script>

<style scoped>
.plan-detail {
  max-width: 800px;
  margin: 0 auto;
  animation: fadeIn 1s ease-out;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  position: relative;
}

.plan-title {
  font-size: 2rem;
  font-weight: 700;
  background: var(--text-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
  flex: 1;
}

.plan-date-badge {
  font-size: 0.9rem;
  color: #666;
  background: rgba(78, 205, 196, 0.1);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  display: inline-block;
  margin-left: 1rem;
}

.plan-info {
  margin: 2rem 0;
}

.schedule {
  margin-top: 1.4rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--border-radius);
  padding: 1.6rem 1.6rem 1.4rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

.summary {
  margin-top: 1.4rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--border-radius);
  padding: 1.6rem 1.6rem 1.4rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.summary-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: #333;
}

.summary-state {
  font-weight: 700;
  color: rgba(0, 0, 0, 0.65);
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--border-radius);
  padding: 0.9rem 1rem;
}

.summary-body {
  font-weight: 650;
  color: rgba(0, 0, 0, 0.74);
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--border-radius);
  padding: 1rem 1rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
}

.schedule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.schedule-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: #333;
}

.schedule-count {
  font-weight: 800;
  color: rgba(0, 0, 0, 0.6);
  background: rgba(78, 205, 196, 0.12);
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
}

.schedule-state {
  font-weight: 700;
  color: rgba(0, 0, 0, 0.65);
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--border-radius);
  padding: 0.9rem 1rem;
}

.schedule-state.schedule-error {
  color: rgba(0, 0, 0, 0.72);
  background: rgba(255, 107, 107, 0.12);
  border-color: rgba(255, 107, 107, 0.18);
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.schedule-row {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--border-radius);
  padding: 0.95rem 1rem;
  transition: var(--transition);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.schedule-row:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.schedule-when {
  flex: 0 0 auto;
  padding: 0.6rem 0.75rem;
  border-radius: 14px;
  background: rgba(69, 183, 209, 0.1);
  border: 1px solid rgba(69, 183, 209, 0.14);
}

.when-date {
  font-weight: 850;
  color: rgba(0, 0, 0, 0.75);
  font-size: 0.92rem;
}

.when-period {
  margin-top: 0.25rem;
  font-weight: 850;
  color: rgba(0, 0, 0, 0.6);
  font-size: 0.86rem;
}

.schedule-main {
  min-width: 0;
  flex: 1 1 auto;
}

.schedule-name {
  font-weight: 800;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.schedule-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.55rem;
}

.meta-chip {
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  font-weight: 850;
  font-size: 0.85rem;
  color: rgba(0, 0, 0, 0.68);
  background: rgba(78, 205, 196, 0.14);
  border: 1px solid rgba(78, 205, 196, 0.16);
}

.info-section {
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--border-radius);
  padding: 2rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.8);
  border-radius: var(--border-radius);
  transition: var(--transition);
}

.info-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-icon {
  font-size: 1.5rem;
  min-width: 32px;
  text-align: center;
}

.info-content {
  flex: 1;
}

.info-label {
  display: block;
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.info-value {
  display: block;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.preferences {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.preference-tag {
  background: var(--accent-gradient);
  color: #333;
  padding: 0.3rem 0.8rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 500;
}

.actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  justify-content: flex-end;
}

.edit-button, .delete-button, .back-button, .retry-button, .copy-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--border-radius);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.copy-button {
  background: linear-gradient(135deg, #8ec5ff, #d8b4fe);
  color: #1f2937;
}

.copy-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.copy-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 50;
}

.modal-card {
  width: min(520px, 100%);
  background: rgba(255, 255, 255, 0.92);
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.18);
  padding: 1.25rem 1.25rem 1.1rem;
}

.modal-title {
  font-size: 1.15rem;
  font-weight: 900;
  color: rgba(0, 0, 0, 0.78);
  text-align: center;
  letter-spacing: 0.08em;
}

.modal-content {
  margin-top: 0.9rem;
  font-weight: 650;
  color: rgba(0, 0, 0, 0.72);
  line-height: 1.6;
}

.modal-hint {
  margin-top: 0.35rem;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.55);
}

.modal-error {
  margin-top: 0.9rem;
  padding: 0.75rem 0.9rem;
  border-radius: 12px;
  font-weight: 750;
  background: rgba(255, 107, 107, 0.12);
  border: 1px solid rgba(255, 107, 107, 0.18);
  color: rgba(0, 0, 0, 0.78);
}

.modal-actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.modal-button {
  border: none;
  border-radius: 14px;
  font-weight: 800;
  padding: 0.7rem 1rem;
  cursor: pointer;
  transition: var(--transition);
}

.modal-button.primary {
  background: linear-gradient(135deg, #45B7D1, #4ECDC4);
  color: white;
}

.modal-button.secondary {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.75);
}

.modal-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.edit-button {
  background: linear-gradient(135deg, #FFEAA7, #96CEB4);
  color: #333;
}

.delete-button {
  background: linear-gradient(135deg, #FF6B6B, #FF8E8E);
  color: white;
}

.back-button {
  background: linear-gradient(135deg, #45B7D1, #4ECDC4);
  color: white;
}

.retry-button {
  background: linear-gradient(135deg, #96CEB4, #FFEAA7);
  color: #333;
  margin-top: 1rem;
}

.edit-button:hover, .delete-button:hover, .back-button:hover, .retry-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .plan-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .plan-date-badge {
    margin-left: 0;
    margin-top: 0.5rem;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .actions {
    flex-direction: column;
  }
  
  .actions button {
    width: 100%;
  }
}
</style>
