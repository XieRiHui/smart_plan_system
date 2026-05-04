import { ref, reactive } from 'vue'

const plans = ref([])
const currentPlan = ref(null)
const loading = ref(false)
const error = ref(null)
const selectedPlacesByDraft = reactive({})
const draftDateRangeByKey = reactive({})
const draftPlanFormByKey = reactive({})

const store = {
  plans,
  currentPlan,
  loading,
  error,
  selectedPlacesByDraft,
  draftDateRangeByKey,
  draftPlanFormByKey,
  
  setPlans(newPlans) {
    plans.value = newPlans
  },
  
  setCurrentPlan(plan) {
    currentPlan.value = plan
  },
  
  addPlan(plan) {
    plans.value.push(plan)
  },
  
  updatePlan(updatedPlan) {
    const index = plans.value.findIndex(p => p.id === updatedPlan.id)
    if (index !== -1) {
      plans.value[index] = updatedPlan
    }
    if (currentPlan.value && currentPlan.value.id === updatedPlan.id) {
      currentPlan.value = updatedPlan
    }
  },
  
  deletePlan(planId) {
    plans.value = plans.value.filter(p => p.id !== planId)
    if (currentPlan.value && currentPlan.value.id === planId) {
      currentPlan.value = null
    }
  },
  
  setLoading(isLoading) {
    loading.value = isLoading
  },
  
  setError(err) {
    error.value = err
  },

  getDraftPlaces(draftKey) {
    if (!draftKey) return []
    return selectedPlacesByDraft[draftKey] || []
  },

  addDraftPlace(draftKey, place) {
    if (!draftKey || !place) return
    if (!selectedPlacesByDraft[draftKey]) {
      selectedPlacesByDraft[draftKey] = []
    }

    const exists = selectedPlacesByDraft[draftKey].some((item) => {
      return item.name === place.name && item.lng === place.lng && item.lat === place.lat
    })
    if (!exists) {
      selectedPlacesByDraft[draftKey].push(place)
    }
  },

  removeDraftPlace(draftKey, index) {
    if (!draftKey || !selectedPlacesByDraft[draftKey]) return
    selectedPlacesByDraft[draftKey].splice(index, 1)
  },

  clearDraftPlaces(draftKey) {
    if (!draftKey) return
    selectedPlacesByDraft[draftKey] = []
  },

  getDraftDateRange(draftKey) {
    if (!draftKey) return null
    return draftDateRangeByKey[draftKey] || null
  },

  setDraftDateRange(draftKey, range) {
    if (!draftKey) return
    if (!range || !range.start || !range.end) return
    draftDateRangeByKey[draftKey] = { start: range.start, end: range.end }
  },

  clearDraftDateRange(draftKey) {
    if (!draftKey) return
    delete draftDateRangeByKey[draftKey]
  },

  getDraftPlanForm(draftKey) {
    if (!draftKey) return null
    return draftPlanFormByKey[draftKey] || null
  },

  setDraftPlanForm(draftKey, form) {
    if (!draftKey || !form) return
    draftPlanFormByKey[draftKey] = {
      name: form.name || '',
      budget: Number(form.budget || 0),
      people_count: Number(form.people_count || 1),
      preferences: form.preferences || '',
      summary: form.summary || ''
    }
  },

  clearDraftPlanForm(draftKey) {
    if (!draftKey) return
    delete draftPlanFormByKey[draftKey]
  }
}

export default store
