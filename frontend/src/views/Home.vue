<template>
  <div class="home">
    <h2 class="page-title">出行规划列表</h2>
    <div class="actions">
      <router-link to="/create">
        <button class="create-button">
          <span class="plus-icon">+</span> 创建新规划
        </button>
      </router-link>
    </div>
    
    <div v-if="loading" class="loading">加载中...</div>
    
    <div v-else-if="error" class="error">{{ error }}</div>
    
    <div v-else-if="plans.length === 0" class="empty">
      <div class="empty-icon">🗺️</div>
      <h3>暂无规划</h3>
      <p>点击"创建新规划"开始你的旅程</p>
      <router-link to="/create">
        <button class="secondary-button">开始规划</button>
      </router-link>
    </div>
    
    <div v-else class="plan-list">
      <div v-for="(plan, index) in plans" :key="plan.id" class="plan-card card" :style="{ animationDelay: `${index * 0.1}s` }">
        <div class="plan-card-header">
          <h3 class="plan-title">{{ plan.name }}</h3>
          <div class="plan-date">{{ formatPlanDate(plan) }}</div>
        </div>
        <div class="plan-card-body">
          <div class="plan-info">
            <div class="info-item">
              <span class="info-label">预算</span>
              <span class="info-value">¥{{ plan.budget }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">人数</span>
              <span class="info-value">{{ plan.people_count }}人</span>
            </div>
            <div v-if="plan.preferences && plan.preferences.length > 0" class="info-item">
              <span class="info-label">偏好</span>
              <div class="preferences">
                <span v-for="(pref, idx) in plan.preferences" :key="idx" class="preference-tag">
                  {{ pref }}
                </span>
              </div>
            </div>
          </div>
          <div class="summary-block">
            <div class="summary-title">总结</div>
            <div class="summary-content">{{ plan.summary || '暂无总结' }}</div>
          </div>
        </div>
        <div class="plan-card-footer">
          <router-link :to="`/plan/${plan.id}`">
            <button class="detail-button">详情</button>
          </router-link>
          <router-link :to="`/edit/${plan.id}`">
            <button class="edit-button">编辑</button>
          </router-link>
          <button
            @click="openCopyModal(plan)"
            class="copy-button"
            :disabled="copying"
          >
            {{ copying && copyingPlanId === plan.id ? '复制中...' : '复制' }}
          </button>
          <button @click="openDeleteModal(plan)" class="delete-button" :disabled="deleting">
            {{ deleting && deleteTargetPlan?.id === plan.id ? '删除中...' : '删除' }}
          </button>
        </div>
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
          <div v-if="deleteTargetPlan?.name" class="modal-hint">当前规划：{{ deleteTargetPlan.name }}</div>
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
import { useRouter } from 'vue-router'
import { planApi } from '../api'
import store from '../store'

const router = useRouter()
const loading = ref(false)
const error = ref(null)
const plans = ref([])
const copyModalOpen = ref(false)
const copying = ref(false)
const copyingPlanId = ref(null)
const copyTargetPlan = ref(null)
const copyError = ref('')
const deleteModalOpen = ref(false)
const deleting = ref(false)
const deleteTargetPlan = ref(null)
const deleteError = ref('')

const fetchPlans = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await planApi.getPlans()
    plans.value = response.data
    store.setPlans(response.data)
  } catch (err) {
    error.value = '获取规划列表失败，请稍后重试'
    console.error('Error fetching plans:', err)
  } finally {
    loading.value = false
  }
}

const openDeleteModal = (plan) => {
  deleteTargetPlan.value = plan
  deleteError.value = ''
  deleteModalOpen.value = true
}

const closeDeleteModal = () => {
  if (deleting.value) return
  deleteModalOpen.value = false
  deleteTargetPlan.value = null
  deleteError.value = ''
}

const confirmDelete = async () => {
  if (!deleteTargetPlan.value || deleting.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await planApi.deletePlan(deleteTargetPlan.value.id)
    store.deletePlan(deleteTargetPlan.value.id)
    fetchPlans()
    deleteModalOpen.value = false
    deleteTargetPlan.value = null
  } catch (err) {
    deleteError.value = err?.response?.data?.detail || '删除规划失败，请稍后重试'
    console.error('Error deleting plan:', err)
  } finally {
    deleting.value = false
  }
}

const formatPlanDate = (plan) => {
  const start = plan?.start_date || plan?.date
  const end = plan?.end_date || plan?.start_date || plan?.date

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

const openCopyModal = (plan) => {
  copyTargetPlan.value = plan
  copyError.value = ''
  copyModalOpen.value = true
}

const closeCopyModal = () => {
  if (copying.value) return
  copyModalOpen.value = false
  copyTargetPlan.value = null
  copyError.value = ''
}

const confirmCopy = async () => {
  if (!copyTargetPlan.value || copying.value) return
  copying.value = true
  copyingPlanId.value = copyTargetPlan.value.id
  copyError.value = ''
  try {
    const res = await planApi.copyPlan(copyTargetPlan.value.id)
    const newId = res?.data?.id
    if (!newId) {
      copyError.value = '复制失败，请稍后重试'
      return
    }
    copyModalOpen.value = false
    copyTargetPlan.value = null
    router.push(`/edit/${newId}`)
  } catch (e) {
    copyError.value = e?.response?.data?.detail || '复制失败，请稍后重试'
  } finally {
    copying.value = false
    copyingPlanId.value = null
  }
}

onMounted(() => {
  fetchPlans()
})
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  animation: fadeIn 1s ease-out;
}

.page-title {
  margin-bottom: 1.5rem;
  font-size: 2rem;
  font-weight: 700;
  background: var(--text-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-align: center;
  margin-top: 1rem;
}

.actions {
  margin-bottom: 2rem;
  text-align: center;
}

.home :deep(a) {
  text-decoration: none;
  color: inherit;
}

.create-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 700;
  background: var(--button-gradient);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: var(--transition);
  box-shadow: 0 6px 20px rgba(255, 107, 107, 0.3);
}

.create-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(255, 107, 107, 0.4);
}

.plus-icon {
  font-size: 1.5rem;
  font-weight: bold;
}

.plan-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 2rem;
}

.plan-card {
  background: var(--card-gradient);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  padding: 1.5rem;
  transition: var(--transition);
  position: relative;
  overflow: hidden;
  animation: slideInUp 0.6s ease-out;
}

.plan-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: var(--primary-gradient);
}

.plan-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.plan-card-header {
  margin-bottom: 1.5rem;
  position: relative;
}

.plan-title {
  font-size: 1.3rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  color: #333;
}

.plan-date {
  font-size: 0.9rem;
  color: #666;
  background: rgba(78, 205, 196, 0.1);
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
  display: inline-block;
}

.plan-card-body {
  margin-bottom: 1.5rem;
}

.plan-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.info-item:last-child {
  border-bottom: none;
}

.summary-block {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.summary-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.68);
  text-align: center;
  letter-spacing: 0.08em;
}

.summary-content {
  margin-top: 0.75rem;
  font-size: 0.98rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.74);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
}

.info-label {
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
}

.info-value {
  font-size: 1rem;
  font-weight: 600;
  color: #333;
}

.preferences {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0 1rem;
}

.preference-tag {
  background: var(--accent-gradient);
  color: #333;
  padding: 0.2rem 0.6rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 500;
}

.plan-card-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.detail-button, .edit-button, .delete-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  flex: 1;
  min-width: 80px;
  text-align: center;
}

.copy-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  flex: 1;
  min-width: 80px;
  text-align: center;
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

.detail-button {
  background: linear-gradient(135deg, #45B7D1, #4ECDC4);
  color: white;
}

.edit-button {
  background: linear-gradient(135deg, #FFEAA7, #96CEB4);
  color: #333;
}

.delete-button {
  background: linear-gradient(135deg, #FF6B6B, #FF8E8E);
  color: white;
}

.detail-button:hover, .edit-button:hover, .delete-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.empty {
  text-align: center;
  padding: 4rem 2rem;
  background: var(--card-gradient);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  margin-top: 2rem;
  backdrop-filter: blur(10px);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-20px);
  }
  60% {
    transform: translateY(-10px);
  }
}

.empty h3 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: #333;
}

.empty p {
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 2rem;
}

.secondary-button {
  background: linear-gradient(135deg, #96CEB4, #FFEAA7);
  color: #333;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: var(--border-radius);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.secondary-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(150, 206, 180, 0.3);
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

@keyframes slideInUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
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
  .plan-list {
    grid-template-columns: 1fr;
  }
  
  .plan-card-footer {
    flex-direction: column;
  }
  
  .plan-card-footer button {
    width: 100%;
  }
}
</style>
