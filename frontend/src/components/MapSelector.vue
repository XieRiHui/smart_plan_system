<template>
  <div class="map-selector">
    <aside class="sidebar">
      <div class="sidebar-top">
        <div class="sidebar-title">已选地点</div>
        <div class="sidebar-count">{{ selectedPlaces.length }}</div>
      </div>

      <div class="sidebar-list">
        <div v-if="selectedPlaces.length === 0" class="sidebar-empty">暂未添加地点</div>
        <div
          v-for="(place, index) in selectedPlaces"
          :key="`${place.name}-${place.lng}-${place.lat}`"
          class="place-card"
          :class="{ active: isSamePlace(place, selectedPlace) }"
        >
          <div class="place-row" @click="viewSavedPlace(place)">
            <div class="place-row-main">
              <div class="place-name">{{ place.name }}</div>
            </div>
            <button class="place-delete" type="button" @click.stop="removeSavedPlace(index, place)">删除</button>
          </div>

          <div class="weather-block">
            <button
              class="weather-toggle"
              type="button"
              @click.stop="toggleWeather(place)"
            >
              {{ getWeatherState(place).expanded ? '收起天气' : '查看天气' }}
            </button>

            <div v-if="getWeatherState(place).expanded" class="weather-panel" @click.stop>
              <div v-if="!activeDateRange.start || !activeDateRange.end" class="weather-empty">
                当前没有选择日期，无法展示天气
              </div>

              <div v-else>
                <div v-if="getWeatherState(place).loading" class="weather-loading">加载中...</div>
                <div v-else-if="getWeatherState(place).error" class="weather-error">{{ getWeatherState(place).error }}</div>
                <div v-else-if="getWeatherState(place).data?.dates?.length" class="weather-list">
                  <div
                    v-for="item in getWeatherState(place).data.dates"
                    :key="item.date"
                    class="weather-line"
                  >
                    <div class="weather-line-date">{{ item.date }}</div>
                    <div
                      class="weather-line-info"
                      @mouseenter="showWeatherTooltip(item, $event)"
                      @mousemove="moveWeatherTooltip($event)"
                      @mouseleave="hideWeatherTooltip"
                    >
                      <span class="weather-info-desc">{{ item.weather }}</span>
                      <span class="weather-info-sep">·</span>
                      <span class="weather-info-temp">
                        <template v-if="item.temp_min != null && item.temp_max != null">{{ item.temp_min }}~{{ item.temp_max }}℃</template>
                        <template v-else>--</template>
                      </span>
                      <span class="weather-info-sep">·</span>
                      <span class="weather-info-wind">
                        <template v-if="item.wind">{{ item.wind }}</template>
                        <template v-else>--</template>
                      </span>
                    </div>
                  </div>
                </div>
                <div v-else class="weather-empty">暂无天气数据</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="selectedPlace" class="sidebar-current">
        <div class="current-label">当前选中</div>
        <div class="current-name">{{ selectedPlace.name }}</div>
        <button @click="confirmSelection" class="confirm-button">确认选择</button>
      </div>
    </aside>

    <section class="main">
      <div class="search-container">
        <div class="search-field">
          <input
            type="text"
            v-model="searchKeyword"
            placeholder="搜索地点"
            class="search-input"
            @keyup.enter="searchPlaces"
          />
          <div v-if="searchKeyword" class="clear-search" @click="clearSearch" role="button" tabindex="0">清空</div>
        </div>
        <button @click="searchPlaces" class="search-button">搜索</button>
      </div>

      <div v-if="uiMessage" class="inline-message" :class="uiMessageType">{{ uiMessage }}</div>

      <div class="map-container" ref="mapContainer"></div>
    </section>

    <div v-if="weatherTooltip.visible" class="weather-tooltip" :style="weatherTooltipStyle">
      {{ weatherTooltip.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount, onMounted, computed, watch } from 'vue'
import store from '../store'
import { planApi, weatherApi } from '../api'

const emit = defineEmits(['select-place'])
const props = defineProps({
  draftKey: {
    type: String,
    default: 'create'
  },
  planId: {
    type: String,
    default: ''
  }
})

const mapContainer = ref(null)
const map = ref(null)
const marker = ref(null)
const selectedPlace = ref(null)
const searchKeyword = ref('')
const selectedPlaces = computed(() => store.getDraftPlaces(props.draftKey))
const planDateRange = ref({ start: '', end: '' })
const uiMessage = ref('')
const uiMessageType = ref('error')

const setUiMessage = (message, type = 'error') => {
  uiMessage.value = message
  uiMessageType.value = type
}

const clearUiMessage = () => {
  uiMessage.value = ''
}

const draftDateRange = computed(() => store.getDraftDateRange(props.draftKey) || null)
const activeDateRange = computed(() => {
  if (draftDateRange.value?.start && draftDateRange.value?.end) return draftDateRange.value
  if (planDateRange.value?.start && planDateRange.value?.end) return planDateRange.value
  return { start: '', end: '' }
})

const weatherStateByKey = ref({})
const weatherTooltip = ref({ visible: false, text: '', x: 0, y: 0 })
const weatherTooltipStyle = computed(() => ({
  left: `${weatherTooltip.value.x}px`,
  top: `${weatherTooltip.value.y}px`
}))

const placeKeyOf = (place) => {
  if (!place) return ''
  return `${place.lng},${place.lat},${place.name}`
}

const buildWeatherParamsKey = (place, range) => {
  if (!place || !range?.start || !range?.end) return ''
  return `${place.lng},${place.lat}:${range.start}:${range.end}`
}

const getWeatherState = (place) => {
  const key = placeKeyOf(place)
  if (!weatherStateByKey.value[key]) {
    weatherStateByKey.value[key] = {
      expanded: false,
      loading: false,
      error: '',
      data: null,
      paramsKey: ''
    }
  }
  return weatherStateByKey.value[key]
}

const buildWeatherTooltipText = (item) => {
  const tempText =
    item?.temp_min != null && item?.temp_max != null ? `${item.temp_min}~${item.temp_max}℃` : '--'
  const windText = item?.wind ? item.wind : '--'
  const weatherText = item?.weather || ''
  const dateText = item?.date || ''
  return `${dateText}  ${weatherText}  ${tempText}  ${windText}`
}

const showWeatherTooltip = (item, e) => {
  weatherTooltip.value = {
    visible: true,
    text: buildWeatherTooltipText(item),
    x: (e?.clientX || 0) + 14,
    y: (e?.clientY || 0) + 14
  }
}

const moveWeatherTooltip = (e) => {
  if (!weatherTooltip.value.visible) return
  weatherTooltip.value = {
    ...weatherTooltip.value,
    x: (e?.clientX || 0) + 14,
    y: (e?.clientY || 0) + 14
  }
}

const hideWeatherTooltip = () => {
  weatherTooltip.value = { visible: false, text: '', x: 0, y: 0 }
}

onMounted(() => {
  initMap()
  fetchPlanDateRangeIfNeeded()
})

const fetchPlanDateRangeIfNeeded = async () => {
  if (!props.planId) return
  if (draftDateRange.value?.start && draftDateRange.value?.end) return

  try {
    const response = await planApi.getPlan(props.planId)
    const plan = response.data
    const rawStart = plan?.start_date || plan?.date
    const rawEnd = plan?.end_date || plan?.start_date || plan?.date
    const start = typeof rawStart === 'string' ? rawStart.split('T')[0] : ''
    const end = typeof rawEnd === 'string' ? rawEnd.split('T')[0] : ''
    planDateRange.value = { start: start || '', end: end || start || '' }
  } catch {
    planDateRange.value = { start: '', end: '' }
  }
}

watch(
  () => draftDateRange.value,
  () => {
    planDateRange.value = { start: '', end: '' }
  },
  { deep: true }
)

const waitForAMap = ({ timeoutMs = 10000, intervalMs = 50 } = {}) => {
  if (window.AMap) return Promise.resolve(window.AMap)

  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const timer = window.setInterval(() => {
      if (window.AMap) {
        window.clearInterval(timer)
        resolve(window.AMap)
        return
      }

      if (Date.now() - startTime > timeoutMs) {
        window.clearInterval(timer)
        reject(new Error('AMap load timeout'))
      }
    }, intervalMs)
  })
}

const handleMapClick = (e) => {
  if (!map.value) return
  const lng = e.lnglat.getLng()
  const lat = e.lnglat.getLat()

  selectedPlace.value = {
    name: '已选择位置',
    address: '',
    lng,
    lat
  }

  addMarker([lng, lat])
  
  // 逆地理编码获取地址
  if (window.AMap?.plugin) {
    window.AMap.plugin('AMap.Geocoder', () => {
      const geocoder = new window.AMap.Geocoder()
      geocoder.getAddress([lng, lat], (status, result) => {
        if (status === 'complete' && result.info === 'OK') {
          const regeocode = result.regeocode
          const address = regeocode.formattedAddress

          let placeName = address
          if (regeocode.pois && regeocode.pois.length > 0) {
            placeName = regeocode.pois[0].name
          }

          selectedPlace.value = {
            name: placeName,
            address: address,
            lng: lng,
            lat: lat
          }

          searchKeyword.value = placeName
        }
      })
    })
  }
}

const addMarker = (position) => {
  if (marker.value) {
    marker.value.setMap(null)
  }
  
  marker.value = new window.AMap.Marker({
    position: position,
    map: map.value
  })
  
  if (map.value?.setZoomAndCenter) {
    map.value.setZoomAndCenter(map.value.getZoom(), position, false)
  } else {
    map.value.setCenter(position)
  }
}

const initMap = async () => {
  if (!mapContainer.value) return

  try {
    await waitForAMap()
  } catch (e) {
    setUiMessage('地图服务加载失败，请刷新页面重试', 'error')
    return
  }

  if (map.value) return
  clearUiMessage()

  map.value = new window.AMap.Map(mapContainer.value, {
    zoom: 13,
    center: [116.397428, 39.90923],
    resizeEnable: true,
    animateEnable: false
  })

  map.value.on('click', handleMapClick)
}

const searchPlaces = () => {
  if (!searchKeyword.value.trim()) {
    setUiMessage('请输入搜索关键词', 'error')
    return
  }

  if (!map.value) {
    setUiMessage('地图尚未加载完成，请稍后重试', 'error')
    return
  }
  clearUiMessage()
  
  const keyword = searchKeyword.value.trim()
  
  // 先进行地点搜索
  window.AMap.plugin('AMap.PlaceSearch', () => {
    const placeSearch = new window.AMap.PlaceSearch({
      pageSize: 1,
      pageIndex: 1,
      extensions: 'all'
    })
    
    placeSearch.search(keyword, (status, result) => {
      if (status === 'complete' && result.info === 'OK' && result.poiList && result.poiList.pois.length > 0) {
        const firstPoi = result.poiList.pois[0]
        const position = [firstPoi.location.getLng(), firstPoi.location.getLat()]

        searchKeyword.value = firstPoi.name
        selectedPlace.value = {
          name: firstPoi.name,
          address: '',
          lng: position[0],
          lat: position[1]
        }
        addMarker(position)

        window.AMap.plugin('AMap.Geocoder', () => {
          const geocoder = new window.AMap.Geocoder()
          geocoder.getAddress(position, (geoStatus, geoResult) => {
            if (geoStatus === 'complete' && geoResult.info === 'OK') {
              const address = geoResult.regeocode.formattedAddress
              selectedPlace.value = {
                name: firstPoi.name,
                address: address,
                lng: position[0],
                lat: position[1]
              }
            }
          })
        })
      } else {
        setUiMessage('未找到相关地点，请重新输入', 'error')
      }
    })
  })
}

const clearSearch = () => {
  searchKeyword.value = ''
  clearUiMessage()
}

const isSamePlace = (a, b) => {
  if (!a || !b) return false
  return a.name === b.name && a.lng === b.lng && a.lat === b.lat
}

const viewSavedPlace = (place) => {
  if (!place) return
  selectedPlace.value = place
  addMarker([place.lng, place.lat])
  clearUiMessage()
}

const toggleWeather = async (place) => {
  const state = getWeatherState(place)
  state.expanded = !state.expanded
  state.error = ''

  if (!state.expanded) return

  const range = activeDateRange.value
  if (!range?.start || !range?.end) return

  const paramsKey = buildWeatherParamsKey(place, range)
  if (state.data && state.paramsKey === paramsKey) return

  state.loading = true
  state.error = ''
  state.paramsKey = paramsKey

  try {
    const response = await weatherApi.getForecast({
      longitude: place.lng,
      latitude: place.lat,
      start_date: range.start,
      end_date: range.end
    })
    state.data = response.data
  } catch (e) {
    const message = e?.response?.data?.detail || '加载失败，请稍后重试'
    state.error = message
    state.data = null
  } finally {
    state.loading = false
  }
}

const removeSavedPlace = (index, place) => {
  const key = placeKeyOf(place)
  store.removeDraftPlace(props.draftKey, index)
  if (key) {
    delete weatherStateByKey.value[key]
  }
  hideWeatherTooltip()
}

watch(
  () => selectedPlaces.value.map(placeKeyOf).join('|'),
  (keys) => {
    const keySet = new Set(keys ? keys.split('|') : [])
    Object.keys(weatherStateByKey.value).forEach((k) => {
      if (!keySet.has(k)) delete weatherStateByKey.value[k]
    })
  }
)

const confirmSelection = () => {
  if (selectedPlace.value) {
    emit('select-place', selectedPlace.value)
    searchKeyword.value = ''
    selectedPlace.value = null
    clearUiMessage()
  }
}

onBeforeUnmount(() => {
  if (marker.value) {
    marker.value.setMap(null)
    marker.value = null
  }
  if (map.value) {
    map.value.destroy()
    map.value = null
  }
})
</script>

<style scoped>
.map-selector {
  width: 100%;
  height: 100%;
  display: flex;
  gap: 1rem;
  padding: 1rem;
  box-sizing: border-box;
  color: #fff;
  overflow: hidden;
}

.sidebar {
  width: 360px;
  flex: 0 0 360px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(12px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sidebar-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 1rem 1rem 0.85rem;
}

.sidebar-title {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.sidebar-count {
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.14);
  font-weight: 700;
  font-size: 0.95rem;
}

.sidebar-list {
  padding: 0.4rem 0.6rem 0.75rem;
  overflow: auto;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
}

.sidebar-empty {
  padding: 0.75rem 0.7rem;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.15);
  border: 1px dashed rgba(255, 255, 255, 0.25);
  border-radius: 14px;
}

.place-card {
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.place-card + .place-card {
  margin-top: 0.55rem;
}

.place-card:hover {
  background: rgba(0, 0, 0, 0.16);
  border-color: rgba(255, 255, 255, 0.2);
}

.place-card.active {
  background: rgba(78, 205, 196, 0.16);
  border-color: rgba(78, 205, 196, 0.45);
}

.place-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.7rem;
  cursor: pointer;
  transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease;
}

.place-row:hover {
  transform: translateY(-1px);
}

.place-row-main {
  min-width: 0;
}

.place-name {
  font-weight: 700;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.place-address {
  margin-top: 0.25rem;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.78);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.place-delete {
  border: none;
  border-radius: 10px;
  padding: 0.45rem 0.75rem;
  background: rgba(255, 107, 107, 0.9);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, filter 0.16s ease;
  flex: 0 0 auto;
}

.place-delete:hover {
  transform: translateY(-1px);
  filter: brightness(1.02);
}

.weather-block {
  padding: 0.55rem 0.7rem 0.7rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.08);
}

.weather-toggle {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.92);
  border-radius: 12px;
  padding: 0.55rem 0.75rem;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.16s ease, background 0.16s ease;
}

.weather-toggle:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.12);
}

.weather-panel {
  margin-top: 0.6rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.16);
  padding: 0.65rem 0.65rem;
}

.weather-loading,
.weather-error,
.weather-empty {
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
}

.weather-error {
  color: rgba(255, 204, 204, 0.95);
}

.weather-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.weather-line {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.45rem 0.55rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.weather-line-date {
  font-weight: 900;
  letter-spacing: 0.2px;
}

.weather-line-info {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.45rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.14);
  cursor: default;
  user-select: none;
  min-width: 0;
}

.weather-info-desc {
  font-weight: 800;
  min-width: 0;
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.weather-info-sep {
  color: rgba(255, 255, 255, 0.5);
  font-weight: 900;
}

.weather-info-temp {
  font-weight: 800;
  white-space: nowrap;
}

.weather-info-wind {
  font-weight: 700;
  color: rgba(255, 255, 255, 0.78);
  min-width: 0;
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.weather-tooltip {
  position: fixed;
  z-index: 9999;
  max-width: min(560px, calc(100vw - 24px));
  padding: 0.6rem 0.75rem;
  border-radius: 14px;
  background: rgba(12, 12, 14, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5);
  color: rgba(255, 255, 255, 0.95);
  font-weight: 800;
  pointer-events: none;
  backdrop-filter: blur(10px);
}

.sidebar-current {
  padding: 0.95rem 1rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.14);
}

.current-label {
  font-weight: 700;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.9rem;
}

.current-name {
  margin-top: 0.35rem;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.2;
}

.main {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.search-container {
  display: flex;
  gap: 0.75rem;
  align-items: stretch;
}

.search-field {
  flex: 1;
  min-width: 0;
  position: relative;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  height: 52px;
  padding: 0 3.25rem 0 1rem;
  border: none;
  border-radius: 14px;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.92);
  color: #222;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}

.search-input:focus {
  outline: none;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24);
}

.clear-search {
  position: absolute;
  right: 0.55rem;
  top: 20%;
  transform: translateY(-20%);
  padding: 0.35rem 0.55rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.7);
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  user-select: none;
}

.search-button {
  box-sizing: border-box;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1.4rem;
  border: none;
  border-radius: 14px;
  background: #4ECDC4;
  color: white;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, background 0.16s ease;
}

.search-button:hover {
  transform: translateY(-1px);
  background: #3aafaa;
}

.map-container {
  flex: 1;
  overflow: hidden;
  border-radius: 18px;
  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.32);
}

.inline-message {
  margin-top: 0.75rem;
  padding: 0.75rem 0.9rem;
  border-radius: 14px;
  font-weight: 800;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.18);
  color: rgba(255, 255, 255, 0.92);
}

.inline-message.error {
  border-color: rgba(255, 107, 107, 0.35);
  background: rgba(255, 107, 107, 0.12);
}

.inline-message.info {
  border-color: rgba(78, 205, 196, 0.35);
  background: rgba(78, 205, 196, 0.12);
}

.confirm-button {
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #FF6B6B, #FF8E53);
  font-weight: 800;
  color: #fff;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
  margin-top: 0.75rem;
}

.confirm-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
}

@media (max-width: 768px) {
  .map-selector {
    flex-direction: column;
    padding: 0.75rem;
  }

  .sidebar {
    width: 100%;
    flex: 0 0 auto;
    max-height: 45vh;
  }

  .place-row {
    align-items: flex-start;
  }

  .place-name {
    white-space: normal;
    overflow: hidden;
    text-overflow: clip;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.25;
  }

  .place-delete {
    min-height: 40px;
    padding: 0.55rem 0.9rem;
  }

  .map-container {
    border-radius: 16px;
  }
}

@media (min-width: 1200px) {
  .sidebar {
    width: 420px;
    flex: 0 0 420px;
  }
}
</style>
