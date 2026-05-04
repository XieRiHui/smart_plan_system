import axios from 'axios'

export const API_BASE_URL = 'https://smart-d3gdo2kb0dd16f0e4.service.tcloudbase.com'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 规划相关API
export const planApi = {
  // 获取规划列表
  getPlans() {
    return api.get('/plan/plans')
  },
  
  // 获取规划详情
  getPlan(id) {
    return api.get(`/plan/plans/${id}`)
  },
  
  // 创建规划
  createPlan(planData) {
    return api.post('/plan/plans', planData)
  },
  
  // 更新规划
  updatePlan(id, planData) {
    return api.put(`/plan/plans/${id}`, planData)
  },
  
  // 删除规划
  deletePlan(id) {
    return api.delete(`/plan/plans/${id}`)
  },

  copyPlan(id) {
    return api.post(`/plan/plans/${id}/copy`)
  }
}

export const locationApi = {
  getLocations(planId) {
    return api.get(`/locations/plans/${planId}/locations`)
  },

  addLocation(planId, locationData) {
    return api.post(`/locations/plans/${planId}/locations`, locationData)
  },

  deleteLocation(planId, locationId) {
    return api.delete(`/locations/plans/${planId}/locations/${locationId}`)
  }
}

export const weatherApi = {
  getForecast(params) {
    return api.get('/weather/weather/forecast', { params })
  }
}

export const itineraryApi = {
  getItineraries(planId) {
    return api.get('/itinerary/itinerary', { params: { plan_id: planId } })
  },
  getItinerary(planId) {
    return api.get('/itinerary/itinerary', { params: { plan_id: planId } })
  },
  createItinerary(payload) {
    return api.post('/itinerary/itinerary', payload)
  },
  updateItinerary(id, payload) {
    return api.put(`/itinerary/itinerary/${id}`, payload)
  },
  deleteItinerary(id) {
    return api.delete(`/itinerary/itinerary/${id}`)
  }
}

export const aiApi = {
  generatePlanSummary(planId) {
    return api.post('/ai/ai/plan-summary', { plan_id: Number(planId) })
  },
  getPlanSummaryStreamUrl(planId) {
    const id = Number(planId)
    return `${API_BASE_URL}/ai_stream/ai/plan-summary/stream?plan_id=${id}`
  }
}

export default api
