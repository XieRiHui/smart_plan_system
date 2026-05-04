<template>
  <div class="itinerary-view">
    <div class="topbar">
      <button class="topbar-back" type="button" @click="goBack">返回</button>
      <div class="topbar-title">
        <div class="title-main">行程安排</div>
        <div v-if="plan" class="title-sub">
          {{ plan.name }}
          <span class="title-sep">·</span>
          预算 ¥{{ Number(plan.budget || 0).toFixed(0) }}
          <span class="title-sep">·</span>
          行程总额 ¥{{ sumCostText }}
        </div>
      </div>
      <div class="topbar-actions">
        <div v-if="syncingCount > 0" class="syncing">同步中 {{ syncingCount }}</div>
      </div>
    </div>

    <div v-if="inlineNotice" class="notice notice-top" :class="inlineNoticeType">{{ inlineNotice }}</div>

    <div v-if="loading" class="state state-loading">加载中...</div>
    <div v-else-if="error" class="state state-error">
      <div class="state-text">{{ error }}</div>
      <button class="state-retry" type="button" @click="loadAll">重试</button>
    </div>

    <div v-else class="content">
      <div class="date-tabs">
        <button
          v-for="d in dates"
          :key="d"
          type="button"
          class="date-tab"
          :class="{ active: d === activeDate }"
          @click="activeDate = d"
        >
          <div class="date-tab-day">{{ formatShortDay(d) }}</div>
          <div class="date-tab-date">{{ d }}</div>
        </button>
      </div>

      <div class="board">
        <div class="lane">
          <div class="lane-head">
            <div class="lane-title">上午</div>
            <div class="lane-meta">{{ laneItems('morning').length }}</div>
          </div>
          <div class="lane-body">
            <div v-if="laneItems('morning').length === 0" class="lane-empty">暂无安排</div>
            <div v-for="item in laneItems('morning')" :key="item.id" class="card">
              <div class="card-top">
                <div class="card-name" :title="item.location_name">{{ item.location_name }}</div>
                <button class="card-delete" type="button" :disabled="isItemBusy(item.id)" @click="removeItem(item)">
                  删除
                </button>
              </div>

              <div class="card-fields">
                <div class="field">
                  <div class="field-label">预计时长</div>
                  <select
                    class="field-control"
                    :value="String(item.duration_minutes)"
                    :disabled="isItemBusy(item.id)"
                    @change="onDurationChange(item, $event)"
                  >
                    <option value="30">0.5h</option>
                    <option value="60">1h</option>
                    <option value="120">2h</option>
                    <option value="180">3h</option>
                    <option value="240">4h</option>
                    <option value="480">全天</option>
                  </select>
                </div>

                <div class="field">
                  <div class="field-label">预计金额（元）</div>
                  <input
                    class="field-control"
                    type="number"
                    min="0"
                    step="1"
                    :value="item.cost"
                    :disabled="isItemBusy(item.id)"
                    @blur="onCostBlur(item, $event)"
                  />
                </div>
              </div>

              <div class="card-actions">
                <button class="card-move" type="button" :disabled="isItemBusy(item.id) || !canMoveUp(item)" @click="moveUp(item)">
                  上移
                </button>
                <button class="card-move" type="button" :disabled="isItemBusy(item.id) || !canMoveDown(item)" @click="moveDown(item)">
                  下移
                </button>
                <div v-if="isItemBusy(item.id)" class="card-sync">同步中...</div>
              </div>
            </div>
          </div>
        </div>

        <div class="lane">
          <div class="lane-head">
            <div class="lane-title">中午</div>
            <div class="lane-meta">{{ laneItems('noon').length }}</div>
          </div>
          <div class="lane-body">
            <div v-if="laneItems('noon').length === 0" class="lane-empty">暂无安排</div>
            <div v-for="item in laneItems('noon')" :key="item.id" class="card">
              <div class="card-top">
                <div class="card-name" :title="item.location_name">{{ item.location_name }}</div>
                <button class="card-delete" type="button" :disabled="isItemBusy(item.id)" @click="removeItem(item)">
                  删除
                </button>
              </div>

              <div class="card-fields">
                <div class="field">
                  <div class="field-label">预计时长</div>
                  <select
                    class="field-control"
                    :value="String(item.duration_minutes)"
                    :disabled="isItemBusy(item.id)"
                    @change="onDurationChange(item, $event)"
                  >
                    <option value="30">0.5h</option>
                    <option value="60">1h</option>
                    <option value="120">2h</option>
                    <option value="180">3h</option>
                    <option value="240">4h</option>
                    <option value="480">全天</option>
                  </select>
                </div>

                <div class="field">
                  <div class="field-label">预计金额（元）</div>
                  <input
                    class="field-control"
                    type="number"
                    min="0"
                    step="1"
                    :value="item.cost"
                    :disabled="isItemBusy(item.id)"
                    @blur="onCostBlur(item, $event)"
                  />
                </div>
              </div>

              <div class="card-actions">
                <button class="card-move" type="button" :disabled="isItemBusy(item.id) || !canMoveUp(item)" @click="moveUp(item)">
                  上移
                </button>
                <button class="card-move" type="button" :disabled="isItemBusy(item.id) || !canMoveDown(item)" @click="moveDown(item)">
                  下移
                </button>
                <div v-if="isItemBusy(item.id)" class="card-sync">同步中...</div>
              </div>
            </div>
          </div>
        </div>

        <div class="lane">
          <div class="lane-head">
            <div class="lane-title">下午</div>
            <div class="lane-meta">{{ laneItems('afternoon').length }}</div>
          </div>
          <div class="lane-body">
            <div v-if="laneItems('afternoon').length === 0" class="lane-empty">暂无安排</div>
            <div v-for="item in laneItems('afternoon')" :key="item.id" class="card">
              <div class="card-top">
                <div class="card-name" :title="item.location_name">{{ item.location_name }}</div>
                <button class="card-delete" type="button" :disabled="isItemBusy(item.id)" @click="removeItem(item)">
                  删除
                </button>
              </div>

              <div class="card-fields">
                <div class="field">
                  <div class="field-label">预计时长</div>
                  <select
                    class="field-control"
                    :value="String(item.duration_minutes)"
                    :disabled="isItemBusy(item.id)"
                    @change="onDurationChange(item, $event)"
                  >
                    <option value="30">0.5h</option>
                    <option value="60">1h</option>
                    <option value="120">2h</option>
                    <option value="180">3h</option>
                    <option value="240">4h</option>
                    <option value="480">全天</option>
                  </select>
                </div>

                <div class="field">
                  <div class="field-label">预计金额（元）</div>
                  <input
                    class="field-control"
                    type="number"
                    min="0"
                    step="1"
                    :value="item.cost"
                    :disabled="isItemBusy(item.id)"
                    @blur="onCostBlur(item, $event)"
                  />
                </div>
              </div>

              <div class="card-actions">
                <button class="card-move" type="button" :disabled="isItemBusy(item.id) || !canMoveUp(item)" @click="moveUp(item)">
                  上移
                </button>
                <button class="card-move" type="button" :disabled="isItemBusy(item.id) || !canMoveDown(item)" @click="moveDown(item)">
                  下移
                </button>
                <div v-if="isItemBusy(item.id)" class="card-sync">同步中...</div>
              </div>
            </div>
          </div>
        </div>

        <aside class="pool">
          <div class="pool-head">
            <div class="pool-title">地点池</div>
            <div class="pool-meta">{{ locations.length }}</div>
          </div>
          <div v-if="locations.length === 0" class="pool-empty">暂无地点，请先在地图选点添加地点</div>
          <div v-else class="pool-list">
            <div v-for="loc in locations" :key="loc.id" class="pool-item">
              <div class="pool-main">
                <div class="pool-name" :title="loc.name">{{ loc.name }}</div>
                <div class="pool-weather" :title="poolWeatherText(loc)">{{ poolWeatherText(loc) }}</div>
              </div>
              <div class="pool-actions">
                <button class="pool-add" type="button" :disabled="creatingLocationId === loc.id" @click="addToPeriod(loc, 'morning')">
                  上午
                </button>
                <button class="pool-add" type="button" :disabled="creatingLocationId === loc.id" @click="addToPeriod(loc, 'noon')">
                  中午
                </button>
                <button class="pool-add" type="button" :disabled="creatingLocationId === loc.id" @click="addToPeriod(loc, 'afternoon')">
                  下午
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <div v-if="confirmModal.open" class="modal-overlay" @click.self="onConfirmCancel">
      <div class="modal">
        <div class="modal-title">预算提示</div>
        <div class="modal-body">
          行程预计花费总和超过了整个规划预计花费，是否需要调整规划的预计花费为{{ confirmModal.sumCostText }}?
        </div>
        <div class="modal-actions">
          <button class="modal-btn ghost" type="button" :disabled="saving" @click="onConfirmCancel">取消</button>
          <button class="modal-btn primary" type="button" :disabled="saving" @click="confirmAdjustBudget">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { itineraryApi, locationApi, planApi, weatherApi } from '../api'

const route = useRoute()
const router = useRouter()

const planId = computed(() => String(route.params.id || ''))

const loading = ref(true)
const error = ref('')
const saving = ref(false)
const inlineNotice = ref('')
const inlineNoticeType = ref('ok')

const plan = ref(null)
const locations = ref([])
const itineraries = ref([])
const activeDate = ref('')
const dates = ref([])

const busyItemIds = ref(new Set())
const creatingLocationId = ref(null)
const maxPromptedSumCost = ref(0)

const confirmModal = ref({ open: false, sumCost: 0, sumCostText: '0' })
const pendingBack = ref(false)
const poolWeatherById = ref({})

const syncingCount = computed(() => busyItemIds.value.size + (creatingLocationId.value ? 1 : 0))

const sumCost = computed(() => {
  const list = itineraries.value || []
  return list.reduce((acc, item) => acc + Number(item?.cost || 0), 0)
})

const sumCostText = computed(() => Number(sumCost.value || 0).toFixed(0))

const setNotice = (text, type = 'ok') => {
  inlineNotice.value = text
  inlineNoticeType.value = type
  window.setTimeout(() => {
    if (inlineNotice.value === text) inlineNotice.value = ''
  }, 2400)
}

const formatShortDay = (ymd) => {
  const d = new Date(`${ymd}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  const w = d.getDay()
  const list = ['日', '一', '二', '三', '四', '五', '六']
  return `周${list[w]}`
}

const toYmd = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const buildDates = (p) => {
  const startRaw = p?.start_date || p?.date
  const endRaw = p?.end_date || p?.start_date || p?.date
  const start = typeof startRaw === 'string' ? startRaw.split('T')[0] : ''
  const end = typeof endRaw === 'string' ? endRaw.split('T')[0] : ''
  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T00:00:00`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return []
  const out = []
  const cursor = new Date(startDate)
  while (cursor.getTime() <= endDate.getTime()) {
    out.push(toYmd(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

const laneItems = (period) => {
  return (itineraries.value || [])
    .filter((i) => i.date === activeDate.value && i.period === period)
    .slice()
    .sort((a, b) => Number(a.order_index) - Number(b.order_index) || Number(a.id) - Number(b.id))
}

const isItemBusy = (id) => busyItemIds.value.has(id)

const navigateBack = () => {
  const returnTo = route.query?.returnTo
  if (typeof returnTo === 'string' && returnTo) {
    router.push(returnTo)
    return
  }

  const back = router?.options?.history?.state?.back
  if (back) {
    router.back()
    return
  }

  router.push(`/plan/${planId.value}`)
}

const goBack = async () => {
  const res = await handleSave()
  if (res?.prompted) {
    pendingBack.value = true
    return
  }
  navigateBack()
}

const loadAll = async () => {
  loading.value = true
  error.value = ''
  inlineNotice.value = ''
  try {
    const [planRes, locRes, itinRes] = await Promise.all([
      planApi.getPlan(planId.value),
      locationApi.getLocations(planId.value),
      itineraryApi.getItinerary(planId.value)
    ])
    plan.value = planRes.data
    locations.value = locRes.data || []
    itineraries.value = itinRes.data || []

    dates.value = buildDates(plan.value)
    if (!dates.value.length) {
      activeDate.value = ''
    } else if (!activeDate.value || !dates.value.includes(activeDate.value)) {
      activeDate.value = dates.value[0]
    }
  } catch (e) {
    error.value = e?.response?.data?.detail || '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const addToPeriod = async (loc, period) => {
  if (!activeDate.value) {
    setNotice('未找到有效日期范围', 'error')
    return
  }
  creatingLocationId.value = loc.id
  try {
    const payload = {
      plan_id: Number(planId.value),
      date: activeDate.value,
      period,
      location_id: loc.id,
      duration_minutes: 60,
      cost: 0,
      order_index: null
    }
    const res = await itineraryApi.createItinerary(payload)
    itineraries.value = [...itineraries.value, res.data]
    setNotice('已添加行程', 'ok')
  } catch (e) {
    setNotice(e?.response?.data?.detail || '添加失败，请稍后重试', 'error')
  } finally {
    creatingLocationId.value = null
  }
}

const withBusy = async (id, task) => {
  busyItemIds.value.add(id)
  busyItemIds.value = new Set(busyItemIds.value)
  try {
    return await task()
  } finally {
    busyItemIds.value.delete(id)
    busyItemIds.value = new Set(busyItemIds.value)
  }
}

const getPoolWeatherState = (loc) => {
  const key = String(loc?.id || '')
  if (!key) return null
  if (!poolWeatherById.value[key]) {
    poolWeatherById.value[key] = { loading: false, error: '', text: '', paramsKey: '' }
  }
  return poolWeatherById.value[key]
}

const buildPoolWeatherText = (day) => {
  const weatherText = day?.weather || ''
  const tempText =
    day?.temp_min != null && day?.temp_max != null ? `${day.temp_min}~${day.temp_max}℃` : '--'
  return weatherText ? `${weatherText} · ${tempText}` : tempText
}

const refreshPoolWeather = async (loc) => {
  if (!activeDate.value) return
  const state = getPoolWeatherState(loc)
  if (!state) return

  const lng = loc?.longitude
  const lat = loc?.latitude
  if (lng == null || lat == null) {
    state.text = '暂无天气数据'
    state.error = ''
    state.loading = false
    return
  }

  const paramsKey = `${lng},${lat}:${activeDate.value}`
  if (state.paramsKey === paramsKey && (state.text || state.error)) return

  state.loading = true
  state.error = ''
  state.paramsKey = paramsKey
  try {
    const res = await weatherApi.getForecast({
      longitude: lng,
      latitude: lat,
      start_date: activeDate.value,
      end_date: activeDate.value
    })
    const day = res?.data?.dates?.[0]
    state.text = day ? buildPoolWeatherText(day) : '暂无天气数据'
  } catch (e) {
    state.error = e?.response?.data?.detail || '天气加载失败'
    state.text = ''
  } finally {
    state.loading = false
  }
}

const poolWeatherText = (loc) => {
  if (!activeDate.value) return '未选择日期'
  const state = getPoolWeatherState(loc)
  if (!state) return '暂无天气数据'
  if (state.loading) return '天气加载中...'
  if (state.error) return state.error
  return state.text || '暂无天气数据'
}

watch(
  () => `${activeDate.value}|${(locations.value || []).map((x) => x.id).join(',')}`,
  () => {
    const ids = new Set((locations.value || []).map((x) => String(x.id)))
    Object.keys(poolWeatherById.value).forEach((k) => {
      if (!ids.has(k)) delete poolWeatherById.value[k]
    })
    if (!activeDate.value || !(locations.value || []).length) return
    Promise.all((locations.value || []).map((loc) => refreshPoolWeather(loc)))
  },
  { immediate: true }
)

const removeItem = async (item) => {
  await withBusy(item.id, async () => {
    try {
      await itineraryApi.deleteItinerary(item.id)
      itineraries.value = itineraries.value.filter((x) => x.id !== item.id)
      setNotice('已删除', 'ok')
    } catch (e) {
      setNotice(e?.response?.data?.detail || '删除失败，请稍后重试', 'error')
    }
  })
}

const onDurationChange = async (item, e) => {
  const next = Number(e?.target?.value || 0)
  await withBusy(item.id, async () => {
    try {
      const res = await itineraryApi.updateItinerary(item.id, { duration_minutes: next })
      itineraries.value = itineraries.value.map((x) => (x.id === item.id ? res.data : x))
    } catch (err) {
      setNotice(err?.response?.data?.detail || '更新失败，请稍后重试', 'error')
    }
  })
}

const onCostBlur = async (item, e) => {
  const raw = e?.target?.value
  const next = Math.max(0, Number(raw || 0))
  if (Number(next) === Number(item.cost || 0)) return

  await withBusy(item.id, async () => {
    try {
      const res = await itineraryApi.updateItinerary(item.id, { cost: next })
      itineraries.value = itineraries.value.map((x) => (x.id === item.id ? res.data : x))
    } catch (err) {
      setNotice(err?.response?.data?.detail || '更新失败，请稍后重试', 'error')
    }
  })
}

const canMoveUp = (item) => {
  const list = laneItems(item.period)
  const idx = list.findIndex((x) => x.id === item.id)
  return idx > 0
}

const canMoveDown = (item) => {
  const list = laneItems(item.period)
  const idx = list.findIndex((x) => x.id === item.id)
  return idx >= 0 && idx < list.length - 1
}

const swapOrder = async (a, b) => {
  const aOrder = Number(a.order_index || 0)
  const bOrder = Number(b.order_index || 0)

  await withBusy(a.id, async () => {
    await withBusy(b.id, async () => {
      const [ra, rb] = await Promise.all([
        itineraryApi.updateItinerary(a.id, { order_index: bOrder }),
        itineraryApi.updateItinerary(b.id, { order_index: aOrder })
      ])
      itineraries.value = itineraries.value.map((x) => {
        if (x.id === a.id) return ra.data
        if (x.id === b.id) return rb.data
        return x
      })
    })
  })
}

const moveUp = async (item) => {
  const list = laneItems(item.period)
  const idx = list.findIndex((x) => x.id === item.id)
  if (idx <= 0) return
  try {
    await swapOrder(list[idx - 1], list[idx])
  } catch (e) {
    setNotice(e?.response?.data?.detail || '排序更新失败，请稍后重试', 'error')
  }
}

const moveDown = async (item) => {
  const list = laneItems(item.period)
  const idx = list.findIndex((x) => x.id === item.id)
  if (idx < 0 || idx >= list.length - 1) return
  try {
    await swapOrder(list[idx], list[idx + 1])
  } catch (e) {
    setNotice(e?.response?.data?.detail || '排序更新失败，请稍后重试', 'error')
  }
}

const openConfirmModal = (sum) => {
  confirmModal.value = {
    open: true,
    sumCost: sum,
    sumCostText: `¥${Number(sum || 0).toFixed(0)}`
  }
}

const closeConfirmModal = () => {
  confirmModal.value = { open: false, sumCost: 0, sumCostText: '0' }
}

const onConfirmCancel = () => {
  closeConfirmModal()
  if (!pendingBack.value) return
  pendingBack.value = false
  setNotice('已保存', 'ok')
  navigateBack()
}

const confirmAdjustBudget = async () => {
  if (!plan.value) return
  saving.value = true
  try {
    const sum = Number(confirmModal.value.sumCost || 0)
    const res = await planApi.updatePlan(planId.value, { budget: sum })
    plan.value = res.data
    closeConfirmModal()
    setNotice('已保存', 'ok')
    if (pendingBack.value) {
      pendingBack.value = false
      navigateBack()
    }
  } catch (e) {
    setNotice(e?.response?.data?.detail || '更新规划预算失败，请稍后重试', 'error')
  } finally {
    saving.value = false
  }
}

const handleSave = async () => {
  if (!plan.value) return
  saving.value = true
  try {
    const sum = Number(sumCost.value || 0)
    const budget = Number(plan.value.budget || 0)
    if (sum > budget) {
      maxPromptedSumCost.value = sum
      openConfirmModal(sum)
      return { prompted: true }
    }
    setNotice('已保存', 'ok')
    return { prompted: false }
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadAll()
})
</script>

<style scoped>
.itinerary-view {
  max-width: 1220px;
  margin: 0 auto;
  padding: 1rem 0.75rem 1.25rem;
}

.topbar {
  display: grid;
  grid-template-columns: 120px 1fr 220px;
  gap: 0.85rem;
  align-items: center;
  padding: 0.85rem 0.85rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
}

.topbar-back {
  height: 44px;
  border: none;
  border-radius: 14px;
  font-weight: 800;
  cursor: pointer;
  color: #1f2a2e;
  background: linear-gradient(135deg, rgba(69, 183, 209, 0.25), rgba(78, 205, 196, 0.25));
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.topbar-back:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(78, 205, 196, 0.18);
}

.topbar-title {
  min-width: 0;
}

.title-main {
  font-size: 1.35rem;
  font-weight: 900;
  background: var(--text-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.title-sub {
  margin-top: 0.2rem;
  color: rgba(0, 0, 0, 0.62);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title-sep {
  margin: 0 0.4rem;
  opacity: 0.6;
}

.topbar-actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  justify-content: flex-end;
}

.syncing {
  font-weight: 800;
  color: rgba(0, 0, 0, 0.55);
  padding: 0.35rem 0.55rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.05);
}

.topbar-save {
  height: 44px;
  border: none;
  border-radius: 14px;
  font-weight: 900;
  cursor: pointer;
  color: #0b1311;
  background: linear-gradient(135deg, #ffeaa7, #96ceb4);
  transition: transform 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}

.topbar-save:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 20px rgba(150, 206, 180, 0.22);
}

.topbar-save:disabled {
  opacity: 0.6;
  cursor: default;
  transform: none;
  box-shadow: none;
}

.state {
  margin-top: 1rem;
  padding: 1rem 1.1rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.state-loading {
  font-weight: 800;
  color: rgba(0, 0, 0, 0.65);
}

.state-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.state-text {
  font-weight: 800;
  color: rgba(0, 0, 0, 0.7);
}

.state-retry {
  border: none;
  border-radius: 14px;
  padding: 0.55rem 0.9rem;
  font-weight: 900;
  cursor: pointer;
  background: linear-gradient(135deg, rgba(255, 234, 167, 0.8), rgba(150, 206, 180, 0.8));
}

.content {
  margin-top: 1rem;
}

.date-tabs {
  display: flex;
  gap: 0.6rem;
  overflow-x: auto;
  padding: 0.2rem 0.05rem 0.6rem;
}

.date-tab {
  flex: 0 0 auto;
  text-align: left;
  padding: 0.65rem 0.75rem;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.86);
  cursor: pointer;
  transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease;
  min-width: 150px;
}

.date-tab:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.06);
  border-color: rgba(78, 205, 196, 0.35);
}

.date-tab.active {
  border-color: rgba(78, 205, 196, 0.55);
  background: linear-gradient(135deg, rgba(69, 183, 209, 0.12), rgba(78, 205, 196, 0.12));
}

.date-tab-day {
  font-weight: 900;
  color: rgba(0, 0, 0, 0.7);
}

.date-tab-date {
  margin-top: 0.25rem;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.55);
  font-size: 0.92rem;
}

.board {
  margin-top: 0.7rem;
  display: grid;
  grid-template-columns: 1fr 320px;
  grid-template-areas:
    'morning pool'
    'noon pool'
    'afternoon pool';
  gap: 0.9rem;
  align-items: start;
}

.board > .lane:nth-of-type(1) {
  grid-area: morning;
}

.board > .lane:nth-of-type(2) {
  grid-area: noon;
}

.board > .lane:nth-of-type(3) {
  grid-area: afternoon;
}

.board > .pool {
  grid-area: pool;
  align-self: start;
}

.lane {
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.lane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 0.95rem;
  background: rgba(0, 0, 0, 0.03);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.lane-title {
  font-weight: 950;
  letter-spacing: 0.2px;
}

.lane-meta {
  font-weight: 900;
  color: rgba(0, 0, 0, 0.55);
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
}

.lane-body {
  padding: 0.85rem 0.85rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 260px;
}

.lane-empty {
  color: rgba(0, 0, 0, 0.55);
  font-weight: 800;
  padding: 0.65rem 0.75rem;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.03);
}

.card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.92);
  padding: 0.8rem 0.85rem;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.05);
}

.card-top {
  display: flex;
  gap: 0.65rem;
  align-items: center;
  justify-content: space-between;
}

.card-name {
  font-weight: 950;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-delete {
  border: none;
  border-radius: 12px;
  padding: 0.45rem 0.7rem;
  cursor: pointer;
  font-weight: 900;
  background: linear-gradient(135deg, rgba(255, 107, 107, 0.9), rgba(255, 142, 142, 0.9));
  color: #fff;
  transition: transform 0.14s ease, filter 0.14s ease, opacity 0.14s ease;
  flex: 0 0 auto;
}

.card-delete:hover {
  transform: translateY(-1px);
  filter: brightness(1.02);
}

.card-delete:disabled {
  opacity: 0.6;
  cursor: default;
  transform: none;
  filter: none;
}

.card-address {
  margin-top: 0.35rem;
  color: rgba(0, 0, 0, 0.55);
  font-weight: 750;
  font-size: 0.92rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-fields {
  margin-top: 0.75rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.field-label {
  font-weight: 850;
  color: rgba(0, 0, 0, 0.65);
  font-size: 0.92rem;
  margin-bottom: 0.35rem;
}

.field-control {
  width: 100%;
  height: 42px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  padding: 0 0.75rem;
  background: rgba(255, 255, 255, 0.95);
  font-weight: 850;
}

.card-actions {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.55rem;
  align-items: center;
}

.card-move {
  border: none;
  border-radius: 12px;
  padding: 0.45rem 0.7rem;
  cursor: pointer;
  font-weight: 900;
  background: rgba(0, 0, 0, 0.06);
  transition: transform 0.14s ease, background 0.14s ease, opacity 0.14s ease;
}

.card-move:hover {
  transform: translateY(-1px);
  background: rgba(78, 205, 196, 0.15);
}

.card-move:disabled {
  opacity: 0.55;
  cursor: default;
  transform: none;
  background: rgba(0, 0, 0, 0.06);
}

.card-sync {
  margin-left: auto;
  font-weight: 900;
  color: rgba(0, 0, 0, 0.5);
}

.pool {
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.pool-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 0.95rem;
  background: rgba(0, 0, 0, 0.03);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.pool-title {
  font-weight: 950;
  letter-spacing: 0.2px;
}

.pool-meta {
  font-weight: 900;
  color: rgba(0, 0, 0, 0.55);
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
}

.pool-empty {
  padding: 0.85rem 0.95rem;
  color: rgba(0, 0, 0, 0.55);
  font-weight: 800;
}

.pool-list {
  padding: 0.85rem 0.85rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.pool-item {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.92);
  padding: 0.7rem 0.75rem;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.04);
}

.pool-main {
  min-width: 0;
}

.pool-name {
  font-weight: 950;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pool-weather {
  margin-top: 0.25rem;
  font-weight: 750;
  color: rgba(0, 0, 0, 0.55);
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pool-actions {
  margin-top: 0.6rem;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
}

.pool-add {
  height: 40px;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  font-weight: 900;
  background: linear-gradient(135deg, rgba(69, 183, 209, 0.18), rgba(78, 205, 196, 0.18));
  transition: transform 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease;
}

.pool-add:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 18px rgba(78, 205, 196, 0.12);
}

.pool-add:disabled {
  opacity: 0.6;
  cursor: default;
  transform: none;
  box-shadow: none;
}

.notice {
  margin-top: 0.9rem;
  padding: 0.75rem 0.95rem;
  border-radius: 16px;
  font-weight: 850;
}

.notice-top {
  margin-top: 0.75rem;
  position: sticky;
  top: 0.65rem;
  z-index: 30;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.08);
}

.notice.ok {
  background: rgba(150, 206, 180, 0.26);
  color: rgba(0, 0, 0, 0.75);
}

.notice.error {
  background: rgba(255, 107, 107, 0.18);
  color: rgba(0, 0, 0, 0.72);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.38);
  z-index: 60;
  padding: 1rem;
}

.modal {
  width: min(520px, 100%);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22);
  padding: 1.05rem 1.05rem 1rem;
}

.modal-title {
  font-weight: 950;
  font-size: 1.15rem;
}

.modal-body {
  margin-top: 0.65rem;
  color: rgba(0, 0, 0, 0.7);
  font-weight: 800;
  line-height: 1.6;
}

.modal-actions {
  margin-top: 0.95rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
}

.modal-btn {
  height: 44px;
  border: none;
  border-radius: 14px;
  padding: 0 1rem;
  font-weight: 950;
  cursor: pointer;
  transition: transform 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease;
}

.modal-btn:hover {
  transform: translateY(-1px);
}

.modal-btn:disabled {
  opacity: 0.65;
  cursor: default;
  transform: none;
  box-shadow: none;
}

.modal-btn.ghost {
  background: rgba(0, 0, 0, 0.06);
}

.modal-btn.primary {
  background: linear-gradient(135deg, #ffeaa7, #96ceb4);
}

@media (max-width: 1180px) {
  .board {
    grid-template-columns: 1fr;
    grid-template-areas:
      'morning'
      'noon'
      'afternoon'
      'pool';
  }

  .pool {
    grid-column: 1 / -1;
  }
}

@media (max-width: 860px) {
  .topbar {
    grid-template-columns: 120px 1fr;
    grid-template-rows: auto auto;
  }

  .topbar-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .board {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .topbar {
    grid-template-columns: 92px 1fr;
    gap: 0.65rem;
    padding: 0.75rem;
  }

  .title-main {
    font-size: 1.2rem;
  }

  .title-sub {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    font-size: 0.95rem;
    line-height: 1.25;
  }

  .title-sep {
    margin: 0 0.25rem;
  }
}
</style>
