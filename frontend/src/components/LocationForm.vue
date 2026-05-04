<template>
  <div class="location-form">
    <h2>{{ isEdit ? '编辑地点' : '创建地点' }}</h2>
    
    <div v-if="loading" class="loading">提交中...</div>
    
    <div v-else class="form-card">
      <form @submit.prevent="submitForm">
        <div class="form-group">
          <label for="name">地点名称</label>
          <input 
            type="text" 
            id="name" 
            v-model="formData.name" 
            required 
            placeholder="请输入地点名称"
            class="form-input"
          />
          <div v-if="errors.name" class="error">{{ errors.name }}</div>
        </div>
        
        <div class="form-group">
          <label for="address">地址</label>
          <input 
            type="text" 
            id="address" 
            v-model="formData.address" 
            required 
            placeholder="请输入地址"
            class="form-input"
          />
          <div v-if="errors.address" class="error">{{ errors.address }}</div>
        </div>
        
        <div class="form-group">
          <label for="description">描述</label>
          <textarea 
            id="description" 
            v-model="formData.description" 
            placeholder="请输入地点描述"
            class="form-input"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label>地图选点</label>
          <div class="map-preview">
            <MapSelector @select-place="handlePlaceSelect" />
          </div>
          <div v-if="formData.latitude && formData.longitude" class="coordinates">
            坐标：{{ formData.longitude }}, {{ formData.latitude }}
          </div>
        </div>
        
        <div class="form-actions">
          <button type="submit" :disabled="loading" class="submit-button">
            {{ isEdit ? '保存修改' : '创建地点' }}
          </button>
          <button type="button" @click="cancel" class="cancel-button">取消</button>
        </div>
      </form>
      
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import MapSelector from './MapSelector.vue'

const props = defineProps({
  location: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['save', 'cancel'])

const isEdit = computed(() => !!props.location)
const loading = ref(false)
const error = ref(null)
const errors = ref({})

const formData = ref({
  name: '',
  address: '',
  description: '',
  latitude: null,
  longitude: null
})

onMounted(() => {
  if (isEdit.value) {
    formData.value = {
      name: props.location.name,
      address: props.location.address,
      description: props.location.description || '',
      latitude: props.location.latitude,
      longitude: props.location.longitude
    }
  }
})

const validateForm = () => {
  const newErrors = {}
  
  if (!formData.value.name.trim()) {
    newErrors.name = '地点名称不能为空'
  }
  
  if (!formData.value.address.trim()) {
    newErrors.address = '地址不能为空'
  }
  
  if (!formData.value.latitude || !formData.value.longitude) {
    newErrors.location = '请在地图上选择地点'
  }
  
  errors.value = newErrors
  return Object.keys(newErrors).length === 0
}

const handlePlaceSelect = (place) => {
  formData.value = {
    ...formData.value,
    name: formData.value.name || place.name,
    address: formData.value.address || place.address,
    latitude: place.lat,
    longitude: place.lng
  }
}

const submitForm = async () => {
  if (!validateForm()) {
    return
  }
  
  loading.value = true
  error.value = null
  
  try {
    // 这里应该调用后端API创建或更新地点
    const locationData = {
      ...formData.value
    }
    
    emit('save', locationData)
  } catch (err) {
    error.value = isEdit.value ? '更新地点失败' : '创建地点失败'
    console.error('Error submitting form:', err)
  } finally {
    loading.value = false
  }
}

const cancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.location-form {
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  color: white;
}

.location-form h2 {
  text-align: center;
  margin: 1rem 0 2rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.loading {
  text-align: center;
  padding: 2rem;
  font-size: 1.1rem;
}

.form-card {
  max-width: 800px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 2rem;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  font-size: 1.1rem;
}

.form-input {
  width: 100%;
  padding: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  transition: border-color 0.3s, transform 0.3s;
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.form-input:focus {
  outline: none;
  border-color: #4ECDC4;
  transform: translateY(-2px);
}

.form-input[type="textarea"] {
  resize: vertical;
  min-height: 100px;
}

.map-preview {
  height: 400px;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.coordinates {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  opacity: 0.8;
}

.error {
  color: #FF6B6B;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.error-message {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid #FF6B6B;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1.5rem;
  color: #FF6B6B;
  font-weight: 500;
  text-align: center;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.submit-button, .cancel-button {
  flex: 1;
  padding: 1rem;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
}

.submit-button {
  background: linear-gradient(135deg, #4ECDC4, #45B7D1);
  color: white;
}

.submit-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(78, 205, 196, 0.4);
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.cancel-button {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.cancel-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .form-card {
    padding: 1.5rem;
  }
  
  .map-preview {
    height: 300px;
  }
  
  .form-actions {
    flex-direction: column;
  }
}
</style>