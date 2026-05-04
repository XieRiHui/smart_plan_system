<template>
  <div class="location-list">
    <div class="list-header">
      <h2>地点列表</h2>
      <button @click="addLocation" class="add-button">添加地点</button>
    </div>
    
    <div v-if="loading" class="loading">加载中...</div>
    
    <div v-else-if="error" class="error">{{ error }}</div>
    
    <div v-else-if="locations.length === 0" class="empty-state">
      <p>暂无地点，请添加地点</p>
    </div>
    
    <div v-else class="locations-grid">
      <div v-for="location in locations" :key="location.id" class="location-card">
        <h3>{{ location.name }}</h3>
        <p>{{ location.address }}</p>
        <div class="location-actions">
          <button @click="editLocation(location)" class="edit-button">编辑</button>
          <button @click="deleteLocation(location.id)" class="delete-button">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['add', 'edit', 'delete'])

const locations = ref([])
const loading = ref(false)
const error = ref(null)

onMounted(() => {
  fetchLocations()
})

const fetchLocations = async () => {
  loading.value = true
  error.value = null
  
  try {
    // 这里应该调用后端API获取地点列表
    // 暂时使用模拟数据
    locations.value = [
      {
        id: 1,
        name: '故宫博物院',
        address: '北京市东城区景山前街4号',
        latitude: 39.916345,
        longitude: 116.397155
      },
      {
        id: 2,
        name: '颐和园',
        address: '北京市海淀区新建宫门路19号',
        latitude: 39.999285,
        longitude: 116.275242
      }
    ]
  } catch (err) {
    error.value = '获取地点列表失败'
    console.error('Error fetching locations:', err)
  } finally {
    loading.value = false
  }
}

const addLocation = () => {
  emit('add')
}

const editLocation = (location) => {
  emit('edit', location)
}

const deleteLocation = (id) => {
  if (confirm('确定要删除这个地点吗？')) {
    emit('delete', id)
  }
}
</script>

<style scoped>
.location-list {
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  color: white;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.list-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
}

.add-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #4ECDC4, #45B7D1);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.3s;
}

.add-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(78, 205, 196, 0.4);
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

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  font-size: 1.1rem;
  opacity: 0.8;
}

.locations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.location-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  backdrop-filter: blur(10px);
  transition: transform 0.3s, box-shadow 0.3s;
}

.location-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.location-card h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.location-card p {
  margin: 0 0 1rem 0;
  opacity: 0.9;
  line-height: 1.4;
}

.location-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.edit-button, .delete-button {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.3s;
}

.edit-button {
  background: #4ECDC4;
  color: white;
}

.edit-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(78, 205, 196, 0.4);
}

.delete-button {
  background: #FF6B6B;
  color: white;
}

.delete-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(255, 107, 107, 0.4);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .list-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .add-button {
    width: 100%;
  }
  
  .locations-grid {
    grid-template-columns: 1fr;
  }
}
</style>