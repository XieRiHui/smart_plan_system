<template>
  <div class="location-detail">
    <div class="detail-header">
      <h2>地点详情</h2>
      <button @click="goBack" class="back-button">返回</button>
    </div>
    
    <div v-if="loading" class="loading">加载中...</div>
    
    <div v-else-if="error" class="error">{{ error }}</div>
    
    <div v-else class="detail-card">
      <div class="location-info">
        <h3>{{ location.name }}</h3>
        <p class="address">{{ location.address }}</p>
        <p class="description" v-if="location.description">{{ location.description }}</p>
        <div class="coordinates">
          <span>纬度：{{ location.latitude }}</span>
          <span>经度：{{ location.longitude }}</span>
        </div>
      </div>
      
      <div class="map-container" ref="mapContainer"></div>
      
      <div class="detail-actions">
        <button @click="editLocation" class="edit-button">编辑</button>
        <button @click="deleteLocation" class="delete-button">删除</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  location: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['edit', 'delete', 'back'])

const loading = ref(false)
const error = ref(null)
const mapContainer = ref(null)
const map = ref(null)

onMounted(() => {
  if (props.location) {
    initMap()
  }
})

watch(() => props.location, (newLocation) => {
  if (newLocation) {
    initMap()
  }
})

const initMap = () => {
  if (mapContainer.value && window.AMap && props.location) {
    map.value = new window.AMap.Map(mapContainer.value, {
      zoom: 15,
      center: [props.location.longitude, props.location.latitude],
      resizeEnable: true
    })
    
    // 添加标记
    new window.AMap.Marker({
      position: [props.location.longitude, props.location.latitude],
      map: map.value,
      title: props.location.name
    })
  }
}

const goBack = () => {
  emit('back')
}

const editLocation = () => {
  emit('edit', props.location)
}

const deleteLocation = () => {
  if (confirm('确定要删除这个地点吗？')) {
    emit('delete', props.location.id)
  }
}
</script>

<style scoped>
.location-detail {
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  color: white;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.detail-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
}

.back-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.3s;
}

.back-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
}

.loading {
  text-align: center;
  padding: 2rem;
  font-size: 1.1rem;
}

.error {
  text-align: center;
  padding: 2rem;
  color: #FF6B6B;
  font-size: 1.1rem;
}

.detail-card {
  max-width: 800px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 2rem;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.location-info {
  margin-bottom: 2rem;
}

.location-info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.address {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  opacity: 0.9;
}

.description {
  margin: 0 0 1.5rem 0;
  line-height: 1.5;
  opacity: 0.8;
}

.coordinates {
  display: flex;
  gap: 2rem;
  margin-top: 1rem;
  font-size: 0.9rem;
  opacity: 0.7;
}

.map-container {
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
  margin: 2rem 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.detail-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.edit-button, .delete-button {
  flex: 1;
  padding: 1rem;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
}

.edit-button {
  background: linear-gradient(135deg, #4ECDC4, #45B7D1);
  color: white;
}

.edit-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(78, 205, 196, 0.4);
}

.delete-button {
  background: #FF6B6B;
  color: white;
}

.delete-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .detail-card {
    padding: 1.5rem;
  }
  
  .map-container {
    height: 300px;
  }
  
  .detail-actions {
    flex-direction: column;
  }
  
  .coordinates {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>