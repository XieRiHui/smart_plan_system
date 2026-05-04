<template>
  <div class="map-view">
    <div class="view-header">
      <h1>地图选点</h1>
      <button @click="goBack" class="back-button">返回</button>
    </div>
    
    <MapSelector :draft-key="draftKey" :plan-id="resolvedPlanId" @select-place="handlePlaceSelect" />
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import MapSelector from '../components/MapSelector.vue'
import store from '../store'

const router = useRouter()
const route = useRoute()

// 获取来源信息
const from = route.query.from
const planId = route.query.planId
const draftKey = computed(() => (from === 'edit' && planId ? `edit-${planId}` : 'create'))
const resolvedPlanId = computed(() => (from === 'edit' && planId ? String(planId) : ''))

const handlePlaceSelect = (place) => {
  store.addDraftPlace(draftKey.value, place)
}

const goBack = () => {
  // 根据来源决定返回路径
  if (from === 'edit' && planId) {
    // 从编辑页面来，返回编辑页面
    router.push(`/edit/${planId}`)
  } else if (from === 'create') {
    // 从创建页面来，返回创建页面
    router.push('/create')
  } else {
    // 默认返回首页
    router.push('/')
  }
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<style scoped>
.map-view {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  overflow: hidden;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  position: relative;
  z-index: 10;
}

.view-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.back-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.3s;
}

.back-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(255, 255, 255, 0.3);
}
</style>
