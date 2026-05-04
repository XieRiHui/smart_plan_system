import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import PlanDetail from '../views/PlanDetail.vue'
import PlanForm from '../views/PlanForm.vue'
import MapView from '../views/MapView.vue'
import ItineraryView from '../views/ItineraryView.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/plan/:id',
    name: 'PlanDetail',
    component: PlanDetail
  },
  {
    path: '/create',
    name: 'PlanForm',
    component: PlanForm
  },
  {
    path: '/edit/:id',
    name: 'EditPlan',
    component: PlanForm
  },
  {
    path: '/map',
    name: 'MapView',
    component: MapView
  },
  {
    path: '/plan/:id/itinerary',
    name: 'ItineraryView',
    component: ItineraryView
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
